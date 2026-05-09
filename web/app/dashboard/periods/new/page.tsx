import { auth } from "@/auth";
import sql from "@/lib/db";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import PeriodCreateWizard from "@/components/periods/period-create-wizard";
import type { WorkerContract } from "@/lib/period-helpers";

export default async function NewPeriodPage() {
  const session = await auth();
  const restaurantId = (session!.user as { restaurantId?: string }).restaurantId;
  if (!restaurantId) return <p className="text-slate-400">Sin restaurante.</p>;

  const rows = await sql(
    `SELECT w.id, w.nombre,
            c.tipo as contrato_tipo, c.horas, c.min_horas, c.max_horas
     FROM workers w
     LEFT JOIN contracts c ON c.worker_id = w.id
     WHERE w.restaurant_id = $1
     ORDER BY w.nombre`,
    [restaurantId]
  );

  const workers: WorkerContract[] = rows.map((w) => ({
    id: w.id as string,
    nombre: w.nombre as string,
    contrato_tipo: w.contrato_tipo as "fijo" | "horquilla",
    horas: (w.horas as number) ?? null,
    min_horas: (w.min_horas as number) ?? null,
    max_horas: (w.max_horas as number) ?? null,
  }));

  if (workers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/periods" className="text-slate-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Nuevo periodo</h1>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-semibold">Sin trabajadores</p>
            <p className="text-amber-300/80 text-sm mt-1">
              Añade tu plantilla en{" "}
              <Link href="/dashboard/workers" className="underline">
                /dashboard/workers
              </Link>{" "}
              antes de crear un periodo de planificación.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/periods" className="text-slate-400 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Nuevo periodo</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Define el horizonte y las horas objetivo por trabajador y semana.
          </p>
        </div>
      </div>

      <PeriodCreateWizard workers={workers} />
    </div>
  );
}
