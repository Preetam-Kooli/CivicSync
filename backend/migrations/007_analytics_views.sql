-- 007: wards, an issue-metrics view, and pre-computed (materialized) analytics

CREATE TABLE wards (
  id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name   TEXT NOT NULL UNIQUE,
  center geography(Point, 4326) NOT NULL
);
CREATE INDEX wards_center_gist ON wards USING GIST (center);

-- A new issue with no ward gets the nearest ward within 15 km.
-- "<->" is the nearest-neighbour operator and uses the GiST index.
CREATE FUNCTION issues_set_ward() RETURNS trigger AS $$
BEGIN
  IF NEW.ward IS NULL THEN
    SELECT w.name INTO NEW.ward
      FROM wards w
     WHERE ST_DWithin(w.center, NEW.location, 15000)
     ORDER BY w.center <-> NEW.location
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_issues_set_ward
  BEFORE INSERT ON issues
  FOR EACH ROW EXECUTE FUNCTION issues_set_ward();

-- One row per issue with the numbers every report needs.
-- A plain VIEW is just a saved query: always current, recalculated every time.
CREATE VIEW v_issue_metrics AS
SELECT i.id, c.module, c.name AS category, i.ward, i.status, i.severity,
       i.duplicate_count AS reports, i.escalation_level,
       i.created_at, i.resolved_at, i.confirmed_at,
       CASE WHEN i.resolved_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (i.resolved_at - i.created_at)) / 3600 END AS resolution_hours,
       (SELECT EXTRACT(EPOCH FROM (min(t.created_at) - i.created_at)) / 3600
          FROM issue_timeline t
         WHERE t.issue_id = i.id AND t.from_status IS NOT NULL AND t.from_status <> t.to_status
       ) AS first_response_hours,
       CASE WHEN i.resolved_at IS NOT NULL
            THEN i.resolved_at <= i.created_at + make_interval(hours => c.sla_hours) END AS met_sla
  FROM issues i JOIN categories c ON c.id = i.category_id;

-- MATERIALIZED views store their result, so reading them is instant and does no work.
-- The price: they are only as fresh as their last REFRESH (the server does it every 10 minutes).
-- Each needs a UNIQUE index so REFRESH ... CONCURRENTLY can update without blocking readers.

CREATE MATERIALIZED VIEW mv_public_stats AS
SELECT 1 AS id,
       count(*)::int AS reported,
       count(*) FILTER (WHERE status <> 'resolved')::int AS open,
       count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
       count(*) FILTER (WHERE confirmed_at IS NOT NULL)::int AS confirmed,
       round(avg(resolution_hours)::numeric, 1) AS avg_resolution_hours,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY resolution_hours))::numeric, 1) AS median_resolution_hours,
       round(100.0 * count(*) FILTER (WHERE met_sla)
             / NULLIF(count(*) FILTER (WHERE status = 'resolved'), 0), 1) AS sla_met_pct,
       now() AS refreshed_at
  FROM v_issue_metrics;
CREATE UNIQUE INDEX mv_public_stats_id ON mv_public_stats (id);

CREATE MATERIALIZED VIEW mv_module_stats AS
SELECT module,
       count(*)::int AS total,
       count(*) FILTER (WHERE status <> 'resolved')::int AS open,
       count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
       round(avg(resolution_hours)::numeric, 1) AS avg_resolution_hours
  FROM v_issue_metrics GROUP BY module;
CREATE UNIQUE INDEX mv_module_stats_module ON mv_module_stats (module);

CREATE MATERIALIZED VIEW mv_monthly_trends AS
WITH rep AS (
  SELECT date_trunc('month', created_at)::date AS month, module, count(*)::int AS reported
    FROM v_issue_metrics GROUP BY 1, 2),
res AS (
  SELECT date_trunc('month', resolved_at)::date AS month, module, count(*)::int AS resolved
    FROM v_issue_metrics WHERE resolved_at IS NOT NULL GROUP BY 1, 2)
SELECT COALESCE(rep.month, res.month) AS month,
       COALESCE(rep.module, res.module) AS module,
       COALESCE(rep.reported, 0) AS reported,
       COALESCE(res.resolved, 0) AS resolved
  FROM rep FULL JOIN res ON rep.month = res.month AND rep.module = res.module;
CREATE UNIQUE INDEX mv_monthly_trends_key ON mv_monthly_trends (month, module);

CREATE MATERIALIZED VIEW mv_ward_leaderboard AS
SELECT COALESCE(ward, 'Unassigned') AS ward,
       count(*)::int AS total,
       count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
       count(*) FILTER (WHERE status <> 'resolved')::int AS open,
       round(avg(resolution_hours)::numeric, 1) AS avg_resolution_hours,
       round(100.0 * count(*) FILTER (WHERE status = 'resolved') / count(*), 1) AS resolution_rate
  FROM v_issue_metrics GROUP BY 1;
CREATE UNIQUE INDEX mv_ward_leaderboard_ward ON mv_ward_leaderboard (ward);