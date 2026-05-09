import { auth } from "@/auth";
import sql from "@/lib/db";
import NeedsEditor from "@/components/needs/needs-editor";

export default async function NeedsPage() {
  const session = await auth();
  const restaurantId = (session!.user as { restaurantId?: string }).restaurantId;
  if (!restaurantId) return <p className="text-slate-400">Sin restaurante.</p>;

  const needs = await sql(
    "SELECT * FROM shift_needs WHERE restaurant_id = $1 ORDER BY dia, inicio",
    [restaurantId]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Necesidades del restaurante</h1>
        <p className="text-slate-400 text-sm mt-1">
          Define cuántas personas, qué roles y qué habilidades necesitas en cada franja horaria.
        </p>
      </div>
      <NeedsEditor initialNeeds={needs as unknown as import("@/lib/types").ShiftNeed[]} />
    </div>
  );
}
