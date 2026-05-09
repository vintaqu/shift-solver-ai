export type UserRole = "owner" | "manager" | "viewer";

export interface Restaurant {
  id: string;
  nombre: string;
  created_at: string;
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  restaurant_id: string | null;
  role: UserRole;
  created_at: string;
}

export interface Contract {
  id: string;
  worker_id: string;
  tipo: "fijo" | "horquilla";
  horas: number | null;
  min_horas: number | null;
  max_horas: number | null;
}

export interface WorkerRestrictions {
  dias_libres: string[];
  no_antes_de: { hora: string; dias: string | string[] }[];
  no_despues_de: { hora: string; dias: string | string[] }[];
  trabajar_obligatorio: { dia: string; desde: string; hasta: string }[];
  texto_pdf?: string;
}

export interface Worker {
  id: string;
  restaurant_id: string;
  nombre: string;
  rol: WorkerRol;
  created_at: string;
  contract?: Contract;
  etiquetas?: string[];
  restricciones?: WorkerRestrictions;
}

export type WorkerRol =
  | "CAMARERO_BASICO"
  | "SEMI_ENCARGADO"
  | "ENCARGADO"
  | "DUENO";

export const ROL_LABELS: Record<WorkerRol, string> = {
  CAMARERO_BASICO: "Camarero básico",
  SEMI_ENCARGADO: "Semi-encargado",
  ENCARGADO: "Encargado",
  DUENO: "Dueño",
};

export const ROL_JERARQUIA: WorkerRol[] = [
  "CAMARERO_BASICO",
  "SEMI_ENCARGADO",
  "ENCARGADO",
  "DUENO",
];

export const DIAS = [
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
  "DOMINGO",
] as const;

export const DIA_LABELS: Record<string, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
  SABADO: "Sábado",
  DOMINGO: "Domingo",
};

export const ETIQUETAS_DISPONIBLES = [
  "PASTAS",
  "APERTURA",
  "CAJERA",
  "BARISTA",
  "BANDEJERA",
  "PLANCHISTA",
  "COMANDERA",
  "BARRA",
  "DELIVERY",
  "CIERRE",
  "CONTABLE",
] as const;

export interface ShiftNeed {
  id: string;
  restaurant_id: string;
  dia: string;
  inicio: string;
  fin: string;
  personas: number;
  personas_por_rol: Record<string, number>;
  etiquetas: string[];
}

export interface ScheduleRun {
  id: string;
  restaurant_id: string;
  created_at: string;
  estado: "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "MODEL_INVALID" | "UNKNOWN";
  tiempo_calculo_seg: number;
  seed_usado: number | null;
  slots_persona_demanda: number;
  slots_persona_asignados: number;
  slots_persona_huecos: number;
  horas_persona_demanda: number;
  horas_persona_asignadas: number;
  horas_persona_huecos: number;
  metricas: {
    total_continuadas: number;
    total_partidas: number;
    dispersion_partidas: number;
    partidas_por_trabajador: Record<string, number>;
  } | null;
  huecos_cobertura: HuecoCobertura[];
  huecos_etiqueta: unknown[];
}

export interface HuecoCobertura {
  dia: string;
  inicio: string;
  fin: string;
  demanda_total: number;
  cubierto: number;
  falta_personas: number;
  falta_por_nivel: Record<string, number>;
}

export interface ScheduleAssignment {
  id: string;
  run_id: string;
  worker_id: string;
  worker_nombre?: string;
  worker_rol?: WorkerRol;
  dia: string;
  tipo: "descanso" | "continuada" | "partida";
  tramos: { inicio: string; fin: string; duracion_horas: number }[];
  horas: number;
  requiere_pausa_20min: boolean;
}
