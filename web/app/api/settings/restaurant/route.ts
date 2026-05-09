import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { z } from "zod";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const restaurantId = (session.user as { restaurantId?: string }).restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "Sin restaurante" }, { status: 400 });

  try {
    const { nombre } = z.object({ nombre: z.string().min(2) }).parse(await req.json());
    await sql("UPDATE restaurants SET nombre = $1 WHERE id = $2", [nombre, restaurantId]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
