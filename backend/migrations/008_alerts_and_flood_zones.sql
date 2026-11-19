-- 008: emergency broadcasts and flood-risk zones

CREATE TYPE zone_status AS ENUM ('normal', 'watch', 'high');

-- A flood-risk zone is a polygon on the map plus its own rainfall thresholds.
-- Low-lying zones get LOWER thresholds, so they are warned earlier.
CREATE TABLE flood_zones (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT    NOT NULL UNIQUE,
  boundary      geography(Polygon, 4326) NOT NULL,
  watch_mm      NUMERIC NOT NULL DEFAULT 35 CHECK (watch_mm > 0),
  high_mm       NUMERIC NOT NULL DEFAULT 65,
  forecast_mm   NUMERIC,
  status        zone_status NOT NULL DEFAULT 'normal',
  checked_at    TIMESTAMPTZ,
  CONSTRAINT flood_zones_thresholds CHECK (high_mm > watch_mm)
);
CREATE INDEX flood_zones_boundary_gist ON flood_zones USING GIST (boundary);

CREATE TYPE broadcast_kind     AS ENUM ('flood', 'road_closure', 'fire', 'weather', 'general');
CREATE TYPE broadcast_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE broadcast_source   AS ENUM ('admin', 'weather');

CREATE TABLE broadcasts (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind         broadcast_kind     NOT NULL,
  severity     broadcast_severity NOT NULL,
  title        TEXT NOT NULL CHECK (length(trim(title)) > 0),
  message      TEXT NOT NULL CHECK (length(trim(message)) > 0),
  source       broadcast_source   NOT NULL DEFAULT 'admin',
  zone_id      BIGINT REFERENCES flood_zones(id) ON DELETE CASCADE,
  created_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
  starts_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  withdrawn_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT broadcasts_window CHECK (expires_at > starts_at)
);

CREATE INDEX broadcasts_active_idx ON broadcasts (expires_at) WHERE withdrawn_at IS NULL;

-- At most ONE live automatic alert per zone
CREATE UNIQUE INDEX broadcasts_one_weather_per_zone
  ON broadcasts (zone_id) WHERE source = 'weather' AND withdrawn_at IS NULL;