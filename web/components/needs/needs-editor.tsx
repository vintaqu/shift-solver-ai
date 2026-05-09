"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DIAS,
  DIA_LABELS,
  ROL_JERARQUIA,
  ROL_LABELS,
  ETIQUETAS_DISPONIBLES,
  type ShiftNeed,
} from "@/lib/types";

interface Props {
  initialNeeds: ShiftNeed[];
}

type NeedsMap = Record<string, Record<string, ShiftNeed>>;

function buildMap(needs: ShiftNeed[]): NeedsMap {
  const map: NeedsMap = {};
  for (const n of needs) {
    if (!map[n.dia]) map[n.dia] = {};
    map[n.dia][`${n.inicio}-${n.fin}`] = n;
  }
  return map;
}

export default function NeedsEditor({ initialNeeds }: Props) {
  const [needs, setNeeds] = useState<NeedsMap>(buildMap(initialNeeds));
  const [saving, setSaving] = useState(false);

  const updateField = (
    dia: string,
    key: string,
    field: keyof ShiftNeed,
    value: unknown
  ) => {
    setNeeds((prev) => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        [key]: { ...prev[dia]?.[key], [field]: value },
      },
    }));
  };

  const toggleEtiqueta = (dia: string, key: string, etiqueta: string) => {
    const current = needs[dia]?.[key]?.etiquetas ?? [];
    const next = current.includes(etiqueta)
      ? current.filter((e) => e !== etiqueta)
      : [...current, etiqueta];
    updateField(dia, key, "etiquetas", next);
  };

  const toggleRol = (dia: string, key: string, rol: string, value: number) => {
    const current = needs[dia]?.[key]?.personas_por_rol ?? {};
    const next = { ...current, [rol]: value };
    updateField(dia, key, "personas_por_rol", next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const franjas: Partial<ShiftNeed>[] = [];
      for (const dia of DIAS) {
        for (const need of Object.values(needs[dia] ?? {})) {
          franjas.push({
            dia: need.dia ?? dia,
            inicio: need.inicio,
            fin: need.fin,
            personas: Number(need.personas) || 0,
            personas_por_rol: need.personas_por_rol ?? {},
            etiquetas: need.etiquetas ?? [],
          });
        }
      }

      const res = await fetch("/api/needs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ franjas }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      toast.success("Necesidades guardadas");
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          className="bg-indigo-600 hover:bg-indigo-700"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar cambios
        </Button>
      </div>

      <Tabs defaultValue="LUNES">
        <TabsList className="bg-slate-800 border border-slate-700 flex-wrap h-auto gap-1 p-1">
          {DIAS.map((d) => (
            <TabsTrigger
              key={d}
              value={d}
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-400 text-xs"
            >
              {DIA_LABELS[d]}
            </TabsTrigger>
          ))}
        </TabsList>

        {DIAS.map((dia) => {
          const dayNeeds = Object.values(needs[dia] ?? {}).sort((a, b) =>
            a.inicio.localeCompare(b.inicio)
          );

          return (
            <TabsContent key={dia} value={dia} className="mt-4">
              {dayNeeds.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No hay franjas definidas para {DIA_LABELS[dia]}.
                </div>
              ) : (
                <div className="space-y-3">
                  {dayNeeds.map((need) => {
                    const key = `${need.inicio}-${need.fin}`;
                    return (
                      <Card key={key} className="bg-slate-900 border-slate-800">
                        <CardHeader className="pb-2 pt-4 px-4">
                          <CardTitle className="text-sm text-slate-300 flex items-center justify-between">
                            <span className="font-mono">
                              {need.inicio} — {need.fin}
                            </span>
                            <Badge className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs">
                              {need.personas} persona{need.personas !== 1 ? "s" : ""}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-4">
                          {/* Personas total */}
                          <div className="flex items-center gap-3">
                            <label className="text-slate-400 text-xs w-28 flex-shrink-0">Personas totales</label>
                            <Input
                              type="number"
                              min={0}
                              max={20}
                              value={need.personas ?? 0}
                              onChange={(e) =>
                                updateField(dia, key, "personas", parseInt(e.target.value) || 0)
                              }
                              className="bg-slate-800 border-slate-700 text-white w-20 text-sm"
                            />
                          </div>

                          {/* Desglose por rol */}
                          <div className="space-y-2">
                            <label className="text-slate-400 text-xs">Mínimo por rol</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {ROL_JERARQUIA.map((rol) => (
                                <div key={rol} className="space-y-1">
                                  <label className="text-slate-500 text-xs">{ROL_LABELS[rol]}</label>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={10}
                                    value={need.personas_por_rol?.[rol] ?? 0}
                                    onChange={(e) =>
                                      toggleRol(dia, key, rol, parseInt(e.target.value) || 0)
                                    }
                                    className="bg-slate-800 border-slate-700 text-white text-sm"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Etiquetas */}
                          <div className="space-y-2">
                            <label className="text-slate-400 text-xs">
                              Habilidades requeridas (basta con una persona que tenga alguna)
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {ETIQUETAS_DISPONIBLES.map((e) => (
                                <button
                                  key={e}
                                  type="button"
                                  onClick={() => toggleEtiqueta(dia, key, e)}
                                  className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                                    need.etiquetas?.includes(e)
                                      ? "bg-emerald-600 text-white"
                                      : "bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300"
                                  }`}
                                >
                                  {e}
                                </button>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
