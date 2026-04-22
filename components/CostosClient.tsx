"use client";
// components/CostosClient.tsx
// Pantalla /costos — Costos fijos con desglose por categoría y comparativa entre sucursales

import { useState, useEffect, useCallback } from "react";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(n);

const fmtK = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : fmt(n);

const CATEGORIA_COLORES: Record<string, string> = {
  NOMINA:    "#10b981",
  MAQUILA:   "#3b82f6",
  SERVICIOS: "#f59e0b",
  RENTA:     "#8b5cf6",
  SOFTWARE:  "#06b6d4",
  OTROS:     "#64748b",
};

function catColor(cat: string) {
  return CATEGORIA_COLORES[cat?.toUpperCase()] || CATEGORIA_COLORES.OTROS;
}

interface Concepto { concepto: string; categoria: string; monto: number; mes?: string; mes_num?: number }
interface SucursalData {
  id: string; nombre: string; serie_prefix: string;
  total: number; conceptos: Concepto[];
}
interface CatData { categoria: string; total: number }
interface MesData { mes_num: number; mes: string }
interface ApiData {
  sucursales: { id: string; nombre: string; serie_prefix: string }[];
  costos: { id: string; sucursal_id: string | null; concepto: string; categoria: string | null; monto: number; mes: string; mes_num: number }[];
  porCategoria: CatData[];
  totalesPorSucursal: SucursalData[];
  meses: MesData[];
  totalGeneral: number;
  anio: number;
}

