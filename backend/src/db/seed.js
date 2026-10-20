import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';

// DEV ONLY: every seeded account gets this password.
const DEV_PASSWORD = 'Passw0rd!';

const categories = [
  // [module, name, sla_hours]
  ['public_service', 'Helpdesk query', 72],
  ['public_service', 'Document assistance', 120],
  ['streetlight', 'Light not working', 72],
  ['streetlight', 'Flickering or dim', 120],
  ['streetlight', 'Pole damaged', 48],
  ['flood', 'Waterlogging', 6],
  ['flood', 'Drain blocked', 24],
  ['flood', 'Water entering homes', 3],
  ['road', 'Pothole', 168],
  ['road', 'Missing sign', 120],
  ['road', 'Damaged road', 240],
  ['road', 'Accident-prone spot', 72],
  ['fire', 'Fire emergency', 1],
  ['fire', 'Hydrant fault', 48],
  ['fire', 'Blocked access road', 24],
];

const users = [
  // [full_name, email, role, department]
  ['Super Admin', 'superadmin@civicsync.test', 'super_admin', null],
  ['Admin One', 'admin@civicsync.test', 'admin', null],
  ['Public Service Staff', 'staff.public@civicsync.test', 'staff', 'public_service'],
  ['Streetlight Staff', 'staff.streetlight@civicsync.test', 'staff', 'streetlight'],
  ['Flood Staff', 'staff.flood@civicsync.test', 'staff', 'flood'],
  ['Road Staff', 'staff.road@civicsync.test', 'staff', 'road'],
  ['Fire Staff', 'staff.fire@civicsync.test', 'staff', 'fire'],
  ['Vinay Volunteer', 'volunteer@civicsync.test', 'volunteer', null],
  ['Asha Citizen', 'citizen1@civicsync.test', 'citizen', null],
  ['Ravi Citizen', 'citizen2@civicsync.test', 'citizen', null],
  ['Meena Citizen', 'citizen3@civicsync.test', 'citizen', null],
];

// [category, reporter email, title, severity, longitude, latitude, ward, final status, days ago, duplicate_count]
// NOTE: PostGIS wants longitude FIRST, then latitude.
const issues = [
  ['Pothole', 'citizen1@civicsync.test', 'Large pothole on main road', 4, 77.5372, 13.2957, 'Ward 1', 'in_progress', 6, 3],
  ['Pothole', 'citizen2@civicsync.test', 'Pothole outside school gate', 5, 77.5391, 13.2968, 'Ward 2', 'reported', 2, 1],
  ['Damaged road', 'citizen3@civicsync.test', 'Road edge crumbling near bridge', 3, 77.5350, 13.2940, 'Ward 1', 'assigned', 9, 1],
  ['Missing sign', 'citizen1@civicsync.test', 'Stop sign missing at junction', 3, 77.5410, 13.2975, 'Ward 3', 'verified', 4, 1],
  ['Accident-prone spot', 'volunteer@civicsync.test', 'Blind curve near market', 4, 77.5330, 13.2990, 'Ward 3', 'reported', 1, 2],
  ['Light not working', 'citizen2@civicsync.test', 'Street light out on temple road', 2, 77.5365, 13.2950, 'Ward 1', 'resolved', 12, 2],
  ['Light not working', 'citizen3@civicsync.test', 'Three lights out near bus stand', 3, 77.5380, 13.2935, 'Ward 2', 'in_progress', 5, 1],
  ['Flickering or dim', 'citizen1@civicsync.test', 'Flickering light at the park', 1, 77.5400, 13.2960, 'Ward 2', 'reported', 3, 1],
  ['Pole damaged', 'citizen2@civicsync.test', 'Leaning pole after storm', 4, 77.5345, 13.2965, 'Ward 3', 'assigned', 2, 1],
  ['Waterlogging', 'citizen3@civicsync.test', 'Water standing on the lane', 4, 77.5360, 13.2928, 'Ward 1', 'resolved', 15, 4],
  ['Drain blocked', 'citizen1@civicsync.test', 'Blocked drain near market', 3, 77.5335, 13.2985, 'Ward 3', 'in_progress', 3, 2],
  ['Water entering homes', 'citizen2@civicsync.test', 'Water entering ground-floor houses', 5, 77.5420, 13.2920, 'Ward 2', 'verified', 1, 3],
  ['Fire emergency', 'citizen3@civicsync.test', 'Small shed fire near farm', 5, 77.5300, 13.2900, 'Ward 4', 'resolved', 20, 1],
  ['Hydrant fault', 'volunteer@civicsync.test', 'Hydrant leaking near school', 3, 77.5392, 13.2970, 'Ward 2', 'reported', 7, 1],
  ['Blocked access road', 'citizen1@civicsync.test', 'Parked vehicles block fire lane', 2, 77.5355, 13.2945, 'Ward 1', 'assigned', 4, 1],
  ['Helpdesk query', 'citizen2@civicsync.test', 'Help applying for pension scheme', 1, 77.5372, 13.2957, 'Ward 1', 'resolved', 10, 1],
  ['Document assistance', 'citizen3@civicsync.test', 'Documents needed for ration card', 1, 77.5340, 13.2975, 'Ward 3', 'reported', 2, 1],
  ['Pothole', 'citizen1@civicsync.test', 'Pothole at bus stand', 3, 77.5382, 13.2933, 'Ward 2', 'resolved', 25, 1],
  ['Damaged road', 'citizen3@civicsync.test', 'Broken road near the farm', 2, 77.5305, 13.2905, 'Ward 4', 'reported', 6, 1],
  ['Waterlogging', 'citizen2@civicsync.test', 'Waterlogging at the underpass', 3, 77.5400, 13.2900, 'Ward 4', 'reported', 1, 1],
];

