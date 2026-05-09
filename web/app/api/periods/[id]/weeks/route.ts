import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { z } from "zod";

const putSchema = z.object({
  semana: z.number().int().min(1).max(53),
  anio: z.number().int(),
  target_hours: z.record(z.string(), z.number().min(0).max(60)),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { semana, anio, target_hours } = putSchema.parse(body);

  const owns = await sql(
    "SELECT id FROM planning_periods WHERE id = $1 AND restaurant_id = $2",
    [id, restaurantId]
  );
  if (!owns[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await sql(
    `UPDATE period_weeks SET target_hours = $1
     WHERE period_id = $2 AND semana = $3 AND anio = $4`,
    [JSON.stringify(target_hours), id, semana, anio]
  );

  return NextResponse.json({ ok: true });
}
