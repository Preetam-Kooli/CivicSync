import { query } from '../config/db.js';

const SELECT_ISSUE = `
  SELECT i.id, i.title, i.description, i.severity, i.status, i.address_text,
         i.photo_url, i.after_photo_url, i.duplicate_count, i.priority_score,
         i.sla_deadline, i.escalation_level, i.created_at, i.resolved_at,
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
    `${SELECT_ISSUE} WHERE i.reporter_id = $1 ORDER BY i.created_at DESC LIMIT 100`,
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