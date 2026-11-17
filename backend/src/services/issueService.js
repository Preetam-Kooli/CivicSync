import { pool, withTransaction } from '../config/db.js';
import * as issueRepo from '../repositories/issueRepository.js';
import * as auditRepo from '../repositories/auditRepository.js';
import { ensureFresh } from './maintenanceService.js';
import { saveImage } from '../utils/imageStore.js';
import { AppError } from '../utils/AppError.js';

const DUPLICATE_RADIUS_M = 75;
// The only allowed forward moves
const NEXT = { reported: 'verified', verified: 'assigned', assigned: 'in_progress', in_progress: 'resolved' };
const STATUSES = new Set(['reported', 'verified', 'assigned', 'in_progress', 'resolved']);
const MODULES = new Set(['public_service', 'streetlight', 'flood', 'road', 'fire']);
const notFound = () => new AppError(404, 'Issue not found');

export const listCategories = () => issueRepo.listCategories();
export const mapCollection = () => issueRepo.mapCollection();
export const listMine = (userId) => issueRepo.listForReporter(userId);

// ---------- Citizens ----------

export async function createIssue(input, reporterId, file) {
  // The slow network upload happens BEFORE the transaction so no lock is held while waiting
  const photoUrl = file ? await saveImage(file.buffer, 'issue') : null;

  try {
    const outcome = await withTransaction(async (client) => {
      // One report at a time per category: two people reporting the same pothole at the
      // same instant cannot both miss each other and create two issues.
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [input.categoryId]);

      const near = await issueRepo.findNearbyOpen(client, input.categoryId, input.latitude, input.longitude, DUPLICATE_RADIUS_M);

      if (!near) {
        const id = await issueRepo.insertIssue(client, { ...input, reporterId, photoUrl });
        return { issueId: id, merged: false, alreadyReported: false };
      }

      if (!(await issueRepo.addReporter(client, near.id, reporterId))) {
        return { issueId: near.id, merged: true, alreadyReported: true };
      }
      await issueRepo.bumpDuplicate(client, near.id, photoUrl);
      await issueRepo.addTimelineNote(client, near.id, reporterId, `Reported again by another citizen (${near.duplicate_count + 1} reports)`);
      return { issueId: near.id, merged: true, alreadyReported: false };
    });

    return {
      issue: await issueRepo.getById(pool, outcome.issueId),
      merged: outcome.merged,
      alreadyReported: outcome.alreadyReported,
    };
  } catch (err) {
    if (err.code === '23503') throw new AppError(400, 'Unknown category');
    throw err;
  }
}

export async function getMine(issueId, userId) {
  const issue = await issueRepo.getById(pool, issueId);
  if (!issue || !(await issueRepo.isReporter(pool, issueId, userId))) throw notFound();
  return {
    issue,
    timeline: await issueRepo.getTimeline(pool, issueId, false),
    canConfirm: issue.status === 'resolved' && !issue.confirmedAt,
  };
}

async function lockResolvedForReporter(client, issueId, userId) {
  const issue = await issueRepo.lockForUpdate(client, issueId);
  if (!issue || !(await issueRepo.isReporter(client, issueId, userId))) throw notFound();
  if (issue.status !== 'resolved' || issue.confirmed_at) {
    throw new AppError(409, 'This issue is not waiting for your confirmation');
  }
}

export async function confirmFix(issueId, userId) {
  await withTransaction(async (client) => {
    await lockResolvedForReporter(client, issueId, userId);
    await issueRepo.markConfirmed(client, issueId);
    await issueRepo.addTimelineNote(client, issueId, userId, 'Citizen confirmed the fix');
  });
}

export async function reopenIssue(issueId, userId, note) {
  await withTransaction(async (client) => {
    await lockResolvedForReporter(client, issueId, userId);
    await issueRepo.setActor(client, userId, note ? `Citizen reopened: ${note}` : 'Citizen reopened: the problem is not fixed');
    await issueRepo.reopen(client, issueId); // the timeline trigger records resolved -> in progress
  });
}

// ---------- Admin and staff ----------

export async function adminList(filters, actor) {
  await ensureFresh(); // overdue issues are escalated when someone looks, even if the timer slept
  const status = STATUSES.has(filters.status) ? filters.status : undefined;
  const module = MODULES.has(filters.module) ? filters.module : undefined;
  const scope = actor.role === 'staff' ? actor.department : null;
  return issueRepo.listAdmin({ status, module }, scope);
}

export async function adminDetail(id, actor) {
  const issue = await issueRepo.getById(pool, id);
  if (!issue || (actor.role === 'staff' && issue.category.module !== actor.department)) throw notFound();
  const [timeline, assignees] = await Promise.all([
    issueRepo.getTimeline(pool, id, true),
    issueRepo.listAssignees(pool, issue.category.module),
  ]);
  return { issue, timeline, assignees, nextStatus: NEXT[issue.status] ?? null };
}

export async function transition(id, { to, assigneeId, note }, actor, file, meta) {
  if (to === 'resolved' && !file) {
    throw new AppError(400, 'An "after" photo is required to resolve an issue');
  }
  const afterPhotoUrl = to === 'resolved' ? await saveImage(file.buffer, 'after') : null;

  await withTransaction(async (client) => {
    const issue = await issueRepo.lockForUpdate(client, id);
    if (!issue || (actor.role === 'staff' && issue.module !== actor.department)) throw notFound();

    const reassigning = to === issue.status && assigneeId && ['assigned', 'in_progress'].includes(to);
    if (!reassigning && NEXT[issue.status] !== to) {
      throw new AppError(409, `An issue cannot move from "${issue.status}" to "${to}"`);
    }

    let assignee = null;
    if (to === 'assigned' || reassigning) {
      if (!assigneeId) throw new AppError(400, 'Choose who to assign this issue to');
      assignee = await issueRepo.findEligibleAssignee(client, assigneeId, issue.module);
      if (!assignee) throw new AppError(400, 'That person cannot be assigned to this issue');
    }

    if (reassigning) {
      await issueRepo.reassign(client, id, assignee.id);
      await issueRepo.addTimelineNote(client, id, actor.userId, `Reassigned to ${assignee.full_name}`);
    } else {
      const text = to === 'assigned' ? `Assigned to ${assignee.full_name}` : note;
      await issueRepo.setActor(client, actor.userId, text);
      await issueRepo.applyTransition(client, id, { status: to, assigneeId: assignee?.id, afterPhotoUrl });
    }
  });

  await auditRepo.record({
    userId: actor.userId,
    portal: 'admin',
    action: `issue_${to}`,
    success: true,
    ...meta,
  });
}