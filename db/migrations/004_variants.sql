-- Variants: agrupar varias soluciones del mismo run

ALTER TABLE schedule_runs
  ADD COLUMN IF NOT EXISTS variant_group_id UUID,
  ADD COLUMN IF NOT EXISTS variant_index    SMALLINT,
  ADD COLUMN IF NOT EXISTS variant_chosen   BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_runs_variant_group
  ON schedule_runs (variant_group_id);
