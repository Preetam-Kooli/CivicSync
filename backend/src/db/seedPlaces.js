import 'dotenv/config';
import { pool } from '../config/db.js';

// [kind, name, longitude, latitude]
const PLACES = [
  ['school', 'Government Primary School', 77.5391, 13.2968],
  ['hospital', 'Community Health Centre', 77.536, 13.2928],
  ['school', 'High School', 77.533, 13.299],
];

// [name, longitude, latitude]: demo ward centres around the seed data.
// For your real area, replace these with your real villages or wards.
const WARDS = [
  ['Ward 1', 77.536, 13.2945],
  ['Ward 2', 77.5395, 13.2965],
  ['Ward 3', 77.5338, 13.298],
  ['Ward 4', 77.5305, 13.2905],
];

async function seedPlaces() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM sensitive_places');
  if (rows[0].n > 0) return console.log('skip    places already exist');
  for (const [kind, name, lng, lat] of PLACES) {
    await pool.query(
      `INSERT INTO sensitive_places (kind, name, location)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography)`,
      [kind, name, lng, lat]
    );
  }
  console.log(`added   ${PLACES.length} demo places`);
}

async function seedWards() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM wards');
  if (rows[0].n === 0) {
    for (const [name, lng, lat] of WARDS) {
      await pool.query(
        `INSERT INTO wards (name, center) VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography)`,
        [name, lng, lat]
      );
    }
    console.log(`added   ${WARDS.length} demo wards`);
  } else {
    console.log('skip    wards already exist');
  }
  const r = await pool.query(
    `UPDATE issues i
        SET ward = (SELECT w.name FROM wards w
                     WHERE ST_DWithin(w.center, i.location, 15000)
                     ORDER BY w.center <-> i.location LIMIT 1)
      WHERE i.ward IS NULL`
  );
  console.log(`checked ${r.rowCount} issues without a ward`);
}

async function refreshScores() {
  const r = await pool.query(
    `UPDATE issues SET priority_score = issue_priority(severity, duplicate_count, created_at, location)
      WHERE status <> 'resolved'`
  );
  console.log(`updated priority of ${r.rowCount} open issues`);
  for (const view of ['mv_public_stats', 'mv_module_stats', 'mv_monthly_trends', 'mv_ward_leaderboard']) {
    await pool.query(`REFRESH MATERIALIZED VIEW ${view}`);
  }
  console.log('refreshed analytics views');
}

async function main() {
  await seedPlaces();
  await seedWards();
  await refreshScores();
}

main()
  .catch((err) => {
    console.error('FAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());