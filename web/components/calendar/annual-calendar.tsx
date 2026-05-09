"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  Lock,
  LockOpen,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  X,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  startOfISOWeek,
  endOfISOWeek,
  addWeeks,
  addDays,
  format,
  getISOWeek,
  getMonth,
} from "date-fns";
import { es } from "date-fns/locale";

export interface Run {
  id: string;
  estado: string;
  semana: number | null;
  anio: number | null;
  coverage: number;
  created_at: string;
}

interface WeekData {
  weekNum: number;
  dateRange: string;
  run: Run | null;
}

interface MonthData {
  month: number;
  name: string;
  weeks: WeekData[];
  cerrado: boolean;
}

interface Props {
  year: number;
  runs: Run[];
  closedMonths: number[];
}

// ─── helpers ────────────────────────────────────────────────────────────────

function buildCalendar(year: number, runs: Run[], closedMonths: number[]): MonthData[] {
  const MONTHS = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
  ];
  const closed = new Set(closedMonths);

  const months: MonthData[] = MONTHS.map((name, i) => ({
    month: i + 1,
    name,
    weeks: [],
    cerrado: closed.has(i + 1),
  }));

  const runByWeek = new Map<number, Run>();
  for (const r of runs) {
    if (r.semana != null && r.anio === year) runByWeek.set(r.semana, r);
  }

  let weekStart = startOfISOWeek(new Date(year, 0, 4));
  for (let i = 0; i < 54; i++) {
    const thursday = addDays(weekStart, 3);
    if (thursday.getFullYear() > year) break;
    if (thursday.getFullYear() < year) { weekStart = addWeeks(weekStart, 1); continue; }

    const monthIdx = getMonth(thursday);
    const weekNum = getISOWeek(weekStart);
    const weekEnd = endOfISOWeek(weekStart);

    months[monthIdx].weeks.push({
      weekNum,
      dateRange: `${format(weekStart, "d MMM", { locale: es })} – ${format(weekEnd, "d MMM", { locale: es })}`,
      run: runByWeek.get(weekNum) ?? null,
    });

    weekStart = addWeeks(weekStart, 1);
  }

  return months;
}

function estadoColor(estado: string) {
  return {
    OPTIMAL:    "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    FEASIBLE:   "bg-amber-500/20  text-amber-300  border-amber-500/40",
    INFEASIBLE: "bg-red-500/20    text-red-300    border-red-500/40",
  }[estado] ?? "bg-slate-700 text-slate-400 border-slate-600";
}

function estadoIcon(estado: string) {
  if (estado === "OPTIMAL")    return <CheckCircle2 className="h-3 w-3" />;
  if (estado === "FEASIBLE")   return <AlertTriangle className="h-3 w-3" />;
  if (estado === "INFEASIBLE") return <XCircle className="h-3 w-3" />;
  return null;
}

// ─── Draggable run chip ──────────────────────────────────────────────────────

