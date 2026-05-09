-- SHIFT SOLVER AI — Schema inicial
-- Ejecutar con: python db/run_migrations.py

-- ---------------------------------------------------------------------------
-- Restaurante
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Trabajadores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    rol             TEXT NOT NULL,  -- CAMARERO_BASICO | SEMI_ENCARGADO | ENCARGADO | DUENO
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (restaurant_id, nombre)
);

-- Contrato del trabajador (uno por trabajador).
CREATE TABLE IF NOT EXISTS contracts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id   UUID NOT NULL UNIQUE REFERENCES workers(id) ON DELETE CASCADE,
    tipo        TEXT NOT NULL CHECK (tipo IN ('fijo', 'horquilla')),
    horas       INTEGER,      -- solo si tipo = 'fijo'
    min_horas   INTEGER,      -- solo si tipo = 'horquilla'
    max_horas   INTEGER,      -- solo si tipo = 'horquilla'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Etiquetas del trabajador (tabla join).
CREATE TABLE IF NOT EXISTS worker_tags (
    worker_id   UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    etiqueta    TEXT NOT NULL,
    PRIMARY KEY (worker_id, etiqueta)
);

-- Restricciones individuales del trabajador en JSONB.
-- Espeja el modelo Pydantic `Restricciones` de schemas.py:
--   { dias_libres, no_antes_de, no_despues_de, trabajar_obligatorio, texto_pdf }
CREATE TABLE IF NOT EXISTS worker_restrictions (
    worker_id       UUID PRIMARY KEY REFERENCES workers(id) ON DELETE CASCADE,
    restricciones   JSONB NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Necesidades del restaurante (demanda por franja)
-- ---------------------------------------------------------------------------
-- Una fila por (restaurant_id, dia, inicio, fin).
-- personas_por_rol: { "CAMARERO_BASICO": 2, "SEMI_ENCARGADO": 1, ... }
-- etiquetas: ["CAJERA", "BARISTA", ...] — disyuncion (basta una persona con alguna)
CREATE TABLE IF NOT EXISTS shift_needs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id    UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    dia              TEXT NOT NULL,   -- LUNES | MARTES | ... | DOMINGO
    inicio           TEXT NOT NULL,   -- "HH:MM"
    fin              TEXT NOT NULL,   -- "HH:MM" — "00:00" = medianoche
    personas         INTEGER NOT NULL DEFAULT 0,
    personas_por_rol JSONB NOT NULL DEFAULT '{}',
    etiquetas        TEXT[] NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (restaurant_id, dia, inicio, fin)
);

CREATE INDEX IF NOT EXISTS shift_needs_restaurant_dia
    ON shift_needs (restaurant_id, dia);

-- ---------------------------------------------------------------------------
-- Ejecuciones del solver
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedule_runs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id           UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    estado                  TEXT NOT NULL,   -- OPTIMAL | FEASIBLE | INFEASIBLE | ...
    tiempo_calculo_seg      FLOAT,
    seed_usado              INTEGER,
    slots_persona_demanda   INTEGER,
    slots_persona_asignados INTEGER,
    slots_persona_huecos    INTEGER,
    horas_persona_demanda   FLOAT,
    horas_persona_asignadas FLOAT,
    horas_persona_huecos    FLOAT,
    metricas                JSONB,   -- { total_continuadas, total_partidas, ... }
    huecos_cobertura        JSONB,   -- List[HuecoCobertura]
    huecos_etiqueta         JSONB,   -- List[HuecoEtiqueta]
    gaps_entre_jornadas     JSONB,   -- List[GapEntreJornadas]
    pausas_obligatorias     JSONB    -- List[PausaObligatoria]
);

-- ---------------------------------------------------------------------------
-- Cuadrante resultado (una fila por trabajador × dia)
-- ---------------------------------------------------------------------------
-- tramos: [{ "inicio": "HH:MM", "fin": "HH:MM", "duracion_horas": 4.5 }, ...]
CREATE TABLE IF NOT EXISTS schedule_assignments (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id               UUID NOT NULL REFERENCES schedule_runs(id) ON DELETE CASCADE,
    worker_id            UUID NOT NULL REFERENCES workers(id),
    dia                  TEXT NOT NULL,
    tipo                 TEXT NOT NULL CHECK (tipo IN ('descanso', 'continuada', 'partida')),
    tramos               JSONB NOT NULL DEFAULT '[]',
    horas                FLOAT NOT NULL DEFAULT 0,
    requiere_pausa_20min BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (run_id, worker_id, dia)
);

CREATE INDEX IF NOT EXISTS schedule_assignments_run
    ON schedule_assignments (run_id);
