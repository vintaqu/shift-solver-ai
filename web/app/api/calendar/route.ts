import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()));

  const [runs, months] = await Promise.all([
    sql(
      `SELECT id, estado, created_at, semana, anio,
              slots_persona_asignados, slots_persona_demanda
       FROM schedule_runs
       WHERE restaurant_id = $1
       ORDER BY created_at DESC`,
      [restaurantId]
    ),
    sql(
      `SELECT mes, cerrado_at FROM calendar_months
       WHERE restaurant_id = $1 AND anio = $2`,
      [restaurantId, year]
    ),
  ]);

  return NextResponse.json({ runs, months });
}
