"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2, AlertCircle, Layers } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VARIANT_OPTIONS = [1, 2, 3, 4, 5];

export default function ScheduleGeneratePanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeLimit, setTimeLimit] = useState(60);
  const [numVariants, setNumVariants] = useState(3);

  const handleGenerate = async () => {
    setLoading(true);
    setProgress(0);

    const totalSec = timeLimit * numVariants;
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 100 / totalSec, 92));
    }, 1000);

    try {
      const res = await fetch("/api/generate-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          time_limit: timeLimit,
          num_variants: numVariants,
        }),
      });

      clearInterval(interval);
      setProgress(100);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar");

      toast.success(
        numVariants === 1
          ? "Cuadrante generado"
          : `${data.numVariants} variantes generadas`
      );

      if (numVariants > 1 && data.groupId) {
        router.push(`/dashboard/schedule/group/${data.groupId}`);
      } else if (data.runIds?.[0]) {
        router.push(`/dashboard/schedule/${data.runIds[0]}`);
      }
      router.refresh();
    } catch (e) {
      clearInterval(interval);
      setProgress(0);
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="text-white text-base flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-400" />
          Generar cuadrante semanal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Variants selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-slate-300 text-sm flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-400" />
              Número de variantes
            </Label>
            <span className="text-slate-500 text-xs">
              Cada variante se genera con una semilla aleatoria distinta
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {VARIANT_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setNumVariants(n)}
                disabled={loading}
                className={cn(
                  "py-3 rounded-lg border text-sm font-semibold transition-all",
                  numVariants === n
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-slate-500 text-xs">
            {numVariants === 1
              ? "Se generará una única solución optimizada"
              : `Se generarán ${numVariants} cuadrantes equivalentes en calidad para que elijas el que más te guste`}
          </p>
        </div>

        {/* Time limit */}
        <div className="space-y-1">
          <Label className="text-slate-300 text-sm">Tiempo límite por variante (segundos)</Label>
          <Input
            type="number"
            min={10}
            max={300}
            value={timeLimit}
            onChange={(e) => setTimeLimit(parseInt(e.target.value) || 60)}
            className="bg-slate-800 border-slate-700 text-white"
            disabled={loading}
          />
          <p className="text-slate-500 text-xs">
            Total estimado:{" "}
            <span className="text-slate-300 font-medium">
              ~{timeLimit * numVariants}s
            </span>{" "}
            ({timeLimit}s × {numVariants})
          </p>
        </div>

        {loading && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <span>OR-Tools CP-SAT resolviendo {numVariants > 1 ? `${numVariants} variantes` : ""}… ({Math.round(progress)}%)</span>
            </div>
            <Progress value={progress} className="h-2 bg-slate-800" />
          </div>
        )}

        <div className="flex items-start gap-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-300 text-xs">
            Las variantes son cuadrantes con la misma cobertura óptima pero asignaciones diferentes — al solver le suele dar igual quién hace cada turno mientras se cumplan las restricciones.
          </p>
        </div>

        <Button
          className="w-full bg-indigo-600 hover:bg-indigo-500 h-11 text-base"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Calculando…</>
          ) : (
            <><Sparkles className="mr-2 h-5 w-5" />
              {numVariants === 1 ? "Generar cuadrante" : `Generar ${numVariants} variantes`}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
