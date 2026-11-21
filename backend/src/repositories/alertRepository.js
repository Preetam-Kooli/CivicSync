import { query } from '../config/db.js';

const SEVERITY_ORDER = `CASE b.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END`;
const ACTIVE = `b.withdrawn_at IS NULL AND b.starts_at <= now() AND b.expires_at > now()`;

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
  locationName: r.location_name ?? null,
  hasArea: r.radius_m != null,
  radiusM: r.radius_m ?? null,
});

// What the banner shows: not withdrawn, already started, not yet expired. Worst first.
export async function listActive() {
  const { rows } = await query(
    `SELECT b.* FROM broadcasts b WHERE ${ACTIVE} ORDER BY ${SEVERITY_ORDER}, b.created_at DESC LIMIT 10`
  );
  return rows.map(toAlert);
}

export async function listRecent() {
  const { rows } = await query(
    `SELECT b.*, u.full_name AS posted_by FROM broadcasts b LEFT JOIN users u ON u.id = b.created_by
      ORDER BY b.id DESC LIMIT 50`
  );
  return rows.map(toAlert);
}

export async function insertManual({ kind, severity, title, message, hours, createdBy, locationName, latitude, longitude, radiusM }) {
  const hasPin = latitude !== undefined && longitude !== undefined;
  const { rows } = await query(
    `INSERT INTO broadcasts (kind, severity, title, message, created_by, expires_at, location_name, location, radius_m)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(hours => $6::int), $7,
             CASE WHEN $8::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($8::float8, $9::float8), 4326)::geography END,
             $10)
     RETURNING id, title`,
    [kind, severity, title, message, createdBy, hours, locationName || null,
      hasPin ? longitude : null, hasPin ? latitude : null, hasPin ? radiusM || 500 : null]
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

// Active announcements that have a pin, as map areas (a circle of radius_m metres around the pin)
export async function areasGeoJSON() {
  const { rows } = await query(
    `SELECT b.id, b.kind, b.severity, b.title, b.message, b.location_name,
            ST_AsGeoJSON(ST_Buffer(b.location, b.radius_m)::geometry)::json AS geometry
       FROM broadcasts b WHERE b.location IS NOT NULL AND ${ACTIVE}`
  );
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      geometry: r.geometry,
      properties: { id: r.id, kind: r.kind, severity: r.severity, title: r.title, message: r.message, locationName: r.location_name },
    })),
  };
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
        forecastMm: r.forecast_mm === null ? null : Number(r.forecast_mm), checkedAt: r.checked_at,
      },
    })),
  };
}

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

// One live automatic alert per zone: create it, refresh it, or withdraw it
export async function syncWeatherAlert(zone, status, mm) {
  if (status === 'normal') {
    await query(
      `UPDATE broadcasts SET withdrawn_at = now() WHERE source = 'weather' AND zone_id = $1 AND withdrawn_at IS NULL`,
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
        SET severity = $2, title = $3, message = $4, location_name = $5, expires_at = now() + interval '3 hours'
      WHERE source = 'weather' AND zone_id = $1 AND withdrawn_at IS NULL`,
    [zone.id, severity, title, message, zone.name]
  );
  if (updated.rowCount === 0) {
    await query(
      `INSERT INTO broadcasts (kind, severity, title, message, source, zone_id, location_name, expires_at)
       VALUES ('flood', $1, $2, $3, 'weather', $4, $5, now() + interval '3 hours')`,
      [severity, title, message, zone.id, zone.name]
    );
  }
}