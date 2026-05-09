import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  nombre: z.string().min(1).max(120).optional(),
  estado: z.enum(["planning", "generating", "active", "closed"]).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [period] = await sql(
    "SELECT id, nombre, tipo, fecha_inicio, fecha_fin, estado, created_at FROM planning_periods WHERE id = $1 AND restaurant_id = $2",
    [id, restaurantId]
  );
  if (!period) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const weeks = await sql(
    `SELECT pw.semana, pw.anio, pw.posicion, pw.target_hours, pw.schedule_run_id,
            r.estado as run_estado,
            r.slots_persona_demanda, r.slots_persona_asignados, r.slots_persona_huecos,
            r.tiempo_calculo_seg, r.created_at as run_created_at, r.nombre as run_nombre
     FROM period_weeks pw
     LEFT JOIN schedule_runs r ON r.id = pw.schedule_run_id
     WHERE pw.period_id = $1
     ORDER BY pw.posicion ASC`,
    [id]
  );

  return NextResponse.json({ period, weeks });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { nombre, estado } = patchSchema.parse(body);

  const owns = await sql(
    "SELECT id FROM planning_periods WHERE id = $1 AND restaurant_id = $2",
    [id, restaurantId]
  );
  if (!owns[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const updates: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (nombre !== undefined) { updates.push(`nombre = $${i++}`); vals.push(nombre); }
  if (estado !== undefined) { updates.push(`estado = $${i++}`); vals.push(estado); }
  if (updates.length === 0) return NextResponse.json({ ok: true });
  vals.push(id);

  await sql(
    `UPDATE planning_periods SET ${updates.join(", ")} WHERE id = $${i}`,
    vals
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const result = await sql(
    "DELETE FROM planning_periods WHERE id = $1 AND restaurant_id = $2 RETURNING id",
    [id, restaurantId]
  );
  if (result.length === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
