"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Coffee, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Tramo,
  totalHoras,
  validateTramos,
  inferTipo,
} from "@/lib/schedule-coverage";

const DIA_LABELS: Record<string, string> = {
  LUNES: "Lunes", MARTES: "Martes", MIERCOLES: "Miércoles",
  JUEVES: "Jueves", VIERNES: "Viernes", SABADO: "Sábado", DOMINGO: "Domingo",
};

interface Props {
  open: boolean;
  onClose: () => void;
  workerName: string;
  workerId: string;
  dia: string;
  initialTramos: Tramo[];
  onSave: (tramos: Tramo[]) => Promise<void>;
}

export default function ShiftEditDialog({
  open, onClose, workerName, workerId, dia, initialTramos, onSave,
}: Props) {
  const [tramos, setTramos] = useState<Tramo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTramos(initialTramos.map((t) => ({ inicio: t.inicio, fin: t.fin })));
      setError(null);
    }
  }, [open, initialTramos]);

  const updateTramo = (i: number, field: "inicio" | "fin", value: string) => {
    setTramos((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
    setError(null);
  };

  const removeTramo = (i: number) => {
    setTramos((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addTramo = () => {
    const last = tramos[tramos.length - 1];
    setTramos((prev) => [
      ...prev,
      { inicio: last ? last.fin : "10:00", fin: last ? "23:00" : "18:00" },
    ]);
  };

  const setDescanso = () => {
    setTramos([]);
  };

  const handleSave = async () => {
    const err = validateTramos(tramos);
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(tramos);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const tipo = inferTipo(tramos);
  const horas = totalHoras(tramos);
  const requierePausa = tipo === "continuada" && horas > 5;

  // workerId is part of the dialog identity but not used directly here
  void workerId;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            {workerName}
            <span className="text-slate-500 font-normal">·</span>
            <span className="text-slate-400 font-normal">{DIA_LABELS[dia] ?? dia}</span>
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Edita los tramos horarios de este turno. Mín. 30 min por tramo.
          </DialogDescription>
        </DialogHeader>

        {/* Tipo selector */}
        <div className="grid grid-cols-3 gap-2 mb-1">
          <TypeButton
            active={tipo === "continuada"}
            onClick={() => {
              if (tramos.length === 0) setTramos([{ inicio: "10:00", fin: "18:00" }]);
              else if (tramos.length > 1) setTramos([tramos[0]]);
            }}
            label="Continuada"
          />
          <TypeButton
            active={tipo === "partida"}
            onClick={() => {
              if (tramos.length === 0) setTramos([{ inicio: "10:00", fin: "14:00" }, { inicio: "19:00", fin: "23:00" }]);
              else if (tramos.length === 1) setTramos([tramos[0], { inicio: tramos[0].fin, fin: "23:00" }]);
            }}
            label="Partida"
          />
          <TypeButton
            active={tipo === "descanso"}
            onClick={setDescanso}
            label="Descanso"
            icon={<Coffee className="h-3 w-3" />}
          />
        </div>

        {/* Tramos editor */}
        {tramos.length === 0 ? (
          <div className="flex flex-col items-center py-8 px-4 rounded-lg border border-dashed border-slate-800 bg-slate-900/50">
            <Coffee className="h-8 w-8 text-slate-700 mb-2" />
            <p className="text-slate-500 text-sm">Día de descanso</p>
            <button
              onClick={() => setTramos([{ inicio: "10:00", fin: "18:00" }])}
              className="text-indigo-400 hover:text-indigo-300 text-xs mt-2"
            >
              Convertir en jornada de trabajo
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {tramos.map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg border border-slate-800 bg-slate-900/50"
              >
                <span className="text-slate-500 text-xs font-mono w-12 shrink-0">
                  Tramo {i + 1}
                </span>
                <Input
                  type="time"
                  value={t.inicio}
                  onChange={(e) => updateTramo(i, "inicio", e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white text-sm h-9 w-28"
                />
                <span className="text-slate-600">–</span>
                <Input
                  type="time"
                  value={t.fin}
                  onChange={(e) => updateTramo(i, "fin", e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white text-sm h-9 w-28"
                />
                <button
                  onClick={() => removeTramo(i)}
                  className="ml-auto p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                  title="Eliminar tramo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {tramos.length < 3 && (
              <button
                onClick={addTramo}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-slate-800 text-slate-500 hover:border-indigo-500/40 hover:text-indigo-400 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Añadir tramo
              </button>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="flex items-center justify-between text-xs px-1 mt-1">
          <span className="text-slate-400">
            Total: <span className="text-white font-semibold">{horas.toFixed(1)}h</span>
          </span>
          {requierePausa && (
            <span className="text-amber-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Requiere pausa de 20 min
            </span>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <DialogFooter className="gap-2 mt-2">
          <Button
            variant="outline"
            className="border-slate-700 text-slate-300"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TypeButton({
  active, onClick, label, icon,
}: {
  active: boolean; onClick: () => void; label: string; icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "py-1.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all",
        active
          ? "bg-indigo-600 border-indigo-500 text-white"
          : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
