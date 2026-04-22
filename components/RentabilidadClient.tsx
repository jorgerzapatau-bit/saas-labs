"use client";
// components/RentabilidadClient.tsx
// Vista de rentabilidad mensual: Ingresos - Gastos - Costos Fijos = Utilidad

import { useState, useMemo } from "react";
import type { CostoFijo } from "@/app/rentabilidad/page";

const MESES_ORDEN = [
  "ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
  "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE",
];

function fmt(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
}

function pct(utilidad: number, ingresos: number) {
  if (ingresos === 0) return "—";
  const p = (utilidad / ingresos) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

interface IngresoAgrupado {
  mes: string | null;
  sucursal_id: string | null;
  _sum: { total: number | null; subtotal: number | null; iva: number | null };
  _count: number;
}

interface GastoAgrupado {
  mes: string | null;
  sucursal_id: string | null;
  _sum: { total: number | null };
  _count: number;
}

interface Props {
  ingresos: IngresoAgrupado[];
  gastos: GastoAgrupado[];
  costosFijos: CostoFijo[];
  sucursales: { id: string; nombre: string }[];
}

export default function RentabilidadClient({ ingresos, gastos, costosFijos, sucursales }: Props) {
  const [sucursalFiltro, setSucursalFiltro] = useState<string>("todas");

  // Construir mapa mes → datos consolidados
  const filas = useMemo(() => {
    const mapa: Record<string, {
      mes: string;
      ingreso: number;
      gasto: number;
      costoFijo: number;
    }> = {};

    const agregarMes = (mes: string) => {
      if (!mapa[mes]) mapa[mes] = { mes, ingreso: 0, gasto: 0, costoFijo: 0 };
    };

    for (const ing of ingresos) {
      if (!ing.mes) continue;
      if (sucursalFiltro !== "todas" && ing.sucursal_id) {
        const suc = sucursales.find((s) => s.id === ing.sucursal_id);
        if (!suc || suc.nombre !== sucursalFiltro) continue;
      }
      agregarMes(ing.mes);
      mapa[ing.mes].ingreso += ing._sum.total ?? 0;
    }

    for (const gas of gastos) {
      if (!gas.mes) continue;
      if (sucursalFiltro !== "todas" && gas.sucursal_id) {
        const suc = sucursales.find((s) => s.id === gas.sucursal_id);
        if (!suc || suc.nombre !== sucursalFiltro) continue;
      }
      agregarMes(gas.mes);
      mapa[gas.mes].gasto += gas._sum.total ?? 0;
    }

    for (const cf of costosFijos) {
      const mes = cf.mes;
      if (!mes) continue;
      if (sucursalFiltro !== "todas") {
        if (!cf.sucursal || cf.sucursal.nombre !== sucursalFiltro) continue;
      }
      agregarMes(mes);
      mapa[mes].costoFijo += cf.monto;
    }

    return Object.values(mapa).sort((a, b) => {
      const ia = MESES_ORDEN.indexOf(a.mes);
      const ib = MESES_ORDEN.indexOf(b.mes);
      return ib - ia; // más reciente primero
    });
  }, [ingresos, gastos, costosFijos, sucursales, sucursalFiltro]);

  const totales = useMemo(() => {
    return filas.reduce(
      (acc, f) => ({
        ingreso:   acc.ingreso   + f.ingreso,
        gasto:     acc.gasto     + f.gasto,
        costoFijo: acc.costoFijo + f.costoFijo,
      }),
      { ingreso: 0, gasto: 0, costoFijo: 0 }
    );
  }, [filas]);

  const utilidadTotal = totales.ingreso - totales.gasto - totales.costoFijo;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Rentabilidad</h1>
          <p className="text-slate-400 text-sm mt-1">Ingresos − Gastos − Costos Fijos = Utilidad neta por mes</p>
        </div>
        <select
          value={sucursalFiltro}
          onChange={(e) => setSucursalFiltro(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="todas">Todas las sucursales</option>
          {sucursales.map((s) => (
            <option key={s.id} value={s.nombre}>{s.nombre}</option>
          ))}
        </select>
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Ingresos totales",   value: totales.ingreso,                            color: "text-emerald-400" },
          { label: "Gastos variables",   value: totales.gasto,                              color: "text-red-400"     },
          { label: "Costos fijos",       value: totales.costoFijo,                          color: "text-amber-400"   },
          { label: "Utilidad neta",      value: utilidadTotal,                              color: utilidadTotal >= 0 ? "text-emerald-400" : "text-red-400" },
        ].map((card) => (
          <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wider">{card.label}</p>
            <p className={`text-xl font-bold mt-1 ${card.color}`}>{fmt(card.value)}</p>
          </div>
        ))}
      </div>

      {/* Tabla mensual */}
      {filas.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <p className="text-slate-500 text-lg">Sin datos suficientes</p>
          <p className="text-slate-600 text-sm mt-1">
            Se necesitan registros en <code>transacciones</code>, <code>gastos</code> o <code>costos_fijos_mensuales</code>
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase border-b border-slate-800 bg-slate-800/40">
                <th className="text-left px-5 py-3">Mes</th>
                <th className="text-right px-5 py-3 text-emerald-400">Ingresos</th>
                <th className="text-right px-5 py-3 text-red-400">Gastos</th>
                <th className="text-right px-5 py-3 text-amber-400">Costos Fijos</th>
                <th className="text-right px-5 py-3 text-white">Utilidad</th>
                <th className="text-right px-5 py-3">Margen</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const utilidad = f.ingreso - f.gasto - f.costoFijo;
                const positivo = utilidad >= 0;
                return (
                  <tr key={f.mes} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-5 py-3 text-white font-medium capitalize">
                      {f.mes.charAt(0) + f.mes.slice(1).toLowerCase()}
                    </td>
                    <td className="px-5 py-3 text-right text-emerald-300">{fmt(f.ingreso)}</td>
                    <td className="px-5 py-3 text-right text-red-300">{fmt(f.gasto)}</td>
                    <td className="px-5 py-3 text-right text-amber-300">{fmt(f.costoFijo)}</td>
                    <td className={`px-5 py-3 text-right font-bold ${positivo ? "text-emerald-400" : "text-red-400"}`}>
                      {fmt(utilidad)}
                    </td>
                    <td className={`px-5 py-3 text-right text-xs font-semibold ${positivo ? "text-emerald-500" : "text-red-500"}`}>
                      {pct(utilidad, f.ingreso)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-700 bg-slate-800/40">
                <td className="px-5 py-3 text-slate-300 font-bold text-xs uppercase">Total</td>
                <td className="px-5 py-3 text-right text-emerald-400 font-bold">{fmt(totales.ingreso)}</td>
                <td className="px-5 py-3 text-right text-red-400 font-bold">{fmt(totales.gasto)}</td>
                <td className="px-5 py-3 text-right text-amber-400 font-bold">{fmt(totales.costoFijo)}</td>
                <td className={`px-5 py-3 text-right font-black ${utilidadTotal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {fmt(utilidadTotal)}
                </td>
                <td className={`px-5 py-3 text-right text-xs font-bold ${utilidadTotal >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {pct(utilidadTotal, totales.ingreso)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Detalle costos fijos */}
      {costosFijos.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-800/60 border-b border-slate-700">
            <h2 className="text-white font-semibold text-sm uppercase tracking-wider">Detalle Costos Fijos</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase border-b border-slate-800">
                <th className="text-left px-5 py-3">Concepto</th>
                <th className="text-left px-5 py-3">Categoría</th>
                <th className="text-left px-5 py-3">Mes</th>
                <th className="text-left px-5 py-3">Sucursal</th>
                <th className="text-right px-5 py-3 text-amber-400">Monto</th>
              </tr>
            </thead>
            <tbody>
              {costosFijos
                .filter((cf) =>
                  sucursalFiltro === "todas" ||
                  !cf.sucursal ||
                  cf.sucursal.nombre === sucursalFiltro
                )
                .slice(0, 50)
                .map((cf) => (
                  <tr key={cf.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-5 py-3 text-white">{cf.concepto}</td>
                    <td className="px-5 py-3">
                      {cf.categoria ? (
                        <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded">
                          {cf.categoria}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-400 capitalize">
                      {cf.mes.charAt(0) + cf.mes.slice(1).toLowerCase()} {cf.anio}
                    </td>
                    <td className="px-5 py-3 text-slate-400">{cf.sucursal?.nombre ?? "General"}</td>
                    <td className="px-5 py-3 text-right text-amber-300 font-semibold">{fmt(cf.monto)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
