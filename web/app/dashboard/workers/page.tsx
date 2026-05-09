import { auth } from "@/auth";
import sql from "@/lib/db";
import { ROL_LABELS, type WorkerRol } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import Link from "next/link";
import WorkerDeleteButton from "@/components/workers/worker-delete-button";

const ROL_COLORS: Record<WorkerRol, string> = {
  DUENO: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ENCARGADO: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  SEMI_ENCARGADO: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  CAMARERO_BASICO: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export default async function WorkersPage() {
  const session = await auth();
  const restaurantId = (session!.user as { restaurantId?: string }).restaurantId;

  if (!restaurantId) return <p className="text-slate-400">Sin restaurante.</p>;

  const workers = await sql(
    `SELECT w.id, w.nombre, w.rol,
            c.tipo, c.horas, c.min_horas, c.max_horas,
            COALESCE(array_agg(wt.etiqueta) FILTER (WHERE wt.etiqueta IS NOT NULL), '{}') as etiquetas
     FROM workers w
     LEFT JOIN contracts c ON c.worker_id = w.id
     LEFT JOIN worker_tags wt ON wt.worker_id = w.id
     WHERE w.restaurant_id = $1
     GROUP BY w.id, w.nombre, w.rol, c.tipo, c.horas, c.min_horas, c.max_horas
     ORDER BY w.nombre`,
    [restaurantId]
  );

  function contratoLabel(w: Record<string, unknown>) {
    if (w.tipo === "fijo") return `${w.horas}h/sem`;
    return `${w.min_horas}-${w.max_horas}h/sem`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trabajadores</h1>
          <p className="text-slate-400 text-sm mt-1">{workers.length} empleados en plantilla</p>
        </div>
        <Link href="/dashboard/workers/new">
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" /> Añadir
          </Button>
        </Link>
      </div>

      {workers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Users className="h-12 w-12 text-slate-700 mb-4" />
          <h2 className="text-white font-semibold text-lg">Sin trabajadores</h2>
          <p className="text-slate-500 text-sm mt-1 mb-6">Añade tu plantilla para generar cuadrantes.</p>
          <Link href="/dashboard/workers/new">
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4 mr-2" /> Añadir primer trabajador
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workers.map((w) => (
            <Card key={w.id as string} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white">{w.nombre as string}</h3>
                    <p className="text-slate-500 text-xs mt-0.5">{contratoLabel(w as Record<string, unknown>)}</p>
                  </div>
                  <Badge className={`${ROL_COLORS[w.rol as WorkerRol]} border text-xs`}>
                    {ROL_LABELS[w.rol as WorkerRol]}
                  </Badge>
                </div>

                {Array.isArray(w.etiquetas) && w.etiquetas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {(w.etiquetas as string[]).map((e) => (
                      <span key={e} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                        {e}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 mt-2">
                  <Link href={`/dashboard/workers/${w.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800">
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                  </Link>
                  <WorkerDeleteButton workerId={w.id as string} workerName={w.nombre as string} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
