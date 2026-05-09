import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  runId: z.string().uuid(),
  semana: z.number().int().min(1).max(53).nullable(),
  anio: z.number().int().nullable(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { runId, semana, anio } = schema.parse(body);

  const owns = await sql(
    "SELECT id FROM schedule_runs WHERE id = $1 AND restaurant_id = $2",
    [runId, restaurantId]
  );
  if (!owns[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await sql(
    "UPDATE schedule_runs SET semana = $1, anio = $2 WHERE id = $3",
    [semana, anio, runId]
  );

  return NextResponse.json({ ok: true });
}
