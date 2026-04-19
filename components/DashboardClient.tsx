"use client";
// components/DashboardClient.tsx

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DashboardData } from "@/types";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(n);

const pct = (n: number) => `${n.toFixed(1)}%`;

const MESES = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];

const COLORES_PAGO = ["#0088FE","#00C49F","#FFBB28","#FF8042","#A28DFF","#FF6B9D"];

interface Props {
  data: DashboardData;
}

export default function DashboardClient({ data }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mesFiltro, setMesFiltro] = useState(searchParams.get("mes") || "");

  function aplicarFiltro(mes: string) {
    setMesFiltro(mes);
    const params = new URLSearchParams(searchParams.toString());
    if (mes) params.set("mes", mes);
    else params.delete("mes");
    router.push(`/dashboard?${params.toString()}`);
  }

  const margenPct = data.gran_total_ingresos > 0
    ? (data.utilidad_neta / data.gran_total_ingresos) * 100
    : 0;

  const maxIngreso = Math.max(...data.resumen_mensual.map((m) => m.total_ingresos), 1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard General</h1>
          <p className="text-sm text-slate-400 mt-0.5">Período: {data.periodo}</p>
        </div>
        <select
          value={mesFiltro}
          onChange={(e) => aplicarFiltro(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todo el período</option>
          {MESES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Ingresos" value={fmt(data.gran_total_ingresos)} color="text-emerald-400" icon="↑" />
          <KpiCard label="Total Gastos" value={fmt(data.gran_total_gastos)} color="text-red-400" icon="↓" />
          <KpiCard label="Utilidad Neta" value={fmt(data.utilidad_neta)} color={data.utilidad_neta >= 0 ? "text-blue-400" : "text-orange-400"} icon="◎" />
          <KpiCard label="Margen Neto" value={pct(margenPct)} color={margenPct >= 0 ? "text-purple-400" : "text-orange-400"} icon="%" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Rendimiento por Sucursal</h2>
            <div className="space-y-3">
              {data.sucursales.map((suc) => {
                const margen = suc.total_ingresos > 0 ? (suc.utilidad_bruta / suc.total_ingresos) * 100 : 0;
                return (
                  <div key={suc.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-white">{suc.nombre}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{suc.num_transacciones} transacciones · {pct(margen)} margen</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-400">{fmt(suc.total_ingresos)}</p>
                      <p className="text-xs text-red-400">{fmt(suc.total_gastos)}</p>
                    </div>
                  </div>
                );
              })}
              {data.sucursales.length === 0 && <p className="text-slate-500 text-sm">Sin datos</p>}
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Formas de Pago</h2>
            <div className="space-y-3">
              {data.formas_pago.map((fp, i) => (
                <div key={fp.forma}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{fp.forma}</span>
                    <span className="text-slate-400">{fmt(fp.total)} · {pct(fp.porcentaje)}</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${fp.porcentaje}%`, backgroundColor: COLORES_PAGO[i % COLORES_PAGO.length] }} />
                  </div>
                </div>
              ))}
              {data.formas_pago.length === 0 && <p className="text-slate-500 text-sm">Sin datos</p>}
            </div>
          </div>
        </div>

        {data.resumen_mensual.length > 0 && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Evolución Mensual</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-800">
                    <th className="pb-2 pr-4 font-medium">Mes</th>
                    <th className="pb-2 pr-4 font-medium text-right">Ingresos</th>
                    <th className="pb-2 pr-4 font-medium text-right">Gastos</th>
                    <th className="pb-2 font-medium text-right">Utilidad</th>
                    <th className="pb-2 pl-4 font-medium">Tendencia</th>
                  </tr>
                </thead>
                <tbody>
                  {data.resumen_mensual.map((row) => (
                    <tr key={row.mes} className="border-b border-slate-800/50 last:border-0">
                      <td className="py-2 pr-4 text-white font-medium">{row.mes}</td>
                      <td className="py-2 pr-4 text-right text-emerald-400">{fmt(row.total_ingresos)}</td>
                      <td className="py-2 pr-4 text-right text-red-400">{fmt(row.total_gastos)}</td>
                      <td className={`py-2 text-right font-semibold ${row.utilidad >= 0 ? "text-blue-400" : "text-orange-400"}`}>{fmt(row.utilidad)}</td>
                      <td className="py-2 pl-4">
                        <div className="h-2 bg-slate-800 rounded-full w-32 overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(row.total_ingresos / maxIngreso) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Top Proveedores por Gasto</h2>
            <div className="space-y-2">
              {data.top_proveedores.map((prov, i) => (
                <div key={prov.nombre} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 w-4">{i + 1}</span>
                    <span className="text-sm text-slate-300 truncate max-w-xs">{prov.nombre}</span>
                  </div>
                  <span className="text-sm font-medium text-red-400">{fmt(prov.total)}</span>
                </div>
              ))}
              {data.top_proveedores.length === 0 && <p className="text-slate-500 text-sm">Sin datos</p>}
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Efectivo Pendiente de Depósito</h2>
            <div className="flex flex-col items-center justify-center h-32">
              <p className="text-4xl font-bold text-orange-400">{fmt(data.efectivo_sin_depositar)}</p>
              <p className="text-sm text-slate-500 mt-2">Efectivo sin depositar</p>
              {data.sucursales.filter((s) => s.efectivo_sin_depositar > 0).map((s) => (
                <p key={s.id} className="text-xs text-slate-600 mt-1">{s.nombre}: {fmt(s.efectivo_sin_depositar)}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
        <span className={`text-lg ${color}`}>{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
