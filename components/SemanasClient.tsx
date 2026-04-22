"use client";
// components/SemanasClient.tsx
// Vista de ingresos semanales por forma de pago

import { useState, useMemo } from "react";
import type { SemanaSemanal } from "@/app/semanas/page";

const MESES_ORDEN = [
  "ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
  "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE",
];

function fmt(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
}

interface Props {
  data: SemanaSemanal[];
  sucursales: { id: string; nombre: string }[];
}

export default function SemanasClient({ data, sucursales }: Props) {
  const [sucursalFiltro, setSucursalFiltro] = useState<string>("todas");
  const [anioFiltro, setAnioFiltro]         = useState<string>("todos");

  const anios = useMemo(() => {
    const set = new Set(data.map((d) => d.anio));
    return Array.from(set).sort((a, b) => b - a);
  }, [data]);

  const filtrado = useMemo(() => {
    return data.filter((d) => {
      if (sucursalFiltro !== "todas" && d.sucursal?.nombre !== sucursalFiltro) return false;
      if (anioFiltro !== "todos" && String(d.anio) !== anioFiltro) return false;
      return true;
    });
  }, [data, sucursalFiltro, anioFiltro]);

  // Agrupar por anio > mes > semanas
  const agrupado = useMemo(() => {
    const mapa: Record<string, Record<string, SemanaSemanal[]>> = {};
    for (const row of filtrado) {
      const key = `${row.anio}-${row.mes}`;
      if (!mapa[key]) mapa[key] = {};
      const sk = row.semana_codigo;
      if (!mapa[key][sk]) mapa[key][sk] = [];
      mapa[key][sk].push(row);
    }
    // Ordenar mes desc
    const grupos = Object.entries(mapa).map(([key, semanas]) => {
      const [anioStr, mes] = key.split("-");
      return { anio: Number(anioStr), mes, semanas };
    });
    grupos.sort((a, b) => {
      if (b.anio !== a.anio) return b.anio - a.anio;
      return MESES_ORDEN.indexOf(b.mes) - MESES_ORDEN.indexOf(a.mes);
    });
    return grupos;
  }, [filtrado]);

  const totales = useMemo(() => ({
    tarjeta:       filtrado.reduce((s, d) => s + d.tarjeta, 0),
    efectivo:      filtrado.reduce((s, d) => s + d.efectivo, 0),
    transferencia: filtrado.reduce((s, d) => s + d.transferencia, 0),
    total:         filtrado.reduce((s, d) => s + d.total, 0),
  }), [filtrado]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ingresos Semanales</h1>
          <p className="text-slate-400 text-sm mt-1">Desglose por forma de pago semana a semana</p>
        </div>
        {/* Filtros */}
        <div className="flex gap-3">
          <select
            value={anioFiltro}
            onChange={(e) => setAnioFiltro(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="todos">Todos los años</option>
            {anios.map((a) => (
              <option key={a} value={String(a)}>{a}</option>
            ))}
          </select>
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
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total general",  value: totales.total,         color: "text-emerald-400" },
          { label: "Tarjeta",        value: totales.tarjeta,       color: "text-blue-400"    },
          { label: "Efectivo",       value: totales.efectivo,      color: "text-amber-400"   },
          { label: "Transferencia",  value: totales.transferencia, color: "text-purple-400"  },
        ].map((card) => (
          <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs uppercase tracking-wider">{card.label}</p>
            <p className={`text-xl font-bold mt-1 ${card.color}`}>{fmt(card.value)}</p>
          </div>
        ))}
      </div>

      {/* Tabla por mes */}
      {agrupado.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <p className="text-slate-500 text-lg">Sin datos de ingresos semanales</p>
          <p className="text-slate-600 text-sm mt-1">Importa registros en la tabla <code>ingresos_semanales</code></p>
        </div>
      ) : (
        agrupado.map(({ anio, mes, semanas }) => {
          const rows = Object.entries(semanas).sort(([a], [b]) => a.localeCompare(b));
          const subtotal = rows.reduce((s, [, arr]) => {
            return s + arr.reduce((ss, r) => ss + r.total, 0);
          }, 0);

          return (
            <div key={`${anio}-${mes}`} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {/* Cabecera mes */}
              <div className="flex items-center justify-between px-5 py-3 bg-slate-800/60 border-b border-slate-700">
                <h2 className="text-white font-semibold text-sm uppercase tracking-wider">
                  {mes} {anio}
                </h2>
                <span className="text-emerald-400 font-bold text-sm">{fmt(subtotal)}</span>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs uppercase border-b border-slate-800">
                    <th className="text-left px-5 py-3">Semana</th>
                    <th className="text-left px-5 py-3">Sucursal</th>
                    <th className="text-right px-5 py-3 text-blue-400">Tarjeta</th>
                    <th className="text-right px-5 py-3 text-amber-400">Efectivo</th>
                    <th className="text-right px-5 py-3 text-purple-400">Transferencia</th>
                    <th className="text-right px-5 py-3 text-emerald-400">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.flatMap(([semana, arr]) =>
                    arr.map((r, i) => (
                      <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        {i === 0 ? (
                          <td className="px-5 py-3 text-white font-medium" rowSpan={arr.length}>
                            {semana.replace("SEMANA", "Semana ")}
                          </td>
                        ) : null}
                        <td className="px-5 py-3 text-slate-400">{r.sucursal?.nombre ?? "—"}</td>
                        <td className="px-5 py-3 text-right text-blue-300">{fmt(r.tarjeta)}</td>
                        <td className="px-5 py-3 text-right text-amber-300">{fmt(r.efectivo)}</td>
                        <td className="px-5 py-3 text-right text-purple-300">{fmt(r.transferencia)}</td>
                        <td className="px-5 py-3 text-right text-emerald-400 font-semibold">{fmt(r.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}
