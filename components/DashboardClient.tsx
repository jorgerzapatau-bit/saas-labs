"use client";
// components/DashboardClient.tsx
// Dashboard interactivo con filtros y visualizaciones

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DashboardData } from "@/types";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(n);

const pct = (n: number) => `${n.toFixed(1)}%`;

const COLORES_SUCURSAL = ["#00C49F", "#0088FE"];
const COLORES_PAGO = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28DFF"];

interface Props {
  data: DashboardData;
}

export default function DashboardClient({ data }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mesActivo, setMesActivo] = useState(searchParams.get("mes") || "");

  const mesesDisponibles = Array.from(
    new Set(data.resumen_mensual.map((r) => r.mes))
  ).sort();

  function filtrarPorMes(mes: string) {
    setMesActivo(mes);
    const params = new URLSearchParams();
    if (mes) params.set("mes", mes);
    router.push(`/dashboard?${params.toString()}`);
  }

  const margenUtilidad =
    data.gran_total_ingresos > 0
      ? (data.utilidad_neta / data.gran_total_ingresos) * 100
      : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <span className="text-slate-900 font-black text-sm">V</span>
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm leading-none">Vitana Labs</h1>
              <p className="text-slate-500 text-xs mt-0.5">Panel Financiero</p>
            </div>
          </div>

          {/* Filtro de mes */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => filtrarPorMes("")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                !mesActivo
                  ? "bg-emerald-500 text-slate-900"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              Todo
            </button>
            {mesesDisponibles.map((m) => (
              <button
                key={m}
                onClick={() => filtrarPorMes(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mesActivo === m
                    ? "bg-emerald-500 text-slate-900"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {m.charAt(0) + m.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── KPIs Principales ─────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Ingresos Totales"
            value={fmt(data.gran_total_ingresos)}
            sublabel={data.periodo}
            color="emerald"
            icon="↑"
          />
          <KPICard
            label="Egresos Totales"
            value={fmt(data.gran_total_gastos)}
            sublabel="Gastos operativos"
            color="rose"
            icon="↓"
          />
          <KPICard
            label="Utilidad Neta"
            value={fmt(data.utilidad_neta)}
            sublabel={`Margen ${pct(margenUtilidad)}`}
            color={data.utilidad_neta >= 0 ? "blue" : "amber"}
            icon="◆"
          />
          <KPICard
            label="⚠ Efectivo sin Depositar"
            value={fmt(data.efectivo_sin_depositar)}
            sublabel="Riesgo de fuga detectado"
            color="amber"
            icon="!"
            alert
          />
        </div>

        {/* ── Sucursales ───────────────────────────────────── */}
        <section>
          <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-4">
            Por Sucursal
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.sucursales.map((suc, i) => {
              const color = COLORES_SUCURSAL[i % COLORES_SUCURSAL.length];
              const margen =
                suc.total_ingresos > 0
                  ? (suc.utilidad_bruta / suc.total_ingresos) * 100
                  : 0;
              const porcentajeIngreso =
                data.gran_total_ingresos > 0
                  ? (suc.total_ingresos / data.gran_total_ingresos) * 100
                  : 0;

              return (
                <div
                  key={suc.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden"
                >
                  <div
                    className="absolute top-0 left-0 w-1 h-full rounded-l-xl"
                    style={{ backgroundColor: color }}
                  />

                  <div className="flex justify-between items-start mb-6 pl-3">
                    <div>
                      <span
                        className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                        style={{ backgroundColor: color + "22", color }}
                      >
                        {suc.serie_prefix}
                      </span>
                      <h3 className="text-white font-semibold text-lg mt-2">{suc.nombre}</h3>
                      <p className="text-slate-500 text-xs">{suc.num_transacciones} transacciones</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 text-xs">% del total</p>
                      <p className="text-white text-2xl font-bold">{pct(porcentajeIngreso)}</p>
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="pl-3 mb-6">
                    <div className="w-full bg-slate-800 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${porcentajeIngreso}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>

                  <div className="pl-3 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-slate-500 text-xs">Ingresos</p>
                      <p className="text-emerald-400 font-semibold">{fmt(suc.total_ingresos)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Gastos</p>
                      <p className="text-rose-400 font-semibold">{fmt(suc.total_gastos)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Margen</p>
                      <p
                        className={`font-semibold ${margen >= 0 ? "text-blue-400" : "text-amber-400"}`}
                      >
                        {pct(margen)}
                      </p>
                    </div>
                  </div>

                  {suc.efectivo_sin_depositar > 0 && (
                    <div className="mt-4 pl-3">
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
                        <span className="text-amber-400 text-sm">⚠</span>
                        <span className="text-amber-400 text-xs">
                          {fmt(suc.efectivo_sin_depositar)} en efectivo sin depositar
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Fila: Formas de pago + Top proveedores ───────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Formas de pago */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-5">
              Formas de Pago
            </h2>
            <div className="space-y-3">
              {data.formas_pago.map((fp, i) => (
                <div key={fp.forma} className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORES_PAGO[i % COLORES_PAGO.length] }}
                  />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">{fp.forma}</span>
                      <span className="text-slate-400 font-mono text-xs">{fmt(fp.total)}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1">
                      <div
                        className="h-1 rounded-full"
                        style={{
                          width: `${fp.porcentaje}%`,
                          backgroundColor: COLORES_PAGO[i % COLORES_PAGO.length],
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-slate-500 text-xs w-12 text-right">{pct(fp.porcentaje)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top proveedores */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-5">
              Principales Proveedores (Gastos)
            </h2>
            <div className="space-y-2">
              {data.top_proveedores.map((prov, i) => {
                const maxTotal = data.top_proveedores[0]?.total || 1;
                const pctProv = (prov.total / maxTotal) * 100;
                return (
                  <div key={prov.nombre} className="flex items-center gap-3">
                    <span className="text-slate-600 text-xs w-4 text-right">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-300 truncate max-w-[180px]" title={prov.nombre}>
                          {prov.nombre}
                        </span>
                        <span className="text-rose-400 font-mono text-xs">{fmt(prov.total)}</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1">
                        <div
                          className="h-1 rounded-full bg-rose-500/70"
                          style={{ width: `${pctProv}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Resumen mensual ──────────────────────────────── */}
        {data.resumen_mensual.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-5">
              Resumen por Mes
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs">
                    <th className="text-left pb-3 font-medium">Mes</th>
                    <th className="text-right pb-3 font-medium">Ingresos</th>
                    <th className="text-right pb-3 font-medium">Gastos</th>
                    <th className="text-right pb-3 font-medium">Utilidad</th>
                    <th className="text-right pb-3 font-medium">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.resumen_mensual.map((row) => {
                    const margen =
                      row.total_ingresos > 0
                        ? (row.utilidad / row.total_ingresos) * 100
                        : 0;
                    return (
                      <tr key={row.mes} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 text-white font-medium">
                          {row.mes.charAt(0) + row.mes.slice(1).toLowerCase()}
                        </td>
                        <td className="py-3 text-right text-emerald-400 font-mono">
                          {fmt(row.total_ingresos)}
                        </td>
                        <td className="py-3 text-right text-rose-400 font-mono">
                          {fmt(row.total_gastos)}
                        </td>
                        <td
                          className={`py-3 text-right font-mono font-semibold ${
                            row.utilidad >= 0 ? "text-blue-400" : "text-amber-400"
                          }`}
                        >
                          {fmt(row.utilidad)}
                        </td>
                        <td className="py-3 text-right text-slate-400 text-xs">
                          {pct(margen)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────── */}
        <footer className="text-center text-slate-700 text-xs pb-4">
          Datos actualizados en tiempo real · Vitana Labs © {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  );
}

// ── Componentes internos ──────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string;
  sublabel: string;
  color: "emerald" | "rose" | "blue" | "amber";
  icon: string;
  alert?: boolean;
}

const colorMap = {
  emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  rose: { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  blue: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
};

function KPICard({ label, value, sublabel, color, icon, alert }: KPICardProps) {
  const c = colorMap[color];
  return (
    <div
      className={`rounded-xl p-5 border ${c.bg} ${alert ? c.border : "border-slate-800"} bg-slate-900`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-slate-400 text-xs font-medium leading-tight">{label}</p>
        <span className={`text-lg ${c.text}`}>{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${c.text} leading-none mb-2`}>{value}</p>
      <p className="text-slate-600 text-xs">{sublabel}</p>
    </div>
  );
}
