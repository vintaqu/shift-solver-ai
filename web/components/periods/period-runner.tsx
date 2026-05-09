"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Play, CheckCircle2, AlertCircle, Pencil, Check, X,
  CalendarDays, Sparkles, Clock, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PeriodWeek {
  semana: number;
  anio: number;
  posicion: number;
  target_hours: Record<string, number>;
  schedule_run_id: string | null;
  run_estado: string | null;
  slots_persona_demanda: number | null;
  slots_persona_asignados: number | null;
  slots_persona_huecos: number | null;
  tiempo_calculo_seg: number | null;
  run_created_at: string | null;
  run_nombre: string | null;
}

interface Period {
  id: string;
  nombre: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: string;
  created_at: string;
}

interface Worker {
  id: string;
  nombre: string;
  rol: string;
  contrato_str: string;
}

interface Props {
  period: Period;
  initialWeeks: PeriodWeek[];
  workers: Worker[];
}

type WeekStatus = "pending" | "generating" | "done" | "error";

export default function PeriodRunner({ period, initialWeeks, workers }: Props) {
  const router = useRouter();
  const [weeks, setWeeks] = useState<PeriodWeek[]>(initialWeeks);
  const [running, setRunning] = useState(false);
  const [currentIdx, setCurrentIdx] = useState<number | null>(null);
  const [tab, setTab] = useState<"semanas" | "trabajadores">("semanas");

  // Inline name editor
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(period.nombre);
  const [savingName, setSavingName] = useState(false);

  const generateOne = async (weekIdx: number) => {
    const w = weeks[weekIdx];
    setCurrentIdx(weekIdx);
    try {
      const res = await fetch(`/api/periods/${period.id}/generate-week`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semana: w.semana,
          anio: w.anio,
          time_limit: 30,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar la semana");

      // Update local state with the result
      setWeeks((prev) =>
        prev.map((x, i) =>
          i === weekIdx
            ? {
                ...x,
                schedule_run_id: data.runId,
                run_estado: data.estado,
                slots_persona_huecos: data.huecos,
                run_created_at: new Date().toISOString(),
              }
            : x
        )
      );
      return { ok: true, estado: data.estado as string };
    } catch (e) {
      toast.error(`Semana ${w.semana}: ${(e as Error).message}`);
      return { ok: false };
    }
  };

  const generateAll = async () => {
    setRunning(true);
    let okCount = 0;
    for (let i = 0; i < weeks.length; i++) {
      if (weeks[i].schedule_run_id) continue; // skip already done
      const res = await generateOne(i);
      if (res.ok) okCount++;
      if (!res.ok) {
        // continue on error to try the rest
      }
    }
    setCurrentIdx(null);
    setRunning(false);
    toast.success(`${okCount} semana${okCount === 1 ? "" : "s"} generada${okCount === 1 ? "" : "s"}`);
    router.refresh();
  };

  const generateSingle = async (idx: number) => {
    setRunning(true);
    await generateOne(idx);
    setCurrentIdx(null);
    setRunning(false);
    router.refresh();
  };

  const stats = useMemo(() => {
    const total = weeks.length;
    const done = weeks.filter((w) => w.schedule_run_id).length;
    const totalHuecos = weeks.reduce((s, w) => s + (Number(w.slots_persona_huecos) || 0), 0);
    const sumDemanda = weeks.reduce((s, w) => s + (Number(w.slots_persona_demanda) || 0), 0);
    const sumAsignados = weeks.reduce((s, w) => s + (Number(w.slots_persona_asignados) || 0), 0);
    const cobertura = sumDemanda > 0 ? Math.round((sumAsignados / sumDemanda) * 100) : 0;
    return { total, done, totalHuecos, cobertura };
  }, [weeks]);

  // Worker totals across the period
  const workerTotals = useMemo(() => {
    const m = new Map<string, { target: number; assigned: number; weeksWithRun: number }>();
    for (const w of workers) m.set(w.id, { target: 0, assigned: 0, weeksWithRun: 0 });
    for (const wk of weeks) {
      const targets = (typeof wk.target_hours === "string"
        ? JSON.parse(wk.target_hours)
        : wk.target_hours) as Record<string, number>;
      for (const [wid, hrs] of Object.entries(targets ?? {})) {
        const cur = m.get(wid);
        if (cur) cur.target += Number(hrs) || 0;
      }
    }
    return m;
  }, [weeks, workers]);

  const saveName = async () => {
    setSavingName(true);
    try {
      const res = await fetch(`/api/periods/${period.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nameVal.trim() || period.nombre }),
      });
      if (!res.ok) throw new Error();
      toast.success("Nombre actualizado");
      setEditingName(false);
      router.refresh();
    } catch {
      toast.error("No se pudo guardar el nombre");
    } finally {
      setSavingName(false);
    }
  };

  const weekStatus = (w: PeriodWeek, idx: number): WeekStatus => {
    if (running && currentIdx === idx) return "generating";
    if (w.schedule_run_id) return "done";
    return "pending";
  };

  const pendingCount = weeks.filter((w) => !w.schedule_run_id).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-1.5 mb-1">
              <Input
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white h-9 w-72 max-w-full text-xl font-semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") { setNameVal(period.nombre); setEditingName(false); }
                }}
              />
              <button
                onClick={saveName}
                disabled={savingName}
                className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => { setNameVal(period.nombre); setEditingName(false); }}
                className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="group flex items-center gap-2 mb-1"
            >
              <h1 className="text-2xl font-bold text-white">{period.nombre}</h1>
              <Pencil className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-400 transition" />
            </button>
          )}
          <p className="text-slate-400 text-sm">
            {format(new Date(period.fecha_inicio), "d 'de' MMMM yyyy", { locale: es })} —{" "}
            {format(new Date(period.fecha_fin), "d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Button
              onClick={generateAll}
              disabled={running}
              className="bg-indigo-600 hover:bg-indigo-500"
            >
              {running ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generando…</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />Generar {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          icon={<CalendarDays className="h-4 w-4 text-indigo-400" />}
          label="Progreso"
          value={`${stats.done}/${stats.total}`}
          progress={(stats.done / Math.max(stats.total, 1)) * 100}
        />
        <Stat
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          label="Cobertura media"
          value={`${stats.cobertura}%`}
        />
        <Stat
          icon={<AlertCircle className={cn("h-4 w-4", stats.totalHuecos === 0 ? "text-emerald-400" : "text-amber-400")} />}
          label="Huecos totales"
          value={String(stats.totalHuecos)}
        />
        <Stat
          icon={<BarChart3 className="h-4 w-4 text-violet-400" />}
          label="Estado"
          value={pendingCount === 0 ? "Completo" : `${pendingCount} pendientes`}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800">
        <button
          onClick={() => setTab("semanas")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            tab === "semanas" ? "border-indigo-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
          )}
        >
          Semanas
        </button>
        <button
          onClick={() => setTab("trabajadores")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            tab === "trabajadores" ? "border-indigo-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
          )}
        >
          Por trabajador
        </button>
      </div>

      {tab === "semanas" && (
        <div className="space-y-2">
          {weeks.map((w, idx) => {
            const status = weekStatus(w, idx);
            const cobertura =
              w.slots_persona_demanda
                ? Math.round((Number(w.slots_persona_asignados) / Math.max(Number(w.slots_persona_demanda), 1)) * 100)
                : null;

            return (
              <div
                key={`${w.anio}-${w.semana}`}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-all",
                  status === "generating"
                    ? "border-indigo-500 bg-indigo-500/5 animate-pulse"
                    : status === "done"
                    ? "border-slate-800 bg-slate-900"
                    : "border-slate-800 bg-slate-900/50"
                )}
              >
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-mono text-slate-400">
                    S{w.semana}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white text-sm font-medium">
                      Semana {w.semana} · {w.anio}
                    </p>
                    {status === "generating" && (
                      <Badge className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs">
                        Generando…
                      </Badge>
                    )}
                    {status === "done" && w.run_estado && (
                      <RunBadge estado={w.run_estado} />
                    )}
                    {status === "pending" && (
                      <Badge className="bg-slate-800 text-slate-500 border border-slate-700 text-xs">
                        Pendiente
                      </Badge>
                    )}
                  </div>
                  {status === "done" && (
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                      {cobertura !== null && (
                        <span>{cobertura}% cobertura</span>
                      )}
                      {w.slots_persona_huecos !== null && Number(w.slots_persona_huecos) > 0 && (
                        <span className="text-amber-400">{w.slots_persona_huecos} huecos</span>
                      )}
                      {w.tiempo_calculo_seg !== null && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {Number(w.tiempo_calculo_seg).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {status === "done" && w.schedule_run_id ? (
                    <Link
                      href={`/dashboard/schedule/${w.schedule_run_id}`}
                      className="text-indigo-400 hover:text-indigo-300 text-sm"
                    >
                      Ver →
                    </Link>
                  ) : status === "pending" ? (
                    <button
                      onClick={() => generateSingle(idx)}
                      disabled={running}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                    >
                      <Play className="h-3 w-3" /> Generar
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "trabajadores" && (
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium sticky left-0 bg-slate-900 z-10 min-w-[200px]">
                    Trabajador
                  </th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Target periodo</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Promedio/sem</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium hidden md:table-cell">Distribución</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {workers.map((w) => {
                  const t = workerTotals.get(w.id);
                  const target = t?.target ?? 0;
                  const promedio = weeks.length ? target / weeks.length : 0;
                  return (
                    <tr key={w.id} className="hover:bg-slate-800/20">
                      <td className="px-4 py-2 sticky left-0 bg-slate-900/60 z-10">
                        <p className="text-white font-medium text-sm">{w.nombre}</p>
                        <p className="text-slate-500 text-xs">{w.contrato_str}</p>
                      </td>
                      <td className="px-4 py-2 text-right text-white font-semibold">
                        {target.toFixed(0)}h
                      </td>
                      <td className="px-4 py-2 text-right text-slate-300">
                        {promedio.toFixed(1)}h
                      </td>
                      <td className="px-4 py-2 hidden md:table-cell">
                        <div className="flex items-center gap-0.5">
                          {weeks.map((wk) => {
                            const targets = (typeof wk.target_hours === "string"
                              ? JSON.parse(wk.target_hours)
                              : wk.target_hours) as Record<string, number>;
                            const h = targets[w.id] ?? 0;
                            const pct = Math.min(100, (h / 50) * 100);
                            return (
                              <div
                                key={`${wk.anio}-${wk.semana}`}
                                className="w-2 bg-slate-800 rounded-sm overflow-hidden"
                                style={{ height: 28 }}
                                title={`S${wk.semana}: ${h}h`}
                              >
                                <div
                                  className={cn(
                                    "w-full bg-gradient-to-t from-indigo-600 to-indigo-400 transition-all",
                                    h === 0 && "bg-slate-700"
                                  )}
                                  style={{ height: `${pct}%`, marginTop: "auto" }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon, label, value, progress,
}: {
  icon: React.ReactNode; label: string; value: string; progress?: number;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-500 text-xs uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
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
