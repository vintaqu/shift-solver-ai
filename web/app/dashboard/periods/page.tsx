import { auth } from "@/auth";
import sql from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Calendar, ChevronRight, Clock, CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const TIPO_LABEL: Record<string, string> = {
  mes: "Mes",
  trimestre: "Trimestre",
  anio: "Año",
  custom: "Personalizado",
};

export default async function PeriodsPage() {
  const session = await auth();
  const restaurantId = (session!.user as { restaurantId?: string }).restaurantId;
  if (!restaurantId) return <p className="text-slate-400">Sin restaurante.</p>;

  const periods = await sql(
    `SELECT p.id, p.nombre, p.tipo, p.fecha_inicio, p.fecha_fin, p.estado, p.created_at,
            (SELECT COUNT(*) FROM period_weeks WHERE period_id = p.id) as total_semanas,
            (SELECT COUNT(*) FROM period_weeks
              WHERE period_id = p.id AND schedule_run_id IS NOT NULL) as semanas_generadas
     FROM planning_periods p
     WHERE p.restaurant_id = $1
     ORDER BY p.fecha_inicio DESC, p.created_at DESC`,
    [restaurantId]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Planificación a largo plazo</h1>
          <p className="text-slate-400 text-sm mt-1">
            Genera cuadrantes para todo un mes, trimestre o año respetando
            contratos y compensación de horas semana a semana.
          </p>
        </div>
        <Link href="/dashboard/periods/new">
          <Button className="bg-indigo-600 hover:bg-indigo-500">
            <Plus className="h-4 w-4 mr-2" /> Nuevo periodo
          </Button>
        </Link>
      </div>

      {periods.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 py-16 text-center">
          <Calendar className="h-12 w-12 text-slate-700 mx-auto mb-3" />
          <p className="text-white font-semibold">Sin periodos planificados</p>
          <p className="text-slate-500 text-sm mt-1 mb-5">
            Crea tu primer mes, trimestre o año para empezar a planificar a largo plazo.
          </p>
          <Link href="/dashboard/periods/new">
            <Button className="bg-indigo-600 hover:bg-indigo-500">
              <Plus className="h-4 w-4 mr-2" /> Crear primer periodo
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {periods.map((p) => {
            const total = Number(p.total_semanas);
            const done = Number(p.semanas_generadas);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const isComplete = total > 0 && done === total;

            return (
              <Link
                key={p.id as string}
                href={`/dashboard/periods/${p.id}`}
                className="block rounded-xl border border-slate-800 bg-slate-900 hover:border-indigo-500/40 transition-colors group"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-slate-800 text-slate-400 border border-slate-700 text-xs">
                        {TIPO_LABEL[p.tipo as string]}
                      </Badge>
                      {isComplete && (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Completo
                        </Badge>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-indigo-400 transition" />
                  </div>

                  <h3 className="text-white font-semibold text-lg mb-1 group-hover:text-indigo-300 transition">
                    {p.nombre as string}
                  </h3>
                  <p className="text-slate-500 text-xs mb-4 flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {format(new Date(p.fecha_inicio as string), "d MMM", { locale: es })}
                    {" – "}
                    {format(new Date(p.fecha_fin as string), "d MMM yyyy", { locale: es })}
                  </p>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Progreso</span>
                      <span className="text-slate-300 font-medium">
                        {done}/{total} semanas
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isComplete ? "bg-emerald-500" : "bg-indigo-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
