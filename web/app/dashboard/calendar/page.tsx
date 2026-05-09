import { auth } from "@/auth";
import sql from "@/lib/db";
import AnnualCalendar, { type Run } from "@/components/calendar/annual-calendar";
import { CalendarDays } from "lucide-react";

export default async function CalendarPage() {
  const session = await auth();
  const restaurantId = (session!.user as { restaurantId?: string }).restaurantId;
  if (!restaurantId) return <p className="text-slate-400">Sin restaurante.</p>;

  const year = new Date().getFullYear();

  const [runsRaw, monthsRaw] = await Promise.all([
    sql(
      `SELECT id, estado, created_at, semana, anio,
              slots_persona_asignados, slots_persona_demanda
       FROM schedule_runs
       WHERE restaurant_id = $1
       ORDER BY created_at DESC`,
      [restaurantId]
    ),
    sql(
      `SELECT mes FROM calendar_months WHERE restaurant_id = $1 AND anio = $2`,
      [restaurantId, year]
    ),
  ]);

  const runs: Run[] = runsRaw.map((r) => ({
    id: r.id as string,
    estado: r.estado as string,
    created_at: r.created_at as string,
    semana: r.semana as number | null,
    anio: r.anio as number | null,
    coverage: Math.round(
      (Number(r.slots_persona_asignados) / Math.max(Number(r.slots_persona_demanda), 1)) * 100
    ),
  }));

  const closedMonths = monthsRaw.map((m) => m.mes as number);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30">
            <CalendarDays className="h-5 w-5 text-indigo-400" />
          </span>
          Calendario anual
        </h1>
        <p className="text-slate-400 text-sm mt-1 ml-1">
          Asigna cuadrantes a cada semana del año y cierra los meses completados.
        </p>
      </div>

      <AnnualCalendar year={year} runs={runs} closedMonths={closedMonths} />
    </div>
  );
}
