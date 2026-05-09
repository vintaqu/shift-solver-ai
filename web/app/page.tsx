import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  Brain,
  ShieldCheck,
  BarChart3,
  ChevronRight,
  Check,
  ArrowRight,
  Zap,
  Users,
  Clock,
} from "lucide-react";

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#080B14] text-white overflow-x-hidden">
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      {/* ── NAVBAR ── */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <CalendarDays className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Shift Solver</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            Empezar gratis
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 rounded-full mb-8">
          <Zap className="h-3 w-3" />
          Powered by Google OR-Tools · CP-SAT
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-none mb-6">
          <span className="text-white">Cuadrantes perfectos</span>
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #818cf8 0%, #6366f1 40%, #a78bfa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            en segundos
          </span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
          Olvídate del Excel. Shift Solver AI genera el cuadrante óptimo de tu
          restaurante respetando contratos, restricciones y necesidades de cobertura.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-7 py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
          >
            Empezar gratis
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 px-7 py-3.5 rounded-xl transition-all"
          >
            Ver demo
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Hero mockup */}
        <div className="mt-16 relative">
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#080B14] to-transparent z-10 pointer-events-none" />
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-left backdrop-blur shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="ml-3 text-xs text-slate-600">Restaurante Tarragona — Semana 23</span>
            </div>
            <div className="grid grid-cols-8 gap-2 text-xs">
              <div className="text-slate-600 py-2 font-medium">Trabajador</div>
              {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map((d) => (
                <div key={d} className="text-slate-500 text-center py-2 font-semibold">{d}</div>
              ))}
              {([
                { name: "SARA",     shifts: ["10–18","10–18","–","10–18","10–18","12–20","–"] },
                { name: "EDGAR",    shifts: ["–","12–20","12–20","–","12–20","12–20","12–20"] },
                { name: "MILAGROS", shifts: ["10–18","–","10–18","10–18","–","12–20","12–20"] },
                { name: "DANA",     shifts: ["12–20","12–20","12–20","12–20","12–20","–","–"] },
              ] as const).map((w) => (
                <div key={w.name} className="contents">
                  <div className="text-slate-400 py-2 font-medium">{w.name}</div>
                  {w.shifts.map((s, i) => (
                    <div
                      key={i}
                      className={`text-center py-2 px-1 rounded text-xs font-mono ${
                        s === "–"
                          ? "text-slate-700"
                          : "bg-indigo-600/20 text-indigo-300 border border-indigo-500/20"
                      }`}
                    >
                      {s}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  98% cobertura
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  0 huecos
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  3.2s
                </span>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                Óptimo
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        <div className="grid grid-cols-3 gap-8 text-center">
          {[
            { value: "< 30s", label: "para generar un cuadrante completo" },
            { value: "100%", label: "de restricciones y contratos respetados" },
            { value: "52", label: "semanas planificadas en el calendario anual" },
          ].map((s) => (
            <div key={s.label} className="space-y-2">
              <div
                className="text-4xl md:text-5xl font-extrabold"
                style={{
                  background: "linear-gradient(135deg, #818cf8, #6366f1)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {s.value}
              </div>
              <p className="text-slate-500 text-sm leading-snug">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Todo lo que necesitas
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Una herramienta completa para gestionar los turnos de tu equipo sin fricciones.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: <Brain className="h-6 w-6 text-indigo-400" />,
              bg: "bg-indigo-500/10 border-indigo-500/20",
              title: "IA que optimiza de verdad",
              desc: "Google OR-Tools CP-SAT resuelve la planificación como un problema de optimización combinatoria. Encuentra el cuadrante óptimo, no una aproximación.",
            },
            {
              icon: <ShieldCheck className="h-6 w-6 text-emerald-400" />,
              bg: "bg-emerald-500/10 border-emerald-500/20",
              title: "Restricciones reales",
              desc: "Contratos fijos o en horquilla, días libres, franjas prohibidas, jornadas obligatorias. Cada regla se respeta al 100%.",
            },
            {
              icon: <BarChart3 className="h-6 w-6 text-amber-400" />,
              bg: "bg-amber-500/10 border-amber-500/20",
              title: "Cobertura garantizada",
              desc: "Define cuántas personas necesitas por franja y día. El algoritmo cierra todos los huecos o te indica exactamente cuáles faltan.",
            },
            {
              icon: <CalendarDays className="h-6 w-6 text-violet-400" />,
              bg: "bg-violet-500/10 border-violet-500/20",
              title: "Calendario anual",
              desc: "Arrastra cuadrantes a cada semana del año. Cierra meses para tener una visión global de toda la planificación anual.",
            },
            {
              icon: <Users className="h-6 w-6 text-sky-400" />,
              bg: "bg-sky-500/10 border-sky-500/20",
              title: "Gestión de equipo",
              desc: "Perfiles completos con habilidades, rol jerárquico y todas las restricciones personales en un solo lugar.",
            },
            {
              icon: <Zap className="h-6 w-6 text-rose-400" />,
              bg: "bg-rose-500/10 border-rose-500/20",
              title: "Multi-restaurante",
              desc: "Cada restaurante tiene su propio espacio aislado. Gestiona varios locales con datos completamente separados.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/80 transition-all group"
            >
              <div className={`inline-flex p-2.5 rounded-xl border mb-4 ${f.bg}`}>
                {f.icon}
              </div>
              <h3 className="text-white font-semibold mb-2 group-hover:text-indigo-300 transition-colors">
                {f.title}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Tres pasos y listo
          </h2>
          <p className="text-slate-400">De cero a cuadrante en menos de cinco minutos.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: "01",
              title: "Añade tu equipo",
              desc: "Crea perfiles con contratos (fijo o en horquilla), habilidades y restricciones personales de cada trabajador.",
            },
            {
              step: "02",
              title: "Define la demanda",
              desc: "Configura cuántas personas necesitas por franja horaria en cada día de la semana, con desglose por rol si lo requieres.",
            },
            {
              step: "03",
              title: "Genera el cuadrante",
              desc: "Un clic y la IA calcula el cuadrante óptimo en segundos. Consulta el resultado y asígnalo a su semana en el calendario anual.",
            },
          ].map((s, i) => (
            <div key={s.step} className="relative">
              {i < 2 && (
                <div className="hidden md:block absolute top-6 left-[calc(100%+1rem)] right-[-1rem] h-px bg-gradient-to-r from-slate-800 to-transparent" />
              )}
              <div>
                <div className="text-6xl font-black text-slate-800/70 mb-3 leading-none">{s.step}</div>
                <h3 className="text-white font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-600/20 via-indigo-600/10 to-violet-600/20 p-12 text-center">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-indigo-600/15 blur-[80px]" />
          </div>
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Empieza hoy — es gratis
            </h2>
            <p className="text-slate-400 mb-8 max-w-lg mx-auto">
              Crea tu cuenta, añade tu equipo y genera tu primer cuadrante optimizado
              en menos de cinco minutos.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/30 hover:-translate-y-0.5"
            >
              Crear mi cuenta gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-slate-500 text-sm">
              {["Sin tarjeta de crédito", "Sin límite de trabajadores", "Sin compromiso"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-slate-900 px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
            <CalendarDays className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-bold text-sm">Shift Solver AI</span>
        </div>
        <p className="text-slate-600 text-xs">
          © {new Date().getFullYear()} Shift Solver AI. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
