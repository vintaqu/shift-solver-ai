"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, ShieldCheck, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { violationsByWorker, type Violation } from "@/lib/legal-validation";

interface Props {
  violations: Violation[];
  workerNames: Map<string, string>;
  onJump?: (workerId: string, dia: string) => void;
}

const CODE_LABEL: Record<string, string> = {
  MAX_9H_DIA:           "Máx 9h/día",
  DESCANSO_12H:         "Descanso 12h",
  PARTIDA_MIN_3H:       "Tramo < 3h",
  PARTIDA_MAX_5H:       "Tramo > 5h",
  PARTIDA_DESCANSO_15H: "Descanso entre tramos < 1.5h",
  DESCANSO_SEMANAL_2D:  "Descanso semanal",
  CONTRATO_FIJO_EXCESO: "Sobre contrato",
  CONTRATO_FIJO_DEFICIT:"Bajo contrato",
  HORQUILLA_BAJO:       "Bajo horquilla",
  HORQUILLA_ALTO:       "Sobre horquilla",
  DIA_LIBRE_FIJO:       "Día libre",
  NO_ANTES_DE:          "No antes de",
  NO_DESPUES_DE:        "No después de",
  TRABAJAR_OBLIGATORIO: "Ventana obligatoria",
};

export default function LegalWarningsPanel({ violations, workerNames, onJump }: Props) {
  const [collapsed, setCollapsed] = useState(true);

  const errors = violations.filter((v) => v.severity === "error");
  const warnings = violations.filter((v) => v.severity === "warning");
  const total = violations.length;

  const grouped = useMemo(() => violationsByWorker(violations), [violations]);

  if (total === 0) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
        <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
        <div className="flex-1">
          <p className="text-emerald-300 text-sm font-medium">Cuadrante legal y sin restricciones violadas</p>
          <p className="text-emerald-400/70 text-xs">
            Cumple las 8 reglas del convenio + Estatuto y todas las restricciones individuales del equipo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        errors.length > 0
          ? "border-red-500/40 bg-red-500/5"
          : "border-amber-500/40 bg-amber-500/5"
      )}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {errors.length > 0 ? (
          <ShieldAlert className="h-5 w-5 text-red-400 shrink-0" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
        )}
        <div className="flex-1">
          <p className={cn(
            "text-sm font-medium",
            errors.length > 0 ? "text-red-300" : "text-amber-300"
          )}>
            {errors.length > 0 && (
              <span className="font-semibold">{errors.length} infracci{errors.length === 1 ? "ón" : "ones"} legal{errors.length === 1 ? "" : "es"}</span>
            )}
            {errors.length > 0 && warnings.length > 0 && <span> · </span>}
            {warnings.length > 0 && (
              <span>{warnings.length} aviso{warnings.length === 1 ? "" : "s"}</span>
            )}
          </p>
          <p className="text-xs opacity-70 mt-0.5">
            {collapsed ? "Click para revisar detalle" : "Detalle por trabajador"}
          </p>
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronUp className="h-4 w-4 text-slate-500" />}
      </button>

      {/* Detail */}
      {!collapsed && (
        <div className="border-t border-slate-800/60 max-h-96 overflow-y-auto">
          {Array.from(grouped.entries())
            .sort(([a], [b]) => (workerNames.get(a) ?? "").localeCompare(workerNames.get(b) ?? ""))
            .map(([workerId, vs]) => {
            const errs = vs.filter((v) => v.severity === "error");
            const warns = vs.filter((v) => v.severity === "warning");
            return (
              <div key={workerId} className="px-4 py-3 border-b border-slate-800/40 last:border-b-0">
                <p className="text-white text-sm font-semibold mb-2 flex items-center gap-2">
                  {workerNames.get(workerId) ?? "—"}
                  {errs.length > 0 && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                      {errs.length} infracc.
                    </span>
                  )}
                  {warns.length > 0 && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {warns.length} aviso{warns.length === 1 ? "" : "s"}
                    </span>
                  )}
                </p>
                <ul className="space-y-1">
                  {vs.map((v, i) => (
                    <li
                      key={`${v.code}-${v.dia}-${i}`}
                      className={cn(
                        "flex items-start gap-2 text-xs rounded-md px-2 py-1.5",
                        v.severity === "error"
                          ? "bg-red-500/5 text-red-300"
                          : "bg-amber-500/5 text-amber-300"
                      )}
                    >
                      <span className={cn(
                        "shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded",
                        v.severity === "error"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-amber-500/20 text-amber-300"
                      )}>
                        {CODE_LABEL[v.code] ?? v.code}
                      </span>
                      <span className="flex-1">{v.message}</span>
                      {v.dia && onJump && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onJump(v.worker_id, v.dia!); }}
                          className="opacity-60 hover:opacity-100 underline text-[10px] shrink-0"
                        >
                          Ir →
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Suppress unused import lint if any
export const _unused: typeof X = X;
