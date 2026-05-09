import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { z } from "zod";

const needSchema = z.object({
  dia: z.string(),
  inicio: z.string(),
  fin: z.string(),
  personas: z.number().int().min(0),
  personas_por_rol: z.record(z.string(), z.number()).default({}),
  etiquetas: z.array(z.string()).default([]),
});

const bulkSchema = z.object({
  franjas: z.array(needSchema),
});

async function getRestaurantId() {
  const session = await auth();
  if (!session) return null;
  return (session.user as { restaurantId?: string }).restaurantId ?? null;
}

export async function GET(req: NextRequest) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const dia = req.nextUrl.searchParams.get("dia");
  const query = dia
    ? "SELECT * FROM shift_needs WHERE restaurant_id = $1 AND dia = $2 ORDER BY inicio"
    : "SELECT * FROM shift_needs WHERE restaurant_id = $1 ORDER BY dia, inicio";
  const args = dia ? [restaurantId, dia] : [restaurantId];

  const rows = await sql(query, args);
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { franjas } = bulkSchema.parse(body);

    for (const f of franjas) {
      await sql(
        `INSERT INTO shift_needs (restaurant_id, dia, inicio, fin, personas, personas_por_rol, etiquetas)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (restaurant_id, dia, inicio, fin)
         DO UPDATE SET personas = EXCLUDED.personas,
                       personas_por_rol = EXCLUDED.personas_por_rol,
                       etiquetas = EXCLUDED.etiquetas`,
        [restaurantId, f.dia, f.inicio, f.fin, f.personas, JSON.stringify(f.personas_por_rol), f.etiquetas]
      );
    }

    return NextResponse.json({ ok: true, count: franjas.length });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
