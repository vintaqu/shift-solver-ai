import RegisterForm from "@/components/auth/register-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">Shift Solver AI</h1>
          <p className="text-slate-400 mt-1">Crea tu restaurante y empieza gratis</p>
        </div>
        <RegisterForm />
        <p className="text-center text-slate-500 text-sm mt-6">
          ¿Ya tienes cuenta?{" "}
          <a href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Inicia sesión
          </a>
        </p>
      </div>
    </div>
  );
}
