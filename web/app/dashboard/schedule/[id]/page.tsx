import { auth } from "@/auth";
import sql from "@/lib/db";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, AlertCircle, Clock, BarChart3 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ScheduleGrid from "@/components/schedule/schedule-grid";
import { DIAS, DIA_LABELS, ROL_LABELS, type WorkerRol, type ScheduleRun, type ScheduleAssignment } from "@/lib/types";

export default async function ScheduleRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const restaurantId = (session!.user as { restaurantId?: string }).restaurantId;

  const [runs, assignments] = await Promise.all([
    sql(
      "SELECT * FROM schedule_runs WHERE id = $1 AND restaurant_id = $2",
      [id, restaurantId]
    ),
    sql(
      `SELECT sa.*, w.nombre as worker_nombre, w.rol as worker_rol
       FROM schedule_assignments sa
       JOIN workers w ON w.id = sa.worker_id
       WHERE sa.run_id = $1
       ORDER BY w.nombre, sa.dia`,
      [id]
    ),
  ]);

  if (!runs[0]) notFound();
  const run = runs[0] as unknown as ScheduleRun;
  const coverage = Math.round(
    (run.slots_persona_asignados / Math.max(run.slots_persona_demanda, 1)) * 100
  );

  const assignmentsByWorker: Record<string, ScheduleAssignment[]> = {};
  for (const a of assignments) {
    const key = a.worker_nombre as string;
    if (!assignmentsByWorker[key]) assignmentsByWorker[key] = [];
    assignmentsByWorker[key].push(a as unknown as ScheduleAssignment);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/schedule" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white truncate">Cuadrante semanal</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {new Date(run.created_at).toLocaleDateString("es-ES", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
        <RunBadge estado={run.estado} />
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Cobertura"
          value={`${coverage}%`}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          color={coverage >= 95 ? "emerald" : coverage >= 80 ? "amber" : "red"}
        />
        <MetricCard
          label="Huecos"
          value={run.slots_persona_huecos}
          icon={<AlertCircle className="h-4 w-4 text-red-400" />}
          color={run.slots_persona_huecos === 0 ? "emerald" : "red"}
        />
        <MetricCard
          label="Tiempo cálculo"
          value={`${run.tiempo_calculo_seg?.toFixed(1)}s`}
          icon={<Clock className="h-4 w-4 text-indigo-400" />}
          color="indigo"
        />
        {run.metricas && (
          <MetricCard
            label="Jornadas"
            value={`${run.metricas.total_continuadas}C / ${run.metricas.total_partidas}P`}
            icon={<BarChart3 className="h-4 w-4 text-amber-400" />}
            color="amber"
          />
        )}
      </div>

      {/* Cuadrícula semanal */}
      <ScheduleGrid assignmentsByWorker={assignmentsByWorker} />

      {/* Huecos */}
      {run.huecos_cobertura && run.huecos_cobertura.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              Huecos detectados ({run.huecos_cobertura.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 text-sm mb-3">
              Slots que no se pudieron cubrir completamente con la plantilla actual y las restricciones legales.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-slate-800">
                    <th className="text-left pb-2">Día</th>
                    <th className="text-left pb-2">Horario</th>
                    <th className="text-right pb-2">Demanda</th>
                    <th className="text-right pb-2">Cubierto</th>
                    <th className="text-right pb-2">Falta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {run.huecos_cobertura.map((h, i) => (
                    <tr key={i} className="text-slate-300">
                      <td className="py-2">{DIA_LABELS[h.dia]}</td>
                      <td className="py-2 font-mono text-xs">{h.inicio}–{h.fin}</td>
                      <td className="py-2 text-right">{h.demanda_total}</td>
                      <td className="py-2 text-right">{h.cubierto}</td>
                      <td className="py-2 text-right text-red-400 font-medium">{h.falta_personas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({
  label, value, icon, color,
}: {
  label: string; value: string | number; icon: React.ReactNode; color: string;
}) {
  const bg: Record<string, string> = {
    emerald: "bg-emerald-500/10", amber: "bg-amber-500/10",
    red: "bg-red-500/10", indigo: "bg-indigo-500/10",
  };
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-slate-400 text-xs">{label}</p>
          <div className={`p-1.5 rounded-md ${bg[color]}`}>{icon}</div>
        </div>
        <p className="text-2xl font-bold text-white">{value}</p>
      </CardContent>
    </Card>
  );
}

function RunBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    OPTIMAL:    { label: "Óptimo",     cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    FEASIBLE:   { label: "Factible",   cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    INFEASIBLE: { label: "Infactible", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const { label, cls } = map[estado] ?? { label: estado, cls: "bg-slate-700 text-slate-400 border-slate-600" };
  return <Badge className={`${cls} border text-xs`}>{label}</Badge>;
}
