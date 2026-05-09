"use client";

import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";

interface Props {
  user: { name?: string | null; email?: string | null };
}

export default function TopBar({ user }: Props) {
  const initials = user.name
    ? user.name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "U";

  return (
    <header className="h-14 border-b border-slate-800/80 bg-[#080B14]/90 backdrop-blur-md flex items-center justify-end px-4 md:px-6 flex-shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-800 transition-colors outline-none">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-indigo-600 text-white text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-slate-300 hidden md:block">
              {user.name || user.email}
            </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-slate-800 border-slate-700">
          <DropdownMenuLabel className="text-slate-400 text-xs">
            {user.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-slate-700" />
          <DropdownMenuItem
            className="text-slate-300 hover:bg-slate-700 cursor-pointer"
            onClick={() => (window.location.href = "/dashboard/settings")}
          >
            <User className="mr-2 h-4 w-4" />
            Ajustes
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-400 hover:bg-slate-700 cursor-pointer"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
