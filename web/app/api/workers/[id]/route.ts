import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  nombre: z.string().min(1).optional(),
  rol: z.enum(["CAMARERO_BASICO", "SEMI_ENCARGADO", "ENCARGADO", "DUENO"]).optional(),
  contrato: z.object({
    tipo: z.enum(["fijo", "horquilla"]),
    horas: z.number().nullable().optional(),
    min_horas: z.number().nullable().optional(),
    max_horas: z.number().nullable().optional(),
  }).optional(),
  etiquetas: z.array(z.string()).optional(),
  restricciones: z.record(z.string(), z.unknown()).optional(),
});

async function getRestaurantId(): Promise<string | null> {
  const session = await auth();
  if (!session) return null;
  return (session.user as { restaurantId?: string }).restaurantId ?? null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await sql(
    `SELECT w.id, w.nombre, w.rol, w.created_at,
            c.tipo, c.horas, c.min_horas, c.max_horas,
            COALESCE(array_agg(wt.etiqueta) FILTER (WHERE wt.etiqueta IS NOT NULL), '{}') as etiquetas,
            wr.restricciones
     FROM workers w
     LEFT JOIN contracts c ON c.worker_id = w.id
     LEFT JOIN worker_tags wt ON wt.worker_id = w.id
     LEFT JOIN worker_restrictions wr ON wr.worker_id = w.id
     WHERE w.id = $1 AND w.restaurant_id = $2
     GROUP BY w.id, w.nombre, w.rol, w.created_at, c.tipo, c.horas, c.min_horas, c.max_horas, wr.restricciones`,
    [id, restaurantId]
  );

  if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const owns = await sql("SELECT id FROM workers WHERE id = $1 AND restaurant_id = $2", [id, restaurantId]);
  if (!owns[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);

    if (data.nombre || data.rol) {
      const fields: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (data.nombre) { fields.push(`nombre = $${i++}`); vals.push(data.nombre.toUpperCase()); }
      if (data.rol) { fields.push(`rol = $${i++}`); vals.push(data.rol); }
      vals.push(id);
      await sql(`UPDATE workers SET ${fields.join(", ")} WHERE id = $${i}`, vals);
    }

    if (data.contrato) {
      await sql(
        `UPDATE contracts SET tipo=$1, horas=$2, min_horas=$3, max_horas=$4 WHERE worker_id=$5`,
        [data.contrato.tipo, data.contrato.horas ?? null, data.contrato.min_horas ?? null, data.contrato.max_horas ?? null, id]
      );
    }

    if (data.etiquetas !== undefined) {
      await sql("DELETE FROM worker_tags WHERE worker_id = $1", [id]);
      for (const e of data.etiquetas) {
        await sql("INSERT INTO worker_tags (worker_id, etiqueta) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, e]);
      }
    }

    if (data.restricciones !== undefined) {
      await sql(
        "INSERT INTO worker_restrictions (worker_id, restricciones) VALUES ($1, $2) ON CONFLICT (worker_id) DO UPDATE SET restricciones = EXCLUDED.restricciones, updated_at = now()",
        [id, JSON.stringify(data.restricciones)]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const restaurantId = await getRestaurantId();
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const owns = await sql("SELECT id FROM workers WHERE id = $1 AND restaurant_id = $2", [id, restaurantId]);
  if (!owns[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await sql("DELETE FROM workers WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
