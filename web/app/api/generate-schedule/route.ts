import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";

const SOLVER_URL = process.env.SOLVER_API_URL!;
const SOLVER_KEY = process.env.SOLVER_API_KEY ?? "";

const DIAS_ORDER = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"];
const HORARIO_APERTURA: Record<string, { apertura: string; cierre: string }> = {
  LUNES:     { apertura: "06:00", cierre: "00:00" },
  MARTES:    { apertura: "06:00", cierre: "00:00" },
  MIERCOLES: { apertura: "06:00", cierre: "00:00" },
  JUEVES:    { apertura: "06:00", cierre: "00:00" },
  VIERNES:   { apertura: "06:00", cierre: "00:00" },
  SABADO:    { apertura: "06:30", cierre: "00:00" },
  DOMINGO:   { apertura: "06:30", cierre: "00:00" },
};

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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const restaurantId = (session.user as { restaurantId?: string }).restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "Sin restaurante" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const numVariants: number = Math.max(1, Math.min(5, parseInt(body.num_variants ?? "3")));
  const timeLimit: number = body.time_limit ?? 60;

  const workers = await sql(
    `SELECT w.nombre, w.rol,
            c.tipo, c.horas, c.min_horas, c.max_horas,
            COALESCE(array_agg(wt.etiqueta) FILTER (WHERE wt.etiqueta IS NOT NULL), '{}') as etiquetas,
            wr.restricciones
     FROM workers w
     LEFT JOIN contracts c ON c.worker_id = w.id
     LEFT JOIN worker_tags wt ON wt.worker_id = w.id
     LEFT JOIN worker_restrictions wr ON wr.worker_id = w.id
     WHERE w.restaurant_id = $1
     GROUP BY w.nombre, w.rol, c.tipo, c.horas, c.min_horas, c.max_horas, wr.restricciones
     ORDER BY w.nombre`,
    [restaurantId]
  );

  if (workers.length === 0) {
    return NextResponse.json({ error: "Sin trabajadores. Añade tu plantilla primero." }, { status: 400 });
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

  const solverRequest = {
    dias: DIAS_ORDER,
    roles_jerarquia: ["CAMARERO_BASICO", "SEMI_ENCARGADO", "ENCARGADO", "DUENO"],
    etiquetas: ["PASTAS","APERTURA","CAJERA","BARISTA","BANDEJERA","PLANCHISTA","COMANDERA","BARRA","DELIVERY","CIERRE","CONTABLE"],
    slot_duracion_min: 30,
    horario_apertura: HORARIO_APERTURA,
    trabajadores: workers.map((w) => ({
      nombre: w.nombre,
      rol: w.rol,
      etiquetas: w.etiquetas,
      contrato: w.tipo === "fijo"
        ? { tipo: "fijo", horas: w.horas }
        : { tipo: "horquilla", min_horas: w.min_horas, max_horas: w.max_horas },
      restricciones: w.restricciones ?? {},
    })),
    franjas_num,
    franjas_rol,
    franjas_eti,
    parametros: { time_limit_seconds: timeLimit },
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (SOLVER_KEY) headers["x-api-key"] = SOLVER_KEY;

  let solverRes: Response;
  try {
    solverRes = await fetch(`${SOLVER_URL}/solve-variants`, {
      method: "POST",
      headers,
      body: JSON.stringify({ request: solverRequest, num_variants: numVariants }),
      signal: AbortSignal.timeout((timeLimit * numVariants + 30) * 1000),
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo contactar el solver: ${(e as Error).message}` }, { status: 502 });
  }

  if (!solverRes.ok) {
    const err = await solverRes.text();
    return NextResponse.json({ error: `Solver error ${solverRes.status}: ${err}` }, { status: 502 });
  }

  const result = (await solverRes.json()) as { variants: SolverResponse[] };
  if (!result.variants || result.variants.length === 0) {
    return NextResponse.json({ error: "El solver no devolvió variantes" }, { status: 502 });
  }

  // Sort variants: fewer huecos first, then fewer partidas, then faster
  const sorted = [...result.variants].sort((a, b) => {
    const aH = (a as { metricas?: { total_partidas?: number } }).metricas?.total_partidas ?? 0;
    const bH = (b as { metricas?: { total_partidas?: number } }).metricas?.total_partidas ?? 0;
    if (a.slots_persona_huecos !== b.slots_persona_huecos)
      return a.slots_persona_huecos - b.slots_persona_huecos;
    if (aH !== bH) return aH - bH;
    return a.tiempo_calculo_segundos - b.tiempo_calculo_segundos;
  });

  // Generate group id
  const [{ uuid: groupId }] = await sql<{ uuid: string }>("SELECT gen_random_uuid()::text as uuid");

  // Workers id lookup for assignments
  const workerIds = await sql(
    "SELECT id, nombre FROM workers WHERE restaurant_id = $1",
    [restaurantId]
  );
  const nameToId = Object.fromEntries(workerIds.map((w) => [w.nombre as string, w.id as string]));

  const runIds: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const v = sorted[i];
    const [run] = await sql<{ id: string }>(
      `INSERT INTO schedule_runs
       (restaurant_id, estado, tiempo_calculo_seg, seed_usado,
        slots_persona_demanda, slots_persona_asignados, slots_persona_huecos,
        horas_persona_demanda, horas_persona_asignadas, horas_persona_huecos,
        metricas, huecos_cobertura, huecos_etiqueta, gaps_entre_jornadas, pausas_obligatorias,
        variant_group_id, variant_index, diagnostico)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [
        restaurantId, v.estado, v.tiempo_calculo_segundos, v.seed_usado,
        v.slots_persona_demanda, v.slots_persona_asignados, v.slots_persona_huecos,
        v.horas_persona_demanda, v.horas_persona_asignadas, v.horas_persona_huecos,
        JSON.stringify(v.metricas),
        JSON.stringify(v.huecos_cobertura),
        JSON.stringify(v.huecos_etiqueta),
        JSON.stringify(v.gaps_entre_jornadas),
        JSON.stringify(v.pausas_obligatorias),
        groupId, i,
        v.diagnostico ? JSON.stringify(v.diagnostico) : null,
      ]
    );
    runIds.push(run.id);

    for (const ct of v.cuadrante) {
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
  }

  return NextResponse.json({
    groupId,
    runIds,
    numVariants: sorted.length,
    bestEstado: sorted[0].estado,
  });
}
