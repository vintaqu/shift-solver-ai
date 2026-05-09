import { auth } from "@/auth";
import sql from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PeriodRunner from "@/components/periods/period-runner";

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const restaurantId = (session!.user as { restaurantId?: string }).restaurantId;
  if (!restaurantId) return <p className="text-slate-400">Sin restaurante.</p>;

  const [periodRows, weeksRaw, workersRaw] = await Promise.all([
    sql(
      "SELECT id, nombre, tipo, fecha_inicio, fecha_fin, estado, created_at FROM planning_periods WHERE id = $1 AND restaurant_id = $2",
      [id, restaurantId]
    ),
    sql(
      `SELECT pw.semana, pw.anio, pw.posicion, pw.target_hours, pw.schedule_run_id,
              r.estado as run_estado,
              r.slots_persona_demanda, r.slots_persona_asignados, r.slots_persona_huecos,
              r.tiempo_calculo_seg, r.created_at as run_created_at, r.nombre as run_nombre
       FROM period_weeks pw
       LEFT JOIN schedule_runs r ON r.id = pw.schedule_run_id
       WHERE pw.period_id = $1
       ORDER BY pw.posicion ASC`,
      [id]
    ),
    sql(
      `SELECT w.id, w.nombre, w.rol,
              c.tipo as contrato_tipo, c.horas, c.min_horas, c.max_horas
       FROM workers w
       LEFT JOIN contracts c ON c.worker_id = w.id
       WHERE w.restaurant_id = $1
       ORDER BY w.nombre`,
      [restaurantId]
    ),
  ]);

  if (!periodRows[0]) notFound();
  const period = periodRows[0] as unknown as {
    id: string; nombre: string; tipo: string;
    fecha_inicio: string; fecha_fin: string; estado: string; created_at: string;
  };

  const weeks = weeksRaw.map((w) => ({
    semana: Number(w.semana),
    anio: Number(w.anio),
    posicion: Number(w.posicion),
    target_hours:
      typeof w.target_hours === "string"
        ? JSON.parse(w.target_hours)
        : (w.target_hours as Record<string, number>),
    schedule_run_id: (w.schedule_run_id as string) ?? null,
    run_estado: (w.run_estado as string) ?? null,
    slots_persona_demanda: (w.slots_persona_demanda as number) ?? null,
    slots_persona_asignados: (w.slots_persona_asignados as number) ?? null,
    slots_persona_huecos: (w.slots_persona_huecos as number) ?? null,
    tiempo_calculo_seg: (w.tiempo_calculo_seg as number) ?? null,
    run_created_at: (w.run_created_at as string) ?? null,
    run_nombre: (w.run_nombre as string) ?? null,
  }));

  const workers = workersRaw.map((w) => ({
    id: w.id as string,
    nombre: w.nombre as string,
    rol: w.rol as string,
    contrato_str:
      w.contrato_tipo === "fijo"
        ? `${w.horas}h/sem`
        : `${w.min_horas}–${w.max_horas}h/sem`,
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/periods"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a periodos
      </Link>

      <PeriodRunner
        period={period}
        initialWeeks={weeks}
        workers={workers}
      />
    </div>
  );
}
