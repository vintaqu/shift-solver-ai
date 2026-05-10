// Validación legal en cliente del cuadrante editado.
// Replica las restricciones del convenio Tarragona + Estatuto que el solver
// CP-SAT impone como restricciones duras, pero aquí en modo informativo:
// el usuario puede saltárselas si lo decide manualmente.

import type { Tramo } from "./schedule-coverage";

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO","DOMINGO"] as const;
const DIA_LABEL: Record<string, string> = {
  LUNES: "Lunes", MARTES: "Martes", MIERCOLES: "Miércoles",
  JUEVES: "Jueves", VIERNES: "Viernes", SABADO: "Sábado", DOMINGO: "Domingo",
};

export type Severity = "error" | "warning";

export interface Violation {
  worker_id: string;
  worker_name: string;
  dia?: string;
  code: string;
  severity: Severity;
  message: string;
  detalle?: string;
}

export interface WorkerRestrictions {
  dias_libres?: string[];
  no_antes_de?: Array<{ hora: string; dias: string | string[] }>;
  no_despues_de?: Array<{ hora: string; dias: string | string[] }>;
  trabajar_obligatorio?: Array<{ dia: string; desde: string; hasta: string }>;
}

export interface WorkerForValidation {
  id: string;
  nombre: string;
  contrato_tipo: "fijo" | "horquilla";
  contrato_horas: number | null;
  contrato_min: number | null;
  contrato_max: number | null;
  restricciones: WorkerRestrictions;
}

export interface AssignmentForValidation {
  worker_id: string;
  dia: string;
  tramos: Tramo[];
}

// ─── Time helpers ────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  if (!time) return 0;
  if (time === "00:00" || time === "24:00") return 24 * 60;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHours(min: number): number {
  return min / 60;
}

function tramoHorasMin(tramo: Tramo): number {
  return timeToMinutes(tramo.fin) - timeToMinutes(tramo.inicio);
}

function totalHoras(tramos: Tramo[]): number {
  return tramos.reduce((sum, t) => sum + tramoHorasMin(t), 0) / 60;
}

function diasMatch(target: string, dias: string | string[] | undefined): boolean {
  if (!dias) return true;
  if (typeof dias === "string") {
    if (dias.toUpperCase() === "TODOS") return true;
    return dias === target;
  }
  return dias.includes(target);
}

// ─── Individual rule validators ──────────────────────────────────────────────

// Punto 3 del PDF: Máx 9h ordinarias/día
function validateMax9hDia(w: WorkerForValidation, a: AssignmentForValidation): Violation[] {
  const horas = totalHoras(a.tramos);
  if (horas > 9.001) {
    return [{
      worker_id: w.id,
      worker_name: w.nombre,
      dia: a.dia,
      code: "MAX_9H_DIA",
      severity: "error",
      message: `${w.nombre} · ${DIA_LABEL[a.dia]}: ${horas.toFixed(1)}h supera el máximo de 9h ordinarias/día.`,
    }];
  }
  return [];
}

// Punto 4: Mín 12h entre fin de jornada e inicio de la siguiente
function validate12hRest(
  w: WorkerForValidation, prev: AssignmentForValidation, today: AssignmentForValidation
): Violation[] {
  if (!prev.tramos.length || !today.tramos.length) return [];

  const lastEnd = Math.max(...prev.tramos.map((t) => timeToMinutes(t.fin)));
  const firstStart = Math.min(...today.tramos.map((t) => timeToMinutes(t.inicio)));
  const gapMin = (24 * 60 - lastEnd) + firstStart;
  const gapH = minutesToHours(gapMin);

  if (gapH < 12) {
    return [{
      worker_id: w.id,
      worker_name: w.nombre,
      dia: today.dia,
      code: "DESCANSO_12H",
      severity: "error",
      message: `${w.nombre} · ${DIA_LABEL[today.dia]}: solo ${gapH.toFixed(1)}h de descanso desde ${DIA_LABEL[prev.dia]} (mínimo 12h).`,
    }];
  }
  return [];
}

