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
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/workers", label: "Trabajadores", icon: Users },
  { href: "/dashboard/needs", label: "Necesidades", icon: TableProperties },
  { href: "/dashboard/schedule", label: "Cuadrante", icon: CalendarDays },
  { href: "/dashboard/settings", label: "Ajustes", icon: Settings },
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
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-indigo-600 text-white"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {label}
    </Link>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-800 text-white"
        onClick={() => setOpen(!open)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <CalendarDays className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-white text-lg">Shift Solver</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <NavItem key={item.href} {...item} onClick={() => setOpen(false)} />
          ))}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800">
          <p className="text-xs text-slate-600">Shift Solver AI v1.0</p>
        </div>
      </aside>
    </>
  );
}
