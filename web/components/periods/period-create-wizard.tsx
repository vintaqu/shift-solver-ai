"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Calendar, ChevronLeft, ChevronRight, Loader2, AlertCircle,
  Users, Clock, ArrowRight, Check,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  enumerateWeeks,
  computePeriodRange,
  defaultTargetsMatrix,
  validateTargets,
  suggestPeriodName,
  PERIOD_LABELS,
  type PeriodTipo,
  type WorkerContract,
  type IsoWeek,
} from "@/lib/period-helpers";

interface Props {
  workers: WorkerContract[];
}

const STEPS = ["Tipo", "Fechas", "Horas objetivo", "Confirmar"] as const;

export default function PeriodCreateWizard({ workers }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [tipo, setTipo] = useState<PeriodTipo>("mes");
  const [anchor, setAnchor] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [nombre, setNombre] = useState("");
  const [targets, setTargets] = useState<Record<string, number[]>>({});
  const [saving, setSaving] = useState(false);

  // Compute the period range and weeks based on user selections
  const { range, weeks } = useMemo(() => {
    const anchorDate = parseISO(anchor);
    let r;
    if (tipo === "custom") {
      r = { start: anchorDate, end: parseISO(customEnd) };
    } else {
      r = computePeriodRange(tipo, anchorDate);
    }
    const w = enumerateWeeks(r.start, r.end);
    return { range: r, weeks: w };
  }, [tipo, anchor, customEnd]);

  // Initialize targets when weeks count changes
  const numWeeks = weeks.length;
  useMemo(() => {
    setTargets((prev) => {
      const fresh = defaultTargetsMatrix(workers, numWeeks);
      // preserve user edits where lengths match
      for (const w of workers) {
        if (prev[w.id] && prev[w.id].length === numWeeks) {
          fresh[w.id] = prev[w.id];
        }
      }
      return fresh;
    });
  }, [workers, numWeeks]);

  // Initialize default name
  useMemo(() => {
    if (!nombre) setNombre(suggestPeriodName(tipo, parseISO(anchor)));
  }, [tipo, anchor, nombre]);

  const updateTarget = (workerId: string, weekIdx: number, value: number) => {
    setTargets((prev) => ({
      ...prev,
      [workerId]: prev[workerId].map((h, i) => (i === weekIdx ? value : h)),
    }));
  };

  const warnings = useMemo(() => validateTargets(workers, targets), [workers, targets]);

  const totalHorasPeriodo = useMemo(() => {
    let total = 0;
    for (const arr of Object.values(targets)) {
      total += arr.reduce((s, h) => s + h, 0);
    }
    return total;
  }, [targets]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim() || suggestPeriodName(tipo, parseISO(anchor)),
          tipo,
          fecha_inicio: format(range.start, "yyyy-MM-dd"),
          fecha_fin: format(range.end, "yyyy-MM-dd"),
          weeks: weeks.map((w, i) => ({
            semana: w.semana,
            anio: w.anio,
            posicion: i,
          })),
          target_hours: targets,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al crear el periodo");
      }
      const { id } = await res.json();
      toast.success("Periodo creado");
      router.push(`/dashboard/periods/${id}`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                i < step
                  ? "bg-emerald-500 text-white"
                  : i === step
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800 text-slate-500"
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={cn(
              "font-medium hidden md:inline",
              i === step ? "text-white" : i < step ? "text-emerald-400" : "text-slate-500"
            )}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn("w-8 h-px", i < step ? "bg-emerald-500/40" : "bg-slate-800")} />
            )}
          </div>
        ))}
      </div>

      {/* STEP 1 — Tipo */}
      {step === 0 && (
        <div className="space-y-4">
          <h3 className="text-white font-semibold">¿Qué horizonte quieres planificar?</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.keys(PERIOD_LABELS) as PeriodTipo[]).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={cn(
                  "p-5 rounded-xl border text-left transition-all",
                  tipo === t
                    ? "bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/10"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                )}
              >
                <Calendar className={cn("h-5 w-5 mb-2", tipo === t ? "text-indigo-400" : "text-slate-500")} />
                <p className="text-white font-semibold">{PERIOD_LABELS[t]}</p>
                <p className="text-slate-500 text-xs mt-1">
                  {t === "mes" && "~4–5 semanas"}
                  {t === "trimestre" && "~13 semanas"}
                  {t === "anio" && "~52 semanas"}
                  {t === "custom" && "Rango libre"}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2 — Fechas */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-white font-semibold">Fechas del periodo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300 text-sm">
                {tipo === "custom" ? "Fecha inicio" : "Fecha de referencia"}
              </Label>
              <Input
                type="date"
                value={anchor}
                onChange={(e) => setAnchor(e.target.value)}
                className="bg-slate-900 border-slate-800 text-white mt-1"
              />
              {tipo !== "custom" && (
                <p className="text-slate-500 text-xs mt-1">
                  Se ajustará automáticamente al inicio del {PERIOD_LABELS[tipo].toLowerCase()}
                </p>
              )}
            </div>
            {tipo === "custom" && (
              <div>
                <Label className="text-slate-300 text-sm">Fecha fin</Label>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-slate-900 border-slate-800 text-white mt-1"
                />
              </div>
            )}
            <div className="md:col-span-2">
              <Label className="text-slate-300 text-sm">Nombre del periodo</Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={suggestPeriodName(tipo, parseISO(anchor))}
                className="bg-slate-900 border-slate-800 text-white mt-1"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-slate-400 text-sm mb-2">Resumen del rango</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl font-bold text-white">{numWeeks}</span>
              <span className="text-slate-400">semanas</span>
              <span className="text-slate-600 mx-2">·</span>
              <span className="text-slate-300">
                {format(range.start, "d MMM yyyy", { locale: es })}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-600" />
              <span className="text-slate-300">
                {format(range.end, "d MMM yyyy", { locale: es })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3 — Horas objetivo */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-white font-semibold">Horas objetivo por semana</h3>
              <p className="text-slate-500 text-sm mt-1">
                Edita las horas que cada trabajador debe hacer cada semana.
                Por defecto = horas del contrato. ±4h de flexibilidad permitida.
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-white">{totalHorasPeriodo.toFixed(0)}h</p>
              <p className="text-slate-500 text-xs">total del periodo</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-900">
                  <tr>
                    <th className="text-left px-3 py-2 text-slate-400 font-medium sticky left-0 bg-slate-900 z-10 min-w-[150px]">
                      Trabajador
                    </th>
                    {weeks.map((w) => (
                      <th key={`${w.anio}-${w.semana}`} className="text-center px-2 py-2 text-slate-400 font-medium min-w-[60px]">
                        S{w.semana}
                      </th>
                    ))}
                    <th className="text-right px-3 py-2 text-slate-400 font-medium min-w-[60px]">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {workers.map((w) => {
                    const arr = targets[w.id] ?? [];
                    const total = arr.reduce((s, h) => s + (h ?? 0), 0);
                    return (
                      <tr key={w.id} className="hover:bg-slate-800/20">
                        <td className="px-3 py-1.5 sticky left-0 bg-slate-900/60 z-10">
                          <p className="text-white font-medium text-xs">{w.nombre}</p>
                          <p className="text-slate-500 text-[10px]">
                            {w.contrato_tipo === "fijo" ? `${w.horas}h fijas` : `${w.min_horas}-${w.max_horas}h`}
                          </p>
                        </td>
                        {arr.map((h, i) => (
                          <td key={i} className="px-1 py-1">
                            <input
                              type="number"
                              min={0}
                              max={50}
                              value={h}
                              onChange={(e) => updateTarget(w.id, i, Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))}
                              className="w-full bg-slate-800 border border-slate-700 rounded text-white text-xs text-center py-1 focus:outline-none focus:border-indigo-500"
                            />
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right text-white font-semibold">{total}h</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
              <p className="text-amber-300 text-sm font-semibold mb-1 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {warnings.length} aviso{warnings.length === 1 ? "" : "s"}
              </p>
              <ul className="text-amber-300/80 text-xs space-y-0.5 max-h-32 overflow-y-auto">
                {warnings.slice(0, 8).map((w, i) => <li key={i}>• {w}</li>)}
                {warnings.length > 8 && <li>… y {warnings.length - 8} más</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* STEP 4 — Confirmar */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-white font-semibold">Resumen final</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={<Calendar className="h-4 w-4 text-indigo-400" />} label="Semanas" value={String(numWeeks)} />
            <Stat icon={<Users className="h-4 w-4 text-emerald-400" />} label="Trabajadores" value={String(workers.length)} />
            <Stat icon={<Clock className="h-4 w-4 text-amber-400" />} label="Horas totales" value={`${totalHorasPeriodo.toFixed(0)}h`} />
            <Stat icon={<AlertCircle className="h-4 w-4 text-slate-400" />} label="Avisos" value={String(warnings.length)} />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
            <Row label="Nombre" value={nombre || suggestPeriodName(tipo, parseISO(anchor))} />
            <Row label="Tipo" value={PERIOD_LABELS[tipo]} />
            <Row label="Inicio" value={format(range.start, "EEEE d 'de' MMMM yyyy", { locale: es })} />
            <Row label="Fin" value={format(range.end, "EEEE d 'de' MMMM yyyy", { locale: es })} />
          </div>

          <p className="text-slate-500 text-sm">
            💡 Crear el periodo no genera los cuadrantes inmediatamente. Después podrás
            generar las semanas una a una o todas seguidas desde la página de detalle.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <Button
          variant="outline"
          className="border-slate-700 text-slate-300"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || saving}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            className="bg-indigo-600 hover:bg-indigo-500"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={numWeeks === 0}
          >
            Siguiente <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            className="bg-emerald-600 hover:bg-emerald-500"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear periodo
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-500 text-xs uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

// Used by helper components but unused weeks reference
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

// Suppress unused IsoWeek import warning if linter complains
export type _IsoWeek = IsoWeek;
