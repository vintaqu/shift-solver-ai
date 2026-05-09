import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  nombre: z.string().min(1).max(120),
  tipo: z.enum(["mes", "trimestre", "anio", "custom"]),
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weeks: z.array(z.object({
    semana: z.number().int().min(1).max(53),
    anio: z.number().int(),
    posicion: z.number().int().min(0),
  })).min(1).max(60),
  target_hours: z.record(z.string(), z.array(z.number().min(0).max(60))),
});

export async function GET() {
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const periods = await sql(
    `SELECT p.id, p.nombre, p.tipo, p.fecha_inicio, p.fecha_fin, p.estado, p.created_at,
            (SELECT COUNT(*) FROM period_weeks WHERE period_id = p.id) as total_semanas,
            (SELECT COUNT(*) FROM period_weeks
              WHERE period_id = p.id AND schedule_run_id IS NOT NULL) as semanas_generadas
     FROM planning_periods p
     WHERE p.restaurant_id = $1
     ORDER BY p.fecha_inicio DESC, p.created_at DESC`,
    [restaurantId]
  );

  return NextResponse.json({ periods });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const data = createSchema.parse(body);

  const [{ id }] = await sql<{ id: string }>(
    `INSERT INTO planning_periods (restaurant_id, nombre, tipo, fecha_inicio, fecha_fin)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [restaurantId, data.nombre, data.tipo, data.fecha_inicio, data.fecha_fin]
  );

  // Insert weeks with target_hours
  for (const w of data.weeks) {
    const targetForWeek: Record<string, number> = {};
    for (const [workerId, weeklyHours] of Object.entries(data.target_hours)) {
      if (w.posicion < weeklyHours.length) {
        targetForWeek[workerId] = weeklyHours[w.posicion];
      }
    }
    await sql(
      `INSERT INTO period_weeks (period_id, semana, anio, posicion, target_hours)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, w.semana, w.anio, w.posicion, JSON.stringify(targetForWeek)]
    );
  }

  return NextResponse.json({ id, periodId: id });
}
