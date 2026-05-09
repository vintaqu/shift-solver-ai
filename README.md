# Shift Solver AI

Sistema que **genera automáticamente cuadrantes horarios** semanales para un
restaurante a partir de las necesidades del negocio, los trabajadores
disponibles y la legislación laboral aplicable.

A diferencia de las herramientas existentes —que parten de una plantilla
manual e indican si cumple o no las restricciones—, este sistema **construye
la plantilla desde cero** dadas la demanda por slot, la lista de
trabajadores con sus contratos/roles/etiquetas/restricciones individuales,
y las reglas legales del convenio + Estatuto de los Trabajadores.

Caso de uso real: 8 trabajadores en un restaurante de Tarragona, abierto
L-V de 06:00-00:00 y S-D de 06:30-00:00, slots de 30 minutos, demanda
desglosada por número de personas, rol jerárquico (camarero básico /
semi-encargado / encargado / dueño) y etiquetas (pastas, apertura,
cajera, etc.).

## Arquitectura

```
┌──────────────────────────────────────┐
│            VERCEL                    │
│  ┌────────────────────────────────┐  │
│  │  Next.js (App Router)          │  │
│  │  - UI cuadrante, trabajadores  │  │
│  │  - Auth                        │  │
│  │  - Route Handlers (API)        │  │
│  │     /api/generate-schedule ────┼──┼──┐
│  └────────────────────────────────┘  │  │
└──────────────────────────────────────┘  │
                  │                       │ HTTPS + API Key
                  ▼ (Postgres)            │ POST /solve
┌──────────────────────────────────────┐  │
│         SUPABASE / NEON              │  │
│  - workers, contracts                │  │
│  - shift_needs, schedules            │  │
└──────────────────────────────────────┘  │
                                          ▼
                          ┌──────────────────────────────┐
                          │   RAILWAY                    │
                          │  ┌────────────────────────┐  │
                          │  │  FastAPI (Python)      │  │
                          │  │  + OR-Tools CP-SAT     │  │
                          │  │                        │  │
                          │  │  POST /solve           │  │
                          │  │  GET  /health          │  │
                          │  └────────────────────────┘  │
                          │  Dockerfile, always-on       │
                          └──────────────────────────────┘
```

Decisión de diseño: el solver vive en un **servicio Python separado**
porque OR-Tools no funciona en serverless y la naturaleza del problema
(NP-hard de scheduling con restricciones duras y blandas) exige un solver
real, no un LLM razonando.

## Stack

