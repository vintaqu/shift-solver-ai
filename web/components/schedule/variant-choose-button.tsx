"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function VariantChooseButton({
  runId,
  chosen,
}: {
  runId: string;
  chosen: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (chosen || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/schedule/choose-variant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error");
      }
      toast.success("Variante marcada como elegida");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading || chosen}
      className={cn(
        "flex items-center gap-1.5 text-sm py-2 px-3 rounded-lg font-medium transition-all",
        chosen
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default"
          : "bg-indigo-600 hover:bg-indigo-500 text-white"
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Crown className="h-3.5 w-3.5" />
      )}
      {chosen ? "Elegida" : "Elegir"}
    </button>
  );
}
