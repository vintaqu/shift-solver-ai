import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  nombre: z.string().min(1).max(120).nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { nombre } = patchSchema.parse(body);

  const owns = await sql(
    "SELECT id FROM schedule_runs WHERE id = $1 AND restaurant_id = $2",
    [runId, restaurantId]
  );
  if (!owns[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await sql(
    "UPDATE schedule_runs SET nombre = $1 WHERE id = $2",
    [nombre, runId]
  );

  return NextResponse.json({ ok: true });
}
