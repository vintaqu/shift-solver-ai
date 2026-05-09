import WorkerForm from "@/components/workers/worker-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewWorkerPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/workers" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Nuevo trabajador</h1>
          <p className="text-slate-400 text-sm mt-0.5">Añade un empleado a tu plantilla</p>
        </div>
      </div>
      <WorkerForm />
    </div>
  );
}
