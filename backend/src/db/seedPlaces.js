import 'dotenv/config';
import { pool } from '../config/db.js';

// [kind, name, longitude, latitude]: placed near some seeded issues
const PLACES = [
  ['school', 'Government Primary School', 77.5391, 13.2968],
  ['hospital', 'Community Health Centre', 77.536, 13.2928],
  ['school', 'High School', 77.533, 13.299],
];

async function main() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM sensitive_places');
  if (rows[0].n === 0) {
    for (const [kind, name, lng, lat] of PLACES) {
      await pool.query(
        `INSERT INTO sensitive_places (kind, name, location)
         VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography)`,
        [kind, name, lng, lat]
      );
    }
    console.log(`added   ${PLACES.length} demo places`);
  } else {
    console.log('skip    places already exist');
  }

  const result = await pool.query(
    `UPDATE issues SET priority_score = issue_priority(severity, duplicate_count, created_at, location)
      WHERE status <> 'resolved'`
  );
  console.log(`updated priority of ${result.rowCount} open issues`);
}

main()
  .catch((err) => {
    console.error('FAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
  