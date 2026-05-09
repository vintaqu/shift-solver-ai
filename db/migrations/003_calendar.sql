-- Calendar: week assignment + month lock

ALTER TABLE schedule_runs
  ADD COLUMN IF NOT EXISTS semana SMALLINT,
  ADD COLUMN IF NOT EXISTS anio   SMALLINT;

CREATE INDEX IF NOT EXISTS idx_runs_calendar ON schedule_runs (restaurant_id, anio, semana);

CREATE TABLE IF NOT EXISTS calendar_months (
  restaurant_id UUID     NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  anio          SMALLINT NOT NULL,
  mes           SMALLINT NOT NULL,
  cerrado_at    TIMESTAMPTZ,
  PRIMARY KEY (restaurant_id, anio, mes)
);
