"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2, AlertCircle, Clock, Coffee, Pencil, Lock, LockOpen,
  Loader2, Edit3, Sparkles, Plus, Check, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  computeCoverage,
  type AssignmentRow,
  type NeedRow,
  type Tramo,
  totalHoras,
  inferTipo,
} from "@/lib/schedule-coverage";
import ShiftEditDialog from "./shift-edit-dialog";

const DIAS = ["LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO","DOMINGO"] as const;
const DIA_LABELS: Record<string, string> = {
  LUNES: "Lun", MARTES: "Mar", MIERCOLES: "Mié",
  JUEVES: "Jue", VIERNES: "Vie", SABADO: "Sáb", DOMINGO: "Dom",
};

export interface WorkerForEditor {
  id: string;
  nombre: string;
  rol: string;
  contrato_str: string;
}

export interface AssignmentForEditor {
  worker_id: string;
  dia: string;
  tramos: Tramo[];
  tipo: string;
  horas: number;
}

interface Props {
  runId: string;
  initialNombre: string | null;
  workers: WorkerForEditor[];
  initialAssignments: AssignmentForEditor[];
  needs: NeedRow[];
}

export default function ScheduleEditor({
  runId, initialNombre, workers, initialAssignments, needs,
}: Props) {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentForEditor[]>(initialAssignments);
  const [editing, setEditing] = useState<{ workerId: string; dia: string } | null>(null);
  const [, startTransition] = useTransition();

  // Live coverage stats — recalculated on every assignment change
  const stats = useMemo(() => {
    const rows: AssignmentRow[] = assignments.map((a) => ({
      worker_id: a.worker_id,
      dia: a.dia,
      tramos: a.tramos,
    }));
    return computeCoverage(needs, rows);
  }, [assignments, needs]);

  // Quick lookup: assignment[(workerId, dia)]
  const lookup = useMemo(() => {
    const m = new Map<string, AssignmentForEditor>();
    for (const a of assignments) m.set(`${a.worker_id}|${a.dia}`, a);
    return m;
  }, [assignments]);

  const editingAssignment =
    editing ? lookup.get(`${editing.workerId}|${editing.dia}`) : undefined;
  const editingWorker =
    editing ? workers.find((w) => w.id === editing.workerId) : undefined;

  const handleSaveTramos = async (tramos: Tramo[]) => {
    if (!editing) return;
    const { workerId, dia } = editing;

    const res = await fetch(`/api/schedule/${runId}/assignments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId, dia, tramos }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Error al guardar");
    }
    const data = await res.json();

    // Optimistic + server-confirmed update
    setAssignments((prev) => {
      const others = prev.filter((a) => !(a.worker_id === workerId && a.dia === dia));
      return [
        ...others,
        {
          worker_id: workerId,
          dia,
          tramos: data.assignment.tramos,
          tipo: data.assignment.tipo,
          horas: data.assignment.horas,
        },
      ];
    });

    toast.success("Turno guardado");
    startTransition(() => router.refresh());
  };

  const initialStats = useMemo(() => computeCoverage(needs, initialAssignments.map((a) => ({
    worker_id: a.worker_id, dia: a.dia, tramos: a.tramos,
  }))), [needs, initialAssignments]);
  const huecosDelta = stats.huecos - initialStats.huecos;

  // Worker totals (live)
  const workerTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of assignments) {
      m.set(a.worker_id, (m.get(a.worker_id) ?? 0) + (a.horas ?? totalHoras(a.tramos)));
    }
    return m;
  }, [assignments]);

  return (
    <>
      {/* Edit mode toggle bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <NameEditor runId={runId} initialNombre={initialNombre} />
        <div className="flex items-center gap-2">
          <Button
            variant={editMode ? "default" : "outline"}
            onClick={() => setEditMode(!editMode)}
            className={cn(
              "gap-2",
              editMode
                ? "bg-indigo-600 hover:bg-indigo-500 border-indigo-500"
                : "border-slate-700 text-slate-300 hover:bg-slate-800"
            )}
          >
            {editMode ? <Edit3 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {editMode ? "Modo edición" : "Solo lectura"}
          </Button>
        </div>
      </div>

      {/* Live stats banner */}
      <LiveStats stats={stats} initialStats={initialStats} delta={huecosDelta} editMode={editMode} />

      {/* Schedule grid */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        {/* Desktop view */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900">
                <th className="text-left px-4 py-3 text-slate-400 font-medium sticky left-0 bg-slate-900 z-10 min-w-[200px]">
                  Trabajador
                </th>
                {DIAS.map((d) => (
                  <th key={d} className="text-center px-2 py-3 text-slate-400 font-medium min-w-[110px]">
                    {DIA_LABELS[d]}
                  </th>
                ))}
                <th className="text-right px-4 py-3 text-slate-400 font-medium min-w-[80px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {workers.map((w) => {
                const total = workerTotals.get(w.id) ?? 0;
                return (
                  <tr key={w.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-2 sticky left-0 bg-slate-900/60 z-10">
                      <div>
                        <p className="text-white font-medium text-sm">{w.nombre}</p>
                        <p className="text-slate-500 text-xs">{w.contrato_str}</p>
                      </div>
                    </td>
                    {DIAS.map((d) => {
                      const a = lookup.get(`${w.id}|${d}`);
                      return (
                        <td key={d} className="px-1 py-1 align-middle">
                          <ShiftCell
                            assignment={a}
                            editMode={editMode}
                            onEdit={() => editMode && setEditing({ workerId: w.id, dia: d })}
                          />
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-right">
                      <span className="text-white font-semibold text-sm">{total.toFixed(1)}h</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile view */}
        <div className="md:hidden divide-y divide-slate-800/60">
          {workers.map((w) => (
            <div key={w.id} className="p-4">
              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <p className="text-white font-semibold text-sm">{w.nombre}</p>
                  <p className="text-slate-500 text-xs">{w.contrato_str}</p>
                </div>
                <span className="text-white text-sm">{(workerTotals.get(w.id) ?? 0).toFixed(1)}h</span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {DIAS.map((d) => {
                  const a = lookup.get(`${w.id}|${d}`);
                  return (
                    <button
                      key={d}
                      onClick={() => editMode && setEditing({ workerId: w.id, dia: d })}
                      disabled={!editMode}
                      className={cn(
                        "rounded-md p-1.5 text-[10px] border transition-colors",
                        a && a.tramos.length > 0
                          ? "bg-indigo-600/20 border-indigo-500/30 text-indigo-300"
                          : "bg-slate-800/50 border-slate-800 text-slate-600",
                        editMode && "cursor-pointer hover:border-indigo-500"
                      )}
                    >
                      <div className="text-slate-500 text-[9px] uppercase mb-0.5">{DIA_LABELS[d]}</div>
                      {a && a.tramos.length > 0 ? (
                        <div className="font-mono font-medium">{a.horas.toFixed(0)}h</div>
                      ) : (
                        <Coffee className="h-3 w-3 mx-auto opacity-50" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit dialog */}
      {editing && editingWorker && (
        <ShiftEditDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          workerId={editing.workerId}
          workerName={editingWorker.nombre}
          dia={editing.dia}
          initialTramos={editingAssignment?.tramos ?? []}
          onSave={handleSaveTramos}
        />
      )}
    </>
  );
}

// ─── Cell ───────────────────────────────────────────────────────────────────

function ShiftCell({
  assignment, editMode, onEdit,
}: {
  assignment?: AssignmentForEditor;
  editMode: boolean;
  onEdit: () => void;
}) {
  const isEmpty = !assignment || assignment.tramos.length === 0;
  const tipo = assignment ? inferTipo(assignment.tramos) : "descanso";

  if (isEmpty) {
    return (
      <button
        onClick={editMode ? onEdit : undefined}
        disabled={!editMode}
        className={cn(
          "w-full h-14 rounded-lg flex items-center justify-center transition-colors",
          editMode
            ? "border border-dashed border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/5 cursor-pointer"
            : "border border-transparent"
        )}
      >
        {editMode ? (
          <Plus className="h-3.5 w-3.5 text-slate-600" />
        ) : (
          <Coffee className="h-3.5 w-3.5 text-slate-700" />
        )}
      </button>
    );
  }

  const color =
    tipo === "continuada"
      ? "bg-indigo-600/20 border-indigo-500/30 text-indigo-300"
      : "bg-amber-500/20 border-amber-500/30 text-amber-300";

  return (
    <button
      onClick={editMode ? onEdit : undefined}
      disabled={!editMode}
      className={cn(
        "w-full rounded-lg border px-2 py-1.5 transition-all",
        color,
        editMode && "cursor-pointer hover:scale-[1.02] hover:ring-1 hover:ring-indigo-500/60"
      )}
    >
      <div className="flex flex-col gap-0.5 items-center text-[11px] font-mono leading-tight">
        {assignment.tramos.map((t, i) => (
          <span key={i}>{t.inicio}–{t.fin}</span>
        ))}
        <span className="text-[10px] opacity-70 font-sans mt-0.5">
          {assignment.horas.toFixed(1)}h{tipo === "partida" && " · partida"}
        </span>
      </div>
    </button>
  );
}

// ─── Live stats ─────────────────────────────────────────────────────────────

function LiveStats({
  stats, initialStats, delta, editMode,
}: {
  stats: ReturnType<typeof computeCoverage>;
  initialStats: ReturnType<typeof computeCoverage>;
  delta: number;
  editMode: boolean;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        label="Cobertura"
        value={`${stats.cobertura_pct}%`}
        delta={editMode && stats.cobertura_pct !== initialStats.cobertura_pct
          ? `${stats.cobertura_pct > initialStats.cobertura_pct ? "+" : ""}${stats.cobertura_pct - initialStats.cobertura_pct}%`
          : undefined}
        deltaPositive={stats.cobertura_pct >= initialStats.cobertura_pct}
      />
      <StatCard
        icon={<AlertCircle className={cn("h-4 w-4", stats.huecos === 0 ? "text-emerald-400" : "text-red-400")} />}
        label="Slots sin cubrir"
        value={String(stats.huecos)}
        sublabel={`${stats.horas_huecos.toFixed(1)}h`}
        delta={editMode && delta !== 0 ? `${delta > 0 ? "+" : ""}${delta}` : undefined}
        deltaPositive={delta <= 0}
      />
      <StatCard
        icon={<Clock className="h-4 w-4 text-indigo-400" />}
        label="Horas asignadas"
        value={`${stats.horas_asignadas.toFixed(1)}h`}
        sublabel={`/ ${stats.horas_demanda.toFixed(1)}h demanda`}
      />
      <StatCard
        icon={<Sparkles className="h-4 w-4 text-violet-400" />}
        label="Estado"
        value={
          stats.huecos === 0
            ? "Cubierto"
            : stats.huecos < 5
            ? "Casi listo"
            : "Con huecos"
        }
        sublabel={editMode ? "Edición activa" : "Solo lectura"}
      />
    </div>
  );
}

function StatCard({
  icon, label, value, sublabel, delta, deltaPositive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  delta?: string;
  deltaPositive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-500 text-xs uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        {delta && (
          <span
            className={cn(
              "text-xs font-semibold px-1.5 py-0.5 rounded-full",
              deltaPositive
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            )}
          >
            {delta}
          </span>
        )}
      </div>
      {sublabel && <p className="text-slate-500 text-xs mt-1">{sublabel}</p>}
    </div>
  );
}

// ─── Name editor ─────────────────────────────────────────────────────────────

function NameEditor({ runId, initialNombre }: { runId: string; initialNombre: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNombre ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(initialNombre ?? "");
  }, [initialNombre]);

  const placeholder = "Cuadrante sin nombre";

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/schedule/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: value.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error");
      }
      toast.success("Nombre guardado");
      setEditing(false);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="bg-slate-900 border-slate-700 text-white h-9 w-64 max-w-full"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") { setValue(initialNombre ?? ""); setEditing(false); }
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
          title="Guardar"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => { setValue(initialNombre ?? ""); setEditing(false); }}
          disabled={saving}
          className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
          title="Cancelar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-2 text-left"
      title="Renombrar cuadrante"
    >
      <span className={cn(
        "text-xl font-semibold",
        initialNombre ? "text-white" : "text-slate-500 italic"
      )}>
        {initialNombre || placeholder}
      </span>
      <Pencil className="h-3.5 w-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
    </button>
  );
}
