import { auth } from "@/auth";
import sql from "@/lib/db";
import { Users, CalendarCheck, CalendarDays, TrendingUp, AlertCircle, Plus, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { DIA_LABELS } from "@/lib/types";

async function getDashboardData(restaurantId: string) {
  const [workers, lastRun, runCount] = await Promise.all([
    sql("SELECT COUNT(*) as count FROM workers WHERE restaurant_id = $1", [restaurantId]),
    sql(
      `SELECT id, estado, created_at, slots_persona_asignados, slots_persona_demanda,
              tiempo_calculo_seg, slots_persona_huecos
       FROM schedule_runs WHERE restaurant_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [restaurantId]
    ),
    sql("SELECT COUNT(*) as count FROM schedule_runs WHERE restaurant_id = $1", [restaurantId]),
  ]);

  return {
    workerCount: Number(workers[0]?.count ?? 0),
    lastRun: lastRun[0] ?? null,
    runCount: Number(runCount[0]?.count ?? 0),
  };
}

export default async function DashboardPage() {
  const session = await auth();
  const restaurantId = (session!.user as { restaurantId?: string }).restaurantId;

  if (!restaurantId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4">
        <AlertCircle className="h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-semibold text-white">Sin restaurante asociado</h2>
        <p className="text-slate-400">Contacta con el administrador.</p>
      </div>
    );
  }

  const [data, restaurant] = await Promise.all([
    getDashboardData(restaurantId),
    sql("SELECT nombre FROM restaurants WHERE id = $1", [restaurantId]),
  ]);

  const coverage = data.lastRun
    ? Math.round(
        (Number(data.lastRun.slots_persona_asignados) /
          Math.max(Number(data.lastRun.slots_persona_demanda), 1)) *
          100
      )
    : null;

  const today = new Date();
  const dayName = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"][
    today.getDay()
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {(restaurant[0] as { nombre?: string })?.nombre ?? "Dashboard"}
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          {DIA_LABELS[dayName]},{" "}
          {today.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Trabajadores"
          value={data.workerCount}
          icon={<Users className="h-5 w-5 text-indigo-400" />}
          href="/dashboard/workers"
          color="indigo"
        />
        <StatCard
          title="Cuadrantes generados"
          value={data.runCount}
          icon={<CalendarCheck className="h-5 w-5 text-emerald-400" />}
          href="/dashboard/schedule"
          color="emerald"
        />
        <StatCard
          title="Cobertura último"
          value={coverage !== null ? `${coverage}%` : "—"}
          icon={<TrendingUp className="h-5 w-5 text-amber-400" />}
          href="/dashboard/schedule"
          color="amber"
        />
        <StatCard
          title="Huecos último"
          value={data.lastRun ? Number(data.lastRun.slots_persona_huecos) : "—"}
          icon={<AlertCircle className="h-5 w-5 text-red-400" />}
          href="/dashboard/schedule"
          color="red"
          subtitle={data.lastRun?.slots_persona_huecos === 0 ? "¡Perfecto!" : "slots sin cubrir"}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Acciones rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <QuickAction href="/dashboard/workers/new" icon={<Plus className="h-5 w-5" />} label="Añadir trabajador" />
            <QuickAction href="/dashboard/schedule" icon={<RefreshCw className="h-5 w-5" />} label="Generar cuadrante" />
            <QuickAction href="/dashboard/needs" icon={<CalendarCheck className="h-5 w-5" />} label="Editar necesidades" />
            <QuickAction href="/dashboard/settings" icon={<Users className="h-5 w-5" />} label="Ajustes" />
          </CardContent>
        </Card>

        {data.lastRun && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">Último cuadrante</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Estado</span>
                <StatusBadge estado={data.lastRun.estado as string} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Cobertura</span>
                <span className="text-white font-medium">{coverage}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Tiempo de cálculo</span>
                <span className="text-white font-medium">
                  {Number(data.lastRun.tiempo_calculo_seg).toFixed(1)}s
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Generado</span>
                <span className="text-white text-sm">
                  {new Date(data.lastRun.created_at as string).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <Link
                href={`/dashboard/schedule/${data.lastRun.id}`}
                className="block text-center text-indigo-400 hover:text-indigo-300 text-sm mt-2"
              >
                Ver cuadrante completo →
              </Link>
            </CardContent>
          </Card>
        )}

        {!data.lastRun && (
          <Card className="bg-slate-900 border-slate-800 flex items-center justify-center min-h-[180px]">
            <div className="text-center">
              <CalendarDays className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Sin cuadrantes aún</p>
              <Link
                href="/dashboard/schedule"
                className="text-indigo-400 hover:text-indigo-300 text-sm mt-1 inline-block"
              >
                Generar primero →
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  href,
  color,
  subtitle,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  href: string;
  color: string;
  subtitle?: string;
}) {
  const bg: Record<string, string> = {
    indigo: "bg-indigo-500/10",
    emerald: "bg-emerald-500/10",
    amber: "bg-amber-500/10",
    red: "bg-red-500/10",
  };

  return (
    <Link href={href}>
      <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-400 text-sm">{title}</p>
            <div className={`p-2 rounded-lg ${bg[color]}`}>{icon}</div>
          </div>
          <p className="text-3xl font-bold text-white">{value}</p>
          {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-slate-300 text-sm font-medium"
    >
      <span className="text-indigo-400">{icon}</span>
      {label}
    </Link>
  );
}

function StatusBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; class: string }> = {
    OPTIMAL: { label: "Óptimo", class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    FEASIBLE: { label: "Factible", class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    INFEASIBLE: { label: "Infactible", class: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const { label, class: cls } = map[estado] ?? { label: estado, class: "bg-slate-700 text-slate-400" };
  return <Badge className={`${cls} border text-xs`}>{label}</Badge>;
}

