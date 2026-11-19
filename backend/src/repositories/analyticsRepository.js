import { query } from '../config/db.js';

const num = (v) => (v === null || v === undefined ? null : Number(v));
// $1 is the department filter (null = everything)
const FILTER = '($1::module_type IS NULL OR module = $1::module_type)';
const METRICS = `count(*)::int AS total,
       count(*) FILTER (WHERE status <> 'resolved')::int AS open,
       count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
       round(avg(first_response_hours)::numeric, 1) AS avg_first_response_hours,
       round(avg(resolution_hours)::numeric, 1) AS avg_resolution_hours`;
const LAST_12_MONTHS = `SELECT generate_series(date_trunc('month', now()) - interval '11 months',
                                              date_trunc('month', now()), interval '1 month')::date AS month`;

// LIVE numbers for admins (accurate to the second, scoped by department)
export async function adminAnalytics(module) {
  const p = [module];
  const [kpi, byModule, byStatus, byWard, monthly] = await Promise.all([
    query(
      `SELECT ${METRICS},
              count(*) FILTER (WHERE status <> 'resolved' AND escalation_level > 0)::int AS escalated,
              round(100.0 * count(*) FILTER (WHERE met_sla)
                    / NULLIF(count(*) FILTER (WHERE status = 'resolved'), 0), 1) AS sla_met_pct
         FROM v_issue_metrics WHERE ${FILTER}`, p),
    query(`SELECT module, ${METRICS} FROM v_issue_metrics WHERE ${FILTER} GROUP BY module ORDER BY module`, p),
    query(`SELECT status, count(*)::int AS count FROM v_issue_metrics WHERE ${FILTER} GROUP BY status`, p),
    query(
      `SELECT COALESCE(ward, 'Unassigned') AS ward, count(*)::int AS total,
              count(*) FILTER (WHERE status <> 'resolved')::int AS open,
              count(*) FILTER (WHERE status = 'resolved')::int AS resolved
         FROM v_issue_metrics WHERE ${FILTER} GROUP BY 1 ORDER BY total DESC, ward LIMIT 12`, p),
    query(
      `WITH months AS (${LAST_12_MONTHS}),
            rep AS (SELECT date_trunc('month', created_at)::date AS month, count(*)::int AS n
                      FROM v_issue_metrics WHERE ${FILTER} GROUP BY 1),
            res AS (SELECT date_trunc('month', resolved_at)::date AS month, count(*)::int AS n
                      FROM v_issue_metrics WHERE resolved_at IS NOT NULL AND ${FILTER} GROUP BY 1)
       SELECT to_char(m.month, 'YYYY-MM') AS month, COALESCE(rep.n, 0) AS reported, COALESCE(res.n, 0) AS resolved
         FROM months m LEFT JOIN rep ON rep.month = m.month LEFT JOIN res ON res.month = m.month
        ORDER BY m.month`, p),
  ]);

  const k = kpi.rows[0];
  return {
    kpis: {
      total: k.total, open: k.open, resolved: k.resolved, escalated: k.escalated,
      avgFirstResponseHours: num(k.avg_first_response_hours),
      avgResolutionHours: num(k.avg_resolution_hours),
      slaMetPct: num(k.sla_met_pct),
    },
    byModule: byModule.rows.map((r) => ({
      module: r.module, total: r.total, open: r.open, resolved: r.resolved,
      avgFirstResponseHours: num(r.avg_first_response_hours),
      avgResolutionHours: num(r.avg_resolution_hours),
    })),
    byStatus: byStatus.rows,
    byWard: byWard.rows,
    monthly: monthly.rows,
  };
}

// PRE-COMPUTED numbers for the public page (read from the materialized views)
export async function publicTransparency() {
  const [stats, modules, monthly, wards] = await Promise.all([
    query('SELECT * FROM mv_public_stats'),
    query('SELECT * FROM mv_module_stats ORDER BY module'),
    query(
      `WITH months AS (${LAST_12_MONTHS})
       SELECT to_char(m.month, 'YYYY-MM') AS month,
              COALESCE(t.reported, 0)::int AS reported, COALESCE(t.resolved, 0)::int AS resolved
         FROM months m
         LEFT JOIN (SELECT month, sum(reported) AS reported, sum(resolved) AS resolved
                      FROM mv_monthly_trends GROUP BY month) t ON t.month = m.month
        ORDER BY m.month`),
    query(
      `SELECT * FROM mv_ward_leaderboard
        ORDER BY (total >= 3) DESC, resolution_rate DESC, avg_resolution_hours NULLS LAST, ward`),
  ]);

  const s = stats.rows[0];
  let rank = 0;
  return {
    refreshedAt: s.refreshed_at,
    totals: {
      reported: s.reported, open: s.open, resolved: s.resolved, confirmed: s.confirmed,
      avgResolutionHours: num(s.avg_resolution_hours),
      medianResolutionHours: num(s.median_resolution_hours),
      slaMetPct: num(s.sla_met_pct),
    },
    byModule: modules.rows.map((r) => ({
      module: r.module, total: r.total, open: r.open, resolved: r.resolved,
      avgResolutionHours: num(r.avg_resolution_hours),
    })),
    monthly: monthly.rows,
    // Wards with fewer than 3 reports are listed but not ranked (too little data to be fair)
    wards: wards.rows.map((r) => ({
      rank: r.total >= 3 ? ++rank : null,
      ward: r.ward, total: r.total, resolved: r.resolved, open: r.open,
      avgResolutionHours: num(r.avg_resolution_hours),
      resolutionRate: num(r.resolution_rate),
    })),
  };
}

