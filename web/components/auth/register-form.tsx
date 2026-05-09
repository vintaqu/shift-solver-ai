"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  restaurantName: z.string().min(2, "Mínimo 2 caracteres"),
  name: z.string().min(2, "Mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

type FormData = z.infer<typeof schema>;

export default function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al registrar");

      toast.success("Cuenta creada. Iniciando sesión...");
      router.push("/login");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-white text-xl">Crear restaurante</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label className="text-slate-300">Nombre del restaurante</Label>
            <Input
              placeholder="Mi Restaurante"
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
              {...register("restaurantName")}
            />
            {errors.restaurantName && (
              <p className="text-red-400 text-xs">{errors.restaurantName.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300">Tu nombre</Label>
            <Input
              placeholder="Juan García"
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-red-400 text-xs">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300">Email</Label>
            <Input
              type="email"
              placeholder="tu@restaurante.com"
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-red-400 text-xs">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300">Contraseña</Label>
            <Input
              type="password"
              placeholder="••••••••"
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-red-400 text-xs">{errors.password.message}</p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear cuenta
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
