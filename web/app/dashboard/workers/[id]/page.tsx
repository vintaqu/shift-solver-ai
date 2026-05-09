import { auth } from "@/auth";
import sql from "@/lib/db";
import { notFound } from "next/navigation";
import WorkerForm from "@/components/workers/worker-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function EditWorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const restaurantId = (session!.user as { restaurantId?: string }).restaurantId;

  const rows = await sql(
    `SELECT w.id, w.nombre, w.rol,
            c.tipo as contrato_tipo, c.horas, c.min_horas, c.max_horas,
            COALESCE(array_agg(wt.etiqueta) FILTER (WHERE wt.etiqueta IS NOT NULL), '{}') as etiquetas,
            wr.restricciones
     FROM workers w
     LEFT JOIN contracts c ON c.worker_id = w.id
     LEFT JOIN worker_tags wt ON wt.worker_id = w.id
     LEFT JOIN worker_restrictions wr ON wr.worker_id = w.id
     WHERE w.id = $1 AND w.restaurant_id = $2
     GROUP BY w.id, w.nombre, w.rol, c.tipo, c.horas, c.min_horas, c.max_horas, wr.restricciones`,
    [id, restaurantId]
  );

  if (!rows[0]) notFound();
  const w = rows[0];
  const r = (w.restricciones ?? {}) as Record<string, unknown>;

  const defaultValues = {
    nombre: w.nombre as string,
    rol: w.rol as "CAMARERO_BASICO" | "SEMI_ENCARGADO" | "ENCARGADO" | "DUENO",
    contrato_tipo: w.contrato_tipo as "fijo" | "horquilla",
    horas: w.horas as number | undefined,
    min_horas: w.min_horas as number | undefined,
    max_horas: w.max_horas as number | undefined,
    etiquetas: w.etiquetas as string[],
    dias_libres: (r.dias_libres as string[]) ?? [],
    no_antes_hora: (r.no_antes_de as { hora: string }[])?.[0]?.hora ?? undefined,
    no_despues_hora: (r.no_despues_de as { hora: string }[])?.[0]?.hora ?? undefined,
    no_despues_dias:
      typeof (r.no_despues_de as { dias: unknown }[])?.[0]?.dias === "string"
        ? []
        : ((r.no_despues_de as { dias: string[] }[])?.[0]?.dias ?? []),
    trabajar_obligatorio_dia:
      (r.trabajar_obligatorio as { dia: string }[])?.[0]?.dia ?? undefined,
    trabajar_obligatorio_desde:
      (r.trabajar_obligatorio as { desde: string }[])?.[0]?.desde ?? undefined,
    trabajar_obligatorio_hasta:
      (r.trabajar_obligatorio as { hasta: string }[])?.[0]?.hasta ?? undefined,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/workers" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Editar — {w.nombre as string}</h1>
          <p className="text-slate-400 text-sm mt-0.5">Modifica los datos del trabajador</p>
        </div>
      </div>
      <WorkerForm workerId={id} defaultValues={defaultValues} />
    </div>
  );
}
