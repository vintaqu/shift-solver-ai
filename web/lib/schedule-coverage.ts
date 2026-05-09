// Recálculo en cliente de la cobertura de un cuadrante.
// Aproximación: por cada slot de 30min, demand = max personas entre franjas
// que cubren el slot, assigned = nº de tramos de trabajadores que cubren el slot.
// hueco = max(0, demand - assigned).

export const SLOT_MIN = 30;
export const SLOTS_PER_DAY = 48; // 24h * 2 (slot 48 = 00:00 del día siguiente)

export interface NeedRow {
  dia: string;
  inicio: string;
  fin: string;
  personas: number;
}

export interface Tramo {
  inicio: string;
  fin: string;
  duracion_horas?: number;
}

export interface AssignmentRow {
  worker_id: string;
  dia: string;
  tramos: Tramo[];
}

export interface CoverageStats {
  demanda: number;          // slots-persona
  asignado: number;
  huecos: number;
  cobertura_pct: number;    // 0-100
  horas_demanda: number;
  horas_asignadas: number;
  horas_huecos: number;
  por_dia: Record<string, { demanda: number; asignado: number; huecos: number }>;
}

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO","DOMINGO"];

function toSlot(time: string): number {
  if (!time) return 0;
  if (time === "00:00" || time === "24:00") return SLOTS_PER_DAY;
  const [h, m] = time.split(":").map(Number);
  return h * 2 + Math.floor(m / SLOT_MIN);
}

function endSlot(time: string): number {
  if (time === "00:00" || time === "24:00") return SLOTS_PER_DAY;
  return toSlot(time);
}

function buildDemandPerSlot(needs: NeedRow[], dia: string): number[] {
  const arr = new Array(SLOTS_PER_DAY).fill(0);
  for (const n of needs) {
    if (n.dia !== dia) continue;
    const start = toSlot(n.inicio);
    const end = endSlot(n.fin);
    for (let s = start; s < end && s < SLOTS_PER_DAY; s++) {
      arr[s] = Math.max(arr[s], n.personas);
    }
  }
  return arr;
}

function buildAssignedPerSlot(assignments: AssignmentRow[], dia: string): number[] {
  const arr = new Array(SLOTS_PER_DAY).fill(0);
  for (const a of assignments) {
    if (a.dia !== dia) continue;
    for (const t of a.tramos ?? []) {
      const start = toSlot(t.inicio);
      const end = endSlot(t.fin);
      for (let s = start; s < end && s < SLOTS_PER_DAY; s++) {
        arr[s] += 1;
      }
    }
  }
  return arr;
}

export function computeCoverage(needs: NeedRow[], assignments: AssignmentRow[]): CoverageStats {
  let demanda = 0, asignado = 0, huecos = 0;
  const por_dia: CoverageStats["por_dia"] = {};

  for (const dia of DIAS) {
    const dem = buildDemandPerSlot(needs, dia);
    const ass = buildAssignedPerSlot(assignments, dia);

    let dDem = 0, dAss = 0, dHue = 0;
    for (let s = 0; s < SLOTS_PER_DAY; s++) {
      dDem += dem[s];
      dAss += ass[s];
      dHue += Math.max(0, dem[s] - ass[s]);
    }
    por_dia[dia] = { demanda: dDem, asignado: dAss, huecos: dHue };
    demanda += dDem;
    asignado += dAss;
    huecos += dHue;
  }

  const cobertura_pct =
    demanda === 0 ? 100 : Math.round(((demanda - huecos) / demanda) * 100);

  return {
    demanda,
    asignado,
    huecos,
    cobertura_pct,
    horas_demanda: (demanda * SLOT_MIN) / 60,
    horas_asignadas: (asignado * SLOT_MIN) / 60,
    horas_huecos: (huecos * SLOT_MIN) / 60,
    por_dia,
  };
}

// Helpers para el editor de tramos
export function tramoHoras(t: Tramo): number {
  const start = toSlot(t.inicio);
  const end = endSlot(t.fin);
  return Math.max(0, (end - start) * SLOT_MIN) / 60;
}

export function totalHoras(tramos: Tramo[]): number {
  return tramos.reduce((sum, t) => sum + tramoHoras(t), 0);
}

export function inferTipo(tramos: Tramo[]): "continuada" | "partida" | "descanso" {
  if (tramos.length === 0) return "descanso";
  if (tramos.length === 1) return "continuada";
  return "partida";
}

export function tramosOverlap(a: Tramo, b: Tramo): boolean {
  return toSlot(a.inicio) < endSlot(b.fin) && toSlot(b.inicio) < endSlot(a.fin);
}

export function validateTramos(tramos: Tramo[]): string | null {
  for (const t of tramos) {
    if (!t.inicio || !t.fin) return "Falta hora de inicio o fin";
    const start = toSlot(t.inicio);
    const end = endSlot(t.fin);
    if (end <= start) return `Tramo inválido: ${t.inicio} – ${t.fin}`;
  }
  for (let i = 0; i < tramos.length; i++) {
    for (let j = i + 1; j < tramos.length; j++) {
      if (tramosOverlap(tramos[i], tramos[j])) return "Los tramos no pueden solaparse";
    }
  }
  return null;
}