// Hotspots: snap every report to a square grid and count per cell.
// ST_SnapToGrid makes ONLY the occupied cells. (ST_SquareGrid would build every empty cell in
// the bounding box too: one wrong coordinate could freeze the database.)
// 3857 is a flat map projection measured in metres (about 2.6% off at this latitude, fine here).
export async function hotspots({ days, cell, module, minIssues }) {
  const { rows } = await query(
    `WITH pts AS (
       SELECT c.module, c.name AS category, i.created_at, i.duplicate_count,
              ST_Transform(i.location::geometry, 3857) AS g
         FROM issues i JOIN categories c ON c.id = i.category_id
        WHERE i.created_at >= now() - make_interval(days => $1::int)
          AND ($3::module_type IS NULL OR c.module = $3::module_type)
     ), cells AS (
       SELECT ST_SnapToGrid(g, $2::float8) AS node,
              count(*)::int AS issues,
              sum(duplicate_count)::int AS reports,
              count(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS recent,
              count(DISTINCT date_trunc('month', created_at))::int AS months_active,
              mode() WITHIN GROUP (ORDER BY category) AS top_category,
              mode() WITHIN GROUP (ORDER BY module) AS top_module
         FROM pts GROUP BY 1
     )
     SELECT issues, reports, recent, months_active, top_category, top_module,
            (issues + 2 * recent + 3 * (months_active - 1)) AS score,
            ST_AsGeoJSON(ST_Transform(ST_MakeEnvelope(
              ST_X(node) - $2::float8 / 2, ST_Y(node) - $2::float8 / 2,
              ST_X(node) + $2::float8 / 2, ST_Y(node) + $2::float8 / 2, 3857), 4326))::json AS geometry
       FROM cells
      WHERE issues >= $4::int
      ORDER BY score DESC, issues DESC
      LIMIT 100`,
    [days, cell, module, minIssues]
  );

  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      geometry: r.geometry,
      properties: {
        issues: r.issues, reports: r.reports, recent: r.recent, monthsActive: r.months_active,
        topCategory: r.top_category, topModule: r.top_module, score: r.score,
        recurring: r.months_active >= 2,
      },
    })),
  };
}

// ---------- Open data (anonymised: no title, description, photo, reporter or exact location) ----------

export async function openIssues({ module, status, from, to, limit, offset }) {
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (module) add('c.module = ?::module_type', module);
  if (status) add('i.status = ?::issue_status', status);
  if (from) add('i.created_at >= ?::date', from);
  if (to) add('i.created_at < (?::date + 1)', to);
  params.push(limit, offset);

  const { rows } = await query(
    `SELECT i.id, c.module, c.name AS category, i.status, i.severity,
            i.duplicate_count AS reports, i.ward, i.created_at, i.resolved_at,
            round(ST_Y(i.location::geometry)::numeric, 3) AS lat,
            round(ST_X(i.location::geometry)::numeric, 3) AS lng,
            count(*) OVER() AS total
       FROM issues i JOIN categories c ON c.id = i.category_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY i.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return {
    total: rows.length ? Number(rows[0].total) : 0,
    items: rows.map((r) => ({
      id: r.id, category: r.category, module: r.module, status: r.status,
      severity: r.severity, reports: r.reports, ward: r.ward,
      createdAt: r.created_at, resolvedAt: r.resolved_at,
      location: { lat: Number(r.lat), lng: Number(r.lng) },
    })),
  };
}

export async function openCategories() {
  const { rows } = await query('SELECT module, name, sla_hours FROM categories ORDER BY module, name');
  return rows.map((r) => ({ module: r.module, name: r.name, slaHours: r.sla_hours }));
}

export async function openMonthly() {
  const { rows } = await query(
    `SELECT to_char(month, 'YYYY-MM') AS month, module, reported, resolved
       FROM mv_monthly_trends ORDER BY month DESC, module`
  );
  return rows;
}