function RunChip({
  run,
  compact = false,
  onUnassign,
}: {
  run: Run;
  compact?: boolean;
  onUnassign?: () => void;
}) {
  const color = estadoColor(run.estado);
  const date = new Date(run.created_at).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border text-xs font-medium select-none",
        color,
        compact ? "px-2 py-1" : "px-2.5 py-1.5"
      )}
    >
      <GripVertical className="h-3 w-3 opacity-40 shrink-0" />
      {estadoIcon(run.estado)}
      <span className="shrink-0">{run.coverage}%</span>
      <span className="text-current/60 shrink-0">{date}</span>
      {!compact && (
        <Link
          href={`/dashboard/schedule/${run.id}`}
          onClick={(e) => e.stopPropagation()}
          className="opacity-40 hover:opacity-80 transition-opacity ml-0.5"
        >
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
      {onUnassign && (
        <button
          onClick={(e) => { e.stopPropagation(); onUnassign(); }}
          className="opacity-40 hover:opacity-100 hover:text-red-400 transition ml-0.5"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function DraggableRunChip({
  run,
  compact,
  onUnassign,
}: {
  run: Run;
  compact?: boolean;
  onUnassign?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: run.id,
    data: { run },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn("cursor-grab active:cursor-grabbing touch-none", isDragging && "opacity-30")}
    >
      <RunChip run={run} compact={compact} onUnassign={isDragging ? undefined : onUnassign} />
    </div>
  );
}

// ─── Droppable week row ──────────────────────────────────────────────────────

function WeekRow({
  week,
  cerrado,
  onUnassign,
}: {
  week: WeekData;
  cerrado: boolean;
  onUnassign: (runId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `week-${week.weekNum}`,
    data: { weekNum: week.weekNum },
    disabled: cerrado,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-150 min-h-[40px]",
        cerrado
          ? "border-slate-800/50 bg-slate-900/20 opacity-50"
          : isOver && !week.run
          ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
          : isOver && week.run
          ? "border-amber-500 bg-amber-500/10"
          : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
      )}
    >
      <span className="text-slate-600 text-xs font-mono w-7 shrink-0">S{week.weekNum}</span>
      <span className="text-slate-600 text-xs w-28 shrink-0 hidden sm:block">{week.dateRange}</span>
      <div className="flex-1 flex items-center">
        {week.run ? (
          <DraggableRunChip
            run={week.run}
            compact
            onUnassign={() => onUnassign(week.run!.id)}
          />
        ) : !cerrado ? (
          <span className="text-slate-700 text-xs italic">Arrastra un cuadrante aquí</span>
        ) : null}
      </div>
    </div>
  );
}

// ─── Month card ──────────────────────────────────────────────────────────────

function MonthCard({
  month,
  onUnassign,
  onToggleLock,
}: {
  month: MonthData;
  onUnassign: (runId: string) => void;
  onToggleLock: (m: number, lock: boolean) => void;
}) {
  const assigned = month.weeks.filter((w) => w.run).length;
  const total = month.weeks.length;
  const allDone = assigned === total && total > 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-2 transition-all",
        month.cerrado
          ? "border-slate-700/50 bg-slate-900/30"
          : "border-slate-800 bg-slate-900/80"
      )}
    >
      {/* month header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">{month.name}</h3>
          <span className="text-xs text-slate-500">
            {assigned}/{total}
          </span>
          {allDone && !month.cerrado && (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
              Listo
            </span>
          )}
        </div>
        <button
          onClick={() => onToggleLock(month.month, !month.cerrado)}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-all",
            month.cerrado
              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
              : "border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300"
          )}
        >
          {month.cerrado ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
          {month.cerrado ? "Cerrado" : "Cerrar"}
        </button>
      </div>

      {/* progress bar */}
      <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            month.cerrado ? "bg-emerald-500" : "bg-indigo-500"
          )}
          style={{ width: total > 0 ? `${(assigned / total) * 100}%` : "0%" }}
        />
      </div>

      {/* week rows */}
      <div className="space-y-1.5">
        {month.weeks.map((week) => (
          <WeekRow
            key={week.weekNum}
            week={week}
            cerrado={month.cerrado}
            onUnassign={onUnassign}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AnnualCalendar({ year: initialYear, runs: initialRuns, closedMonths: initialClosed }: Props) {
  const [year, setYear] = useState(initialYear);
  const [runs, setRuns] = useState<Run[]>(initialRuns);
  const [closedMonths, setClosedMonths] = useState<number[]>(initialClosed);
  const [activeRun, setActiveRun] = useState<Run | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const months = buildCalendar(year, runs, closedMonths);

  const unassigned = runs.filter((r) => r.semana == null || r.anio !== year);

  const assignRun = useCallback(async (runId: string, semana: number | null, anio: number | null) => {
    setRuns((prev) =>
      prev.map((r) => r.id === runId ? { ...r, semana, anio } : r)
    );
    const res = await fetch("/api/calendar/assign", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId, semana, anio }),
    });
    if (!res.ok) {
      toast.error("Error al asignar el cuadrante");
      setRuns((prev) => prev); // keep current - server will correct on reload
    }
  }, []);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const run = (e.active.data.current as { run: Run })?.run;
    if (run) setActiveRun(run);
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveRun(null);
      const run = (e.active.data.current as { run: Run })?.run;
      if (!run) return;

      const over = e.over;
      if (!over) return;

      const weekNum = (over.data.current as { weekNum?: number })?.weekNum;
      if (weekNum == null) return;

      // If the target week already has a run, swap
      const existingRun = months
        .flatMap((m) => m.weeks)
        .find((w) => w.weekNum === weekNum)?.run;

      if (existingRun && existingRun.id !== run.id) {
        // Move existing run to unassigned, place dragged run here
        assignRun(existingRun.id, null, null);
      }

      assignRun(run.id, weekNum, year);
      toast.success(`Semana ${weekNum} asignada`);
    },
    [months, year, assignRun]
  );

  const handleUnassign = useCallback(
    (runId: string) => {
      assignRun(runId, null, null);
      toast.success("Cuadrante desasignado");
    },
    [assignRun]
  );

  const handleToggleLock = useCallback(
    async (mes: number, cerrado: boolean) => {
      setClosedMonths((prev) =>
        cerrado ? [...prev, mes] : prev.filter((m) => m !== mes)
      );
      const res = await fetch("/api/calendar/close-month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anio: year, mes, cerrado }),
      });
      if (!res.ok) {
        toast.error("Error al cambiar el estado del mes");
        setClosedMonths((prev) =>
          cerrado ? prev.filter((m) => m !== mes) : [...prev, mes]
        );
      } else {
        toast.success(cerrado ? "Mes cerrado" : "Mes abierto");
      }
    },
    [year]
  );

  // Stats
  const totalWeeks = months.reduce((s, m) => s + m.weeks.length, 0);
  const assignedWeeks = months.reduce((s, m) => s + m.weeks.filter((w) => w.run).length, 0);
  const closedCount = closedMonths.length;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Year selector */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-2xl font-bold text-white w-16 text-center">{year}</span>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-slate-400">
              <CalendarDays className="h-4 w-4 text-indigo-400" />
              <span>
                <span className="text-white font-semibold">{assignedWeeks}</span>/{totalWeeks} semanas
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Lock className="h-4 w-4 text-emerald-400" />
              <span>
                <span className="text-white font-semibold">{closedCount}</span>/12 meses cerrados
              </span>
            </div>
            <div className="h-2 w-24 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                style={{ width: totalWeeks > 0 ? `${(assignedWeeks / totalWeeks) * 100}%` : "0%" }}
              />
            </div>
          </div>
        </div>

        {/* Unassigned runs pool */}
        {unassigned.length > 0 && (
          <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/40">
            <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wider">
              Cuadrantes sin asignar — arrastra a una semana
            </p>
            <div className="flex flex-wrap gap-2">
              {unassigned.map((run) => (
                <DraggableRunChip key={run.id} run={run} />
              ))}
            </div>
          </div>
        )}

        {unassigned.length === 0 && assignedWeeks === 0 && (
          <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center">
            <CalendarDays className="h-8 w-8 text-slate-700 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">
              Genera cuadrantes desde{" "}
              <Link href="/dashboard/schedule" className="text-indigo-400 hover:text-indigo-300">
                la página de cuadrantes
              </Link>{" "}
              y asígnalos aquí.
            </p>
          </div>
        )}

        {/* Month grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {months.map((month) => (
            <MonthCard
              key={month.month}
              month={month}
              onUnassign={handleUnassign}
              onToggleLock={handleToggleLock}
            />
          ))}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeRun && (
          <div className="rotate-2 scale-105 opacity-90">
            <RunChip run={activeRun} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
