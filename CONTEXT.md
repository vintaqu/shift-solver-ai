# SHIFT SOLVER AI — Contexto y plan de trabajo

> **Cómo usar este documento:** Este archivo es el punto de entrada del proyecto para Claude Code. Antes de escribir una sola línea de código, lee este archivo COMPLETO y después lee `docs/SHIFT_SOLVER_AI_PLANTEAMIENTO_DEL_PROBLEMA.pdf`. Cuando hayas leído ambos, resume lo que has entendido y espera confirmación antes de empezar la Fase 0.

---

## 1. Resumen del proyecto

Construir un sistema que **genere automáticamente cuadrantes horarios** para un restaurante a partir de:

- Las **necesidades del negocio** definidas en slots de 30 minutos (cuántas personas, qué roles, qué etiquetas).
- La **plantilla disponible** (trabajadores con sus contratos, roles, etiquetas y restricciones individuales).
- La **legislación laboral** (convenio de hostelería de Tarragona + Estatuto de los Trabajadores).
- Objetivos de **conciliación y equidad** entre trabajadores.

La diferencia frente a herramientas existentes es el enfoque inverso: **no se parte de una plantilla manual que el sistema valida**, sino que **el sistema construye la plantilla desde cero** a partir de los datos.

El planteamiento detallado del problema, las restricciones legales, los datos de los 8 trabajadores reales y las necesidades por slot están en:

📄 **`docs/SHIFT_SOLVER_AI_PLANTEAMIENTO_DEL_PROBLEMA.pdf`**

Ese PDF es la **fuente de verdad** del problema. Cualquier duda funcional se resuelve ahí.

---

## 2. Arquitectura técnica

### Visión general

El proyecto se divide en **dos servicios independientes**:

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
                          │   RAILWAY / FLY.IO           │
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

### Stack

**Servicio solver (este es el que vamos a construir PRIMERO):**
- Python 3.11+
- OR-Tools (`ortools` en pip) — solver CP-SAT
- FastAPI — para exponer el endpoint HTTP (en Fase 1, no antes)
- Pydantic — validación de entrada/salida
- Docker — para despliegue
- Hosting: **Railway** (recomendado para empezar)

**Aplicación web (se construye DESPUÉS, cuando el solver funciona):**
- Next.js 15 con App Router
- TypeScript
- Tailwind CSS + shadcn/ui
- Supabase o Neon (Postgres)
- TanStack Table para el cuadrante editable
- Hosting: Vercel

### Decisiones tomadas y NO cuestionables

Estas decisiones ya se han tomado en fase de diseño. Claude Code **no debe proponer cambiarlas** salvo que detecte un bloqueo técnico real:

1. **El solver es Python con OR-Tools CP-SAT.** No JavaScript, no algoritmos genéricos, no LLMs razonando. CP-SAT es la elección correcta para este tipo de problema (NP-hard de scheduling con restricciones duras y blandas).
2. **El solver vive en un servicio separado** del Next.js, comunicado por HTTP. No se intenta meter el solver dentro de Vercel.
3. **El proyecto se construye en este orden: solver primero, web después.** Ver Fase 0 más abajo.
4. **Empezamos con horizonte semanal.** Trimestre/semestre/año son extensiones futuras.

---

## 3. Estructura del repositorio

```
shift-solver-ai/
├── CONTEXT.md                   ← este archivo
├── README.md                    ← se irá rellenando
├── docs/
│   └── SHIFT_SOLVER_AI_PLANTEAMIENTO_DEL_PROBLEMA.pdf
├── solver/                      ← servicio Python (FASE 0 → 1)
│   ├── data.py                  ← datos hardcodeados de los 8 trabajadores
│   ├── solver.py                ← script principal CP-SAT
│   ├── requirements.txt
│   ├── Dockerfile               ← solo en Fase 1
│   ├── main.py                  ← FastAPI, solo en Fase 1
│   └── README.md                ← qué versión cubre qué restricciones
└── web/                         ← Next.js (FASE 3 en adelante)
    └── (vacío de momento)
```

---

## 4. Plan por fases

El proyecto avanza en fases secuenciales. **No saltar fases.** Cada fase termina con un checkpoint validable.

### FASE 0 — Solver mínimo en local (prioridad máxima)

