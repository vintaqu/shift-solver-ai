import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { z } from "zod";
import { targetToContrato, type WorkerContract } from "@/lib/period-helpers";

const SOLVER_URL = process.env.SOLVER_API_URL!;
const SOLVER_KEY = process.env.SOLVER_API_KEY ?? "";

const DIAS_ORDER = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO","DOMINGO"];
const HORARIO_APERTURA: Record<string, { apertura: string; cierre: string }> = {
  LUNES:     { apertura: "06:00", cierre: "00:00" },
  MARTES:    { apertura: "06:00", cierre: "00:00" },
  MIERCOLES: { apertura: "06:00", cierre: "00:00" },
  JUEVES:    { apertura: "06:00", cierre: "00:00" },
  VIERNES:   { apertura: "06:00", cierre: "00:00" },
  SABADO:    { apertura: "06:30", cierre: "00:00" },
  DOMINGO:   { apertura: "06:30", cierre: "00:00" },
};

const bodySchema = z.object({
  semana: z.number().int().min(1).max(53),
  anio: z.number().int(),
  time_limit: z.number().int().min(10).max(300).default(45),
});

interface SolverResponse {
  estado: string;
  tiempo_calculo_segundos: number;
  seed_usado: number | null;
  slots_persona_demanda: number;
  slots_persona_asignados: number;
  slots_persona_huecos: number;
  horas_persona_demanda: number;
  horas_persona_asignadas: number;
  horas_persona_huecos: number;
  cuadrante: Array<{
    nombre: string;
    jornadas: Array<{
      dia: string;
      tipo: string;
      tramos: unknown[];
      horas: number;
      requiere_pausa_20min: boolean;
    }>;
  }>;
  metricas: unknown;
  huecos_cobertura: unknown;
  huecos_etiqueta: unknown;
  gaps_entre_jornadas: unknown;
  pausas_obligatorias: unknown;
  diagnostico: unknown;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: periodId } = await params;
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { semana, anio, time_limit } = bodySchema.parse(body);

  // Validate period and week
  const [pw] = await sql<{ target_hours: Record<string, number> }>(
    `SELECT pw.target_hours
     FROM period_weeks pw
     JOIN planning_periods p ON p.id = pw.period_id
     WHERE pw.period_id = $1 AND pw.semana = $2 AND pw.anio = $3 AND p.restaurant_id = $4`,
    [periodId, semana, anio, restaurantId]
  );
  if (!pw) return NextResponse.json({ error: "Semana del periodo no encontrada" }, { status: 404 });
  const targets = (typeof pw.target_hours === "string"
    ? JSON.parse(pw.target_hours)
    : pw.target_hours) as Record<string, number>;

  // Load workers (with full data) and apply target overrides
  const workers = await sql(
    `SELECT w.id, w.nombre, w.rol,
            c.tipo as contrato_tipo, c.horas, c.min_horas, c.max_horas,
            COALESCE(array_agg(wt.etiqueta) FILTER (WHERE wt.etiqueta IS NOT NULL), '{}') as etiquetas,
            wr.restricciones
     FROM workers w
     LEFT JOIN contracts c ON c.worker_id = w.id
     LEFT JOIN worker_tags wt ON wt.worker_id = w.id
     LEFT JOIN worker_restrictions wr ON wr.worker_id = w.id
     WHERE w.restaurant_id = $1
     GROUP BY w.id, w.nombre, w.rol, c.tipo, c.horas, c.min_horas, c.max_horas, wr.restricciones
     ORDER BY w.nombre`,
    [restaurantId]
  );

  if (workers.length === 0) {
    return NextResponse.json({ error: "Sin trabajadores" }, { status: 400 });
  }

  const needs = await sql(
    "SELECT dia, inicio, fin, personas, personas_por_rol, etiquetas FROM shift_needs WHERE restaurant_id = $1 ORDER BY dia, inicio",
    [restaurantId]
  );

  const franjas_num: Record<string, unknown[]> = {};
  const franjas_rol: Record<string, unknown[]> = {};
  const franjas_eti: Record<string, unknown[]> = {};
  for (const n of needs) {
    const dia = n.dia as string;
    if (!franjas_num[dia]) { franjas_num[dia] = []; franjas_rol[dia] = []; franjas_eti[dia] = []; }
    franjas_num[dia].push({ inicio: n.inicio, fin: n.fin, personas: n.personas });
    franjas_rol[dia].push({ inicio: n.inicio, fin: n.fin, personas_por_rol: n.personas_por_rol });
    if ((n.etiquetas as string[]).length > 0) {
      franjas_eti[dia].push({ inicio: n.inicio, fin: n.fin, etiquetas: n.etiquetas });
    }
  }

  // Build solver request with per-worker contract OVERRIDDEN by week target
  const solverWorkers = workers.map((w) => {
    const wc: WorkerContract = {
      id: w.id as string,
      nombre: w.nombre as string,
      contrato_tipo: w.contrato_tipo as "fijo" | "horquilla",
      horas: (w.horas as number | null) ?? null,
      min_horas: (w.min_horas as number | null) ?? null,
      max_horas: (w.max_horas as number | null) ?? null,
    };
    const target = targets[w.id as string];
    const contrato = target !== undefined && target >= 0
      ? targetToContrato(wc, target)
      : (w.contrato_tipo === "fijo"
        ? { tipo: "fijo", horas: w.horas, min_horas: null, max_horas: null }
        : { tipo: "horquilla", horas: null, min_horas: w.min_horas, max_horas: w.max_horas });

    return {
      nombre: w.nombre,
      rol: w.rol,
      etiquetas: w.etiquetas,
      contrato,
      restricciones: w.restricciones ?? {},
    };
  });

  const solverRequest = {
    dias: DIAS_ORDER,
    roles_jerarquia: ["CAMARERO_BASICO","SEMI_ENCARGADO","ENCARGADO","DUENO"],
    etiquetas: ["PASTAS","APERTURA","CAJERA","BARISTA","BANDEJERA","PLANCHISTA","COMANDERA","BARRA","DELIVERY","CIERRE","CONTABLE"],
    slot_duracion_min: 30,
    horario_apertura: HORARIO_APERTURA,
    trabajadores: solverWorkers,
    franjas_num,
    franjas_rol,
    franjas_eti,
    parametros: { time_limit_seconds: time_limit, seed: Math.floor(Math.random() * 1000000) + 1 },
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (SOLVER_KEY) headers["x-api-key"] = SOLVER_KEY;

  let solverRes: Response;
  try {
    solverRes = await fetch(`${SOLVER_URL}/solve`, {
      method: "POST",
      headers,
      body: JSON.stringify(solverRequest),
      signal: AbortSignal.timeout((time_limit + 30) * 1000),
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo contactar el solver: ${(e as Error).message}` }, { status: 502 });
  }

  if (!solverRes.ok) {
    const err = await solverRes.text();
    return NextResponse.json({ error: `Solver error ${solverRes.status}: ${err}` }, { status: 502 });
  }

  const result = (await solverRes.json()) as SolverResponse;

  // Save the run with period_id, semana, anio
  const [run] = await sql<{ id: string }>(
    `INSERT INTO schedule_runs
     (restaurant_id, estado, tiempo_calculo_seg, seed_usado,
      slots_persona_demanda, slots_persona_asignados, slots_persona_huecos,
      horas_persona_demanda, horas_persona_asignadas, horas_persona_huecos,
      metricas, huecos_cobertura, huecos_etiqueta, gaps_entre_jornadas, pausas_obligatorias,
      semana, anio, period_id, diagnostico)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING id`,
    [
      restaurantId, result.estado, result.tiempo_calculo_segundos, result.seed_usado,
      result.slots_persona_demanda, result.slots_persona_asignados, result.slots_persona_huecos,
      result.horas_persona_demanda, result.horas_persona_asignadas, result.horas_persona_huecos,
      JSON.stringify(result.metricas),
      JSON.stringify(result.huecos_cobertura),
      JSON.stringify(result.huecos_etiqueta),
      JSON.stringify(result.gaps_entre_jornadas),
      JSON.stringify(result.pausas_obligatorias),
      semana, anio, periodId,
      result.diagnostico ? JSON.stringify(result.diagnostico) : null,
    ]
  );

  // Save assignments
  const workerIds = await sql(
    "SELECT id, nombre FROM workers WHERE restaurant_id = $1",
    [restaurantId]
  );
  const nameToId = Object.fromEntries(workerIds.map((w) => [w.nombre as string, w.id as string]));

  for (const ct of result.cuadrante) {
    const workerId = nameToId[ct.nombre];
    if (!workerId) continue;
    for (const jornada of ct.jornadas) {
      await sql(
        `INSERT INTO schedule_assignments (run_id, worker_id, dia, tipo, tramos, horas, requiere_pausa_20min)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (run_id, worker_id, dia) DO NOTHING`,
        [run.id, workerId, jornada.dia, jornada.tipo, JSON.stringify(jornada.tramos), jornada.horas, jornada.requiere_pausa_20min]
      );
    }
  }

  // Link the run to the period_week (replace any previous run)
  await sql(
    `UPDATE period_weeks SET schedule_run_id = $1
     WHERE period_id = $2 AND semana = $3 AND anio = $4`,
    [run.id, periodId, semana, anio]
  );

  return NextResponse.json({
    runId: run.id,
    estado: result.estado,
    huecos: result.slots_persona_huecos,
    cobertura_pct: Math.round(
      (result.slots_persona_asignados / Math.max(result.slots_persona_demanda, 1)) * 100
    ),
  });
}
