"use client";
// components/AppShell.tsx
// Shell con sidebar de navegación — envuelve todas las páginas internas

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "◈" },
  { href: "/transacciones", label: "Ingresos", icon: "↑" },
  { href: "/gastos", label: "Gastos", icon: "↓" },
  { href: "/sucursales", label: "Sucursales", icon: "⊞" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* ── Sidebar ───────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 border-r border-slate-800 bg-slate-900 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <span className="text-slate-900 font-black text-sm">V</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">Vitana Labs</p>
              <p className="text-slate-500 text-xs mt-0.5">Finanzas</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer del sidebar */}
        <div className="px-5 py-4 border-t border-slate-800">
          <p className="text-slate-600 text-xs">v0.1.0 · 2 sucursales</p>
        </div>
      </aside>

      {/* ── Contenido principal ───────────────────────────── */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
