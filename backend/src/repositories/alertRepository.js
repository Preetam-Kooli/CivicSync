import { query } from '../config/db.js';

const SEVERITY_ORDER = `CASE b.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END`;

const toAlert = (r) => ({
  id: r.id,
  kind: r.kind,
  severity: r.severity,
  title: r.title,
  message: r.message,
  source: r.source,
  startsAt: r.starts_at,
  expiresAt: r.expires_at,
  withdrawnAt: r.withdrawn_at,
  postedBy: r.posted_by ?? null,
});

// What the banner shows: not withdrawn, already started, not yet expired. Worst first.
export async function listActive() {
  const { rows } = await query(
    `SELECT b.* FROM broadcasts b
      WHERE b.withdrawn_at IS NULL AND b.starts_at <= now() AND b.expires_at > now()
      ORDER BY ${SEVERITY_ORDER}, b.created_at DESC
      LIMIT 10`
  );
  return rows.map(toAlert);
}

export async function listRecent() {
  const { rows } = await query(
    `SELECT b.*, u.full_name AS posted_by
       FROM broadcasts b LEFT JOIN users u ON u.id = b.created_by
      ORDER BY b.id DESC LIMIT 50`
  );
  return rows.map(toAlert);
}

export async function insertManual({ kind, severity, title, message, hours, createdBy }) {
  const { rows } = await query(
    `INSERT INTO broadcasts (kind, severity, title, message, created_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(hours => $6::int))
     RETURNING id, title`,
    [kind, severity, title, message, createdBy, hours]
  );
  return rows[0];
}

export async function withdraw(id) {
  const { rows } = await query(
    'UPDATE broadcasts SET withdrawn_at = now() WHERE id = $1 AND withdrawn_at IS NULL RETURNING title',
    [id]
  );
  return rows[0] || null;
}

// ---------- Flood zones ----------

export async function listZones() {
  const { rows } = await query(
    `SELECT id, name, watch_mm, high_mm, forecast_mm, status, checked_at FROM flood_zones ORDER BY name`
  );
  return rows.map((r) => ({
    id: r.id, name: r.name, watchMm: Number(r.watch_mm), highMm: Number(r.high_mm),
    forecastMm: r.forecast_mm === null ? null : Number(r.forecast_mm),
    status: r.status, checkedAt: r.checked_at,
  }));
}

export async function zonesGeoJSON() {
  const { rows } = await query(
    `SELECT id, name, status, forecast_mm, checked_at, ST_AsGeoJSON(boundary)::json AS geometry FROM flood_zones`
  );
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      geometry: r.geometry,
      properties: {
        id: r.id, name: r.name, status: r.status,
        forecastMm: r.forecast_mm === null ? null : Number(r.forecast_mm),
        checkedAt: r.checked_at,
      },
    })),
  };
}

// The weather check queries the forecast at each zone's centre point
export async function zonesForCheck() {
  const { rows } = await query(
    `SELECT id, name, watch_mm, high_mm,
            ST_Y(ST_Centroid(boundary::geometry)) AS lat, ST_X(ST_Centroid(boundary::geometry)) AS lng
       FROM flood_zones ORDER BY id`
  );
  return rows.map((r) => ({ ...r, lat: Number(r.lat), lng: Number(r.lng) }));
}

export async function saveForecast(id, mm, status) {
  await query('UPDATE flood_zones SET forecast_mm = $2, status = $3::zone_status, checked_at = now() WHERE id = $1', [id, mm, status]);
}

// Keeps exactly one live automatic alert per zone: create it, refresh it, or withdraw it.
// Every refresh pushes the expiry 3 hours ahead, so if the checks ever stop, the alert expires by itself.
export async function syncWeatherAlert(zone, status, mm) {
  if (status === 'normal') {
    await query(
      `UPDATE broadcasts SET withdrawn_at = now()
        WHERE source = 'weather' AND zone_id = $1 AND withdrawn_at IS NULL`,
      [zone.id]
    );
    return;
  }
  const high = status === 'high';
  const severity = high ? 'critical' : 'warning';
  const title = high ? `Flood risk: ${zone.name}` : `Heavy rain watch: ${zone.name}`;
  const message = high
    ? `About ${mm} mm of rain is forecast in the next 24 hours. Avoid low-lying roads and underpasses, move vehicles and valuables to higher ground, and report waterlogging in the app.`
    : `About ${mm} mm of rain is forecast in the next 24 hours. Keep drains clear and be ready to avoid low-lying areas.`;

  const updated = await query(
    `UPDATE broadcasts
        SET severity = $2, title = $3, message = $4, expires_at = now() + interval '3 hours'
      WHERE source = 'weather' AND zone_id = $1 AND withdrawn_at IS NULL`,
    [zone.id, severity, title, message]
  );
  if (updated.rowCount === 0) {
    await query(
      `INSERT INTO broadcasts (kind, severity, title, message, source, zone_id, expires_at)
       VALUES ('flood', $1, $2, $3, 'weather', $4, now() + interval '3 hours')`,
      [severity, title, message, zone.id]
    );
  }
}