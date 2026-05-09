"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ROL_LABELS, type WorkerRol } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import WorkerSheet from "./worker-sheet";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export interface WorkerRow {
  id: string;
  nombre: string;
  rol: WorkerRol;
  tipo: "fijo" | "horquilla";
  horas: number | null;
  min_horas: number | null;
  max_horas: number | null;
  etiquetas: string[];
}

const ROL_STYLE: Record<WorkerRol, { dot: string; text: string }> = {
  DUENO:           { dot: "bg-purple-500",  text: "text-purple-400" },
  ENCARGADO:       { dot: "bg-blue-500",    text: "text-blue-400" },
  SEMI_ENCARGADO:  { dot: "bg-cyan-500",    text: "text-cyan-400" },
  CAMARERO_BASICO: { dot: "bg-slate-500",   text: "text-slate-400" },
};

const ROL_RANK: Record<WorkerRol, number> = {
  DUENO: 0, ENCARGADO: 1, SEMI_ENCARGADO: 2, CAMARERO_BASICO: 3,
};

function contratoLabel(w: WorkerRow) {
  if (w.tipo === "fijo") return `${w.horas}h/sem`;
  return `${w.min_horas}–${w.max_horas}h/sem`;
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ").slice(0, 2);
  const letters = parts.map((p) => p[0]).join("").toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
      <span className="text-xs font-bold text-indigo-300">{letters}</span>
    </div>
  );
}

type SortKey = "nombre" | "rol" | "contrato";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3.5 w-3.5 text-slate-600" />;
  return dir === "asc"
    ? <ChevronUp className="h-3.5 w-3.5 text-indigo-400" />
    : <ChevronDown className="h-3.5 w-3.5 text-indigo-400" />;
}

