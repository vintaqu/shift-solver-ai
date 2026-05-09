"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function ScheduleGeneratePanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeLimit, setTimeLimit] = useState(60);
  const [seed, setSeed] = useState<string>("");

  const handleGenerate = async () => {
    setLoading(true);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 100 / timeLimit, 92));
    }, 1000);

    try {
      const res = await fetch("/api/generate-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          time_limit: timeLimit,
          seed: seed ? parseInt(seed) : undefined,
        }),
      });

      clearInterval(interval);
      setProgress(100);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al generar");

      const label = data.estado === "OPTIMAL" ? "Cuadrante óptimo generado" : "Cuadrante generado";
      toast.success(label);
      router.push(`/dashboard/schedule/${data.runId}`);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-slate-300 text-sm">Tiempo límite (segundos)</Label>
            <Input
              type="number"
              min={10}
              max={300}
              value={timeLimit}
              onChange={(e) => setTimeLimit(parseInt(e.target.value) || 60)}
              className="bg-slate-800 border-slate-700 text-white"
            />
            <p className="text-slate-500 text-xs">Más tiempo = mejor resultado (max. 300s)</p>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300 text-sm">Seed (opcional)</Label>
            <Input
              type="number"
              placeholder="Aleatorio"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600"
            />
            <p className="text-slate-500 text-xs">Mismo seed = misma rotación</p>
          </div>
        </div>

        {loading && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <span>OR-Tools CP-SAT resolviendo… ({Math.round(progress)}%)</span>
            </div>
            <Progress value={progress} className="h-2 bg-slate-800" />
          </div>
        )}

        <div className="flex items-start gap-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-300 text-xs">
            El solver optimiza en base a los trabajadores y necesidades actuales. Asegúrate de que la plantilla y las franjas están al día antes de generar.
          </p>
        </div>

        <Button
          className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 text-base"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Calculando…</>
          ) : (
            <><Sparkles className="mr-2 h-5 w-5" />Generar cuadrante</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
