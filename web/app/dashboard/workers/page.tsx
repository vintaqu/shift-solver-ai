import { auth } from "@/auth";
import sql from "@/lib/db";
import { type WorkerRol } from "@/lib/types";
import WorkersTable, { type WorkerRow } from "@/components/workers/workers-table";

export default async function WorkersPage() {
  const session = await auth();
  const restaurantId = (session!.user as { restaurantId?: string }).restaurantId;
  if (!restaurantId) return <p className="text-slate-400">Sin restaurante.</p>;

  const rows = await sql(
    `SELECT w.id, w.nombre, w.rol,
            c.tipo, c.horas, c.min_horas, c.max_horas,
            COALESCE(array_agg(wt.etiqueta ORDER BY wt.etiqueta)
              FILTER (WHERE wt.etiqueta IS NOT NULL), '{}') as etiquetas
     FROM workers w
     LEFT JOIN contracts c ON c.worker_id = w.id
     LEFT JOIN worker_tags wt ON wt.worker_id = w.id
     WHERE w.restaurant_id = $1
     GROUP BY w.id, w.nombre, w.rol, c.tipo, c.horas, c.min_horas, c.max_horas
     ORDER BY w.nombre`,
    [restaurantId]
  );

  const workers: WorkerRow[] = rows.map((r) => ({
    id: r.id as string,
    nombre: r.nombre as string,
    rol: r.rol as WorkerRol,
    tipo: r.tipo as "fijo" | "horquilla",
    horas: r.horas as number | null,
    min_horas: r.min_horas as number | null,
    max_horas: r.max_horas as number | null,
    etiquetas: r.etiquetas as string[],
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Trabajadores</h1>
        <p className="text-slate-400 text-sm mt-1">
          {workers.length} empleados en plantilla
        </p>
      </div>
      <WorkersTable workers={workers} />
    </div>
  );
}
