import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { z } from "zod";
import {
  computeCoverage,
  inferTipo,
  totalHoras,
  validateTramos,
  type AssignmentRow,
  type NeedRow,
} from "@/lib/schedule-coverage";

const tramoSchema = z.object({
  inicio: z.string().regex(/^\d{2}:\d{2}$/),
  fin: z.string().regex(/^\d{2}:\d{2}$/),
  duracion_horas: z.number().optional(),
});

const putSchema = z.object({
  workerId: z.string().uuid(),
  dia: z.enum(["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO","DOMINGO"]),
  tramos: z.array(tramoSchema),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { workerId, dia, tramos } = putSchema.parse(body);

  // Ownership check on the run
  const owns = await sql(
    "SELECT id FROM schedule_runs WHERE id = $1 AND restaurant_id = $2",
    [runId, restaurantId]
  );
  if (!owns[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Validate tramos
  const err = validateTramos(tramos);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  // Worker must belong to same restaurant
  const w = await sql(
    "SELECT id FROM workers WHERE id = $1 AND restaurant_id = $2",
    [workerId, restaurantId]
  );
  if (!w[0]) return NextResponse.json({ error: "Trabajador no válido" }, { status: 400 });

  // Compute derived fields
  const tipo = inferTipo(tramos);
  const horas = totalHoras(tramos);
  const requiere_pausa = tipo === "continuada" && horas > 5;

  const tramosWithDur = tramos.map((t) => ({
    inicio: t.inicio,
    fin: t.fin,
    duracion_horas: t.duracion_horas,
  }));

  // Upsert assignment
  await sql(
    `INSERT INTO schedule_assignments
       (run_id, worker_id, dia, tipo, tramos, horas, requiere_pausa_20min)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (run_id, worker_id, dia) DO UPDATE
       SET tipo = EXCLUDED.tipo,
           tramos = EXCLUDED.tramos,
           horas = EXCLUDED.horas,
           requiere_pausa_20min = EXCLUDED.requiere_pausa_20min`,
    [runId, workerId, dia, tipo, JSON.stringify(tramosWithDur), horas, requiere_pausa]
  );

  // Recompute aggregate coverage from current state
  const [allAssignments, allNeeds] = await Promise.all([
    sql<AssignmentRow>(
      `SELECT worker_id, dia, tramos
       FROM schedule_assignments WHERE run_id = $1`,
      [runId]
    ),
    sql<NeedRow>(
      "SELECT dia, inicio, fin, personas FROM shift_needs WHERE restaurant_id = $1",
      [restaurantId]
    ),
  ]);

  // Convert tramos JSONB to array (pg returns it as object/array depending)
  const assignments: AssignmentRow[] = allAssignments.map((a) => ({
    worker_id: a.worker_id,
    dia: a.dia,
    tramos: typeof a.tramos === "string" ? JSON.parse(a.tramos) : (a.tramos ?? []),
  }));

  const stats = computeCoverage(allNeeds, assignments);

  await sql(
    `UPDATE schedule_runs
     SET slots_persona_demanda = $1,
         slots_persona_asignados = $2,
         slots_persona_huecos = $3,
         horas_persona_demanda = $4,
         horas_persona_asignadas = $5,
         horas_persona_huecos = $6,
         edited_at = now()
     WHERE id = $7`,
    [
      stats.demanda,
      stats.asignado,
      stats.huecos,
      stats.horas_demanda,
      stats.horas_asignadas,
      stats.horas_huecos,
      runId,
    ]
  );

  return NextResponse.json({
    ok: true,
    stats,
    assignment: { workerId, dia, tipo, tramos: tramosWithDur, horas },
  });
}
