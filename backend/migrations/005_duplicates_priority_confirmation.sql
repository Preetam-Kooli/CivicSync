-- 005: duplicate reports, priority scoring, citizen confirmation

-- Everyone who reported an issue (the first reporter AND people whose reports were merged)
CREATE TABLE issue_reporters (
  issue_id   BIGINT      NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, user_id)
);
CREATE INDEX issue_reporters_user_idx ON issue_reporters (user_id);

-- Existing issues: their original reporter is a reporter
INSERT INTO issue_reporters (issue_id, user_id)
SELECT id, reporter_id FROM issues
ON CONFLICT DO NOTHING;

-- Every NEW issue automatically registers its first reporter
CREATE FUNCTION issues_add_reporter() RETURNS trigger AS $$
BEGIN
  INSERT INTO issue_reporters (issue_id, user_id) VALUES (NEW.id, NEW.reporter_id)
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_issues_add_reporter
  AFTER INSERT ON issues
  FOR EACH ROW EXECUTE FUNCTION issues_add_reporter();

-- Citizen confirmation of a fix, and how many times an issue was reopened
ALTER TABLE issues
  ADD COLUMN confirmed_at TIMESTAMPTZ,
  ADD COLUMN reopen_count INTEGER NOT NULL DEFAULT 0 CHECK (reopen_count >= 0);

-- Schools and hospitals: issues near them are more urgent
CREATE TYPE place_kind AS ENUM ('school', 'hospital');

CREATE TABLE sensitive_places (
  id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind     place_kind NOT NULL,
  name     TEXT       NOT NULL,
  location geography(Point, 4326) NOT NULL
);
CREATE INDEX sensitive_places_location_gist ON sensitive_places USING GIST (location);

-- PRIORITY = severity x 3 + reports x 2 + proximity x 2 + days open
--   proximity: nearest school/hospital within 100 m = 3, 250 m = 2, 500 m = 1, else 0
--   days open: whole days since reported, capped at 30
-- "ORDER BY location <-> point LIMIT 1" is a nearest-neighbour search that uses the GiST index.
CREATE FUNCTION issue_priority(
  p_severity INT, p_dups INT, p_created TIMESTAMPTZ, p_location geography
) RETURNS NUMERIC AS $$
  SELECT (
    p_severity * 3
    + p_dups * 2
    + 2 * COALESCE((
        SELECT CASE WHEN d <= 100 THEN 3 WHEN d <= 250 THEN 2 WHEN d <= 500 THEN 1 ELSE 0 END
          FROM (SELECT ST_Distance(sp.location, p_location) AS d
                  FROM sensitive_places sp
                 ORDER BY sp.location <-> p_location
                 LIMIT 1) nearest
      ), 0)
    + LEAST(floor(EXTRACT(EPOCH FROM (now() - p_created)) / 86400), 30)
  )::numeric
$$ LANGUAGE sql STABLE;

-- The score recalculates itself whenever severity, report count or location changes
CREATE FUNCTION issues_set_priority() RETURNS trigger AS $$
BEGIN
  NEW.priority_score = issue_priority(NEW.severity, NEW.duplicate_count, NEW.created_at, NEW.location);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_issues_set_priority
  BEFORE INSERT OR UPDATE OF severity, duplicate_count, location ON issues
  FOR EACH ROW EXECUTE FUNCTION issues_set_priority();

-- The timeline trigger now also reads an optional note from the transaction
-- (set by the app with set_config), so every status change can carry a message.
CREATE OR REPLACE FUNCTION issues_log_status() RETURNS trigger AS $$
DECLARE
  actor     BIGINT := NULLIF(current_setting('app.user_id', true), '')::BIGINT;
  note_text TEXT   := NULLIF(current_setting('app.note', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO issue_timeline (issue_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, NULL, NEW.status, COALESCE(actor, NEW.reporter_id), COALESCE(note_text, 'Issue reported'));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO issue_timeline (issue_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, OLD.status, NEW.status, actor, note_text);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE INDEX issues_open_priority_idx ON issues (priority_score DESC) WHERE status <> 'resolved';

-- Recalculate every existing issue with the real formula
UPDATE issues SET priority_score = issue_priority(severity, duplicate_count, created_at, location);