import { auth } from "@/auth";
import sql from "@/lib/db";
import ScheduleGeneratePanel from "@/components/schedule/schedule-generate-panel";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { CalendarDays, Clock, TrendingUp } from "lucide-react";

export default async function SchedulePage() {
  const session = await auth();
  const restaurantId = (session!.user as { restaurantId?: string }).restaurantId;
  if (!restaurantId) return <p className="text-slate-400">Sin restaurante.</p>;

  const runs = await sql(
    `SELECT id, estado, created_at, tiempo_calculo_seg,
            slots_persona_asignados, slots_persona_demanda, slots_persona_huecos
     FROM schedule_runs WHERE restaurant_id = $1
     ORDER BY created_at DESC LIMIT 20`,
    [restaurantId]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Cuadrante</h1>
        <p className="text-slate-400 text-sm mt-1">Genera y consulta los cuadrantes horarios semanales.</p>
      </div>

      <ScheduleGeneratePanel />

      {runs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-300">Historial</h2>
          <div className="space-y-2">
            {runs.map((r) => {
              const coverage = Math.round(
                (Number(r.slots_persona_asignados) / Math.max(Number(r.slots_persona_demanda), 1)) * 100
              );
              return (
                <Link
                  key={r.id as string}
                  href={`/dashboard/schedule/${r.id}`}
                  className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <CalendarDays className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium group-hover:text-indigo-300 transition-colors">
                        {new Date(r.created_at as string).toLocaleDateString("es-ES", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-slate-500 text-xs flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Number(r.tiempo_calculo_seg).toFixed(1)}s
                        </span>
                        <span className="text-slate-500 text-xs flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {coverage}% cobertura
                        </span>
                        {Number(r.slots_persona_huecos) > 0 && (
                          <span className="text-red-400 text-xs">
                            {String(r.slots_persona_huecos)} huecos
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <RunBadge estado={r.estado as string} />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RunBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    OPTIMAL:   { label: "Óptimo",    cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    FEASIBLE:  { label: "Factible",  cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    INFEASIBLE:{ label: "Infactible",cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const { label, cls } = map[estado] ?? { label: estado, cls: "bg-slate-700 text-slate-400" };
  return <Badge className={`${cls} border text-xs flex-shrink-0`}>{label}</Badge>;
}
