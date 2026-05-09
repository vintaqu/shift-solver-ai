"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Settings,
  TableProperties,
  Menu,
  X,
  CalendarRange,
  CalendarClock,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard",          label: "Dashboard",    icon: LayoutDashboard, exact: true },
  { href: "/dashboard/workers",  label: "Trabajadores", icon: Users },
  { href: "/dashboard/needs",    label: "Necesidades",  icon: TableProperties },
  { href: "/dashboard/schedule", label: "Cuadrante",    icon: CalendarDays },
  { href: "/dashboard/calendar", label: "Calendario",   icon: CalendarRange },
  { href: "/dashboard/periods",  label: "Periodos",     icon: CalendarClock },
  { href: "/dashboard/settings", label: "Ajustes",      icon: Settings },
];

function NavItem({
  href,
  label,
  icon: Icon,
  exact,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
        active
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
          : "text-slate-400 hover:text-white hover:bg-slate-800/80"
      )}
    >
      <Icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-white" : "text-slate-500")} />
      {label}
    </Link>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 shadow-lg"
        onClick={() => setOpen(!open)}
        aria-label="Menu"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-40 w-64 flex flex-col transition-transform duration-200 ease-out",
          "bg-slate-950 border-r border-slate-800/80",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800/80">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/30">
            <CalendarDays className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-white text-sm leading-none block">Shift Solver</span>
            <span className="text-indigo-400 text-xs">AI Scheduling</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-2">Principal</p>
          {NAV.slice(0, 4).map((item) => (
            <NavItem key={item.href} {...item} onClick={() => setOpen(false)} />
          ))}
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mt-5 mb-2">Planificacion</p>
          {NAV.slice(4, 6).map((item) => (
            <NavItem key={item.href} {...item} onClick={() => setOpen(false)} />
          ))}
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mt-5 mb-2">Cuenta</p>
          {NAV.slice(6).map((item) => (
            <NavItem key={item.href} {...item} onClick={() => setOpen(false)} />
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs text-slate-600">Shift Solver AI v1.0</p>
          </div>
        </div>
      </aside>
    </>
  );
}
