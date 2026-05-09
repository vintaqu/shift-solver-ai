"use client";

import { DIAS, DIA_LABELS, ROL_LABELS, type WorkerRol, type ScheduleAssignment } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  assignmentsByWorker: Record<string, ScheduleAssignment[]>;
}

const TIPO_COLORS: Record<string, string> = {
  continuada: "bg-indigo-500/20 border-indigo-500/40 text-indigo-300",
  partida:    "bg-amber-500/20 border-amber-500/40 text-amber-300",
  descanso:   "bg-slate-800/50 border-slate-700/50 text-slate-600",
};

const ROL_COLORS: Record<WorkerRol, string> = {
  DUENO:           "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ENCARGADO:       "bg-blue-500/20 text-blue-400 border-blue-500/30",
  SEMI_ENCARGADO:  "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  CAMARERO_BASICO: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export default function ScheduleGrid({ assignmentsByWorker }: Props) {
  const workers = Object.keys(assignmentsByWorker).sort();

  if (workers.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        Sin asignaciones en este cuadrante.
      </div>
    );
  }

  const getAssignment = (worker: string, dia: string): ScheduleAssignment | undefined =>
    assignmentsByWorker[worker]?.find((a) => a.dia === dia);

  const totalHours = (worker: string) =>
    (assignmentsByWorker[worker] ?? []).reduce((acc, a) => acc + (a.tipo !== "descanso" ? a.horas : 0), 0);

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-slate-300">Cuadrícula semanal</h2>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/80">
              <th className="text-left px-4 py-3 text-slate-400 font-medium w-40">Trabajador</th>
              {DIAS.map((d) => (
                <th key={d} className="text-center px-2 py-3 text-slate-400 font-medium">
                  {DIA_LABELS[d].slice(0, 3)}
                </th>
              ))}
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {workers.map((worker) => {
              const rol = assignmentsByWorker[worker]?.[0]?.worker_rol as WorkerRol;
              return (
                <tr key={worker} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white font-medium text-sm">{worker}</p>
                      {rol && (
                        <Badge className={`${ROL_COLORS[rol]} border text-xs mt-0.5`}>
                          {ROL_LABELS[rol]}
                        </Badge>
                      )}
                    </div>
                  </td>
                  {DIAS.map((dia) => {
                    const a = getAssignment(worker, dia);
                    if (!a || a.tipo === "descanso") {
                      return (
                        <td key={dia} className="px-2 py-3 text-center">
                          <span className="text-slate-700 text-xs">—</span>
                        </td>
                      );
                    }
                    return (
                      <td key={dia} className="px-2 py-3">
                        <div className={cn("rounded-lg border px-2 py-1.5 text-center", TIPO_COLORS[a.tipo])}>
                          {a.tramos.map((t, i) => (
                            <div key={i} className="text-xs font-mono leading-tight">
                              {t.inicio}–{t.fin}
                            </div>
                          ))}
                          <div className="text-xs opacity-70 mt-0.5">{a.horas}h</div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right">
                    <span className="text-white font-semibold">{totalHours(worker).toFixed(1)}h</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {workers.map((worker) => {
          const rol = assignmentsByWorker[worker]?.[0]?.worker_rol as WorkerRol;
          return (
            <div key={worker} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white font-semibold">{worker}</p>
                  {rol && (
                    <Badge className={`${ROL_COLORS[rol]} border text-xs mt-0.5`}>
                      {ROL_LABELS[rol]}
                    </Badge>
                  )}
                </div>
                <span className="text-indigo-400 font-bold">{totalHours(worker).toFixed(1)}h</span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {DIAS.map((dia) => {
                  const a = getAssignment(worker, dia);
                  const isOff = !a || a.tipo === "descanso";
                  return (
                    <div key={dia} className="text-center">
                      <p className="text-slate-600 text-xs mb-1">{DIA_LABELS[dia].slice(0, 2)}</p>
                      {isOff ? (
                        <div className="h-10 rounded bg-slate-800/50 border border-slate-800 flex items-center justify-center">
                          <span className="text-slate-700 text-xs">–</span>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "rounded border flex flex-col items-center justify-center p-1 min-h-[40px]",
                            TIPO_COLORS[a.tipo]
                          )}
                        >
                          <span className="text-xs font-semibold">{a.horas}h</span>
                          <span className="text-xs opacity-70">{a.tipo === "partida" ? "P" : "C"}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-indigo-500/20 border border-indigo-500/40" />
          Jornada continuada
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40" />
          Jornada partida
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-slate-800/50 border border-slate-700/50" />
          Descanso
        </div>
      </div>
    </div>
  );
}
