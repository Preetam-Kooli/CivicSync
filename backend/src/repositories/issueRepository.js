import { query } from '../config/db.js';

const SELECT_ISSUE = `
  SELECT i.id, i.title, i.description, i.severity, i.status, i.address_text,
         i.photo_url, i.after_photo_url, i.duplicate_count, i.priority_score,
         i.sla_deadline, i.escalation_level, i.created_at, i.resolved_at,
         i.confirmed_at, i.reopen_count,
         ST_Y(i.location::geometry) AS lat, ST_X(i.location::geometry) AS lng,
         c.id AS category_id, c.name AS category_name, c.module,
         au.full_name AS assignee_name
    FROM issues i
    JOIN categories c ON c.id = i.category_id
    LEFT JOIN users au ON au.id = i.assigned_to`;

export const toIssue = (r) => ({
  id: r.id,
  title: r.title,
  description: r.description,
  severity: r.severity,
  status: r.status,
  addressText: r.address_text,
  photoUrl: r.photo_url,
  afterPhotoUrl: r.after_photo_url,
  duplicateCount: r.duplicate_count,
  priorityScore: Number(r.priority_score),
  slaDeadline: r.sla_deadline,
  escalationLevel: r.escalation_level,
  createdAt: r.created_at,
  resolvedAt: r.resolved_at,
  confirmedAt: r.confirmed_at,
  reopenCount: r.reopen_count,
  location: { lat: r.lat, lng: r.lng },
  category: { id: r.category_id, name: r.category_name, module: r.module },
  assigneeName: r.assignee_name,
});

export async function listCategories() {
  const { rows } = await query('SELECT id, module, name, sla_hours FROM categories ORDER BY module, name');
  return rows.map((r) => ({ id: r.id, module: r.module, name: r.name, slaHours: r.sla_hours }));
}

// PostGIS wants longitude FIRST, then latitude
export async function insertIssue(db, d) {
  const { rows } = await db.query(
    `INSERT INTO issues (category_id, reporter_id, title, description, severity, location, address_text, photo_url)
     VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, $8, $9)
     RETURNING id`,
    [d.categoryId, d.reporterId, d.title, d.description || null, d.severity, d.longitude, d.latitude, d.addressText || null, d.photoUrl]
  );
  return rows[0].id;
}

export async function getById(db, id) {
  const { rows } = await db.query(`${SELECT_ISSUE} WHERE i.id = $1`, [id]);
  return rows[0] ? toIssue(rows[0]) : null;
}

export async function listForReporter(userId) {
  const { rows } = await query(
    `${SELECT_ISSUE} WHERE i.id IN (SELECT issue_id FROM issue_reporters WHERE user_id = $1) ORDER BY i.created_at DESC LIMIT 100`,
    [userId]
  );
  return rows.map(toIssue);
}

// Admin list: unresolved first, then by priority. Staff are limited to their own department (scopeModule).
export async function listAdmin({ status, module }, scopeModule) {
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (status) add('i.status = ?::issue_status', status);
  if (module) add('c.module = ?::module_type', module);
  if (scopeModule) add('c.module = ?::module_type', scopeModule);

  const { rows } = await query(
    `${SELECT_ISSUE}
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY (i.status = 'resolved'), i.priority_score DESC, i.created_at
      LIMIT 200`,
    params
  );
  return rows.map(toIssue);
}

// GeoJSON for the map. No reporter details: only what is safe to show.
export async function mapCollection() {
  const { rows } = await query(
    `SELECT i.id, i.title, i.severity, i.status, i.duplicate_count, i.created_at,
            ST_Y(i.location::geometry) AS lat, ST_X(i.location::geometry) AS lng,
            c.name AS category_name, c.module
       FROM issues i JOIN categories c ON c.id = i.category_id
      ORDER BY i.created_at DESC LIMIT 2000`
  );
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id,
        title: r.title,
        category: r.category_name,
        module: r.module,
        status: r.status,
        severity: r.severity,
        duplicateCount: r.duplicate_count,
        createdAt: r.created_at,
      },
    })),
  };
}
// ---------- Phase 6 ----------

// Open issues of the same category within radiusM metres. ST_DWithin on a
// geography column measures real metres. FOR UPDATE locks the matched row.
export async function findNearbyOpen(db, categoryId, lat, lng, radiusM) {
  const { rows } = await db.query(
    `SELECT id, duplicate_count FROM issues
      WHERE category_id = $1 AND status <> 'resolved'
        AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, $4)
      ORDER BY ST_Distance(location, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography)
      LIMIT 1
      FOR UPDATE`,
    [categoryId, lat, lng, radiusM]
  );
  return rows[0] || null;
}

// false when this person had already reported the issue
export async function addReporter(db, issueId, userId) {
  const { rowCount } = await db.query(
    'INSERT INTO issue_reporters (issue_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [issueId, userId]
  );
  return rowCount === 1;
}

export async function isReporter(db, issueId, userId) {
  const { rowCount } = await db.query(
    'SELECT 1 FROM issue_reporters WHERE issue_id = $1 AND user_id = $2',
    [issueId, userId]
  );
  return rowCount === 1;
}

