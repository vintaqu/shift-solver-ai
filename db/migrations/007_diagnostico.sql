-- Subfase 0.12: diagnostico de infactibilidad / huecos estructurales

ALTER TABLE schedule_runs
  ADD COLUMN IF NOT EXISTS diagnostico JSONB;