// Punto 5: Continuada > 5h ⇒ pausa 20min (no validable solo desde tramos,
// la pausa se asume; aquí solo avisamos si existe la condición).
// Punto 6: Jornada partida — cada tramo entre 3-5h, descanso entre tramos ≥1.5h
function validatePartida(w: WorkerForValidation, a: AssignmentForValidation): Violation[] {
  const out: Violation[] = [];
  if (a.tramos.length < 2) return out; // sólo aplica a partida

  for (const t of a.tramos) {
    const horas = tramoHorasMin(t) / 60;
    if (horas < 3) {
      out.push({
        worker_id: w.id,
        worker_name: w.nombre,
        dia: a.dia,
        code: "PARTIDA_MIN_3H",
        severity: "error",
        message: `${w.nombre} · ${DIA_LABEL[a.dia]}: tramo ${t.inicio}–${t.fin} (${horas.toFixed(1)}h) por debajo del mínimo legal de 3h en jornada partida.`,
      });
    }
    if (horas > 5.001) {
      out.push({
        worker_id: w.id,
        worker_name: w.nombre,
        dia: a.dia,
        code: "PARTIDA_MAX_5H",
        severity: "error",
        message: `${w.nombre} · ${DIA_LABEL[a.dia]}: tramo ${t.inicio}–${t.fin} (${horas.toFixed(1)}h) supera el máximo de 5h en jornada partida.`,
      });
    }
  }

  // Descanso entre tramos ≥ 1.5h
  const sorted = [...a.tramos].sort((x, y) => timeToMinutes(x.inicio) - timeToMinutes(y.inicio));
  for (let i = 0; i < sorted.length - 1; i++) {
    const restMin = timeToMinutes(sorted[i + 1].inicio) - timeToMinutes(sorted[i].fin);
    if (restMin < 90) {
      out.push({
        worker_id: w.id,
        worker_name: w.nombre,
        dia: a.dia,
        code: "PARTIDA_DESCANSO_15H",
        severity: "error",
        message: `${w.nombre} · ${DIA_LABEL[a.dia]}: solo ${(restMin / 60).toFixed(1)}h entre tramos (mínimo 1.5h en jornada partida).`,
      });
    }
  }

  return out;
}

// Punto 7: Descanso semanal — 2 días seguidos
function validateRestSemanal(
  w: WorkerForValidation, weekAssignments: AssignmentForValidation[]
): Violation[] {
  const byDia = new Map<string, AssignmentForValidation>();
  for (const a of weekAssignments) byDia.set(a.dia, a);

  const isRest = (dia: string) => {
    const a = byDia.get(dia);
    return !a || a.tramos.length === 0;
  };

  // Comprobar 2 días consecutivos (con wrap dom→lun)
  for (let i = 0; i < 7; i++) {
    if (isRest(DIAS[i]) && isRest(DIAS[(i + 1) % 7])) return [];
  }

  return [{
    worker_id: w.id,
    worker_name: w.nombre,
    code: "DESCANSO_SEMANAL_2D",
    severity: "error",
    message: `${w.nombre}: no tiene 2 días consecutivos de descanso esta semana.`,
  }];
}

// Contrato — total semanal dentro de rango
function validateContractHours(
  w: WorkerForValidation, weekAssignments: AssignmentForValidation[]
): Violation[] {
  const totalSemana = weekAssignments.reduce((sum, a) => sum + totalHoras(a.tramos), 0);

  if (w.contrato_tipo === "fijo") {
    const base = w.contrato_horas ?? 40;
    // Cómputo solo semanal: solo permite subir hasta +4 (44h max)
    if (totalSemana > base + 4.001) {
      return [{
        worker_id: w.id,
        worker_name: w.nombre,
        code: "CONTRATO_FIJO_EXCESO",
        severity: "warning",
        message: `${w.nombre}: ${totalSemana.toFixed(1)}h en la semana, supera el máximo flexible (${base + 4}h) sobre contrato de ${base}h.`,
      }];
    }
    if (totalSemana < base - 0.001 && totalSemana > 0) {
      return [{
        worker_id: w.id,
        worker_name: w.nombre,
        code: "CONTRATO_FIJO_DEFICIT",
        severity: "warning",
        message: `${w.nombre}: ${totalSemana.toFixed(1)}h asignadas, contrato fijo de ${base}h.`,
      }];
    }
  } else {
    // horquilla
    const lo = w.contrato_min ?? 0;
    const hi = w.contrato_max ?? 999;
    if (totalSemana > 0 && totalSemana < lo - 0.001) {
      return [{
        worker_id: w.id,
        worker_name: w.nombre,
        code: "HORQUILLA_BAJO",
        severity: "warning",
        message: `${w.nombre}: ${totalSemana.toFixed(1)}h, por debajo del mínimo de horquilla (${lo}h).`,
      }];
    }
    if (totalSemana > hi + 0.001) {
      return [{
        worker_id: w.id,
        worker_name: w.nombre,
        code: "HORQUILLA_ALTO",
        severity: "warning",
        message: `${w.nombre}: ${totalSemana.toFixed(1)}h, por encima del máximo de horquilla (${hi}h).`,
      }];
    }
  }
  return [];
}

