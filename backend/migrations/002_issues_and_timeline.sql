-- 002: issues, issue_timeline, and the triggers that automate them

CREATE TYPE issue_status AS ENUM
  ('reported', 'verified', 'assigned', 'in_progress', 'resolved');

CREATE TABLE issues (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id      BIGINT      NOT NULL REFERENCES categories(id),
  reporter_id      BIGINT      NOT NULL REFERENCES users(id),
  assigned_to      BIGINT      REFERENCES users(id),
  title            TEXT        NOT NULL,
  description      TEXT,
  severity         SMALLINT    NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  status           issue_status NOT NULL DEFAULT 'reported',
  location         geography(Point, 4326) NOT NULL,
  address_text     TEXT,
  ward             TEXT,                -- ward/village name for the leaderboard
  photo_url        TEXT,
  after_photo_url  TEXT,                -- before/after proof on closure
  duplicate_count  INTEGER     NOT NULL DEFAULT 1 CHECK (duplicate_count >= 1),
  priority_score   NUMERIC(8,2) NOT NULL DEFAULT 0,
  sla_deadline     TIMESTAMPTZ,
  escalation_level INTEGER     NOT NULL DEFAULT 0 CHECK (escalation_level >= 0),
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT issues_title_not_blank CHECK (length(trim(title)) > 0)
);

-- GiST index: makes "find reports near this point" fast
CREATE INDEX issues_location_gist ON issues USING GIST (location);
CREATE INDEX issues_status_idx    ON issues (status);
CREATE INDEX issues_category_idx  ON issues (category_id);
CREATE INDEX issues_created_idx   ON issues (created_at);

CREATE TABLE issue_timeline (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  issue_id    BIGINT       NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  from_status issue_status,            -- NULL for the very first entry
  to_status   issue_status NOT NULL,
  changed_by  BIGINT       REFERENCES users(id),
  note        TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX issue_timeline_issue_idx ON issue_timeline (issue_id, created_at);

-- ---------- Trigger functions ----------

-- 1. Keep updated_at current on every update
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. On insert: compute the SLA deadline from the category's sla_hours
CREATE FUNCTION issues_set_sla() RETURNS trigger AS $$
BEGIN
  IF NEW.sla_deadline IS NULL THEN
    SELECT now() + make_interval(hours => c.sla_hours)
      INTO NEW.sla_deadline
      FROM categories c
     WHERE c.id = NEW.category_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Set or clear resolved_at when status moves to or from 'resolved'
CREATE FUNCTION issues_track_resolution() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status <> 'resolved' THEN
    NEW.resolved_at = now();
  ELSIF NEW.status <> 'resolved' AND OLD.status = 'resolved' THEN
    NEW.resolved_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Write a timeline row on every new issue and every status change
CREATE FUNCTION issues_log_status() RETURNS trigger AS $$
DECLARE
  actor BIGINT := NULLIF(current_setting('app.user_id', true), '')::BIGINT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO issue_timeline (issue_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, NULL, NEW.status, COALESCE(actor, NEW.reporter_id), 'Issue reported');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO issue_timeline (issue_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, actor);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ---------- Attach the functions to the tables ----------

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_issues_set_sla
  BEFORE INSERT ON issues
  FOR EACH ROW EXECUTE FUNCTION issues_set_sla();

CREATE TRIGGER trg_issues_track_resolution
  BEFORE UPDATE OF status ON issues
  FOR EACH ROW EXECUTE FUNCTION issues_track_resolution();

CREATE TRIGGER trg_issues_log_status
  AFTER INSERT OR UPDATE OF status ON issues
  FOR EACH ROW EXECUTE FUNCTION issues_log_status();