-- Cuadrantes editables: nombre y marca de edicion

ALTER TABLE schedule_runs
  ADD COLUMN IF NOT EXISTS nombre    TEXT,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
