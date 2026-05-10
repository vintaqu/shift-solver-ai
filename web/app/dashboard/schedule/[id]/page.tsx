import { auth } from "@/auth";
import sql from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Layers, Pencil, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DIA_LABELS } from "@/lib/types";
import ScheduleEditor, {
  type WorkerForEditor,
  type AssignmentForEditor,
} from "@/components/schedule/schedule-editor";
import DiagnosticoPanel, { type Diagnostico } from "@/components/schedule/diagnostico-panel";
import type { NeedRow } from "@/lib/schedule-coverage";

interface ScheduleRunRow {
  id: string;
  nombre: string | null;
  estado: string;
  created_at: string;
  edited_at: string | null;
  variant_group_id: string | null;
  variant_index: number | null;
  variant_chosen: boolean;
  diagnostico: Diagnostico | string | null;
  huecos_cobertura: Array<{
    dia: string;
    inicio: string;
    fin: string;
    demanda_total: number;
    cubierto: number;
    falta_personas: number;
  }>;
}

export default async function ScheduleRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const restaurantId = (session!.user as { restaurantId?: string }).restaurantId;
  if (!restaurantId) return <p className="text-slate-400">Sin restaurante.</p>;

  const [runs, assignmentsRaw, workersRaw, needsRaw] = await Promise.all([
    sql<ScheduleRunRow>(
      `SELECT id, nombre, estado, created_at, edited_at,
              variant_group_id, variant_index, variant_chosen,
              huecos_cobertura, diagnostico
       FROM schedule_runs
       WHERE id = $1 AND restaurant_id = $2`,
      [id, restaurantId]
    ),
    sql(
      `SELECT worker_id, dia, tipo, tramos, horas
       FROM schedule_assignments WHERE run_id = $1`,
      [id]
    ),
    sql(
      `SELECT w.id, w.nombre, w.rol,
              c.tipo as contrato_tipo, c.horas, c.min_horas, c.max_horas,
              wr.restricciones
       FROM workers w
       LEFT JOIN contracts c ON c.worker_id = w.id
       LEFT JOIN worker_restrictions wr ON wr.worker_id = w.id
       WHERE w.restaurant_id = $1
       ORDER BY w.nombre`,
      [restaurantId]
    ),
    sql<NeedRow>(
      `SELECT dia, inicio, fin, personas
       FROM shift_needs WHERE restaurant_id = $1`,
      [restaurantId]
    ),
  ]);

  if (!runs[0]) notFound();
  const run = runs[0];

  const workers: WorkerForEditor[] = workersRaw.map((w) => ({
    id: w.id as string,
    nombre: w.nombre as string,
    rol: w.rol as string,
    contrato_str:
      w.contrato_tipo === "fijo"
        ? `${w.horas}h/sem`
        : `${w.min_horas}–${w.max_horas}h/sem`,
    contrato_tipo: w.contrato_tipo as "fijo" | "horquilla",
    contrato_horas: (w.horas as number) ?? null,
    contrato_min: (w.min_horas as number) ?? null,
    contrato_max: (w.max_horas as number) ?? null,
    restricciones:
      typeof w.restricciones === "string"
        ? JSON.parse(w.restricciones)
        : ((w.restricciones as Record<string, unknown>) ?? {}),
  }));

  const assignments: AssignmentForEditor[] = assignmentsRaw.map((a) => ({
    worker_id: a.worker_id as string,
    dia: a.dia as string,
    tipo: a.tipo as string,
    horas: Number(a.horas),
    tramos:
      typeof a.tramos === "string"
        ? JSON.parse(a.tramos)
        : ((a.tramos as Array<{ inicio: string; fin: string }>) ?? []),
  }));

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-start gap-3">
        <Link
          href={
            run.variant_group_id
              ? `/dashboard/schedule/group/${run.variant_group_id}`
              : "/dashboard/schedule"
          }
          className="text-slate-400 hover:text-white transition-colors mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {run.variant_group_id && (
              <Badge className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs flex items-center gap-1">
                <Layers className="h-3 w-3" />
                Variante {(run.variant_index ?? 0) + 1}
              </Badge>
            )}
            {run.variant_chosen && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">
                Elegida
              </Badge>
            )}
            {run.edited_at && (
              <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs flex items-center gap-1">
                <Pencil className="h-3 w-3" />
                Editado
              </Badge>
            )}
            <RunBadge estado={run.estado} />
          </div>
          <p className="text-slate-500 text-sm">
            Generado{" "}
            {new Date(run.created_at).toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {run.edited_at && (
              <>
                {" · "}
                Última edición{" "}
                {new Date(run.edited_at).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </>
            )}
          </p>
        </div>
      </div>

      <ScheduleEditor
        runId={run.id}
        initialNombre={run.nombre}
        workers={workers}
        initialAssignments={assignments}
        needs={needsRaw}
      />

      {/* Diagnóstico de infactibilidad / huecos estructurales (subfase 0.12) */}
      {run.diagnostico && (
        <DiagnosticoPanel
          diagnostico={
            typeof run.diagnostico === "string"
              ? (JSON.parse(run.diagnostico) as Diagnostico)
              : run.diagnostico
          }
        />
      )}

      {/* Huecos detectados (snapshot del solver) */}
      {run.huecos_cobertura && run.huecos_cobertura.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              Huecos iniciales detectados por el solver ({run.huecos_cobertura.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 text-sm mb-3">
              Snapshot del momento de la generación — las estadísticas en vivo de arriba reflejan tus ediciones.
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

function RunBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    OPTIMAL:    { label: "Óptimo",     cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    FEASIBLE:   { label: "Factible",   cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    INFEASIBLE: { label: "Infactible", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const { label, cls } = map[estado] ?? { label: estado, cls: "bg-slate-700 text-slate-400 border-slate-600" };
  return <Badge className={`${cls} border text-xs`}>{label}</Badge>;
}
