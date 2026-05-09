import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { z } from "zod";

const workerSchema = z.object({
  nombre: z.string().min(1),
  rol: z.enum(["CAMARERO_BASICO", "SEMI_ENCARGADO", "ENCARGADO", "DUENO"]),
  contrato: z.object({
    tipo: z.enum(["fijo", "horquilla"]),
    horas: z.number().nullable().optional(),
    min_horas: z.number().nullable().optional(),
    max_horas: z.number().nullable().optional(),
  }),
  etiquetas: z.array(z.string()).default([]),
  restricciones: z.object({
    dias_libres: z.array(z.string()).default([]),
    no_antes_de: z.array(z.object({ hora: z.string(), dias: z.union([z.string(), z.array(z.string())]) })).default([]),
    no_despues_de: z.array(z.object({ hora: z.string(), dias: z.union([z.string(), z.array(z.string())]) })).default([]),
    trabajar_obligatorio: z.array(z.object({ dia: z.string(), desde: z.string(), hasta: z.string() })).default([]),
    texto_pdf: z.string().optional(),
  }).default({ dias_libres: [], no_antes_de: [], no_despues_de: [], trabajar_obligatorio: [] }),
});

async function getRestaurantId(req: NextRequest) {
  const session = await auth();
  if (!session) return null;
  return (session.user as { restaurantId?: string }).restaurantId ?? null;
}

export async function GET(req: NextRequest) {
  const restaurantId = await getRestaurantId(req);
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const workers = await sql(
    `SELECT w.id, w.nombre, w.rol, w.created_at,
            c.tipo, c.horas, c.min_horas, c.max_horas,
            COALESCE(array_agg(wt.etiqueta) FILTER (WHERE wt.etiqueta IS NOT NULL), '{}') as etiquetas,
            wr.restricciones
     FROM workers w
     LEFT JOIN contracts c ON c.worker_id = w.id
     LEFT JOIN worker_tags wt ON wt.worker_id = w.id
     LEFT JOIN worker_restrictions wr ON wr.worker_id = w.id
     WHERE w.restaurant_id = $1
     GROUP BY w.id, w.nombre, w.rol, w.created_at, c.tipo, c.horas, c.min_horas, c.max_horas, wr.restricciones
     ORDER BY w.nombre`,
    [restaurantId]
  );

  return NextResponse.json(workers);
}

export async function POST(req: NextRequest) {
  const restaurantId = await getRestaurantId(req);
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = workerSchema.parse(body);

    const [worker] = await sql(
      "INSERT INTO workers (restaurant_id, nombre, rol) VALUES ($1, $2, $3) RETURNING id",
      [restaurantId, data.nombre.toUpperCase(), data.rol]
    );

    await sql(
      "INSERT INTO contracts (worker_id, tipo, horas, min_horas, max_horas) VALUES ($1, $2, $3, $4, $5)",
      [worker.id, data.contrato.tipo, data.contrato.horas ?? null, data.contrato.min_horas ?? null, data.contrato.max_horas ?? null]
    );

    if (data.etiquetas.length > 0) {
      for (const etiqueta of data.etiquetas) {
        await sql("INSERT INTO worker_tags (worker_id, etiqueta) VALUES ($1, $2) ON CONFLICT DO NOTHING", [worker.id, etiqueta]);
      }
    }

    await sql(
      "INSERT INTO worker_restrictions (worker_id, restricciones) VALUES ($1, $2) ON CONFLICT (worker_id) DO UPDATE SET restricciones = EXCLUDED.restricciones",
      [worker.id, JSON.stringify(data.restricciones)]
    );

    return NextResponse.json({ id: worker.id }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Datos inválidos", details: e.issues }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
