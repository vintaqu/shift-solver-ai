"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function WorkerDeleteButton({
  workerId,
  workerName,
}: {
  workerId: string;
  workerName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workers/${workerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      toast.success(`${workerName} eliminado`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("No se pudo eliminar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="border-slate-700 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Eliminar trabajador</DialogTitle>
          </DialogHeader>
          <p className="text-slate-400 text-sm">
            ¿Seguro que quieres eliminar a{" "}
            <span className="text-white font-medium">{workerName}</span>? Esta acción no se puede deshacer.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-slate-700 text-slate-300" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
