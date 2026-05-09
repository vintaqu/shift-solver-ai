import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  anio: z.number().int(),
  mes: z.number().int().min(1).max(12),
  cerrado: z.boolean(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { anio, mes, cerrado } = schema.parse(body);

  if (cerrado) {
    await sql(
      `INSERT INTO calendar_months (restaurant_id, anio, mes, cerrado_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (restaurant_id, anio, mes) DO UPDATE SET cerrado_at = now()`,
      [restaurantId, anio, mes]
    );
  } else {
    await sql(
      "DELETE FROM calendar_months WHERE restaurant_id = $1 AND anio = $2 AND mes = $3",
      [restaurantId, anio, mes]
    );
  }

  return NextResponse.json({ ok: true });
}
