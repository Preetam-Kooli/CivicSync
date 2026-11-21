import 'dotenv/config';
import { pool, withTransaction } from '../config/db.js';

const args = process.argv.slice(2);
const REMOVE = args.includes('--remove');
const COUNT = Number(args.find((a) => a.startsWith('--count='))?.split('=')[1] ?? 260);
const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL || '');

if (!isLocal && process.env.ALLOW_DEMO_ON_REMOTE !== 'yes') {
  console.error('Refusing: DATABASE_URL is not localhost. To add demo REPORTS (no accounts are created) to a hosted demo site, set ALLOW_DEMO_ON_REMOTE=yes for that one command.');
  process.exit(1);
}

// A small repeatable random generator: every run tells the same story
function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261120);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + rand() * (b - a);
const weighted = (items) => {
  let r = rand() * items.reduce((t, i) => t + i[1], 0);
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[0][0];
};

const HOUR = 3_600_000;
const NOW = Date.now();
const STAGES = ['reported', 'verified', 'assigned', 'in_progress', 'resolved'];
const MODULE_WEIGHTS = [['road', 30], ['streetlight', 22], ['flood', 20], ['fire', 12], ['public_service', 16]];
const RESOLVE_HOURS = { fire: [0.5, 5], flood: [3, 40], streetlight: [20, 110], road: [40, 200], public_service: [20, 90] };
const STREETS = ['Station Rd', 'Bellary Rd', 'MG Road', 'Market Rd', 'SH74', 'NH648', 'Temple Street', 'School Lane', 'Lake View Rd', 'Bus Stand Rd'];
const NOTES = ['Reported by a resident. Please check as soon as possible.', 'This has been a problem for several days.', 'Many people pass here every day.', 'Needs attention before the next rain.'];
const TITLES = {
  'Pothole': ['Deep pothole on the main road', 'Pothole near the bus stand', 'Potholes after the rain'],
  'Damaged road': ['Road edge crumbling', 'Broken road surface near the bridge'],
  'Missing sign': ['Stop sign missing at the junction', 'Speed limit sign knocked down'],
  'Accident-prone spot': ['Blind curve near the market', 'Unsafe crossing near the school'],
  'Light not working': ['Street light out on the main road', 'Three lights out near the bus stand'],
  'Flickering or dim': ['Flickering light at the park', 'Very dim light on the lane'],
  'Pole damaged': ['Leaning pole after the storm', 'Damaged pole near the temple'],
  'Waterlogging': ['Water standing on the lane', 'Waterlogging at the underpass'],
  'Drain blocked': ['Blocked drain near the market', 'Drain overflowing on the road'],
  'Water entering homes': ['Water entering ground-floor houses'],
  'Fire emergency': ['Small shed fire near the farm', 'Smoke from the dumpyard'],
  'Hydrant fault': ['Hydrant leaking near the school', 'Hydrant cap missing'],
  'Blocked access road': ['Parked vehicles block the fire lane', 'Fallen tree blocks the access road'],
  'Helpdesk query': ['Help applying for the pension scheme'],
  'Document assistance': ['Documents needed for a ration card'],
};
// Problems that keep coming back at the same spot (these make the hotspot map interesting)
const HOT = [
  { i: 0, module: 'road', category: 'Pothole', dx: 0.0012, dy: -0.0008 },
  { i: 1, module: 'flood', category: 'Waterlogging', dx: -0.001, dy: 0.0009 },
  { i: 2, module: 'streetlight', category: 'Light not working', dx: 0.0005, dy: 0.0013 },
];
const FORCED = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4, 5, 6, 6]; // guarantees busy recent days

async function refreshViews() {
  for (const v of ['mv_public_stats', 'mv_module_stats', 'mv_monthly_trends', 'mv_ward_leaderboard']) {
    await pool.query(`REFRESH MATERIALIZED VIEW ${v}`);
  }
}