**Objetivo:** demostrar que CP-SAT puede resolver el problema real con los 8 trabajadores y necesidades reales del PDF.

**Sin web. Sin base de datos. Sin FastAPI. Sin Docker. Solo un script Python que se ejecuta con `python solver.py` y escupe el horario por consola (o a un archivo de texto / CSV).**

#### Subfases de FASE 0 (ir una a una, validando cada paso)

| # | Restricción a añadir | Objetivo de validación |
|---|---|---|
| 0.1 | Solo lunes, solo cobertura numérica de demanda (sin roles ni etiquetas) | El solver encuentra solución y cubre los slots del lunes |
| 0.2 | Toda la semana, cobertura numérica de demanda | El solver cubre lunes a domingo |
| 0.3 | Cumplimiento de horas semanales por contrato (40h fijas, horquillas 12-28h) | Cada trabajador hace las horas que le tocan |
| 0.4 | Descanso de 12h entre jornadas | No hay turnos consecutivos sin descanso suficiente |
| 0.5 | 2 días seguidos de descanso semanal | Cada trabajador tiene su descanso semanal |
| 0.6 | Restricciones individuales por trabajador (Edgar findes libres, Mayte no después de 22h, JOSE no L-J, etc.) | Las restricciones individuales del PDF se respetan |
| 0.7 | Roles con jerarquía acumulativa (DUEÑO > ENCARGADO > SEMI-ENCARGADO > CAMARERO BÁSICO) | Cobertura de roles por slot correcta |
| 0.8 | Etiquetas requeridas por slot | Al menos una persona con la etiqueta requerida |
| 0.9 | Jornada partida: tramos de 3-5h, descanso ≥1.5h entre tramos, máx 9h ordinarias/día | Las jornadas partidas que aparezcan son legales |
| 0.10 | Jornada continuada >5h ⇒ 20 min de descanso (computa como tiempo de trabajo) | Pausas correctas |
| 0.11 | Objetivo blando: maximizar jornadas continuadas, repartir partidas equitativamente | Función objetivo definida |
| 0.12 | Modo soft: detección de infactibilidades y propuestas de cambio (sugerir contratos/roles/etiquetas, NO cambios en necesidades) | Cuando no hay solución factible, el solver explica por qué |

**Después de cada subfase, hacer commit en Git.** Mensaje de commit: `feat(solver): fase 0.X - <descripción>`.

**Criterio de salida de Fase 0:** el script genera un cuadrante semanal completo, válido y legal para los 8 trabajadores reales del PDF, en menos de 60 segundos.

---

### FASE 1 — Convertir el script en servicio HTTP

**Objetivo:** que el solver sea consumible por HTTP desde Internet.

Pasos:
1. Envolver `solver.py` en una API FastAPI con un endpoint `POST /solve`.
2. Definir esquemas Pydantic para entrada y salida (esto define el **contrato JSON** entre solver y web).
3. Añadir autenticación por API key (header `x-api-key`).
4. Crear `Dockerfile`.
5. Probar en local con Docker.
6. Desplegar en Railway.
7. Validar con un `curl` desde fuera que devuelve un horario.

**Criterio de salida de Fase 1:** un `curl` con JSON de entrada a la URL de Railway devuelve un horario válido en JSON.

---

### FASE 2 — Diseño del modelo de datos

**Objetivo:** diseñar el schema de Neon basándose en el contrato JSON ya estable del solver.

Tablas mínimas previstas:
- `users` (auth)
- `restaurants` (multi-tenant en el futuro)
- `workers` (trabajadores)
- `contracts` (horas semanales, horquillas)
- `worker_roles` (rol asignado)
- `worker_tags` (etiquetas)
- `worker_restrictions` (restricciones individuales)
- `shift_needs` (necesidades por slot, día, rol, etiqueta)
- `schedule_runs` (cada vez que se genera un cuadrante)
- `schedule_assignments` (slot × trabajador del horario generado)

**Criterio de salida de Fase 2:** schema migrado en Supabase, datos de los 8 trabajadores reales cargados como seed.

---

### FASE 3 — Aplicación Next.js

Aquí entramos en zona de confort. Funcionalidades mínimas para el MVP:

