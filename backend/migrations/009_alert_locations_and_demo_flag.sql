-- 009: where an announcement applies, and a flag so demo issues can be removed later

ALTER TABLE broadcasts
  ADD COLUMN location_name TEXT CHECK (location_name IS NULL OR length(trim(location_name)) > 0),
  ADD COLUMN location      geography(Point, 4326),
  ADD COLUMN radius_m      INTEGER CHECK (radius_m IS NULL OR radius_m BETWEEN 50 AND 20000);

ALTER TABLE issues ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX issues_demo_idx ON issues (id) WHERE is_demo;