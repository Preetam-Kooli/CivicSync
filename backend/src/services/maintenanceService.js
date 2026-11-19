import { query, withTransaction } from '../config/db.js';

// Escalation ladder: 1st missed deadline -> an Admin, 2nd -> a Super Admin
const LEVEL_ROLE = ['admin', 'super_admin'];

async function escalateOverdue() {
  return withTransaction(async (client) => {
    // SKIP LOCKED: if another run holds a row, skip it instead of waiting
    const { rows } = await client.query(
      `SELECT i.id, i.escalation_level, c.sla_hours
         FROM issues i JOIN categories c ON c.id = i.category_id
        WHERE i.status <> 'resolved' AND i.sla_deadline < now() AND i.escalation_level < 2
        ORDER BY i.id
        FOR UPDATE OF i SKIP LOCKED`
    );

    for (const r of rows) {
      const role = LEVEL_ROLE[r.escalation_level];
      const officer = (
        await client.query('SELECT id, full_name FROM users WHERE role = $1::user_role AND is_active ORDER BY id LIMIT 1', [role])
      ).rows[0];

      await client.query(
        `UPDATE issues
            SET escalation_level = escalation_level + 1,
                sla_deadline = now() + make_interval(hours => $2::int),
                assigned_to = COALESCE($3, assigned_to)
          WHERE id = $1`,
        [r.id, r.sla_hours, officer?.id ?? null]
      );
      const who = role === 'admin' ? 'an Admin' : 'a Super Admin';
      await client.query(
        `INSERT INTO issue_timeline (issue_id, from_status, to_status, note)
         SELECT id, status, status, $2 FROM issues WHERE id = $1`,
        [r.id, `SLA missed: escalated to ${who}${officer ? ` (${officer.full_name})` : ''}`]
      );
    }
    return rows.length;
  });
}

// A fix the reporter never answered is accepted after 7 days
async function autoConfirmResolved() {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE issues SET confirmed_at = now()
        WHERE status = 'resolved' AND confirmed_at IS NULL AND resolved_at < now() - interval '7 days'
        RETURNING id`
    );
    for (const r of rows) {
      await client.query(
        `INSERT INTO issue_timeline (issue_id, from_status, to_status, note)
         SELECT id, status, status, 'Automatically confirmed after 7 days without a reply' FROM issues WHERE id = $1`,
        [r.id]
      );
    }
    return rows.length;
  });
}

// "Days open" grows with time, so open issues are rescored. Only changed rows are written.
async function refreshPriorities() {
  const { rowCount } = await query(
    `UPDATE issues i SET priority_score = s.score
       FROM (SELECT id, issue_priority(severity, duplicate_count, created_at, location) AS score
               FROM issues WHERE status <> 'resolved') s
      WHERE i.id = s.id AND i.priority_score IS DISTINCT FROM s.score`
  );
  return rowCount;
}

// ---------- Analytics views (Phase 7) ----------
const ANALYTICS_VIEWS = ['mv_public_stats', 'mv_module_stats', 'mv_monthly_trends', 'mv_ward_leaderboard'];
const ANALYTICS_EVERY_MS = 10 * 60 * 1000;
let lastAnalytics = 0;
let analyticsRunning = null;

// CONCURRENTLY: readers keep seeing the old numbers until the new ones are ready
async function refreshAnalytics() {
  for (const view of ANALYTICS_VIEWS) {
    await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
  }
  lastAnalytics = Date.now();
}

export async function ensureAnalyticsFresh() {
  if (Date.now() - lastAnalytics < ANALYTICS_EVERY_MS) return;
  if (!analyticsRunning) {
    analyticsRunning = refreshAnalytics()
      .catch((err) => console.error('[analytics] refresh failed:', err.message))
      .finally(() => {
        analyticsRunning = null;
      });
  }
  await analyticsRunning;
}

let running = null;
let lastRun = 0;

export async function runMaintenance(source = 'manual') {
  if (running) return running; // never two runs at once
  running = (async () => {
    try {
      const result = {
        escalated: await escalateOverdue(),
        confirmed: await autoConfirmResolved(),
        reprioritised: await refreshPriorities(),
      };
      await ensureAnalyticsFresh();
      lastRun = Date.now();
      if (result.escalated || result.confirmed) console.log(`[maintenance:${source}]`, result);
      return result;
    } catch (err) {
      console.error('[maintenance] failed:', err.message);
      return null;
    } finally {
      running = null;
    }
  })();
  return running;
}

// The free server sleeps, so the timer cannot be trusted alone. Admin pages call this
// so overdue issues are always checked when someone actually looks.
export async function ensureFresh() {
  if (Date.now() - lastRun > 60_000) await runMaintenance('lazy');
}