1. Auth básica (Supabase Auth o similar).
2. Pantalla **Trabajadores**: CRUD de trabajadores con sus contratos, roles, etiquetas, restricciones.
3. Pantalla **Necesidades del restaurante**: edición de la matriz de slots × días con número de personas, roles y etiquetas requeridas.
4. Pantalla **Generar cuadrante**: botón que llama al solver vía Route Handler `/api/generate-schedule`, muestra spinner, recibe resultado.
5. Pantalla **Visualización del cuadrante**: tabla/grid con el horario semanal por trabajador y por slot.
6. Pantalla **Diagnóstico**: si el solver no pudo cubrir todo, mostrar huecos y propuestas.

**Criterio de salida de Fase 3:** un usuario puede entrar en la web, definir trabajadores y necesidades, pulsar "Generar" y ver el cuadrante resultado.

---

### FASE 4 (futuro, no implementar ahora)

- Horizontes largos (trimestre, semestre, año) con compensación de horas entre semanas.
- Horarios rotativos.
- Limitar horas en las que no debe haber cambios de turno.
- Edición manual del cuadrante con re-validación en vivo.
- Multi-restaurante (multi-tenant).
- Histórico y comparativas.

---

## 5. Datos del problema (referencia rápida)

> Detalle completo en el PDF. Esto es solo un índice rápido para no tener que abrirlo cada vez.

### Trabajadores (8 en total)

| Nombre | Contrato | Rol | Restricciones clave |
|---|---|---|---|
| EDGAR | Horquilla 12-28h/sem | DUEÑO | Sáb/Dom libres, solo 8-18h, solo continuado |
| SARA | 40h/sem | ENCARGADO | Domingo libre, jueves 11-13h obligatorio |
| MILAGROS | 40h/sem | SEMI-ENCARGADO | Sin restricciones |
| DANA | 40h/sem | SEMI-ENCARGADO | Sin restricciones |
| YULI | 40h/sem | CAMARERO BÁSICO | Sin restricciones |
| ANASTASIA | 40h/sem | CAMARERO BÁSICO | Sin restricciones |
| MAYTE | 34h/sem | CAMARERO BÁSICO | Dom-Jue no después de 22h, no antes de 7h |
| JOSE | Horquilla 12-28h/sem | CAMARERO BÁSICO | Lun-Jue no trabaja, Dom no después de 22h, no antes de 7h |

### Roles (jerárquicos, acumulativos)

`CAMARERO BÁSICO < SEMI-ENCARGADO < ENCARGADO < DUEÑO`

Un nivel superior puede ejercer cualquiera de los inferiores.

### Etiquetas (independientes)

`PASTAS, APERTURA, CAJERA, BARISTA, BANDEJERA, PLANCHISTA, COMANDERA, BARRA, DELIVERY, CIERRE, CONTABLE`

### Horario de apertura

- Lunes a Viernes: 06:00 – 00:00
- Sábado y Domingo: 06:30 – 00:00

Slots de **30 minutos**.

### Restricciones legales (convenio Tarragona + Estatuto)

1. Máx 1.791h/año/trabajador a tiempo completo.
2. Máx 40h/semana en promedio anual.
3. Máx 9h ordinarias/día.
4. Mín 12h entre fin de jornada e inicio de la siguiente.
5. Jornada continuada >5h ⇒ 20 min descanso (cuenta como trabajado).
6. Jornada partida: cada tramo entre 3-5h, descanso entre tramos ≥1.5h.
7. Descanso semanal: 2 días seguidos.
8. Horas extra: el horario estándar no debe necesitarlas. Tope 80h/año.

### Flexibilidad permitida

- Contratos de 40h pueden subir hasta 44h o bajar hasta 36h en cómputo multi-semana (compensándose).
- Cálculo solo semanal: solo permite subir hasta 44h, no bajar.
- Horquillas (ej: 12-28h): el mínimo es obligatorio, el rango se puede usar como flexibilidad.

---

## 6. Reglas de trabajo para Claude Code

### Antes de escribir código

1. **Leer este `CONTEXT.md` completo.**
2. **Leer el PDF en `docs/SHIFT_SOLVER_AI_PLANTEAMIENTO_DEL_PROBLEMA.pdf` completo.**
3. **Resumir lo entendido** antes de empezar a programar y esperar confirmación.