// The order an issue moves through. We step through it so every
// issue gets a proper timeline, not a single jump.
const STAGES = ['reported', 'verified', 'assigned', 'in_progress', 'resolved'];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // `npm run seed -- --reset` wipes all data first (dev only!)
    if (process.argv.includes('--reset')) {
      await client.query(
        'TRUNCATE issue_timeline, issues, users, categories RESTART IDENTITY CASCADE'
      );
      console.log('reset   all tables emptied');
    }

    // 1. Categories (skipped if they already exist)
    for (const [module, name, sla] of categories) {
      await client.query(
        `INSERT INTO categories (module, name, sla_hours)
         VALUES ($1, $2, $3) ON CONFLICT (module, name) DO NOTHING`,
        [module, name, sla]
      );
    }
    console.log(`seeded  ${categories.length} categories`);

    // 2. Users (passwords are hashed with bcrypt, never stored as plain text)
    const hash = await bcrypt.hash(DEV_PASSWORD, 10);
    for (const [name, email, role, dept] of users) {
      await client.query(
        `INSERT INTO users (full_name, email, password_hash, role, department, email_verified)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (lower(email)) DO NOTHING`,
        [name, email, hash, role, dept]
      );
    }
    console.log(`seeded  ${users.length} users`);

    // 3. Issues (only if there are none yet, so re-running never duplicates them)
    const existing = await client.query('SELECT count(*)::int AS n FROM issues');
    if (existing.rows[0].n > 0) {
      console.log('skip    issues already exist (use --reset to start over)');
      await client.query('COMMIT');
      return;
    }

    const catRows = (await client.query('SELECT id, module, name, sla_hours FROM categories')).rows;
    const catByName = Object.fromEntries(catRows.map((c) => [c.name, c]));
    const userRows = (await client.query('SELECT id, email, role, department FROM users')).rows;
    const userByEmail = Object.fromEntries(userRows.map((u) => [u.email, u]));
    const staffByDept = Object.fromEntries(
      userRows.filter((u) => u.role === 'staff').map((u) => [u.department, u.id])
    );

    for (const [catName, email, title, sev, lng, lat, ward, finalStatus, daysAgo, dup] of issues) {
      const cat = catByName[catName];
      const reporter = userByEmail[email];
      // Placeholder priority: severity x 3 + duplicates x 2 + days open.
      // The real scoring (with school/hospital proximity) comes in Phase 6.
      const priority = sev * 3 + dup * 2 + daysAgo;

      const inserted = await client.query(
        `INSERT INTO issues
           (category_id, reporter_id, title, severity, location, ward,
            duplicate_count, priority_score, created_at, sla_deadline)
         VALUES ($1, $2, $3, $4,
                 ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
                 $7, $8, $9,
                 now() - make_interval(days => $10),
                 now() - make_interval(days => $10) + make_interval(hours => $11))
         RETURNING id`,
        [cat.id, reporter.id, title, sev, lng, lat, ward, dup, priority, daysAgo, cat.sla_hours]
      );
      const issueId = inserted.rows[0].id;

      // Move through each stage up to the final one. Each UPDATE fires the
      // trigger that writes a timeline row automatically.
      const target = STAGES.indexOf(finalStatus);
      for (let i = 1; i <= target; i++) {
        const stage = STAGES[i];
        const assignee = stage === 'assigned' ? staffByDept[cat.module] : null;
        await client.query(
          `UPDATE issues SET status = $1, assigned_to = COALESCE($2, assigned_to) WHERE id = $3`,
          [stage, assignee, issueId]
        );
      }

      // The trigger stamps resolved_at with "now". For old demo issues, make it
      // look like it was resolved at 60% of the SLA window after being reported.
      if (finalStatus === 'resolved') {
        await client.query(
          `UPDATE issues
              SET resolved_at = created_at + make_interval(hours => $2::int)
            WHERE id = $1`,
          [issueId, Math.max(1, Math.round(cat.sla_hours * 0.6))]
        );
      }
    }
    console.log(`seeded  ${issues.length} issues`);

    await client.query('COMMIT');
    console.log(`Done. Dev password for every seeded account: ${DEV_PASSWORD}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('FAILED  seed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();