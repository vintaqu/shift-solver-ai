// Periodos de planificación: enumeración de semanas ISO y asignación de horas
// objetivo por trabajador respetando contratos y tope anual.

import {
  startOfISOWeek,
  endOfISOWeek,
  addWeeks,
  addDays,
  getISOWeek,
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
} from "date-fns";
import { es } from "date-fns/locale";

export type PeriodTipo = "mes" | "trimestre" | "anio" | "custom";

export interface IsoWeek {
  semana: number;
  anio: number;
  fecha_inicio: string;        // ISO date YYYY-MM-DD (lunes)
  fecha_fin: string;           // ISO date YYYY-MM-DD (domingo)
  label: string;               // "8 mar – 14 mar 2026"
}

export interface WorkerContract {
  id: string;
  nombre: string;
  contrato_tipo: "fijo" | "horquilla";
  horas: number | null;
  min_horas: number | null;
  max_horas: number | null;
}

// ─── Date range computation ──────────────────────────────────────────────────

export function computePeriodRange(tipo: PeriodTipo, anchor: Date): { start: Date; end: Date } {
  switch (tipo) {
    case "mes":
      return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
    case "trimestre":
      return { start: startOfQuarter(anchor), end: endOfQuarter(anchor) };
    case "anio":
      return { start: startOfYear(anchor), end: endOfYear(anchor) };
    case "custom":
      return { start: anchor, end: anchor }; // caller fills end
  }
}

// ─── Week enumeration ────────────────────────────────────────────────────────

/**
 * Enumera las semanas ISO completas que solapan con [start, end].
 * Cada semana abarca lunes-domingo. Si una semana cae a caballo del
 * principio o final del rango, también se incluye.
 */
export function enumerateWeeks(start: Date, end: Date): IsoWeek[] {
  const weeks: IsoWeek[] = [];
  let cursor = startOfISOWeek(start);

  while (cursor <= end) {
    const weekEnd = endOfISOWeek(cursor);
    const thursday = addDays(cursor, 3);
    weeks.push({
      semana: getISOWeek(cursor),
      anio: thursday.getFullYear(),
      fecha_inicio: format(cursor, "yyyy-MM-dd"),
      fecha_fin: format(weekEnd, "yyyy-MM-dd"),
      label: `${format(cursor, "d MMM", { locale: es })} – ${format(weekEnd, "d MMM yyyy", { locale: es })}`,
    });
    cursor = addWeeks(cursor, 1);
  }

  return weeks;
}

// ─── Hour allocation ─────────────────────────────────────────────────────────

const HORAS_FLEX_MAX = 4;     // ±4h de variación permitida sobre la base
const HORAS_ANUAL_CAP = 1791; // tope anual a tiempo completo (convenio)

export interface WorkerWeekTargets {
  worker_id: string;
  // map week index → target hours
  por_semana: number[];
}

export function defaultBaselineHoras(w: WorkerContract): number {
  if (w.contrato_tipo === "fijo") return w.horas ?? 40;
  const lo = w.min_horas ?? 12;
  const hi = w.max_horas ?? 28;
  return Math.round((lo + hi) / 2);
}

/**
 * Genera la matriz inicial de horas-objetivo por trabajador y semana.
 * Por defecto: cada semana = horas base del contrato. El usuario puede
 * editarlo después semana a semana. Tope anual proporcional al periodo.
 */
export function defaultTargetsMatrix(
  workers: WorkerContract[],
  numWeeks: number
): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const w of workers) {
    const base = defaultBaselineHoras(w);
    result[w.id] = new Array(numWeeks).fill(base);
  }
  return result;
}

/**
 * Valida una matriz de horas-objetivo contra los contratos y tope anual.
 * Devuelve lista de avisos (no errores duros — las decisiones son del usuario).
 */
export function validateTargets(
  workers: WorkerContract[],
  targets: Record<string, number[]>
): string[] {
  const warnings: string[] = [];
  for (const w of workers) {
    const horas = targets[w.id] ?? [];
    const total = horas.reduce((s, h) => s + (h ?? 0), 0);
    const semanasConTrabajo = horas.filter((h) => (h ?? 0) > 0).length;
    if (semanasConTrabajo === 0) continue;

    const base = defaultBaselineHoras(w);
    const promedio = total / semanasConTrabajo;

    // Variabilidad dentro del rango ±4h sobre la base
    for (let i = 0; i < horas.length; i++) {
      const h = horas[i];
      if (h === 0) continue;
      if (w.contrato_tipo === "horquilla") {
        const lo = w.min_horas ?? 0;
        const hi = w.max_horas ?? 999;
        if (h < lo) warnings.push(`${w.nombre}: semana ${i + 1} (${h}h) por debajo del mínimo del contrato (${lo}h)`);
        if (h > hi) warnings.push(`${w.nombre}: semana ${i + 1} (${h}h) por encima del máximo (${hi}h)`);
      } else {
        if (Math.abs(h - base) > HORAS_FLEX_MAX) {
          warnings.push(`${w.nombre}: semana ${i + 1} (${h}h) fuera de rango ${base - HORAS_FLEX_MAX}h–${base + HORAS_FLEX_MAX}h`);
        }
      }
    }

    // Promedio del periodo cerca del contrato (±2h tolerancia)
    if (w.contrato_tipo === "fijo" && Math.abs(promedio - base) > 2) {
      warnings.push(`${w.nombre}: promedio ${promedio.toFixed(1)}h aleja del contrato ${base}h`);
    }

    // Tope anual proporcional
    const capProporcional = (HORAS_ANUAL_CAP * horas.length) / 52;
    if (total > capProporcional) {
      warnings.push(`${w.nombre}: ${total}h excede el tope anual proporcional (${capProporcional.toFixed(0)}h)`);
    }
  }
  return warnings;
}

/**
 * Convierte un target de horas para una semana en un Contrato del solver.
 * - Para 'fijo': devuelve el contrato fijo con esas horas exactas.
 * - Para 'horquilla': respeta el rango original, pero tope superior por
 *   target (el solver intentará llegar a target sin pasarse).
 */
export function targetToContrato(w: WorkerContract, target: number) {
  if (target <= 0) {
    // marcar como inactivo dándole una horquilla 0-0 (todo descanso)
    return { tipo: "horquilla", horas: null, min_horas: 0, max_horas: 0 };
  }
  if (w.contrato_tipo === "fijo") {
    return { tipo: "fijo", horas: target, min_horas: null, max_horas: null };
  }
  // horquilla: usar target exacto como contrato fijo de la semana
  return { tipo: "fijo", horas: target, min_horas: null, max_horas: null };
}

// ─── Period type helpers ─────────────────────────────────────────────────────

export const PERIOD_LABELS: Record<PeriodTipo, string> = {
  mes: "Mes",
  trimestre: "Trimestre",
  anio: "Año",
  custom: "Personalizado",
};

export function suggestPeriodName(tipo: PeriodTipo, start: Date): string {
  switch (tipo) {
    case "mes":
      return format(start, "MMMM yyyy", { locale: es }).replace(/^\w/, (c) => c.toUpperCase());
    case "trimestre": {
      const q = Math.floor(start.getMonth() / 3) + 1;
      return `Q${q} ${start.getFullYear()}`;
    }
    case "anio":
      return `Año ${start.getFullYear()}`;
    case "custom":
      return `Periodo ${format(start, "d MMM yyyy", { locale: es })}`;
  }
}

export function parseDateOrToday(s: string | null | undefined): Date {
  if (!s) return new Date();
  try {
    return parseISO(s);
  } catch {
    return new Date();
  }
}
