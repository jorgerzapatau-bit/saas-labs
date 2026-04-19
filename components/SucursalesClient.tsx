"use client";
// components/SucursalesClient.tsx

import { useState } from "react";
import type { DashboardData } from "@/types";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(n);

const pct = (n: number) => `${n.toFixed(1)}%`;

const COLORES = ["#00C49F", "#0088FE"];
const COLORES_PAGO = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28DFF"];

interface Props {
  data: DashboardData;
}

export default function SucursalesClient({ data }: Props) {
  const [activa, setActiva] = useState<string | null>(null);

  const sucursalData = activa
    ? data.sucursales.filter((s) => s.id === activa)
    : data.sucursales;

  const totalIngresos = data.gran_total_ingresos;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-white font-semibold text-sm leading-none">Sucursales</h1>
            <p className="text-slate-500 text-xs mt-0.5">Comparativa y métricas por sede</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiva(null)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                !activa ? "bg-emerald-500 text-slate-900" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              Todas
            </button>
            {data.sucursales.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActiva(s.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activa === s.id
                    ? "text-slate-900 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
                style={activa === s.id ? { backgroundColor: COLORES[i] } : {}}
              >
                {s.nombre}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Comparativa rápida ─────────────────────────── */}
        {!activa && (
          <section>
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-4">
              Comparativa General
            </h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="grid grid-cols-5 gap-4 text-xs text-slate-500 font-medium uppercase tracking-wide pb-3 border-b border-slate-800 mb-4">
                <span>Sucursal</span>
                <span className="text-right">Ingresos</span>
                <span className="text-right">Gastos</span>
                <span className="text-right">Utilidad</span>
                <span className="text-right">Margen</span>
              </div>
              {data.sucursales.map((suc, i) => {
                const margen = suc.total_ingresos > 0 ? (suc.utilidad_bruta / suc.total_ingresos) * 100 : 0;
                const color = COLORES[i];
                return (
                  <div
                    key={suc.id}
                    className="grid grid-cols-5 gap-4 py-4 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 rounded-lg px-2 transition-colors cursor-pointer"
                    onClick={() => setActiva(suc.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <div>
                        <p className="text-white font-semibold text-sm">{suc.nombre}</p>
                        <p className="text-slate-500 text-xs">{suc.num_transacciones} transacciones</p>
                      </div>
                    </div>
                    <p className="text-right text-emerald-400 font-mono text-sm self-center">{fmt(suc.total_ingresos)}</p>
                    <p className="text-right text-rose-400 font-mono text-sm self-center">{fmt(suc.total_gastos)}</p>
                    <p className={`text-right font-mono text-sm font-semibold self-center ${suc.utilidad_bruta >= 0 ? "text-blue-400" : "text-amber-400"}`}>
                      {fmt(suc.utilidad_bruta)}
                    </p>
                    <p className={`text-right text-sm font-semibold self-center ${margen >= 30 ? "text-emerald-400" : margen >= 0 ? "text-amber-400" : "text-rose-400"}`}>
                      {pct(margen)}
                    </p>
                  </div>
                );
              })}

              {/* Totales */}
              <div className="grid grid-cols-5 gap-4 py-4 mt-2 border-t-2 border-slate-700 px-2">
                <p className="text-slate-400 text-xs font-semibold uppercase">Total</p>
                <p className="text-right text-emerald-400 font-mono text-sm font-bold">{fmt(data.gran_total_ingresos)}</p>
                <p className="text-right text-rose-400 font-mono text-sm font-bold">{fmt(data.gran_total_gastos)}</p>
                <p className={`text-right font-mono text-sm font-bold ${data.utilidad_neta >= 0 ? "text-blue-400" : "text-amber-400"}`}>
                  {fmt(data.utilidad_neta)}
                </p>
                <p className="text-right text-slate-400 text-xs self-center">
                  {pct(data.gran_total_ingresos > 0 ? (data.utilidad_neta / data.gran_total_ingresos) * 100 : 0)}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── Barra comparativa visual ──────────────────── */}
        {!activa && (
          <section>
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-4">
              Participación en Ingresos
            </h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              {data.sucursales.map((suc, i) => {
                const porcentaje = totalIngresos > 0 ? (suc.total_ingresos / totalIngresos) * 100 : 0;
                const color = COLORES[i];
                return (
                  <div key={suc.id}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-slate-300 text-sm font-medium">{suc.nombre}</span>
                        <span className="text-slate-600 text-xs">{suc.num_transacciones} trans.</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-emerald-400 font-mono text-sm">{fmt(suc.total_ingresos)}</span>
                        <span className="text-white font-bold text-sm w-14 text-right">{pct(porcentaje)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-3">
                      <div
                        className="h-3 rounded-full transition-all duration-700"
                        style={{ width: `${porcentaje}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Tarjetas detalladas por sucursal ─────────── */}
        <section>
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-4">
            {activa ? "Detalle de Sucursal" : "Detalle por Sucursal"}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.sucursales
              .filter((s) => !activa || s.id === activa)
              .map((suc, i) => {
                const color = COLORES[activa ? 0 : i];
                const margen = suc.total_ingresos > 0 ? (suc.utilidad_bruta / suc.total_ingresos) * 100 : 0;
                const porcentaje = totalIngresos > 0 ? (suc.total_ingresos / totalIngresos) * 100 : 0;

                // Mini gráfica de barras: ingresos vs gastos
                const maxVal = Math.max(suc.total_ingresos, suc.total_gastos);
                const barIng = maxVal > 0 ? (suc.total_ingresos / maxVal) * 100 : 0;
                const barGas = maxVal > 0 ? (suc.total_gastos / maxVal) * 100 : 0;

                return (
                  <div
                    key={suc.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
                  >
                    {/* Cabecera de tarjeta */}
                    <div className="p-6 border-b border-slate-800" style={{ borderTopColor: color, borderTopWidth: 3 }}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span
                            className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                            style={{ backgroundColor: color + "22", color }}
                          >
                            {suc.serie_prefix}
                          </span>
                          <h3 className="text-white font-bold text-xl mt-2">{suc.nombre}</h3>
                          <p className="text-slate-500 text-xs mt-1">{suc.num_transacciones} transacciones · Marzo 2026</p>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-500 text-xs">% del total</p>
                          <p className="text-white text-3xl font-black">{pct(porcentaje)}</p>
                        </div>
                      </div>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-3 divide-x divide-slate-800 border-b border-slate-800">
                      <div className="p-4 text-center">
                        <p className="text-slate-500 text-xs mb-1">Ingresos</p>
                        <p className="text-emerald-400 font-bold text-sm">{fmt(suc.total_ingresos)}</p>
                      </div>
                      <div className="p-4 text-center">
                        <p className="text-slate-500 text-xs mb-1">Gastos</p>
                        <p className="text-rose-400 font-bold text-sm">{fmt(suc.total_gastos)}</p>
                      </div>
                      <div className="p-4 text-center">
                        <p className="text-slate-500 text-xs mb-1">Margen</p>
                        <p className={`font-bold text-sm ${margen >= 30 ? "text-emerald-400" : margen >= 0 ? "text-blue-400" : "text-amber-400"}`}>
                          {pct(margen)}
                        </p>
                      </div>
                    </div>

                    {/* Mini gráfica de barras horizontales */}
                    <div className="p-5 border-b border-slate-800">
                      <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-3">
                        Ingresos vs Gastos
                      </p>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">Ingresos</span>
                            <span className="text-emerald-400 font-mono">{fmt(suc.total_ingresos)}</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2.5">
                            <div className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${barIng}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">Gastos</span>
                            <span className="text-rose-400 font-mono">{fmt(suc.total_gastos)}</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2.5">
                            <div className="h-2.5 rounded-full bg-rose-500" style={{ width: `${barGas}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">Utilidad</span>
                            <span className={`font-mono font-semibold ${suc.utilidad_bruta >= 0 ? "text-blue-400" : "text-amber-400"}`}>
                              {fmt(suc.utilidad_bruta)}
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2.5">
                            <div
                              className={`h-2.5 rounded-full ${suc.utilidad_bruta >= 0 ? "bg-blue-500" : "bg-amber-500"}`}
                              style={{ width: `${Math.abs(margen)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Alerta efectivo */}
                    {suc.efectivo_sin_depositar > 0 ? (
                      <div className="p-4 bg-amber-500/5 border-b border-amber-500/20">
                        <div className="flex items-start gap-3">
                          <span className="text-amber-400 text-lg mt-0.5">⚠</span>
                          <div>
                            <p className="text-amber-400 text-sm font-semibold">
                              {fmt(suc.efectivo_sin_depositar)} sin depositar
                            </p>
                            <p className="text-amber-500/70 text-xs mt-0.5">
                              Efectivo cobrado que no ha sido depositado al banco. Requiere atención inmediata.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-emerald-500/5 border-b border-emerald-500/20">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 text-sm">✓</span>
                          <p className="text-emerald-400 text-xs font-medium">Todo el efectivo está depositado</p>
                        </div>
                      </div>
                    )}

                    {/* Utilidad neta destacada */}
                    <div className="p-5">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-slate-500 text-xs">Utilidad Neta</p>
                          <p className={`text-2xl font-black mt-1 ${suc.utilidad_bruta >= 0 ? "text-blue-400" : "text-rose-400"}`}>
                            {fmt(suc.utilidad_bruta)}
                          </p>
                        </div>
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{
                            backgroundColor: color + "22",
                            color,
                            border: `2px solid ${color}44`,
                          }}
                        >
                          {pct(margen).replace("%", "")}
                          <span className="text-xs">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        {/* ── Alerta global efectivo ────────────────────── */}
        {data.efectivo_sin_depositar > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-amber-400 text-xl">⚠</span>
            </div>
            <div>
              <p className="text-amber-400 font-semibold">
                Alerta: {fmt(data.efectivo_sin_depositar)} en efectivo sin depositar (total empresa)
              </p>
              <p className="text-amber-500/70 text-sm mt-1">
                Este dinero fue cobrado en efectivo pero no ha sido registrado como depositado en banco.
                Representa un riesgo de fuga o error de registro. Verificar con los encargados de cada sucursal.
              </p>
            </div>
          </div>
        )}

        <footer className="text-center text-slate-700 text-xs pb-4">
          Datos actualizados en tiempo real · Vitana Labs © {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  );
}
