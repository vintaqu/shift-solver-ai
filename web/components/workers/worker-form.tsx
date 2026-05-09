"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ROL_LABELS, ETIQUETAS_DISPONIBLES, DIAS, DIA_LABELS } from "@/lib/types";

const schema = z.object({
  nombre: z.string().min(1, "Obligatorio"),
  rol: z.enum(["CAMARERO_BASICO", "SEMI_ENCARGADO", "ENCARGADO", "DUENO"]),
  contrato_tipo: z.enum(["fijo", "horquilla"]),
  horas: z.coerce.number().int().positive().optional(),
  min_horas: z.coerce.number().int().positive().optional(),
  max_horas: z.coerce.number().int().positive().optional(),
  etiquetas: z.array(z.string()),
  dias_libres: z.array(z.string()),
  no_antes_hora: z.string().optional(),
  no_despues_hora: z.string().optional(),
  no_despues_dias: z.array(z.string()),
  trabajar_obligatorio_dia: z.string().optional(),
  trabajar_obligatorio_desde: z.string().optional(),
  trabajar_obligatorio_hasta: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  workerId?: string;
  defaultValues?: Partial<FormData>;
  onSuccess?: () => void;
}

export default function WorkerForm({ workerId, defaultValues, onSuccess }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEdit = !!workerId;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as unknown as Resolver<FormData>,
    defaultValues: {
      rol: "CAMARERO_BASICO" as const,
      contrato_tipo: "fijo" as const,
      etiquetas: [] as string[],
      dias_libres: [] as string[],
      no_despues_dias: [] as string[],
      ...defaultValues,
    },
  });

  const contratoTipo = watch("contrato_tipo");
  const etiquetas = watch("etiquetas");
  const diasLibres = watch("dias_libres");
  const noDespuesDias = watch("no_despues_dias");

  const toggleArray = (field: "etiquetas" | "dias_libres" | "no_despues_dias", value: string) => {
    const current = field === "etiquetas" ? etiquetas : field === "dias_libres" ? diasLibres : noDespuesDias;
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setValue(field, next);
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const body = {
        nombre: data.nombre,
        rol: data.rol,
        contrato: {
          tipo: data.contrato_tipo,
          horas: data.contrato_tipo === "fijo" ? data.horas : null,
          min_horas: data.contrato_tipo === "horquilla" ? data.min_horas : null,
          max_horas: data.contrato_tipo === "horquilla" ? data.max_horas : null,
        },
        etiquetas: data.etiquetas,
        restricciones: {
          dias_libres: data.dias_libres,
          no_antes_de: data.no_antes_hora
            ? [{ hora: data.no_antes_hora, dias: "TODOS" }]
            : [],
          no_despues_de:
            data.no_despues_hora && data.no_despues_dias.length > 0
              ? [{ hora: data.no_despues_hora, dias: data.no_despues_dias }]
              : data.no_despues_hora
              ? [{ hora: data.no_despues_hora, dias: "TODOS" }]
              : [],
          trabajar_obligatorio:
            data.trabajar_obligatorio_dia &&
            data.trabajar_obligatorio_desde &&
            data.trabajar_obligatorio_hasta
              ? [
                  {
                    dia: data.trabajar_obligatorio_dia,
                    desde: data.trabajar_obligatorio_desde,
                    hasta: data.trabajar_obligatorio_hasta,
                  },
                ]
              : [],
        },
      };

      const url = isEdit ? `/api/workers/${workerId}` : "/api/workers";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }

      toast.success(isEdit ? "Trabajador actualizado" : "Trabajador creado");
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/dashboard/workers");
        router.refresh();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      {/* Datos básicos */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Datos básicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-slate-300">Nombre</Label>
              <Input
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="SARA"
                {...register("nombre")}
              />
              {errors.nombre && <p className="text-red-400 text-xs">{errors.nombre.message}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Rol</Label>
              <Controller
                control={control}
                name="rol"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {Object.entries(ROL_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-slate-300 focus:bg-slate-700">
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contrato */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Contrato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-slate-300">Tipo</Label>
            <Controller
              control={control}
              name="contrato_tipo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="fijo" className="text-slate-300 focus:bg-slate-700">Horas fijas</SelectItem>
                    <SelectItem value="horquilla" className="text-slate-300 focus:bg-slate-700">Horquilla (mín-máx)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {contratoTipo === "fijo" && (
            <div className="space-y-1">
              <Label className="text-slate-300">Horas semanales</Label>
              <Input type="number" className="bg-slate-800 border-slate-700 text-white" placeholder="40" {...register("horas")} />
            </div>
          )}

          {contratoTipo === "horquilla" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-slate-300">Mínimo (h/sem)</Label>
                <Input type="number" className="bg-slate-800 border-slate-700 text-white" placeholder="12" {...register("min_horas")} />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-300">Máximo (h/sem)</Label>
                <Input type="number" className="bg-slate-800 border-slate-700 text-white" placeholder="28" {...register("max_horas")} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Etiquetas */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Habilidades (etiquetas)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {ETIQUETAS_DISPONIBLES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => toggleArray("etiquetas", e)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  etiquetas.includes(e)
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Restricciones */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Restricciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-slate-300">Días libres fijos</Label>
            <div className="flex flex-wrap gap-2">
              {DIAS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleArray("dias_libres", d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    diasLibres.includes(d)
                      ? "bg-red-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {DIA_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-slate-300">No antes de (todos los días)</Label>
              <Input type="time" className="bg-slate-800 border-slate-700 text-white" {...register("no_antes_hora")} />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">No después de (hora)</Label>
              <Input type="time" className="bg-slate-800 border-slate-700 text-white" {...register("no_despues_hora")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300 text-sm">No después de — aplicar solo en estos días (vacío = todos)</Label>
            <div className="flex flex-wrap gap-2">
              {DIAS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleArray("no_despues_dias", d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    noDespuesDias.includes(d)
                      ? "bg-amber-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {DIA_LABELS[d]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Trabajar obligatorio en ventana (opcional)</Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-500 text-xs">Día</Label>
                <Controller
                  control={control}
                  name="trabajar_obligatorio_dia"
                  render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {DIAS.map((d) => (
                          <SelectItem key={d} value={d} className="text-slate-300 focus:bg-slate-700 text-sm">
                            {DIA_LABELS[d]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-500 text-xs">Desde</Label>
                <Input type="time" className="bg-slate-800 border-slate-700 text-white text-sm" {...register("trabajar_obligatorio_desde")} />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-500 text-xs">Hasta</Label>
                <Input type="time" className="bg-slate-800 border-slate-700 text-white text-sm" {...register("trabajar_obligatorio_hasta")} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? "Guardar cambios" : "Crear trabajador"}
        </Button>
        {!onSuccess && (
          <Button
            type="button"
            variant="outline"
            className="border-slate-700 text-slate-300"
            onClick={() => router.back()}
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
