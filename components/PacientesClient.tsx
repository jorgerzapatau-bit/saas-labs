"use client";
// components/PacientesClient.tsx
// Pantalla /pacientes — Pacientes e ingresos diarios por sucursal
// Gráfica de barras comparativa Esperanza vs Progreso

import { useState, useEffect, useCallback } from "react";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(n);

const fmtK = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : fmt(n);

const MESES_ORDEN = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];

const COLOR_ESP  = "#10b981"; // emerald-500
const COLOR_PROG = "#3b82f6"; // blue-500

interface SucursalResumen {
  id: string; nombre: string; serie_prefix: string;
  total_pacientes: number; total_ingresos: number; dias: number; max_pacientes: number;
}
interface MesData { mes_num: number; mes: string; sucursales: SucursalResumen[] }
interface DetalleDia { dia: number; sucursal_id: string; num_pacientes: number; ingreso_dia: number }
interface ApiData {
  sucursales: { id: string; nombre: string; serie_prefix: string }[];
  meses: MesData[];
  detalleDiario: DetalleDia[];
  totalPacientes: number;
  totalIngresos: number;
  anio: number;
  mesNum: number | null;
}

// ── Mini BarChart ─────────────────────────────────────────────
const CHART_H = 160; // px — altura del área de barras

function BarChart({ data, sucursales }: { data: MesData[]; sucursales: ApiData["sucursales"] }) {
  const maxPac = Math.max(...data.flatMap((m) => m.sucursales.map((s) => s.total_pacientes)), 1);

  return (
    <div className="w-full">
      {/* Área de barras con altura fija en px */}
      <div className="flex items-end gap-2" style={{ height: CHART_H }}>
        {data.map((mes) => (
          <div key={mes.mes_num} className="flex-1 flex items-end justify-center gap-1" style={{ height: "100%" }}>
            {sucursales.map((suc, i) => {
              const resumen = mes.sucursales.find((s) => s.id === suc.id);
              const val    = resumen?.total_pacientes || 0;
              const barH   = val > 0 ? Math.max(Math.round((val / maxPac) * CHART_H), 6) : 0;
              const color  = i === 0 ? COLOR_ESP : COLOR_PROG;
              return (
                <div
                  key={suc.id}
                  className="relative group flex-1 max-w-[28px]"
                  style={{ height: barH, backgroundColor: color, borderRadius: "3px 3px 0 0", cursor: "default" }}
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 border border-slate-700">
                    <p className="font-medium">{suc.nombre.split(" ")[0]}</p>
                    <p>{val} pac.</p>
                    <p>{fmtK(resumen?.total_ingresos || 0)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Etiquetas de mes debajo */}
      <div className="flex gap-2 mt-1">
        {data.map((mes) => (
          <div key={mes.mes_num} className="flex-1 text-center">
            <span className="text-slate-500 text-[10px]">{mes.mes.slice(0, 3)}</span>
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 mt-3">
        {sucursales.map((suc, i) => (
          <div key={suc.id} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: i === 0 ? COLOR_ESP : COLOR_PROG }} />
            <span className="text-slate-400 text-xs">{suc.nombre}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Gráfica de ingresos por mes ───────────────────────────────
function IngresosChart({ data, sucursales }: { data: MesData[]; sucursales: ApiData["sucursales"] }) {
  const maxIng = Math.max(...data.flatMap((m) => m.sucursales.map((s) => s.total_ingresos)), 1);

  return (
    <div className="w-full">
      <div className="flex items-end gap-2" style={{ height: CHART_H }}>
        {data.map((mes) => (
          <div key={mes.mes_num} className="flex-1 flex items-end justify-center gap-1" style={{ height: "100%" }}>
            {sucursales.map((suc, i) => {
              const resumen = mes.sucursales.find((s) => s.id === suc.id);
              const val    = resumen?.total_ingresos || 0;
              const barH   = val > 0 ? Math.max(Math.round((val / maxIng) * CHART_H), 6) : 0;
              const color  = i === 0 ? COLOR_ESP : COLOR_PROG;
              return (
                <div
                  key={suc.id}
                  className="relative group flex-1 max-w-[28px]"
                  style={{ height: barH, backgroundColor: color, borderRadius: "3px 3px 0 0", opacity: 0.8, cursor: "default" }}
                >
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 border border-slate-700">
                    <p>{suc.nombre.split(" ")[0]}</p>
                    <p>{fmt(val)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-1">
        {data.map((mes) => (
          <div key={mes.mes_num} className="flex-1 text-center">
            <span className="text-slate-500 text-[10px]">{mes.mes.slice(0, 3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Heatmap diario ────────────────────────────────────────────
function HeatmapDiario({ detalle, sucursales, mesLabel }: { detalle: DetalleDia[]; sucursales: ApiData["sucursales"]; mesLabel: string }) {
  if (!detalle.length) return null;

  const maxPac = Math.max(...detalle.map((d) => d.num_pacientes), 1);

  const diasPorSuc: Record<string, Record<number, DetalleDia>> = {};
  for (const d of detalle) {
    if (!diasPorSuc[d.sucursal_id]) diasPorSuc[d.sucursal_id] = {};
    diasPorSuc[d.sucursal_id][d.dia] = d;
  }

  const dias = Array.from(new Set(detalle.map((d) => d.dia))).sort((a, b) => a - b);

  return (
    <div className="mt-6">
      <h3 className="text-slate-300 text-sm font-medium mb-3">Detalle diario · {mesLabel}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-y-1">
          <thead>
            <tr>
              <th className="text-left text-slate-500 font-normal pb-2 pr-3 w-24">Sucursal</th>
              {dias.map((d) => (
                <th key={d} className="text-center text-slate-500 font-normal pb-2 w-8">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sucursales.map((suc, i) => (
              <tr key={suc.id}>
                <td className="text-slate-400 pr-3 py-1 font-medium text-[11px]">
                  <span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ backgroundColor: i === 0 ? COLOR_ESP : COLOR_PROG }} />
                  {suc.nombre.split(" ")[0]}
                </td>
                {dias.map((d) => {
                  const cell = diasPorSuc[suc.id]?.[d];
                  const pac = cell?.num_pacientes || 0;
                  const intensity = pac > 0 ? 0.15 + (pac / maxPac) * 0.85 : 0;
                  const bg = i === 0
                    ? `rgba(16,185,129,${intensity})`
                    : `rgba(59,130,246,${intensity})`;
                  return (
                    <td key={d} className="text-center py-1 group relative">
                      <div
                        className="mx-auto w-7 h-6 rounded flex items-center justify-center text-[10px] font-medium cursor-default transition-opacity hover:opacity-70"
                        style={{ backgroundColor: pac > 0 ? bg : "transparent", color: pac > 0 ? "white" : "#475569" }}
                        title={pac > 0 ? `${pac} pac · ${fmt(cell?.ingreso_dia || 0)}` : "Sin actividad"}
                      >
                        {pac > 0 ? pac : "·"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function PacientesClient() {
  const [data, setData]       = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mesNum, setMesNum]   = useState<number | null>(null);
  const [tab, setTab]         = useState<"pacientes" | "ingresos">("pacientes");

  const load = useCallback(async (mesSeleccionado: number | null) => {
    setLoading(true);
    const params = new URLSearchParams({ anio: "2026" });
    if (mesSeleccionado) params.set("mes_num", String(mesSeleccionado));
    const res = await fetch(`/api/pacientes?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => { load(mesNum); }, [mesNum, load]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-500 text-sm animate-pulse">Cargando pacientes…</div>
      </div>
    );
  }

  if (!data) return null;

  const mesActivo = data.meses.find((m) => m.mes_num === mesNum);
  const mesLabel  = mesActivo?.mes || "Todo el período";

  // Totales por sucursal (globales o del mes)
  const totalSuc = data.sucursales.map((suc) => {
    let pacientes = 0, ingresos = 0, dias = 0, maxDia = 0;
    if (mesNum && mesActivo) {
      const r = mesActivo.sucursales.find((s) => s.id === suc.id);
      pacientes = r?.total_pacientes || 0;
      ingresos  = r?.total_ingresos  || 0;
      dias      = r?.dias            || 0;
      maxDia    = r?.max_pacientes   || 0;
    } else {
      data.meses.forEach((m) => {
        const r = m.sucursales.find((s) => s.id === suc.id);
        if (r) { pacientes += r.total_pacientes; ingresos += r.total_ingresos; dias += r.dias; if (r.max_pacientes > maxDia) maxDia = r.max_pacientes; }
      });
    }
    return { ...suc, pacientes, ingresos, dias, maxDia };
  });

  const totalPacientesVis = totalSuc.reduce((s, r) => s + r.pacientes, 0);
  const totalIngresosVis  = totalSuc.reduce((s, r) => s + r.ingresos, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ── Header ── */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white font-semibold text-base leading-none">Pacientes & Rendimiento</h1>
            <p className="text-slate-500 text-xs mt-1">Atenciones diarias e ingresos por sucursal</p>
          </div>

          {/* Filtro de mes */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setMesNum(null)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mesNum === null ? "bg-emerald-500 text-slate-900" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              Todo
            </button>
            {data.meses.sort((a,b)=>a.mes_num-b.mes_num).map((m) => (
              <button
                key={m.mes_num}
                onClick={() => setMesNum(m.mes_num)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mesNum === m.mes_num ? "bg-emerald-500 text-slate-900" : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {m.mes.charAt(0) + m.mes.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <p className="text-slate-500 text-xs mb-1">Total pacientes</p>
            <p className="text-2xl font-bold text-white">{totalPacientesVis.toLocaleString()}</p>
            <p className="text-slate-500 text-xs mt-1">{mesLabel}</p>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <p className="text-slate-500 text-xs mb-1">Total ingresos</p>
            <p className="text-2xl font-bold text-emerald-400">{fmtK(totalIngresosVis)}</p>
            <p className="text-slate-500 text-xs mt-1">{mesLabel}</p>
          </div>
          {totalSuc.map((suc, i) => (
            <div key={suc.id} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: i === 0 ? COLOR_ESP : COLOR_PROG }} />
                <p className="text-slate-500 text-xs truncate">{suc.nombre}</p>
              </div>
              <p className="text-xl font-bold text-white">{suc.pacientes.toLocaleString()}</p>
              <p className="text-xs mt-1" style={{ color: i === 0 ? COLOR_ESP : COLOR_PROG }}>{fmtK(suc.ingresos)}</p>
            </div>
          ))}
        </div>

        {/* ── Comparativa por sucursal ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {totalSuc.map((suc, i) => {
            const pctTotal = totalPacientesVis > 0 ? (suc.pacientes / totalPacientesVis) * 100 : 0;
            const promDia  = suc.dias > 0 ? suc.pacientes / suc.dias : 0;
            const color    = i === 0 ? COLOR_ESP : COLOR_PROG;
            return (
              <div key={suc.id} className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: `${color}20`, color }}>
                      {i === 0 ? "E" : "P"}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{suc.nombre}</p>
                      <p className="text-slate-500 text-xs">{suc.serie_prefix}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">{pctTotal.toFixed(1)}% del total</span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <p className="text-slate-500 text-xs">Pacientes</p>
                    <p className="text-white font-semibold text-lg">{suc.pacientes.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Ingresos</p>
                    <p className="font-semibold text-lg" style={{ color }}>{fmtK(suc.ingresos)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Prom/día</p>
                    <p className="text-white font-semibold text-lg">{promDia.toFixed(1)}</p>
                  </div>
                </div>

                {/* Barra de participación */}
                <div className="w-full bg-slate-800 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${pctTotal}%`, backgroundColor: color }} />
                </div>
                <div className="flex justify-between mt-1">
                  <p className="text-slate-600 text-xs">Participación vs total</p>
                  <p className="text-slate-500 text-xs">{suc.dias} días con actividad</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Gráfica comparativa por mes ── */}
        {data.meses.length > 0 && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-medium text-sm">Comparativa mensual</h2>
                <p className="text-slate-500 text-xs mt-0.5">Esperanza vs Progreso · 2026</p>
              </div>
              <div className="flex gap-1 p-1 bg-slate-800 rounded-lg">
                <button
                  onClick={() => setTab("pacientes")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${tab === "pacientes" ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}
                >
                  Pacientes
                </button>
                <button
                  onClick={() => setTab("ingresos")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${tab === "ingresos" ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}
                >
                  Ingresos
                </button>
              </div>
            </div>

            {tab === "pacientes" ? (
              <BarChart data={data.meses} sucursales={data.sucursales} />
            ) : (
              <IngresosChart data={data.meses} sucursales={data.sucursales} />
            )}

            {/* Tabla resumen */}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs">
                    <th className="text-left font-normal pb-2">Mes</th>
                    {data.sucursales.map((suc) => (
                      <th key={suc.id} className="text-right font-normal pb-2 px-3">{suc.nombre.split(" ")[0]}</th>
                    ))}
                    <th className="text-right font-normal pb-2 pl-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.meses.sort((a,b)=>a.mes_num-b.mes_num).map((m) => {
                    const mesTotal = m.sucursales.reduce((s, r) => s + (tab === "pacientes" ? r.total_pacientes : r.total_ingresos), 0);
                    return (
                      <tr
                        key={m.mes_num}
                        onClick={() => setMesNum(mesNum === m.mes_num ? null : m.mes_num)}
                        className={`cursor-pointer transition-colors ${mesNum === m.mes_num ? "bg-emerald-500/10" : "hover:bg-slate-800/50"}`}
                      >
                        <td className="py-2.5 text-slate-300 text-xs font-medium">
                          {m.mes.charAt(0) + m.mes.slice(1).toLowerCase()}
                        </td>
                        {data.sucursales.map((suc, i) => {
                          const r = m.sucursales.find((s) => s.id === suc.id);
                          const val = tab === "pacientes" ? (r?.total_pacientes || 0) : (r?.total_ingresos || 0);
                          return (
                            <td key={suc.id} className="py-2.5 text-right px-3 text-xs font-medium" style={{ color: i === 0 ? COLOR_ESP : COLOR_PROG }}>
                              {tab === "pacientes" ? val.toLocaleString() : fmtK(val)}
                            </td>
                          );
                        })}
                        <td className="py-2.5 text-right pl-3 text-xs font-medium text-white">
                          {tab === "pacientes" ? mesTotal.toLocaleString() : fmtK(mesTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Heatmap diario (solo cuando hay mes seleccionado) ── */}
        {mesNum && data.detalleDiario.length > 0 && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <HeatmapDiario detalle={data.detalleDiario} sucursales={data.sucursales} mesLabel={mesLabel} />
          </div>
        )}

        {mesNum && data.detalleDiario.length === 0 && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center">
            <p className="text-slate-500 text-sm">No hay detalle diario para {mesLabel}</p>
          </div>
        )}

      </div>
    </div>
  );
}
