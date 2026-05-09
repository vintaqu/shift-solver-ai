"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Building2, Users } from "lucide-react";
import { toast } from "sonner";

interface Props {
  restaurant: { id: string; nombre: string };
  users: { id: string; name: string; email: string; role: string }[];
  currentUserId: string;
}

export default function SettingsForm({ restaurant, users, currentUserId }: Props) {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState(restaurant.nombre);
  const [saving, setSaving] = useState(false);

  const handleSaveRestaurant = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/restaurant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: restaurantName }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      toast.success("Restaurante actualizado");
      router.refresh();
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Restaurante */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-400" />
            Datos del restaurante
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-slate-300">Nombre del restaurante</Label>
            <Input
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={handleSaveRestaurant}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar
          </Button>
        </CardContent>
      </Card>

      {/* Equipo */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-400" />
            Equipo ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3 bg-slate-800 rounded-lg"
              >
                <div>
                  <p className="text-white text-sm font-medium">{u.name || u.email}</p>
                  <p className="text-slate-500 text-xs">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs">
                    {u.role}
                  </Badge>
                  {u.id === currentUserId && (
                    <Badge className="bg-slate-700 text-slate-400 text-xs">Tú</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-slate-600 text-xs mt-4">
            La gestión de usuarios adicionales estará disponible próximamente.
          </p>
        </CardContent>
      </Card>

      {/* Info del solver */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Servicio solver</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">URL</span>
            <span className="text-slate-300 text-sm font-mono">
              {process.env.SOLVER_API_URL || "shift-solver-ai-production.up.railway.app"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Autenticación</span>
            <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs">
              Sin API key (dev)
            </Badge>
          </div>
          <p className="text-slate-600 text-xs pt-1">
            Para producción, configura SOLVER_API_KEY en Railway y en las variables de entorno de Vercel.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
