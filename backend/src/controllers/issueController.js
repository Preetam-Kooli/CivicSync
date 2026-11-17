import * as issueService from '../services/issueService.js';
import { AppError } from '../utils/AppError.js';

const metaFrom = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });
const actorFrom = (req) => ({
  userId: req.auth.userId,
  role: req.auth.role,
  department: req.auth.user.department,
});

function parseId(value) {
  if (!/^\d{1,18}$/.test(value)) throw new AppError(400, 'Invalid id');
  return value;
}

// ----- Citizens -----
export async function create(req, res) {
  res.status(201).json(await issueService.createIssue(req.body, req.auth.userId, req.file));
}
export async function listMine(req, res) {
  res.json({ issues: await issueService.listMine(req.auth.userId) });
}
export async function getMine(req, res) {
  res.json(await issueService.getMine(parseId(req.params.id), req.auth.userId));
}
export async function confirm(req, res) {
  await issueService.confirmFix(parseId(req.params.id), req.auth.userId);
  res.json({ message: 'Thank you for confirming' });
}
export async function reopen(req, res) {
  await issueService.reopenIssue(parseId(req.params.id), req.auth.userId, req.body.note);
  res.json({ message: 'The issue was reopened' });
}

// ----- Shared -----
export async function categories(req, res) {
  res.json({ categories: await issueService.listCategories() });
}
export async function mapData(req, res) {
  res.json(await issueService.mapCollection());
}

// ----- Admin and staff -----
export async function adminList(req, res) {
  res.json({ issues: await issueService.adminList(req.query, actorFrom(req)) });
}
export async function adminDetail(req, res) {
  res.json(await issueService.adminDetail(parseId(req.params.id), actorFrom(req)));
}
export async function adminTransition(req, res) {
  await issueService.transition(parseId(req.params.id), req.body, actorFrom(req), req.file, metaFrom(req));
  res.json({ message: 'Issue updated' });
}