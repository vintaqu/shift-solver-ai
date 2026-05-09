-- Horizontes largos: mes / trimestre / anio agrupando varios runs semanales

CREATE TABLE IF NOT EXISTS planning_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('mes','trimestre','anio','custom')),
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE NOT NULL,
  estado        TEXT NOT NULL DEFAULT 'planning'
                CHECK (estado IN ('planning','generating','active','closed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_periods_rest ON planning_periods(restaurant_id);

CREATE TABLE IF NOT EXISTS period_weeks (
  period_id        UUID     NOT NULL REFERENCES planning_periods(id) ON DELETE CASCADE,
  semana           SMALLINT NOT NULL,
  anio             SMALLINT NOT NULL,
  posicion         SMALLINT NOT NULL,
  target_hours     JSONB    NOT NULL DEFAULT '{}'::jsonb,
  schedule_run_id  UUID     REFERENCES schedule_runs(id) ON DELETE SET NULL,
  PRIMARY KEY (period_id, semana, anio)
);
CREATE INDEX IF NOT EXISTS idx_pweeks_run ON period_weeks(schedule_run_id);

ALTER TABLE schedule_runs
  ADD COLUMN IF NOT EXISTS period_id UUID REFERENCES planning_periods(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_runs_period ON schedule_runs(period_id);
