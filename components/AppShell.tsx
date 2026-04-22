"use client";
// components/AppShell.tsx
// Shell responsive: sidebar en desktop, drawer + bottom nav en móvil

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const NAV = [
  { href: "/dashboard",     label: "Dashboard",   icon: "◈" },
  { href: "/transacciones", label: "Ingresos",    icon: "↑" },
  { href: "/gastos",        label: "Gastos",       icon: "↓" },
  { href: "/sucursales",    label: "Sucursales",   icon: "⊞" },
];

const NAV_ANALISIS = [
  { href: "/costos",       label: "Costos",        icon: "🧾" },
  { href: "/semanas",      label: "Sem. Ingresos", icon: "📅" },
  { href: "/rentabilidad", label: "Rentabilidad",  icon: "📊" },
];

const ALL_NAV = [...NAV, ...NAV_ANALISIS];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Cierra el drawer al navegar
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Bloquea scroll del body cuando el drawer está abierto
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const activeLabel = ALL_NAV.find(
    (n) => pathname === n.href || pathname.startsWith(n.href + "/")
  )?.label ?? "Vitana Labs";

  return (
    <div className="flex min-h-screen bg-slate-950">

      {/* ── Sidebar desktop (lg+) ─────────────────────────── */}
      <aside className="hidden lg:flex w-56 flex-shrink-0 border-r border-slate-800 bg-slate-900 flex-col">
        <Logo />
        <NavContent pathname={pathname} />
        <Footer />
      </aside>

      {/* ── Overlay móvil ────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Drawer móvil (desliza desde la izquierda) ──── */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header del drawer con botón cerrar */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <span className="text-slate-900 font-black text-sm">V</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">Vitana Labs</p>
              <p className="text-slate-500 text-xs mt-0.5">Finanzas</p>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Cerrar menú"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <NavContent pathname={pathname} onLinkClick={() => setDrawerOpen(false)} />
        <Footer />
      </aside>

      {/* ── Contenido ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar móvil */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-slate-900/95 backdrop-blur border-b border-slate-800">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Abrir menú"
          >
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
              <rect y="0"   width="18" height="2" rx="1" fill="currentColor"/>
              <rect y="6"   width="18" height="2" rx="1" fill="currentColor"/>
              <rect y="12"  width="12" height="2" rx="1" fill="currentColor"/>
            </svg>
          </button>

          <span className="text-white text-sm font-semibold">{activeLabel}</span>

          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <span className="text-slate-900 font-black text-sm">V</span>
          </div>
        </header>

        {/* Contenido con padding-bottom para no quedar bajo el bottom nav */}
        <main className="flex-1 overflow-auto pb-20 lg:pb-0">
          {children}
        </main>

        {/* ── Bottom nav móvil ─────────────────────────── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex safe-bottom">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center pt-2.5 pb-3 gap-1 transition-colors ${
                  active ? "text-emerald-400" : "text-slate-500"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            );
          })}
          {/* Botón "Más" abre el drawer con sección Análisis */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center pt-2.5 pb-3 gap-1 transition-colors ${
              NAV_ANALISIS.some((n) => pathname === n.href || pathname.startsWith(n.href + "/"))
                ? "text-emerald-400"
                : "text-slate-500"
            }`}
          >
            <span className="text-base leading-none">···</span>
            <span className="text-[10px] font-medium leading-none">Más</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────

function Logo() {
  return (
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
  );
}

function NavContent({ pathname, onLinkClick }: { pathname: string; onLinkClick?: () => void }) {
  return (
    <>
      <nav className="px-3 py-4 space-y-1 border-b border-slate-800">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span className="w-5 text-center text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <nav className="px-3 py-4 space-y-1 flex-1">
        <p className="text-slate-600 text-[10px] font-medium uppercase tracking-wider px-3 pb-1">Análisis</p>
        {NAV_ANALISIS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span className="w-5 text-center text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function Footer() {
  return (
    <div className="px-5 py-4 border-t border-slate-800">
      <p className="text-slate-600 text-xs">v0.2.0 · 2 sucursales</p>
    </div>
  );
}