**Solver (servicio HTTP, este repo, Fase 1 completa):**
- Python 3.13+
- [OR-Tools](https://developers.google.com/optimization) — solver CP-SAT
- [FastAPI](https://fastapi.tiangolo.com/) + [Pydantic v2](https://docs.pydantic.dev/) — endpoint y schemas
- Docker — despliegue en Railway

**Aplicación web (pendiente, Fase 3):**
- Next.js 15 (App Router) + TypeScript
- Tailwind + shadcn/ui
- Supabase / Neon (Postgres)
- Despliegue en Vercel

## Estado del proyecto

### Fase 0 — Solver local (completa)

Modelo CP-SAT que respeta todas las restricciones legales e individuales
del PDF. Genera el cuadrante semanal de los 8 trabajadores reales en
~15 segundos con calidad óptima. Detalle por subfase en
[`solver/README.md`](solver/README.md).

### Fase 1 — Servicio HTTP (completa, pendiente despliegue)

| Hito | Estado |
|------|--------|
| Refactor del motor a `core.py` | hecho |
| Pydantic schemas en `schemas.py` | hecho |
| FastAPI con `/health` y `/solve` (auth `x-api-key`) | hecho |
| Dockerfile Railway-friendly | hecho |
| Validado en local con `uvicorn` + curl | hecho |
| Validado en local con `docker build` + curl | hecho |
| Desplegado en Railway | hecho (`shift-solver-ai-production.up.railway.app`) |

### Fase 2-4 — Pendientes

- **Fase 2**: schema de la base de datos (Supabase / Neon).
- **Fase 3**: aplicación Next.js (CRUD de trabajadores, edición de la
  matriz de necesidades, generación + visualización del cuadrante).
- **Fase 4** (futuro): horizontes largos (trimestre, semestre, año),
  rotativos, edición manual con re-validación, multi-tenant.

## Quick start (desarrollo local)

### CLI — generar el cuadrante de los 8 trabajadores y mostrarlo en consola

```powershell
git clone <este-repo>
cd shift-solver-ai

py -m venv solver/.venv
solver\.venv\Scripts\python.exe -m pip install -r solver/requirements.txt

solver\.venv\Scripts\python.exe solver/solver.py
# (opcional) rotación alternativa equivalente:
solver\.venv\Scripts\python.exe solver/solver.py 42
```

### Servicio HTTP — uvicorn

```powershell
cd solver
$env:SHIFT_SOLVER_API_KEY = "secreto-de-prueba"
..\solver\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

```bash
curl http://127.0.0.1:8000/health
# {"status":"ok","auth_required":true,"version":"0.11.0"}

curl -X POST http://127.0.0.1:8000/solve \
  -H "Content-Type: application/json" \
  -H "x-api-key: secreto-de-prueba" \
  --data-binary @request.json
```

Documentación interactiva del API: <http://127.0.0.1:8000/docs>.

### Servicio HTTP — Docker

```bash
cd solver
docker build -t shift-solver:dev .
docker run --rm -p 8000:8000 -e SHIFT_SOLVER_API_KEY=secreto shift-solver:dev
```

## Estructura del repositorio

```
shift-solver-ai/
├── README.md                  ← este fichero
├── CONTEXT.md                 ← documento de contexto y plan de trabajo
├── docs/
│   └── SHIFT SOLVER AI (PLANTEAMIENTO DEL PROBLEMA).pdf
│                              ← fuente de verdad del problema (8 trabajadores
│                                reales, restricciones legales, demanda por slot)
├── solver/                    ← servicio Python (Fase 0 + Fase 1)
│   ├── core.py                ← motor del solver (CP-SAT)
│   ├── schemas.py             ← Pydantic ScheduleRequest / ScheduleResponse
│   ├── data.py                ← datos del PDF (fixture)
│   ├── solver.py              ← script CLI (validación humana)
│   ├── main.py                ← FastAPI (POST /solve, GET /health)
│   ├── Dockerfile             ← imagen de despliegue
│   ├── requirements.txt
│   └── README.md              ← documentación detallada del servicio
└── web/                       ← Next.js (Fase 3, vacío de momento)
```

## Documentación

- [`docs/SHIFT SOLVER AI (PLANTEAMIENTO DEL PROBLEMA).pdf`](<docs/SHIFT SOLVER AI (PLANTEAMIENTO DEL PROBLEMA).pdf>) —
  el problema completo: trabajadores, restricciones legales, demanda por
  slot/rol/etiqueta. Es la **fuente de verdad** del proyecto.
- [`CONTEXT.md`](CONTEXT.md) — contexto de alto nivel y plan por fases del
  proyecto.
- [`solver/README.md`](solver/README.md) — documentación técnica del
  servicio: cómo ejecutar, contrato JSON, despliegue a Railway.

## Despliegue a Railway

El `Dockerfile` está diseñado para que Railway lo detecte automáticamente
sin configuración extra. Pasos resumidos (detalles en
[`solver/README.md`](solver/README.md#despliegue-a-railway)):

1. Subir el repo a GitHub.
2. En [railway.app](https://railway.app) → **New Project → Deploy from
   GitHub repo** → seleccionar el repo.
3. **Settings → Root directory** = `solver/`.
4. **Variables** → `SHIFT_SOLVER_API_KEY = <secreto-largo>`.
5. Deploy.

## Métricas de la solución actual

Sobre el caso real del PDF (8 trabajadores, demanda semanal de 601
slots-persona = 300.5 h):

- Estado: **OPTIMAL** en ~15 segundos.
- Cobertura: 591/601 slots-persona (98.3 %).
- Huecos detectados: 10 sp (5 h) — son **estructurales**: ningún cuadrante
  legal es capaz de cubrirlos con la plantilla actual y las restricciones
  del PDF; la subfase 0.12 generará propuestas para cerrarlos (cambios de
  contrato, plantilla extra, etc.).
- Distribución de jornadas: 34 continuadas + 4 partidas, con dispersión
  máxima de 1 partida entre trabajadores — el reparto cumple el "se hará
  lo posible para equilibrar y compartirlo entre todos los trabajadores"
  del PDF.
- Cobertura por etiqueta: 250/250 slots requeridos cubiertos.
- Todas las restricciones legales (12 h entre jornadas, 2 días seguidos
  de descanso semanal, ≤ 9 h ordinarias/día, jornada partida 3-5 h con
  ≥ 1.5 h de gap) y todas las restricciones individuales del PDF se
  cumplen.
