import { auth } from "@/auth";
import sql from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Layers,
  Crown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import VariantChooseButton from "@/components/schedule/variant-choose-button";

export default async function GroupComparisonPage({
  params,
}: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const session = await auth();
  const restaurantId = (session!.user as { restaurantId?: string }).restaurantId;
  if (!restaurantId) return <p className="text-slate-400">Sin restaurante.</p>;

  const variants = await sql(
    `SELECT id, estado, created_at, tiempo_calculo_seg, seed_usado,
            slots_persona_demanda, slots_persona_asignados, slots_persona_huecos,
            metricas, variant_index, variant_chosen
     FROM schedule_runs
     WHERE variant_group_id = $1 AND restaurant_id = $2
     ORDER BY variant_index ASC NULLS LAST, created_at ASC`,
    [groupId, restaurantId]
  );

  if (variants.length === 0) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/schedule"
          className="text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="h-6 w-6 text-indigo-400" />
            {variants.length} variantes generadas
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Cada variante es una solución equivalente en calidad pero con
            asignaciones distintas. Elige la que mejor encaje con tu equipo.
          </p>
        </div>
      </div>

      {/* Variants grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {variants.map((v, i) => {
          const coverage = Math.round(
            (Number(v.slots_persona_asignados) /
              Math.max(Number(v.slots_persona_demanda), 1)) *
              100
          );
          const m = v.metricas as {
            total_partidas?: number;
            total_continuadas?: number;
            dispersion_partidas?: number;
          } | null;

          const isBest = i === 0;
          const isChosen = v.variant_chosen as boolean;

          return (
            <div
              key={v.id as string}
              className={`relative rounded-2xl border p-5 transition-all ${
                isChosen
                  ? "border-emerald-500/60 bg-emerald-500/5 shadow-xl shadow-emerald-500/10"
                  : isBest
                  ? "border-indigo-500/40 bg-slate-900 hover:border-indigo-500/60"
                  : "border-slate-800 bg-slate-900 hover:border-slate-700"
              }`}
            >
              {/* Badges */}
              <div className="absolute -top-2.5 left-5 flex items-center gap-2">
                {isChosen && (
                  <Badge className="bg-emerald-500 text-white border-0 text-xs px-2 py-0.5 flex items-center gap-1">
                    <Crown className="h-3 w-3" />
                    Elegida
                  </Badge>
                )}
                {isBest && !isChosen && (
                  <Badge className="bg-indigo-500 text-white border-0 text-xs px-2 py-0.5">
                    Recomendada
                  </Badge>
                )}
              </div>

              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-white font-semibold text-base">
                    Variante {((v.variant_index as number) ?? 0) + 1}
                  </h2>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Seed: <span className="font-mono">{String(v.seed_usado ?? "—")}</span>
                  </p>
                </div>
                <RunBadge estado={v.estado as string} />
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Metric
                  icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                  label="Cobertura"
                  value={`${coverage}%`}
                  highlight={coverage >= 95 ? "good" : coverage >= 80 ? "ok" : "bad"}
                />
                <Metric
                  icon={<AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                  label="Huecos"
                  value={String(v.slots_persona_huecos)}
                  highlight={Number(v.slots_persona_huecos) === 0 ? "good" : "bad"}
                />
                <Metric
                  icon={<Users className="h-3.5 w-3.5 text-amber-400" />}
                  label="Partidas"
                  value={String(m?.total_partidas ?? 0)}
                />
                <Metric
                  icon={<Clock className="h-3.5 w-3.5 text-indigo-400" />}
                  label="Cálculo"
                  value={`${Number(v.tiempo_calculo_seg).toFixed(1)}s`}
                />
              </div>

              {/* Extra info */}
              <div className="flex items-center justify-between text-xs text-slate-500 pb-4 border-b border-slate-800">
                <span>
                  Continuadas: <span className="text-slate-300 font-medium">{m?.total_continuadas ?? 0}</span>
                </span>
                <span>
                  Dispersión: <span className="text-slate-300 font-medium">{m?.dispersion_partidas ?? 0}</span>
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4">
                <Link
                  href={`/dashboard/schedule/${v.id}`}
                  className="flex-1 text-center text-sm py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors font-medium"
                >
                  Ver detalle →
                </Link>
                <VariantChooseButton runId={v.id as string} chosen={isChosen} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Helper text */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <p className="text-slate-400 text-sm">
          💡 <span className="text-slate-300 font-medium">¿Cómo decidir?</span>{" "}
          La <span className="text-indigo-400">recomendada</span> tiene los mejores
          KPIs (menos huecos y partidas). El resto son alternativas equivalentes
          en calidad — útiles si quieres rotar la plantilla o probar repartos
          distintos. Marca como <span className="text-emerald-400">elegida</span> la
          que vayas a usar en producción.
        </p>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: "good" | "ok" | "bad";
}) {
  const valueColor =
    highlight === "good"
      ? "text-emerald-400"
      : highlight === "bad"
      ? "text-red-400"
      : "text-white";
  return (
    <div className="bg-slate-800/40 rounded-lg p-2.5 border border-slate-800">
      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] uppercase tracking-wide font-medium">
        {icon}
        {label}
      </div>
      <p className={`text-lg font-bold mt-0.5 ${valueColor}`}>{value}</p>
    </div>
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