// Restricciones individuales del trabajador
function validateRestrictions(
  w: WorkerForValidation, weekAssignments: AssignmentForValidation[]
): Violation[] {
  const out: Violation[] = [];
  const r = w.restricciones ?? {};

  // Días libres fijos
  for (const dia of r.dias_libres ?? []) {
    const a = weekAssignments.find((x) => x.dia === dia);
    if (a && a.tramos.length > 0) {
      out.push({
        worker_id: w.id,
        worker_name: w.nombre,
        dia,
        code: "DIA_LIBRE_FIJO",
        severity: "warning",
        message: `${w.nombre} tiene ${DIA_LABEL[dia]} como día libre fijo pero está asignado.`,
      });
    }
  }

  // No antes de
  for (const regla of r.no_antes_de ?? []) {
    const limite = timeToMinutes(regla.hora);
    for (const a of weekAssignments) {
      if (!diasMatch(a.dia, regla.dias)) continue;
      if (a.tramos.length === 0) continue;
      const earliest = Math.min(...a.tramos.map((t) => timeToMinutes(t.inicio)));
      if (earliest < limite) {
        out.push({
          worker_id: w.id,
          worker_name: w.nombre,
          dia: a.dia,
          code: "NO_ANTES_DE",
          severity: "warning",
          message: `${w.nombre} · ${DIA_LABEL[a.dia]}: empieza a las ${minutesToTime(earliest)} (no antes de ${regla.hora}).`,
        });
      }
    }
  }

  // No después de
  for (const regla of r.no_despues_de ?? []) {
    const limite = timeToMinutes(regla.hora);
    for (const a of weekAssignments) {
      if (!diasMatch(a.dia, regla.dias)) continue;
      if (a.tramos.length === 0) continue;
      const latest = Math.max(...a.tramos.map((t) => timeToMinutes(t.fin)));
      if (latest > limite) {
        out.push({
          worker_id: w.id,
          worker_name: w.nombre,
          dia: a.dia,
          code: "NO_DESPUES_DE",
          severity: "warning",
          message: `${w.nombre} · ${DIA_LABEL[a.dia]}: termina a las ${minutesToTime(latest)} (no después de ${regla.hora}).`,
        });
      }
    }
  }

  // Trabajar obligatorio: la ventana debe estar cubierta por al menos un tramo
  for (const regla of r.trabajar_obligatorio ?? []) {
    const a = weekAssignments.find((x) => x.dia === regla.dia);
    const desde = timeToMinutes(regla.desde);
    const hasta = timeToMinutes(regla.hasta);
    const cubierto = !!a && a.tramos.some((t) => timeToMinutes(t.inicio) <= desde && timeToMinutes(t.fin) >= hasta);
    if (!cubierto) {
      out.push({
        worker_id: w.id,
        worker_name: w.nombre,
        dia: regla.dia,
        code: "TRABAJAR_OBLIGATORIO",
        severity: "warning",
        message: `${w.nombre} · ${DIA_LABEL[regla.dia]}: no cubre la ventana obligatoria ${regla.desde}–${regla.hasta}.`,
      });
    }
  }

  return out;
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Valida un cuadrante completo. Devuelve todas las violaciones encontradas
 * agrupadas por trabajador y día.
 */
export function validateSchedule(
  workers: WorkerForValidation[],
  assignments: AssignmentForValidation[]
): Violation[] {
  const out: Violation[] = [];

  for (const w of workers) {
    const wAssignments = assignments.filter((a) => a.worker_id === w.id);
    const byDia = new Map<string, AssignmentForValidation>();
    for (const a of wAssignments) byDia.set(a.dia, a);

    // Aseguramos que cada dia tiene un assignment (descanso si vacío) para validaciones de descanso semanal
    const fullWeek = DIAS.map((d) => byDia.get(d) ?? { worker_id: w.id, dia: d, tramos: [] });

    // Por día
    for (const a of fullWeek) {
      out.push(...validateMax9hDia(w, a));
      out.push(...validatePartida(w, a));
    }

    // Cruces día anterior → día actual (12h descanso)
    for (let i = 1; i < DIAS.length; i++) {
      const prev = fullWeek[i - 1];
      const today = fullWeek[i];
      out.push(...validate12hRest(w, prev, today));
    }
    // Wrap dom → lun (lo trataríamos cross-week, lo dejamos aquí como aviso interno)
    out.push(...validate12hRest(w, fullWeek[6], fullWeek[0]));

    // Semanales
    out.push(...validateRestSemanal(w, fullWeek));
    out.push(...validateContractHours(w, fullWeek));

    // Individuales
    out.push(...validateRestrictions(w, fullWeek));
  }

  return out;
}

/**
 * Valida una propuesta de cambio para una celda específica. Devuelve sólo
 * las violaciones que afectan al trabajador en cuestión, considerando los
 * tramos propuestos en lugar de los actuales.
 */
export function validateProposal(
  worker: WorkerForValidation,
  dia: string,
  proposedTramos: Tramo[],
  weekAssignments: AssignmentForValidation[]
): Violation[] {
  const updated = weekAssignments
    .filter((a) => a.dia !== dia)
    .concat([{ worker_id: worker.id, dia, tramos: proposedTramos }]);

  return validateSchedule([worker], updated);
}

// ─── Group helpers for UI ────────────────────────────────────────────────────

export function violationsByCell(violations: Violation[]): Map<string, Violation[]> {
  const m = new Map<string, Violation[]>();
  for (const v of violations) {
    if (!v.dia) continue;
    const key = `${v.worker_id}|${v.dia}`;
    const arr = m.get(key) ?? [];
    arr.push(v);
    m.set(key, arr);
  }
  return m;
}

export function violationsByWorker(violations: Violation[]): Map<string, Violation[]> {
  const m = new Map<string, Violation[]>();
  for (const v of violations) {
    const arr = m.get(v.worker_id) ?? [];
    arr.push(v);
    m.set(v.worker_id, arr);
  }
  return m;
}
