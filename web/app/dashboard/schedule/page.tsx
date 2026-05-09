import { auth } from "@/auth";
import sql from "@/lib/db";
import ScheduleGeneratePanel from "@/components/schedule/schedule-generate-panel";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { CalendarDays, Clock, TrendingUp, Layers, Crown } from "lucide-react";

interface Run {
  id: string;
  nombre: string | null;
  estado: string;
  created_at: string;
  tiempo_calculo_seg: number;
  slots_persona_asignados: number;
  slots_persona_demanda: number;
  slots_persona_huecos: number;
  variant_group_id: string | null;
  variant_index: number | null;
  variant_chosen: boolean;
}

export default async function SchedulePage() {
  const session = await auth();
  const restaurantId = (session!.user as { restaurantId?: string }).restaurantId;
  if (!restaurantId) return <p className="text-slate-400">Sin restaurante.</p>;

  const runs = (await sql(
    `SELECT id, nombre, estado, created_at, tiempo_calculo_seg,
            slots_persona_asignados, slots_persona_demanda, slots_persona_huecos,
            variant_group_id, variant_index, variant_chosen
     FROM schedule_runs WHERE restaurant_id = $1
     ORDER BY created_at DESC LIMIT 60`,
    [restaurantId]
  )) as unknown as Run[];

  // Group runs by variant_group_id
  type Entry =
    | { type: "single"; run: Run }
    | { type: "group"; groupId: string; runs: Run[]; createdAt: string };

  const seenGroups = new Set<string>();
  const grouped: Entry[] = [];

  for (const r of runs) {
    if (r.variant_group_id) {
      if (seenGroups.has(r.variant_group_id)) continue;
      seenGroups.add(r.variant_group_id);
      const groupRuns = runs
        .filter((x) => x.variant_group_id === r.variant_group_id)
        .sort((a, b) => (a.variant_index ?? 0) - (b.variant_index ?? 0));
      grouped.push({
        type: "group",
        groupId: r.variant_group_id,
        runs: groupRuns,
        createdAt: groupRuns[0].created_at,
      });
    } else {
      grouped.push({ type: "single", run: r });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Cuadrante</h1>
        <p className="text-slate-400 text-sm mt-1">
          Genera variantes alternativas y consulta el historial completo.
        </p>
      </div>

      <ScheduleGeneratePanel />

      {grouped.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-300">Historial</h2>
          <div className="space-y-2">
            {grouped.map((entry) => {
              if (entry.type === "single") return <SingleRunCard key={entry.run.id} r={entry.run} />;
              return <GroupCard key={entry.groupId} groupId={entry.groupId} runs={entry.runs} createdAt={entry.createdAt} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SingleRunCard({ r }: { r: Run }) {
  const coverage = Math.round(
    (Number(r.slots_persona_asignados) / Math.max(Number(r.slots_persona_demanda), 1)) * 100
  );
  return (
    <Link
      href={`/dashboard/schedule/${r.id}`}
      className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors group"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
          <CalendarDays className="h-5 w-5 text-indigo-400" />
        </div>
        <div>
          <p className="text-white text-sm font-medium group-hover:text-indigo-300 transition-colors">
            {r.nombre ?? new Date(r.created_at).toLocaleDateString("es-ES", {
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
      <RunBadge estado={r.estado} />
    </Link>
  );
}

function GroupCard({
  groupId,
  runs,
  createdAt,
}: {
  groupId: string;
  runs: Run[];
  createdAt: string;
}) {
  const chosen = runs.find((r) => r.variant_chosen);
  const totalHuecos = Math.min(...runs.map((r) => Number(r.slots_persona_huecos)));
  const bestCoverage = Math.max(
    ...runs.map((r) =>
      Math.round((Number(r.slots_persona_asignados) / Math.max(Number(r.slots_persona_demanda), 1)) * 100)
    )
  );

  return (
    <Link
      href={`/dashboard/schedule/group/${groupId}`}
      className="block p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-indigo-500/40 transition-colors group"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
            <Layers className="h-5 w-5 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white text-sm font-medium group-hover:text-indigo-300 transition-colors">
                {new Date(createdAt).toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <Badge className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs">
                {runs.length} variantes
              </Badge>
              {chosen && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  Elegida
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-slate-500 text-xs flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Mejor: {bestCoverage}%
              </span>
              {totalHuecos > 0 && (
                <span className="text-amber-400 text-xs">
                  {totalHuecos} huecos mínimos
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Mini grid showing each variant */}
        <div className="hidden md:flex items-center gap-1">
          {runs.map((r) => {
            const cov = Math.round(
              (Number(r.slots_persona_asignados) / Math.max(Number(r.slots_persona_demanda), 1)) * 100
            );
            const color =
              r.estado === "OPTIMAL"
                ? "bg-emerald-500/30 border-emerald-500/50"
                : r.estado === "FEASIBLE"
                ? "bg-amber-500/30 border-amber-500/50"
                : "bg-red-500/30 border-red-500/50";
            return (
              <div
                key={r.id}
                className={`w-8 h-8 rounded-md border ${color} ${
                  r.variant_chosen ? "ring-2 ring-emerald-500" : ""
                } flex items-center justify-center text-[10px] text-white font-bold`}
                title={`Variante ${(r.variant_index ?? 0) + 1}: ${cov}% cobertura`}
              >
                {(r.variant_index ?? 0) + 1}
              </div>
            );
          })}
        </div>
      </div>
    </Link>
  );
}

function RunBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    OPTIMAL:    { label: "Óptimo",     cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    FEASIBLE:   { label: "Factible",   cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    INFEASIBLE: { label: "Infactible", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const { label, cls } = map[estado] ?? { label: estado, cls: "bg-slate-700 text-slate-400" };
  return <Badge className={`${cls} border text-xs flex-shrink-0`}>{label}</Badge>;
}