### Al programar

- **No saltar fases.** Si estamos en 0.3, no añadir cosas de 0.7 "porque me viene bien".
- **Un commit por subfase.** Mensaje claro tipo `feat(solver): fase 0.3 - cumplimiento horas semanales`.
- **Comentar el código en español**, igual que el PDF.
- **Cada restricción CP-SAT debe ir comentada** indicando qué punto del PDF la origina (ej: `# Restricción legal punto 4: descanso 12h entre jornadas`).
- **Cuando una restricción no encuentre solución**, no "ablandarla" automáticamente. Parar y preguntar.
- **Ejecutar el script después de cada cambio significativo** y mostrar el output.

### Al final de cada subfase

- Resumir qué se ha implementado.
- Mostrar un ejemplo de horario generado.
- Listar qué se va a hacer en la siguiente subfase.
- Esperar confirmación antes de continuar.

### Qué NO hacer

- ❌ No proponer cambiar el stack (CP-SAT, FastAPI, Next.js, Vercel, Railway están decididos).
- ❌ No empezar la web antes de terminar la Fase 0 del solver.
- ❌ No usar `pulp`, `scipy.optimize` ni otros solvers en lugar de OR-Tools.
- ❌ No reescribir el solver en JavaScript "para unificar".
- ❌ No hacer suposiciones sobre datos del PDF — si algo no está claro, preguntar.

---

## 7. Primer paso concreto

Cuando confirmes que has leído este documento Y el PDF:

1. Crea la estructura de carpetas tal como figura en la sección 3.
2. Crea `solver/requirements.txt` con la dependencia `ortools`.
3. Crea `solver/data.py` con los 8 trabajadores y las necesidades del lunes (solo lunes de momento) hardcodeados como diccionarios Python, fielmente al PDF.
4. Crea `solver/solver.py` versión 0.1: solo lunes, solo cobertura numérica de demanda, sin roles ni etiquetas.
5. Ejecuta `python solver.py` y muestra el output.
6. Espera mi feedback antes de pasar a la subfase 0.2.

---

**Última actualización:** punto de partida del proyecto, redactado a partir de la conversación de diseño previa.



Ejemplo extraido FASE 0 :


Cuadrante completo de una semana — generado ahora
OPTIMAL en 11.6 s. 591/601 slots-persona cubiertos (98.3 %). 0 huecos de etiqueta. 34 jornadas continuadas, 4 partidas (1 por persona en SARA, YULI, MAYTE, JOSE; dispersión = 1).

Vista por trabajador (la legible)
EDGAR — DUEÑO, contrato 12-28h, 25.5 h semana

LUN  08:00-15:00 (7.0h)   continuada
MAR  08:00-12:30 (4.5h)   continuada
MIE  08:00-12:30 (4.5h)   continuada
JUE  08:00-12:30 (4.5h)   continuada
VIE  10:30-15:30 (5.0h)   continuada
SAB  descanso
DOM  descanso
SARA — ENCARGADO, contrato 40-44h, 42.0 h semana

LUN  descanso
MAR  07:00-15:00 (8.0h)   continuada
MIE  07:00-15:30 (8.5h)   continuada
JUE  06:00-15:00 (9.0h)   continuada     <- cubre ventana 11-13
VIE  06:00-10:30 (4.5h) | 20:00-00:00 (4.0h)   PARTIDA
SAB  16:00-00:00 (8.0h)   continuada
DOM  descanso
MILAGROS — SEMI_ENCARGADO, contrato 40-44h, 43.5 h semana

LUN  06:00-15:00 (9.0h)   continuada
MAR  15:00-00:00 (9.0h)   continuada
MIE  15:30-00:00 (8.5h)   continuada
JUE  descanso
VIE  descanso
SAB  07:30-16:00 (8.5h)   continuada
DOM  06:30-15:00 (8.5h)   continuada
DANA — SEMI_ENCARGADO, contrato 40-44h, 41.5 h semana

LUN  15:00-00:00 (9.0h)   continuada
MAR  descanso
MIE  descanso
JUE  15:00-00:00 (9.0h)   continuada
VIE  15:30-00:00 (8.5h)   continuada
SAB  18:00-00:00 (6.0h)   continuada
DOM  15:00-00:00 (9.0h)   continuada
YULI — CAMARERO_BÁSICO, contrato 40-44h, 42.0 h semana

