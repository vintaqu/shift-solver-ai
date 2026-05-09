import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  runId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { runId } = schema.parse(body);

  const rows = await sql<{ variant_group_id: string | null }>(
    "SELECT variant_group_id FROM schedule_runs WHERE id = $1 AND restaurant_id = $2",
    [runId, restaurantId]
  );
  if (!rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const groupId = rows[0].variant_group_id;
  if (!groupId) return NextResponse.json({ error: "Run sin grupo de variantes" }, { status: 400 });

  await sql(
    "UPDATE schedule_runs SET variant_chosen = (id = $1) WHERE variant_group_id = $2",
    [runId, groupId]
  );

  return NextResponse.json({ ok: true });
}
