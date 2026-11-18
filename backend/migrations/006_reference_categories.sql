-- 006: reference data the app cannot work without.
-- ON CONFLICT DO NOTHING makes it safe to run on a database that already has some of these.
INSERT INTO categories (module, name, sla_hours) VALUES
  ('public_service', 'Helpdesk query', 72),
  ('public_service', 'Document assistance', 120),
  ('streetlight', 'Light not working', 72),
  ('streetlight', 'Flickering or dim', 120),
  ('streetlight', 'Pole damaged', 48),
  ('flood', 'Waterlogging', 6),
  ('flood', 'Drain blocked', 24),
  ('flood', 'Water entering homes', 3),
  ('road', 'Pothole', 168),
  ('road', 'Missing sign', 120),
  ('road', 'Damaged road', 240),
  ('road', 'Accident-prone spot', 72),
  ('fire', 'Fire emergency', 1),
  ('fire', 'Hydrant fault', 48),
  ('fire', 'Blocked access road', 24)
ON CONFLICT (module, name) DO NOTHING;