LUN  15:00-00:00 (9.0h)   continuada
MAR  15:00-00:00 (9.0h)   continuada
MIE  15:00-00:00 (9.0h)   continuada
JUE  descanso
VIE  descanso
SAB  06:30-12:30 (6.0h)   continuada
DOM  07:30-12:30 (5.0h) | 20:00-00:00 (4.0h)   PARTIDA
ANASTASIA — CAMARERO_BÁSICO, contrato 40-44h, 41.5 h semana

LUN  descanso
MAR  06:00-15:00 (9.0h)   continuada
MIE  06:00-15:00 (9.0h)   continuada
JUE  15:00-00:00 (9.0h)   continuada
VIE  16:00-00:00 (8.0h)   continuada
SAB  17:30-00:00 (6.5h)   continuada
DOM  descanso
MAYTE — CAMARERO_BÁSICO, contrato 34h, 34.0 h semana

LUN  07:00-12:30 (5.5h)   continuada
MAR  descanso
MIE  descanso
JUE  07:00-15:00 (8.0h)   continuada
VIE  08:00-12:30 (4.5h) | 18:00-21:30 (3.5h)   PARTIDA
SAB  09:30-17:30 (8.0h)   continuada
DOM  08:00-12:30 (4.5h)   continuada
JOSE — CAMARERO_BÁSICO, contrato 12-28h, 25.5 h semana

LUN  descanso
MAR  descanso
MIE  descanso
JUE  descanso
VIE  07:00-16:00 (9.0h)   continuada
SAB  08:00-12:30 (4.5h) | 20:00-23:30 (3.5h)   PARTIDA
DOM  11:30-20:00 (8.5h)   continuada
Resumen semanal por día

TRABAJADOR      LUN    MAR    MIE    JUE    VIE    SAB    DOM    TOTAL  RANGO h
EDGAR           7.0    4.5    4.5    4.5    5.0    0.0    0.0     25.5  12-28
SARA            0.0    8.0    8.5    9.0    8.5    8.0    0.0     42.0  40-44
MILAGROS        9.0    9.0    8.5    0.0    0.0    8.5    8.5     43.5  40-44
DANA            9.0    0.0    0.0    9.0    8.5    6.0    9.0     41.5  40-44
YULI            9.0    9.0    9.0    0.0    0.0    6.0    9.0     42.0  40-44
ANASTASIA       0.0    9.0    9.0    9.0    8.0    6.5    0.0     41.5  40-44
MAYTE           5.5    0.0    0.0    8.0    8.0    8.0    4.5     34.0     34
JOSE            0.0    0.0    0.0    0.0    9.0    8.0    8.5     25.5  12-28
TOTAL          39.5   39.5   39.5   39.5   47.0   51.0   39.5    295.5
Demanda        39.5   39.5   39.5   39.5   49.5   51.5   41.5    300.5

Huecos del cuadrante (los inevitables)
Día	Slot	        Demanda	Cubierto	Falta
VIE	21:30-22:00	    4	    3	        1 CB+
VIE	22:00-22:30	    4	    3	        1 CB+
VIE	22:30-23:00	    4	    3	        1 CB+
VIE	23:00-23:30	    4	    3	        1 CB+
VIE	23:30-00:00	    4	    3	        1 CB+
SAB	23:30-00:00	    4	    3	        1 CB+
DOM	09:30-10:00	    4	    3	        1 CB+
DOM	10:00-10:30	    4	    3	        1 CB+
DOM	10:30-11:00	    4	    3	        1 CB+
DOM	11:00-11:30	    4	    3	        1 CB+
Estos 10 slots-persona (5 h sin cubrir) son estructurales: con la plantilla actual y las restricciones del PDF, no se puede mejorar. La subfase 0.12 generará propuestas concretas para cerrarlos (p.ej. ampliar la horquilla de JOSE).

Conclusión
El solver de Fase 0 está completo y correcto. Genera en ~12 s un cuadrante semanal realista, legal y respetuoso con las restricciones individuales, dejando solo los huecos imposibles de cubrir con la plantilla actual. Listo para empaquetar como servicio FastAPI (Fase 1) cuando lo decidas.