async function main() {
  if (REMOVE) {
    const r = await pool.query('DELETE FROM issues WHERE is_demo');
    await refreshViews();
    return console.log(`removed ${r.rowCount} demo issues`);
  }

  const wardRows = (await pool.query(
    'SELECT name, ST_X(center::geometry) AS lng, ST_Y(center::geometry) AS lat FROM wards ORDER BY name'
  )).rows.map((r) => ({ name: r.name, lng: Number(r.lng), lat: Number(r.lat) }));
  const wards = wardRows.length ? wardRows : [
    { name: 'Ward 1', lng: 77.536, lat: 13.2945 }, { name: 'Ward 2', lng: 77.5395, lat: 13.2965 },
    { name: 'Ward 3', lng: 77.5338, lat: 13.298 }, { name: 'Ward 4', lng: 77.5305, lat: 13.2905 },
  ];
  const cats = (await pool.query('SELECT id, module, name, sla_hours FROM categories')).rows;
  let citizens = (await pool.query(
    `SELECT id FROM users WHERE role = 'citizen' AND is_active ${isLocal ? "AND email LIKE '%@civicsync.test'" : ''}`
  )).rows.map((r) => r.id);
  if (!citizens.length) {
    citizens = (await pool.query("SELECT id FROM users WHERE role = 'citizen' AND is_active")).rows.map((r) => r.id);
  }
  const officers = (await pool.query(
    "SELECT id, full_name, role, department FROM users WHERE is_active AND role IN ('staff', 'admin', 'super_admin')"
  )).rows;
  if (!cats.length || !citizens.length) {
    console.error('Need the issue categories and at least one citizen account first.');
    process.exitCode = 1;
    return;
  }
  const admin = officers.find((u) => u.role === 'admin');
  const sup = officers.find((u) => u.role === 'super_admin');
  const officerFor = (m) => pick(officers.filter((u) => u.role === 'staff' && u.department === m).concat(officers.length ? [] : [])) ?? pick(officers);
  const hot = HOT.map((h) => ({ ...h, ward: wards[h.i % wards.length] }));

  await withTransaction(async (client) => {
    for (let n = 0; n < COUNT; n++) {
      const daysAgo = n < FORCED.length ? FORCED[n] : Math.floor(180 * Math.pow(rand(), 1.4)); // more recent reports than old ones
      const ageH = Math.max(1.5, daysAgo * 24 + between(0, 22));
      const t0 = NOW - ageH * HOUR;

      const spot = rand() < 0.22 ? pick(hot) : null;
      const mod = spot ? spot.module : weighted(MODULE_WEIGHTS);
      const cat = (spot && cats.find((c) => c.name === spot.category)) || pick(cats.filter((c) => c.module === mod));
      const base = spot ? spot.ward : pick(wards);
      const lng = base.lng + (spot ? spot.dx + between(-0.0004, 0.0004) : between(-0.0035, 0.0035));
      const lat = base.lat + (spot ? spot.dy + between(-0.0004, 0.0004) : between(-0.0035, 0.0035));
      const reporter = pick(citizens);
      const officer = officerFor(cat.module);

      // How long it takes to fix: slower in the past, faster recently (so the trend shows improvement)
      const R = between(...RESOLVE_HOURS[cat.module]) * (0.8 + 0.4 * (daysAgo / 180));
      const resolved = rand() < (ageH < 72 ? 0.2 : ageH < 336 ? 0.6 : 0.9) && R < ageH * 0.97;
      let offsets;
      let final;
      if (resolved) {
        offsets = [0, R * between(0.04, 0.12), R * between(0.15, 0.3), R * between(0.35, 0.55), R];
        final = 4;
      } else {
        const cand = [0, between(0.5, 8), between(2, 24), between(6, 48)].sort((a, b) => a - b);
        final = ageH < 6 ? (rand() < 0.8 ? 0 : 1) : weighted([[0, 3], [1, 2], [2, 2], [3, 2]]);
        while (final > 0 && cand[final] > ageH * 0.9) final--;
        offsets = cand.slice(0, final + 1);
      }

      // Replay the escalation rules the server uses, so overdue issues look genuine
      let level = 0;
      let deadline = t0 + cat.sla_hours * HOUR;
      const escalations = [];
      if (!resolved) {
        while (level < 2 && deadline < NOW) {
          level++;
          const who = level === 1 ? admin : sup;
          escalations.push({
            at: deadline + 5 * 60_000,
            text: `SLA missed: escalated to ${level === 1 ? 'an Admin' : 'a Super Admin'}${who ? ` (${who.full_name})` : ''}`,
          });
          deadline += cat.sla_hours * HOUR;
        }
      }
      const owner = level === 2 ? sup ?? officer : level === 1 ? admin ?? officer : officer;
      const resolvedAt = resolved ? new Date(t0 + R * HOUR) : null;
      const confirmedAt = resolved && NOW - resolvedAt > 7 * 24 * HOUR ? new Date(Math.min(NOW, +resolvedAt + between(1, 3) * 24 * HOUR)) : null;

      const street = pick(STREETS);
      const ins = await client.query(
        `INSERT INTO issues (category_id, reporter_id, title, description, severity, location, address_text, ward, created_at, sla_deadline, is_demo)
         VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, $8, $9, $10, $11, true) RETURNING id`,
        [cat.id, reporter, pick(TITLES[cat.name] ?? [cat.name]), rand() < 0.4 ? pick(NOTES) : null,
          weighted([[1, 12], [2, 25], [3, 33], [4, 22], [5, 8]]), lng, lat, `${street}, ${base.name}`, base.name,
          new Date(t0), new Date(t0 + cat.sla_hours * HOUR)]
      );
      const id = ins.rows[0].id;

      // Each status change fires the timeline trigger; the timestamps are corrected below
      for (let k = 1; k <= final; k++) {
        await client.query(
          'UPDATE issues SET status = $2::issue_status, assigned_to = COALESCE($3, assigned_to) WHERE id = $1',
          [id, STAGES[k], k === 2 ? officer?.id ?? null : null]
        );
      }
      await client.query(
        `UPDATE issues SET resolved_at = $2, confirmed_at = $3, reopen_count = $4, escalation_level = $5,
                           sla_deadline = $6, assigned_to = COALESCE($7, assigned_to) WHERE id = $1`,
        [id, resolvedAt, confirmedAt, resolved && rand() < 0.06 ? 1 : 0, level, new Date(deadline), final >= 2 ? owner?.id ?? null : null]
      );

      const timeline = (await client.query('SELECT id FROM issue_timeline WHERE issue_id = $1 ORDER BY id', [id])).rows;
      const actors = [reporter, (admin ?? officer)?.id, (admin ?? officer)?.id, officer?.id, officer?.id];
      for (let k = 0; k < timeline.length; k++) {
        await client.query('UPDATE issue_timeline SET created_at = $2, changed_by = $3 WHERE id = $1', [
          timeline[k].id, new Date(t0 + (offsets[k] ?? 0) * HOUR), actors[k] ?? null,
        ]);
      }
      for (const e of escalations) {
        await client.query(
          `INSERT INTO issue_timeline (issue_id, from_status, to_status, note, created_at) VALUES ($1, $2::issue_status, $2::issue_status, $3, $4)`,
          [id, STAGES[final], e.text, new Date(e.at)]
        );
      }

      // Some problems are reported by several people
      if (rand() < 0.25) {
        let added = 0;
        for (const other of citizens.filter((c) => c !== reporter).slice(0, 1 + Math.floor(rand() * 3))) {
          const r = await client.query('INSERT INTO issue_reporters (issue_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, other]);
          added += r.rowCount;
        }
        if (added) await client.query('UPDATE issues SET duplicate_count = $2 WHERE id = $1', [id, 1 + added]);
      }
      if ((n + 1) % 50 === 0) console.log(`  ${n + 1} of ${COUNT}…`);
    }
  });

  await refreshViews();
  const s = (await pool.query(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
            count(*) FILTER (WHERE status <> 'resolved')::int AS open,
            count(*) FILTER (WHERE status <> 'resolved' AND sla_deadline < now())::int AS overdue
       FROM issues WHERE is_demo`
  )).rows[0];
  console.log(`added ${s.total} demo issues: ${s.resolved} resolved, ${s.open} open (${s.overdue} overdue)`);
}

main()
  .catch((err) => {
    console.error('FAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());