export default function WorkersTable({ workers: initial }: { workers: WorkerRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("nombre");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [editName, setEditName] = useState<string | undefined>(undefined);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<WorkerRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    let list = initial.filter((w) => {
      const matchSearch = w.nombre.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === "all" || w.rol === roleFilter;
      return matchSearch && matchRole;
    });
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "nombre") cmp = a.nombre.localeCompare(b.nombre);
      else if (sortKey === "rol") cmp = ROL_RANK[a.rol] - ROL_RANK[b.rol];
      else if (sortKey === "contrato") {
        const aH = a.tipo === "fijo" ? (a.horas ?? 0) : (a.min_horas ?? 0);
        const bH = b.tipo === "fijo" ? (b.horas ?? 0) : (b.min_horas ?? 0);
        cmp = aH - bH;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [initial, search, roleFilter, sortKey, sortDir]);

  const openNew = () => {
    setEditId(undefined);
    setEditName(undefined);
    setSheetOpen(true);
  };

  const openEdit = (w: WorkerRow) => {
    setEditId(w.id);
    setEditName(w.nombre);
    setSheetOpen(true);
  };

  const handleSheetSuccess = () => {
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workers/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      toast.success(`${deleteTarget.nombre} eliminado`);
      router.refresh();
    } catch {
      toast.error("No se pudo eliminar el trabajador");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <p className="text-slate-400 text-sm">
          <span className="text-white font-semibold">{filtered.length}</span>
          {filtered.length !== initial.length && (
            <span className="text-slate-500"> de {initial.length}</span>
          )}{" "}
          empleados
        </p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
            <Input
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 w-full sm:w-56 h-9 text-sm"
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v ?? "all")}>
            <SelectTrigger className="bg-slate-900 border-slate-800 text-slate-300 h-9 text-sm w-full sm:w-44">
              <SelectValue placeholder="Filtrar rol" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800">
              <SelectItem value="all" className="text-slate-300 focus:bg-slate-800">Todos los roles</SelectItem>
              {(Object.entries(ROL_LABELS) as [WorkerRol, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-slate-300 focus:bg-slate-800">{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={openNew}
            className="bg-indigo-600 hover:bg-indigo-500 h-9 text-sm px-4 shrink-0"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Añadir
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {initial.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border border-dashed border-slate-800">
          <Users className="h-12 w-12 text-slate-700 mb-4" />
          <h2 className="text-white font-semibold text-lg">Sin trabajadores</h2>
          <p className="text-slate-500 text-sm mt-1 mb-6">Añade tu plantilla para empezar a generar cuadrantes.</p>
          <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-500">
            <Plus className="h-4 w-4 mr-2" /> Añadir primer trabajador
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-slate-800">
          <Search className="h-8 w-8 text-slate-700 mb-3" />
          <p className="text-slate-400">Sin resultados para &ldquo;{search}&rdquo;</p>
          <button onClick={() => { setSearch(""); setRoleFilter("all"); }} className="text-indigo-400 text-sm mt-2 hover:underline">
            Limpiar filtros
          </button>
        </div>
      ) : (
        /* Table */
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium w-10">#</th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort("nombre")}
                      className="flex items-center gap-1.5 text-slate-400 hover:text-white font-medium transition-colors"
                    >
                      Nombre
                      <SortIcon col="nombre" sortKey={sortKey} dir={sortDir} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort("rol")}
                      className="flex items-center gap-1.5 text-slate-400 hover:text-white font-medium transition-colors"
                    >
                      Rol
                      <SortIcon col="rol" sortKey={sortKey} dir={sortDir} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button
                      onClick={() => handleSort("contrato")}
                      className="flex items-center gap-1.5 text-slate-400 hover:text-white font-medium transition-colors"
                    >
                      Contrato
                      <SortIcon col="contrato" sortKey={sortKey} dir={sortDir} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium hidden lg:table-cell">
                    Habilidades
                  </th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((w, idx) => {
                  const style = ROL_STYLE[w.rol];
                  return (
                    <tr
                      key={w.id}
                      className="group hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Index */}
                      <td className="px-4 py-3 text-slate-600 text-xs">{idx + 1}</td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Initials name={w.nombre} />
                          <span className="font-semibold text-white">{w.nombre}</span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <div className={cn("flex items-center gap-2", style.text)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} />
                          {ROL_LABELS[w.rol]}
                        </div>
                      </td>

                      {/* Contract */}
                      <td className="px-4 py-3">
                        <span className="text-slate-300 font-mono text-xs bg-slate-800 px-2 py-1 rounded-md">
                          {contratoLabel(w)}
                        </span>
                      </td>

                      {/* Tags */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {w.etiquetas.length === 0 ? (
                            <span className="text-slate-700 text-xs">—</span>
                          ) : (
                            <>
                              {w.etiquetas.slice(0, 3).map((e) => (
                                <span
                                  key={e}
                                  className="text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full"
                                >
                                  {e}
                                </span>
                              ))}
                              {w.etiquetas.length > 3 && (
                                <span className="text-xs text-slate-500">
                                  +{w.etiquetas.length - 3}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(w)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(w)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="px-4 py-3 border-t border-slate-800/60 bg-slate-900/30 flex items-center justify-between">
            <p className="text-slate-600 text-xs">
              Mostrando {filtered.length} de {initial.length} trabajadores
            </p>
            {filtered.length < initial.length && (
              <button
                onClick={() => { setSearch(""); setRoleFilter("all"); }}
                className="text-indigo-400 text-xs hover:underline"
              >
                Ver todos
              </button>
            )}
          </div>
        </div>
      )}

      {/* Worker Sheet (create / edit) */}
      <WorkerSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSuccess={handleSheetSuccess}
        workerId={editId}
        workerName={editName}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Eliminar trabajador</DialogTitle>
            <DialogDescription className="text-slate-400">
              ¿Seguro que quieres eliminar a{" "}
              <span className="text-white font-semibold">{deleteTarget?.nombre}</span>?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-500 text-white"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
