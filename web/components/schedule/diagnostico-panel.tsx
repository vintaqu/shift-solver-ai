"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, Lightbulb, TrendingDown, Users, Tag, Clock, Settings,
  ChevronDown, ChevronUp,
} from "lucide-react";

export interface Propuesta {
  severidad: "critica" | "alta" | "media" | "baja";
  categoria: "capacidad" | "rol" | "etiqueta" | "restriccion" | "contrato";
  titulo: string;
  mensaje: string;
  accion_sugerida: string;
  afecta_trabajador?: string | null;
  afecta_dia?: string | null;
}

export interface Diagnostico {
  capacidad_total_h: number;
  demanda_total_h: number;
  deficit_h: number;
  propuestas: Propuesta[];
}

const SEV_STYLE = {
  critica: { dot: "bg-red-500",    text: "text-red-300",    bg: "bg-red-500/5",    border: "border-red-500/30",    label: "Crítica" },
  alta:    { dot: "bg-orange-500", text: "text-orange-300", bg: "bg-orange-500/5", border: "border-orange-500/30", label: "Alta" },
  media:   { dot: "bg-amber-500",  text: "text-amber-300",  bg: "bg-amber-500/5",  border: "border-amber-500/30",  label: "Media" },
  baja:    { dot: "bg-slate-500",  text: "text-slate-300",  bg: "bg-slate-500/5",  border: "border-slate-500/30",  label: "Info" },
};

const CAT_ICON = {
  capacidad:    Users,
  rol:          Settings,
  etiqueta:     Tag,
  restriccion:  Clock,
  contrato:     TrendingDown,
};

const CAT_LABEL: Record<Propuesta["categoria"], string> = {
  capacidad: "Capacidad",
  rol: "Roles",
  etiqueta: "Etiquetas",
  restriccion: "Restricciones",
  contrato: "Contratos",
};

export default function DiagnosticoPanel({ diagnostico }: { diagnostico: Diagnostico }) {
  const [expanded, setExpanded] = useState(true);

  const total = diagnostico.propuestas.length;
  const criticas = diagnostico.propuestas.filter((p) => p.severidad === "critica").length;
  const altas = diagnostico.propuestas.filter((p) => p.severidad === "alta").length;

  if (total === 0 && diagnostico.deficit_h <= 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-amber-500/5 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
          <Lightbulb className="h-5 w-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-amber-200 font-semibold text-sm flex items-center gap-2 flex-wrap">
            Diagnóstico de cuellos de botella
            {criticas > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 font-medium">
                {criticas} crítica{criticas === 1 ? "" : "s"}
              </span>
            )}
            {altas > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 font-medium">
                {altas} alta{altas === 1 ? "" : "s"}
              </span>
            )}
          </p>
          <p className="text-amber-300/70 text-xs mt-0.5">
            Capacidad: {diagnostico.capacidad_total_h.toFixed(0)}h ·
            Demanda: {diagnostico.demanda_total_h.toFixed(0)}h
            {diagnostico.deficit_h > 0 && (
              <> · Déficit: <span className="text-red-300 font-semibold">{diagnostico.deficit_h.toFixed(0)}h</span></>
            )}
            {" · "}{total} propuesta{total === 1 ? "" : "s"} accionable{total === 1 ? "" : "s"}
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-amber-400" /> : <ChevronDown className="h-4 w-4 text-amber-400" />}
      </button>

      {expanded && total > 0 && (
        <div className="border-t border-amber-500/20 divide-y divide-amber-500/10">
          {diagnostico.propuestas.map((p, i) => {
            const sev = SEV_STYLE[p.severidad];
            const Icon = CAT_ICON[p.categoria] ?? AlertTriangle;
            return (
              <div key={i} className={cn("px-5 py-4", sev.bg)}>
                <div className="flex items-start gap-3">
                  <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", sev.border)}>
                    <Icon className={cn("h-4 w-4", sev.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className={cn("font-semibold text-sm", sev.text)}>{p.titulo}</p>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", sev.border, sev.text)}>
                        {sev.label}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                        {CAT_LABEL[p.categoria]}
                      </span>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">{p.mensaje}</p>
                    <div className="mt-2 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-300 text-sm">
                      <span className="text-emerald-400 font-medium text-xs uppercase tracking-wide mr-2">Acción:</span>
                      {p.accion_sugerida}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