// ── Donut chart SVG ───────────────────────────────────────────
function DonutChart({ data }: { data: CatData[] }) {
  const total = data.reduce((s, d) => s + d.total, 0);
  if (total === 0) return null;

  let cumulativeAngle = -90;
  const cx = 80, cy = 80, r = 60, innerR = 38;
  const slices = data.map((d) => {
    const pct   = d.total / total;
    const angle = pct * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    const endAngle = cumulativeAngle;

    const toRad = (a: number) => (a * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startAngle));
    const y1 = cy + r * Math.sin(toRad(startAngle));
    const x2 = cx + r * Math.cos(toRad(endAngle));
    const y2 = cy + r * Math.sin(toRad(endAngle));
    const xi1 = cx + innerR * Math.cos(toRad(startAngle));
    const yi1 = cy + innerR * Math.sin(toRad(startAngle));
    const xi2 = cx + innerR * Math.cos(toRad(endAngle));
    const yi2 = cy + innerR * Math.sin(toRad(endAngle));
    const largeArc = angle > 180 ? 1 : 0;

    return {
      ...d, pct,
      path: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${xi1} ${yi1} Z`,
    };
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 160 160" className="w-40 h-40 flex-shrink-0">
        {slices.map((s) => (
          <path key={s.categoria} d={s.path} fill={catColor(s.categoria)} className="hover:opacity-80 transition-opacity cursor-default">
            <title>{s.categoria}: {fmt(s.total)} ({(s.pct * 100).toFixed(1)}%)</title>
          </path>
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" className="text-xs" fill="#94a3b8" fontSize="9">Total</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="white" fontSize="11" fontWeight="600">{fmtK(total)}</text>
      </svg>

      {/* Leyenda */}
      <div className="space-y-1.5 flex-1 min-w-0">
        {data.map((d) => {
          const pct = total > 0 ? (d.total / total) * 100 : 0;
          return (
            <div key={d.categoria} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: catColor(d.categoria) }} />
              <span className="text-slate-400 text-xs flex-1 truncate">{d.categoria}</span>
              <span className="text-slate-300 text-xs font-medium">{fmtK(d.total)}</span>
              <span className="text-slate-600 text-xs w-10 text-right">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Barra comparativa horizontal ─────────────────────────────
function BarraComparativa({ suc, maxTotal }: { suc: SucursalData; maxTotal: number }) {
  const pct = maxTotal > 0 ? (suc.total / maxTotal) * 100 : 0;
  const isEsp = suc.serie_prefix.toLowerCase().includes("vit");
  const color = isEsp ? "#10b981" : "#3b82f6";

  return (
    <div className="flex items-center gap-3">
      <p className="text-slate-400 text-xs w-20 flex-shrink-0">{suc.nombre.split(" ")[0]}</p>
      <div className="flex-1 bg-slate-800 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="text-white text-xs font-medium w-14 text-right">{fmtK(suc.total)}</p>
    </div>
  );
}

// ── Tabla de conceptos ────────────────────────────────────────
function TablaConceptos({ conceptos, titulo }: { conceptos: Concepto[]; titulo: string }) {
  const [expandida, setExpandida] = useState(false);
  const sorted = [...conceptos].sort((a, b) => b.monto - a.monto);
  const visible = expandida ? sorted : sorted.slice(0, 8);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-slate-300 text-sm font-medium">{titulo}</h3>
        <span className="text-slate-600 text-xs">{conceptos.length} conceptos</span>
      </div>
      <div className="space-y-1">
        {visible.map((c, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5 px-3 rounded-lg hover:bg-slate-800/50 transition-colors">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: catColor(c.categoria) }} />
            <span className="text-slate-400 text-xs flex-1 truncate">{c.concepto}</span>
            {c.mes && <span className="text-slate-600 text-[10px] hidden sm:block">{c.mes.charAt(0)+c.mes.slice(1).toLowerCase()}</span>}
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${catColor(c.categoria)}20`, color: catColor(c.categoria) }}>
              {c.categoria || "OTROS"}
            </span>
            <span className="text-white text-xs font-medium w-16 text-right">{fmt(c.monto)}</span>
          </div>
        ))}
      </div>
      {sorted.length > 8 && (
        <button
          onClick={() => setExpandida(!expandida)}
          className="mt-2 w-full text-center text-slate-600 text-xs hover:text-slate-400 transition-colors py-1"
        >
          {expandida ? "Mostrar menos ↑" : `Ver ${sorted.length - 8} más ↓`}
        </button>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function CostosClient() {
  const [data, setData]       = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mesNum, setMesNum]   = useState<number | null>(null);
  const [sucActiva, setSucActiva] = useState<string>("todas");

  const load = useCallback(async (mes: number | null) => {
    setLoading(true);
    const params = new URLSearchParams({ anio: "2026" });
    if (mes) params.set("mes_num", String(mes));
    const res = await fetch(`/api/costos?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => { load(mesNum); }, [mesNum, load]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-500 text-sm animate-pulse">Cargando costos…</div>
      </div>
    );
  }
  if (!data) return null;

  const maxTotal = Math.max(...data.totalesPorSucursal.map((s) => s.total), 1);

  // Filtrar conceptos según sucursal activa
  const conceptosFiltrados = sucActiva === "todas"
    ? data.totalesPorSucursal.flatMap((s) => s.conceptos)
    : (data.totalesPorSucursal.find((s) => s.id === sucActiva)?.conceptos || []);

  // Donut data según filtro
  const donutData = sucActiva === "todas"
    ? data.porCategoria
    : (() => {
        const suc = data.totalesPorSucursal.find((s) => s.id === sucActiva);
        if (!suc) return data.porCategoria;
        const catMap = new Map<string, number>();
        suc.conceptos.forEach((c) => { const cat = c.categoria || "OTROS"; catMap.set(cat, (catMap.get(cat) || 0) + c.monto); });
        return Array.from(catMap.entries()).map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total);
      })();

  const totalVis = sucActiva === "todas"
    ? data.totalGeneral
    : (data.totalesPorSucursal.find((s) => s.id === sucActiva)?.total || 0);

  const mesLabel = data.meses.find((m) => m.mes_num === mesNum)?.mes || "Todo el período";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ── Header ── */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white font-semibold text-base leading-none">Costos Operativos</h1>
            <p className="text-slate-500 text-xs mt-1">Costos fijos por categoría y sucursal</p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setMesNum(null)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mesNum === null ? "bg-amber-500 text-slate-900" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              Todo
            </button>
            {data.meses.map((m) => (
              <button
                key={m.mes_num}
                onClick={() => setMesNum(m.mes_num)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mesNum === m.mes_num ? "bg-amber-500 text-slate-900" : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {m.mes.charAt(0) + m.mes.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <p className="text-slate-500 text-xs mb-1">Total costos</p>
            <p className="text-2xl font-bold text-amber-400">{fmtK(data.totalGeneral)}</p>
            <p className="text-slate-500 text-xs mt-1">{mesLabel}</p>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <p className="text-slate-500 text-xs mb-1">Conceptos</p>
            <p className="text-2xl font-bold text-white">{data.costos.length}</p>
            <p className="text-slate-500 text-xs mt-1">{data.porCategoria.length} categorías</p>
          </div>
          {data.totalesPorSucursal.slice(0, 2).map((suc, i) => (
            <div key={suc.id} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: i === 0 ? "#10b981" : "#3b82f6" }} />
                <p className="text-slate-500 text-xs truncate">{suc.nombre.split(" ")[0]}</p>
              </div>
              <p className="text-xl font-bold text-white">{fmtK(suc.total)}</p>
              <p className="text-slate-500 text-xs mt-1">{(suc.total / data.totalGeneral * 100).toFixed(1)}% del total</p>
            </div>
          ))}
        </div>

        {/* ── Grid principal ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Donut por categoría */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-medium text-sm">Por categoría</h2>
              {/* Tabs sucursal */}
              <div className="flex gap-1 p-0.5 bg-slate-800 rounded-lg text-xs">
                <button
                  onClick={() => setSucActiva("todas")}
                  className={`px-2 py-1 rounded-md transition-colors ${sucActiva === "todas" ? "bg-slate-700 text-white" : "text-slate-500"}`}
                >
                  Ambas
                </button>
                {data.sucursales.map((suc) => (
                  <button
                    key={suc.id}
                    onClick={() => setSucActiva(suc.id)}
                    className={`px-2 py-1 rounded-md transition-colors ${sucActiva === suc.id ? "bg-slate-700 text-white" : "text-slate-500"}`}
                  >
                    {suc.nombre.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
            <DonutChart data={donutData} />
          </div>

          {/* Comparativa barras horizontales */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h2 className="text-white font-medium text-sm mb-4">Comparativa entre sucursales</h2>
            <div className="space-y-3">
              {data.totalesPorSucursal.map((suc) => (
                <BarraComparativa key={suc.id} suc={suc} maxTotal={maxTotal} />
              ))}
            </div>

            {/* Diferencia */}
            {data.totalesPorSucursal.length === 2 && (
              <div className="mt-5 pt-4 border-t border-slate-800">
                <p className="text-slate-500 text-xs mb-2">Diferencia entre sucursales</p>
                {(() => {
                  const [a, b] = data.totalesPorSucursal;
                  const mayor  = a.total >= b.total ? a : b;
                  const menor  = a.total < b.total ? a : b;
                  const diff   = mayor.total - menor.total;
                  const pct    = menor.total > 0 ? (diff / menor.total) * 100 : 0;
                  return (
                    <div className="flex items-baseline gap-2">
                      <span className="text-white font-semibold text-base">{fmt(diff)}</span>
                      <span className="text-slate-500 text-xs">más en {mayor.nombre.split(" ")[0]} ({pct.toFixed(1)}%)</span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Desglose por categoría por sucursal */}
            <div className="mt-5 pt-4 border-t border-slate-800 space-y-3">
              <p className="text-slate-500 text-xs">Desglose por categoría</p>
              {data.porCategoria.slice(0, 5).map((cat) => (
                <div key={cat.categoria} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: catColor(cat.categoria) }} />
                      <span className="text-slate-400 text-xs">{cat.categoria}</span>
                    </div>
                    <span className="text-slate-300 text-xs">{fmtK(cat.total)}</span>
                  </div>
                  {data.totalesPorSucursal.map((suc, i) => {
                    const montoCat = suc.conceptos
                      .filter((c) => (c.categoria || "OTROS") === cat.categoria)
                      .reduce((s, c) => s + c.monto, 0);
                    const pct = cat.total > 0 ? (montoCat / cat.total) * 100 : 0;
                    return (
                      <div key={suc.id} className="flex items-center gap-2 pl-3.5">
                        <span className="text-slate-600 text-[10px] w-16">{suc.nombre.split(" ")[0]}</span>
                        <div className="flex-1 bg-slate-800 rounded-full h-1">
                          <div className="h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: i === 0 ? "#10b981" : "#3b82f6" }} />
                        </div>
                        <span className="text-slate-600 text-[10px] w-12 text-right">{fmtK(montoCat)}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tabla detalle ── */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-medium text-sm">Todos los conceptos</h2>
            <div className="flex gap-1 text-xs">
              <button
                onClick={() => setSucActiva("todas")}
                className={`px-2 py-1 rounded-md transition-colors ${sucActiva === "todas" ? "bg-slate-700 text-white" : "text-slate-600 hover:text-slate-400"}`}
              >
                Todas
              </button>
              {data.sucursales.map((suc) => (
                <button
                  key={suc.id}
                  onClick={() => setSucActiva(suc.id)}
                  className={`px-2 py-1 rounded-md transition-colors ${sucActiva === suc.id ? "bg-slate-700 text-white" : "text-slate-600 hover:text-slate-400"}`}
                >
                  {suc.nombre.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          <TablaConceptos
            conceptos={conceptosFiltrados}
            titulo={sucActiva === "todas" ? "Todos los conceptos" : (data.sucursales.find((s) => s.id === sucActiva)?.nombre || "")}
          />

          {/* Total visible */}
          <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between items-center">
            <span className="text-slate-500 text-xs">Total filtrado</span>
            <span className="text-amber-400 font-semibold text-sm">{fmt(totalVis)}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