// duplicate_count + 1 also makes the database recalculate the priority score (trigger)
export async function bumpDuplicate(db, issueId, photoUrl) {
  await db.query(
    'UPDATE issues SET duplicate_count = duplicate_count + 1, photo_url = COALESCE(photo_url, $2) WHERE id = $1',
    [issueId, photoUrl]
  );
}

export async function addTimelineNote(db, issueId, userId, note) {
  await db.query(
    `INSERT INTO issue_timeline (issue_id, from_status, to_status, changed_by, note)
     SELECT id, status, status, $2, $3 FROM issues WHERE id = $1`,
    [issueId, userId, note]
  );
}

// Tells the timeline trigger WHO made the next status change, and an optional note.
// "true" = this value lasts only for the current transaction.
export async function setActor(db, userId, note) {
  await db.query("SELECT set_config('app.user_id', $1, true), set_config('app.note', $2, true)", [
    String(userId),
    note || '',
  ]);
}

export async function getTimeline(db, issueId, withNames) {
  const { rows } = await db.query(
    `SELECT t.id, t.from_status, t.to_status, t.note, t.created_at, u.full_name
       FROM issue_timeline t LEFT JOIN users u ON u.id = t.changed_by
      WHERE t.issue_id = $1 ORDER BY t.id`,
    [issueId]
  );
  return rows.map((r) => ({
    id: r.id,
    from: r.from_status,
    to: r.to_status,
    note: r.note,
    at: r.created_at,
    by: withNames ? r.full_name : null, // citizens never see staff names
  }));
}

export async function lockForUpdate(db, id) {
  const { rows } = await db.query(
    `SELECT i.id, i.status, i.confirmed_at, c.module
       FROM issues i JOIN categories c ON c.id = i.category_id
      WHERE i.id = $1 FOR UPDATE OF i`,
    [id]
  );
  return rows[0] || null;
}

export async function findEligibleAssignee(db, userId, module) {
  const { rows } = await db.query(
    `SELECT id, full_name FROM users
      WHERE id = $1 AND is_active
        AND (role IN ('admin', 'super_admin') OR (role = 'staff' AND department = $2::module_type))`,
    [userId, module]
  );
  return rows[0] || null;
}

export async function listAssignees(db, module) {
  const { rows } = await db.query(
    `SELECT id, full_name, role FROM users
      WHERE is_active
        AND (role IN ('admin', 'super_admin') OR (role = 'staff' AND department = $1::module_type))
      ORDER BY role, full_name`,
    [module]
  );
  return rows.map((r) => ({ id: r.id, fullName: r.full_name, role: r.role }));
}

export async function applyTransition(db, id, { status, assigneeId, afterPhotoUrl }) {
  await db.query(
    `UPDATE issues
        SET status = $2::issue_status,
            assigned_to = COALESCE($3, assigned_to),
            after_photo_url = COALESCE($4, after_photo_url)
      WHERE id = $1`,
    [id, status, assigneeId ?? null, afterPhotoUrl ?? null]
  );
}

export async function reassign(db, id, assigneeId) {
  await db.query('UPDATE issues SET assigned_to = $2 WHERE id = $1', [id, assigneeId]);
}

export async function markConfirmed(db, id) {
  await db.query('UPDATE issues SET confirmed_at = now() WHERE id = $1', [id]);
}

// Reopen: back to "in progress", with a fresh SLA window and no escalation
export async function reopen(db, id) {
  await db.query(
    `UPDATE issues
        SET status = 'in_progress',
            reopen_count = reopen_count + 1,
            after_photo_url = NULL,
            escalation_level = 0,
            sla_deadline = now() + make_interval(hours => (SELECT sla_hours FROM categories WHERE id = issues.category_id))
      WHERE id = $1`,
    [id]
  );
}

// Search, status counts and paging for the redesigned Issues page
export async function listAdminPaged({ status, module, q, limit, offset }, scopeModule) {
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (module) add('c.module = ?::module_type', module);
  if (scopeModule) add('c.module = ?::module_type', scopeModule);
  if (q) {
    const needle = q.trim().replace(/^#?cs-?/i, '');
    params.push(`%${needle.replace(/[\\%_]/g, '\\$&')}%`);
    const like = `$${params.length}`;
    params.push(needle);
    where.push(`(i.title ILIKE ${like} OR i.address_text ILIKE ${like} OR i.ward ILIKE ${like} OR i.id::text = $${params.length})`);
  }
  const baseWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countRes = await query(
    `SELECT i.status, count(*)::int AS n FROM issues i JOIN categories c ON c.id = i.category_id ${baseWhere} GROUP BY i.status`,
    params
  );
  const counts = Object.fromEntries(countRes.rows.map((r) => [r.status, r.n]));
  const all = Object.values(counts).reduce((a, b) => a + b, 0);

  const listParams = [...params];
  let listWhere = baseWhere;
  if (status) {
    listParams.push(status);
    listWhere += `${baseWhere ? ' AND' : 'WHERE'} i.status = $${listParams.length}::issue_status`;
  }
  listParams.push(limit, offset);
  const { rows } = await query(
    `${SELECT_ISSUE} ${listWhere}
      ORDER BY (i.status = 'resolved'), i.priority_score DESC, i.created_at
      LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );
  return { issues: rows.map(toIssue), total: status ? counts[status] || 0 : all, counts: { all, ...counts } };
}