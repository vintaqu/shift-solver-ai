"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import WorkerForm from "./worker-form";
import { Loader2 } from "lucide-react";

type FormDefaults = {
  nombre: string;
  rol: "CAMARERO_BASICO" | "SEMI_ENCARGADO" | "ENCARGADO" | "DUENO";
  contrato_tipo: "fijo" | "horquilla";
  horas?: number;
  min_horas?: number;
  max_horas?: number;
  etiquetas: string[];
  dias_libres: string[];
  no_antes_hora?: string;
  no_despues_hora?: string;
  no_despues_dias: string[];
  trabajar_obligatorio_dia?: string;
  trabajar_obligatorio_desde?: string;
  trabajar_obligatorio_hasta?: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workerId?: string;
  workerName?: string;
}

function parseDefaults(w: Record<string, unknown>): FormDefaults {
  const r = ((w.restricciones ?? {}) as Record<string, unknown>);
  return {
    nombre: w.nombre as string,
    rol: w.rol as FormDefaults["rol"],
    contrato_tipo: (w.tipo ?? w.contrato_tipo) as FormDefaults["contrato_tipo"],
    horas: (w.horas as number) ?? undefined,
    min_horas: (w.min_horas as number) ?? undefined,
    max_horas: (w.max_horas as number) ?? undefined,
    etiquetas: (w.etiquetas as string[]) ?? [],
    dias_libres: (r.dias_libres as string[]) ?? [],
    no_antes_hora: (r.no_antes_de as { hora: string }[])?.[0]?.hora ?? undefined,
    no_despues_hora: (r.no_despues_de as { hora: string }[])?.[0]?.hora ?? undefined,
    no_despues_dias:
      typeof (r.no_despues_de as { dias: unknown }[])?.[0]?.dias === "string"
        ? []
        : ((r.no_despues_de as { dias: string[] }[])?.[0]?.dias ?? []),
    trabajar_obligatorio_dia:
      (r.trabajar_obligatorio as { dia: string }[])?.[0]?.dia ?? undefined,
    trabajar_obligatorio_desde:
      (r.trabajar_obligatorio as { desde: string }[])?.[0]?.desde ?? undefined,
    trabajar_obligatorio_hasta:
      (r.trabajar_obligatorio as { hasta: string }[])?.[0]?.hasta ?? undefined,
  };
}

export default function WorkerSheet({ open, onClose, onSuccess, workerId, workerName }: Props) {
  const [defaults, setDefaults] = useState<FormDefaults | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setDefaults(undefined); return; }
    if (!workerId) return;

    setLoading(true);
    fetch(`/api/workers/${workerId}`)
      .then((r) => r.json())
      .then((w) => setDefaults(parseDefaults(w as Record<string, unknown>)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, workerId]);

  const handleSuccess = () => {
    onClose();
    onSuccess();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[580px] sm:max-w-none bg-[#0d1117] border-slate-800 p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-slate-800 shrink-0">
          <SheetTitle className="text-white text-lg">
            {workerId ? `Editar trabajador` : "Nuevo trabajador"}
          </SheetTitle>
          <SheetDescription className="text-slate-500 text-sm">
            {workerId
              ? `Modifica los datos de ${workerName ?? "este empleado"}`
              : "Añade un nuevo empleado a tu plantilla"}
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            </div>
          ) : (
            <WorkerForm
              workerId={workerId}
              defaultValues={defaults}
              onSuccess={handleSuccess}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
