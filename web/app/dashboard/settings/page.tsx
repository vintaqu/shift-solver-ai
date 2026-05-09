import { auth } from "@/auth";
import sql from "@/lib/db";
import SettingsForm from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const session = await auth();
  const restaurantId = (session!.user as { restaurantId?: string }).restaurantId;
  if (!restaurantId) return <p className="text-slate-400">Sin restaurante.</p>;

  const [restaurant, user] = await Promise.all([
    sql("SELECT id, nombre FROM restaurants WHERE id = $1", [restaurantId]),
    sql("SELECT id, name, email, role FROM users WHERE restaurant_id = $1", [restaurantId]),
  ]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Ajustes</h1>
        <p className="text-slate-400 text-sm mt-1">Gestiona tu restaurante y cuenta.</p>
      </div>
      <SettingsForm
        restaurant={(restaurant[0] ?? { id: "", nombre: "" }) as { id: string; nombre: string }}
        users={user as { id: string; name: string; email: string; role: string }[]}
        currentUserId={session!.user?.id ?? ""}
      />
    </div>
  );
}
