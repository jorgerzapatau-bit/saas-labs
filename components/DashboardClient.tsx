"use client";
// components/DashboardClient.tsx

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DashboardData } from "@/types";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(n);
const fmtK = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : fmt(n);
const pct = (n: number) => `${n.toFixed(1)}%`;

const COLORES_SUCURSAL = ["#10b981", "#3b82f6"];
const COLORES_PAGO     = ["#3b82f6", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

// ── Tipos pacientes ───────────────────────────────────────────
interface SucursalResumenPac {
  id: string; nombre: string; serie_prefix: string;
  total_pacientes: number; total_ingresos: number; dias: number; max_pacientes: number;
}
interface MesPac { mes_num: number; mes: string; sucursales: SucursalResumenPac[] }
interface DetalleDia { dia: number; sucursal_id: string; num_pacientes: number; ingreso_dia: number }
interface PacientesData {
  sucursales: { id: string; nombre: string; serie_prefix: string }[];
  meses: MesPac[];
  detalleDiario: DetalleDia[];
  totalPacientes: number;
  totalIngresos: number;
}

// ── Filtros rápidos ───────────────────────────────────────────
const RAPIDOS_DASH = [
  { key: "hoy",           label: "Hoy",            icon: "◉" },
  { key: "semana",        label: "Esta semana",     icon: "◈" },
  { key: "mes",           label: "Este mes",        icon: "◷" },
  { key: "sin_depositar", label: "Sin depositar",   icon: "⚠" },
  { key: "efectivo",      label: "Solo efectivo",   icon: "💵" },
];

interface FiltrosDash {
  mes: string;
  rapido: string;
  sucursal: string;
  depositado: string;
  fecha_desde: string;
  fecha_hasta: string;
  monto_min: string;
  monto_max: string;
}

// ── Bar chart pacientes ───────────────────────────────────────
const CHART_H = 120;
function PacBarChart({ data, sucursales, mode }: {
  data: MesPac[]; sucursales: PacientesData["sucursales"]; mode: "pacientes" | "ingresos"
}) {
  const getValue = (r: SucursalResumenPac | undefined) =>
    mode === "pacientes" ? (r?.total_pacientes || 0) : (r?.total_ingresos || 0);
  const maxVal = Math.max(...data.flatMap((m) => m.sucursales.map((s) => getValue(s))), 1);
  return (
    <div className="w-full">
      <div className="flex items-end gap-1.5" style={{ height: CHART_H }}>
        {data.map((mes) => (
          <div key={mes.mes_num} className="flex-1 flex items-end justify-center gap-0.5" style={{ height: "100%" }}>
            {sucursales.map((suc, i) => {
              const resumen = mes.sucursales.find((s) => s.id === suc.id);
              const val = getValue(resumen);
              const barH = val > 0 ? Math.max(Math.round((val / maxVal) * CHART_H), 4) : 0;
              return (
                <div key={suc.id} className="relative group flex-1 max-w-[20px]"
                  style={{ height: barH, backgroundColor: COLORES_SUCURSAL[i], borderRadius: "3px 3px 0 0", cursor: "default" }}>
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 border border-slate-700">
                    <p className="font-medium">{suc.nombre.split(" ")[0]}</p>
                    <p>{mode === "pacientes" ? `${val} pac` : fmtK(val)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1">
        {data.map((mes) => (
          <div key={mes.mes_num} className="flex-1 text-center">
            <span className="text-slate-600 text-[10px]">{mes.mes.slice(0, 3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Heatmap diario ────────────────────────────────────────────
function HeatmapDiario({ detalle, sucursales, mesLabel }: {
  detalle: DetalleDia[]; sucursales: PacientesData["sucursales"]; mesLabel: string
}) {
  if (!detalle.length) return (
    <p className="text-slate-600 text-xs text-center py-6">No hay detalle diario para {mesLabel}</p>
  );
  const maxPac = Math.max(...detalle.map((d) => d.num_pacientes), 1);
  const diasPorSuc: Record<string, Record<number, DetalleDia>> = {};
  for (const d of detalle) {
    if (!diasPorSuc[d.sucursal_id]) diasPorSuc[d.sucursal_id] = {};
    diasPorSuc[d.sucursal_id][d.dia] = d;
  }
  const dias = Array.from(new Set(detalle.map((d) => d.dia))).sort((a, b) => a - b);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-separate border-spacing-y-1">
        <thead>
          <tr>
            <th className="text-left text-slate-500 font-normal pb-2 pr-3 w-20">Sucursal</th>
            {dias.map((d) => <th key={d} className="text-center text-slate-500 font-normal pb-2 w-7">{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {sucursales.map((suc, i) => (
            <tr key={suc.id}>
              <td className="text-slate-400 pr-3 py-1 font-medium text-[11px]">
                <span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ backgroundColor: COLORES_SUCURSAL[i] }} />
                {suc.nombre.split(" ")[0]}
              </td>
              {dias.map((d) => {
                const cell = diasPorSuc[suc.id]?.[d];
                const pac = cell?.num_pacientes || 0;
                const intensity = pac > 0 ? 0.15 + (pac / maxPac) * 0.85 : 0;
                const color = COLORES_SUCURSAL[i];
                const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
                const bg = pac > 0 ? `rgba(${r},${g},${b},${intensity})` : "transparent";
                return (
                  <td key={d} className="text-center py-1">
                    <div className="mx-auto w-6 h-5 rounded flex items-center justify-center text-[10px] font-medium cursor-default"
                      style={{ backgroundColor: bg, color: pac > 0 ? "white" : "#475569" }}
                      title={pac > 0 ? `${pac} pac · ${fmt(cell?.ingreso_dia || 0)}` : "Sin actividad"}>
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
  );
}

// ── Componente principal ──────────────────────────────────────
export default function DashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tipoRef = useRef<HTMLDivElement>(null);

  const [filtros, setFiltros] = useState<FiltrosDash>({
    mes:         searchParams.get("mes")         || "",
    rapido:      searchParams.get("rapido")      || "",
    sucursal:    searchParams.get("sucursal")    || "todas",
    depositado:  searchParams.get("depositado")  || "",
    fecha_desde: searchParams.get("fecha_desde") || "",
    fecha_hasta: searchParams.get("fecha_hasta") || "",
    monto_min:   searchParams.get("monto_min")   || "",
    monto_max:   searchParams.get("monto_max")   || "",
  });

  const [panelAbierto, setPanelAbierto] = useState(false);

  // Cerrar dropdown al click afuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (tipoRef.current && !tipoRef.current.contains(e.target as Node)) return;
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Pacientes ─────────────────────────────────────────────
  const [pacData, setPacData]   = useState<PacientesData | null>(null);
  const [pacMes, setPacMes]     = useState<number | null>(null);
  const [pacTab, setPacTab]     = useState<"pacientes" | "ingresos">("pacientes");
  const [heatOpen, setHeatOpen] = useState(false);
  const [pacLoading, setPacLoading] = useState(true);

  const loadPacientes = useCallback(async (mesNum: number | null) => {
    setPacLoading(true);
    const p = new URLSearchParams({ anio: "2026" });
    if (mesNum) p.set("mes_num", String(mesNum));
    const res = await fetch(`/api/pacientes?${p}`);
    setPacData(await res.json());
    setPacLoading(false);
  }, []);

  useEffect(() => { loadPacientes(pacMes); }, [pacMes, loadPacientes]);

  useEffect(() => {
    if (!filtros.mes) { setPacMes(null); return; }
    const MESES: Record<string, number> = {
      ENERO:1, FEBRERO:2, MARZO:3, ABRIL:4, MAYO:5, JUNIO:6,
      JULIO:7, AGOSTO:8, SEPTIEMBRE:9, OCTUBRE:10, NOVIEMBRE:11, DICIEMBRE:12,
    };
    const found = Object.entries(MESES).find(([k]) => k.startsWith(filtros.mes.toUpperCase().slice(0, 3)));
    setPacMes(found ? found[1] : null);
  }, [filtros.mes]);

  // ── aplicar() ─────────────────────────────────────────────
  const aplicar = useCallback((nuevo: Partial<FiltrosDash>) => {
    const merged = { ...filtros, ...nuevo };

    // Exclusiones mutuas
    if (nuevo.rapido !== undefined && nuevo.rapido !== "") merged.mes = "";
    if (nuevo.mes    !== undefined && nuevo.mes    !== "") merged.rapido = "";
    if (nuevo.rapido) { merged.fecha_desde = ""; merged.fecha_hasta = ""; }
    if (nuevo.fecha_desde || nuevo.fecha_hasta) merged.rapido = "";

    setFiltros(merged);

    const p = new URLSearchParams();
    if (merged.mes)                                     p.set("mes",         merged.mes);
    if (merged.rapido)                                  p.set("rapido",      merged.rapido);
    if (merged.sucursal && merged.sucursal !== "todas") p.set("sucursal",    merged.sucursal);
    if (merged.depositado)                              p.set("depositado",  merged.depositado);
    if (merged.fecha_desde)                             p.set("fecha_desde", merged.fecha_desde);
    if (merged.fecha_hasta)                             p.set("fecha_hasta", merged.fecha_hasta);
    if (merged.monto_min)                               p.set("monto_min",   merged.monto_min);
    if (merged.monto_max)                               p.set("monto_max",   merged.monto_max);
    router.push(`/dashboard?${p.toString()}`);
  }, [filtros, router]);

  const limpiar = () => {
    setFiltros({ mes:"", rapido:"", sucursal:"todas", depositado:"", fecha_desde:"", fecha_hasta:"", monto_min:"", monto_max:"" });
    router.push("/dashboard");
  };

  // ── Chips ─────────────────────────────────────────────────
  const chips: { label: string; quitar: () => void }[] = [];
  if (filtros.mes)      chips.push({ label: filtros.mes.charAt(0)+filtros.mes.slice(1).toLowerCase(), quitar: () => aplicar({ mes: "" }) });
  if (filtros.rapido)   chips.push({ label: RAPIDOS_DASH.find(r => r.key===filtros.rapido)?.label || filtros.rapido, quitar: () => aplicar({ rapido: "" }) });
  if (filtros.sucursal && filtros.sucursal !== "todas") {
    const suc = data.sucursales.find(s => s.id === filtros.sucursal);
    chips.push({ label: suc?.nombre || filtros.sucursal, quitar: () => aplicar({ sucursal: "todas" }) });
  }
  if (filtros.depositado)  chips.push({ label: filtros.depositado==="si" ? "Depositado ✓" : "Sin depositar ⚠", quitar: () => aplicar({ depositado: "" }) });
  if (filtros.fecha_desde) chips.push({ label: `Desde ${filtros.fecha_desde}`, quitar: () => aplicar({ fecha_desde: "" }) });
  if (filtros.fecha_hasta) chips.push({ label: `Hasta ${filtros.fecha_hasta}`, quitar: () => aplicar({ fecha_hasta: "" }) });
  if (filtros.monto_min)   chips.push({ label: `≥ ${fmt(+filtros.monto_min)}`, quitar: () => aplicar({ monto_min: "" }) });
  if (filtros.monto_max)   chips.push({ label: `≤ ${fmt(+filtros.monto_max)}`, quitar: () => aplicar({ monto_max: "" }) });

  // ── KPIs del servidor ─────────────────────────────────────
  const totalIngresos = data.gran_total_ingresos;
  const totalGastos   = data.gran_total_gastos;
  const utilidad      = data.utilidad_neta;
  const efectivo      = data.efectivo_sin_depositar;
  const margen        = totalIngresos > 0 ? (utilidad / totalIngresos) * 100 : 0;

  const mesesDisponibles = Array.from(new Set(data.resumen_mensual.map(r => r.mes))).sort();

  // ── Pacientes totales por sucursal ────────────────────────
  const pacTotalesSuc = pacData ? pacData.sucursales.map((suc) => {
    let pacientes = 0, ingresos = 0, dias = 0;
    if (pacMes) {
      const mesD = pacData.meses.find(m => m.mes_num === pacMes);
      const r = mesD?.sucursales.find(s => s.id === suc.id);
      pacientes = r?.total_pacientes||0; ingresos = r?.total_ingresos||0; dias = r?.dias||0;
    } else {
      pacData.meses.forEach(m => {
        const r = m.sucursales.find(s => s.id === suc.id);
        if (r) { pacientes += r.total_pacientes; ingresos += r.total_ingresos; dias += r.dias; }
      });
    }
    return { ...suc, pacientes, ingresos, dias };
  }) : [];

  const totalPacVis = pacTotalesSuc.reduce((s, r) => s + r.pacientes, 0);
  const mesLabelPac = pacData?.meses.find(m => m.mes_num === pacMes)?.mes || "Todo el período";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white font-bold text-lg">Dashboard</h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {chips.length > 0
                ? `${chips.length} filtro${chips.length > 1 ? "s" : ""} activo${chips.length > 1 ? "s" : ""}`
                : "Sin filtros · " + data.periodo}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Botones de mes */}
            <div className="flex items-center gap-1 flex-wrap">
              <button onClick={() => aplicar({ mes: "", rapido: "", fecha_desde: "", fecha_hasta: "" })}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  !filtros.mes && !filtros.rapido && !filtros.fecha_desde && !filtros.fecha_hasta
                    ? "bg-emerald-500 text-slate-900"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}>Todo</button>
              {mesesDisponibles.map(m => (
                <button key={m} onClick={() => aplicar({ mes: m })}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    filtros.mes === m ? "bg-emerald-500 text-slate-900" : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}>
                  {m.charAt(0)+m.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <button onClick={() => setPanelAbierto(!panelAbierto)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                panelAbierto
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
              }`}>
              ⚙ Filtros {chips.length > 0 && (
                <span className="bg-emerald-500 text-slate-900 text-xs font-bold px-1.5 py-0.5 rounded-full">{chips.length}</span>
              )}
            </button>
            {chips.length > 0 && (
              <button onClick={limpiar}
                className="px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 transition-colors">
                ✕ Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* ── Panel de filtros avanzados ──────────────────── */}
        {panelAbierto && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-5">

            {/* Fila 1: Fechas + Sucursal + Forma de pago + Montos */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs font-medium">Desde</label>
                <input type="date" value={filtros.fecha_desde}
                  onChange={e => aplicar({ fecha_desde: e.target.value })}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs font-medium">Hasta</label>
                <input type="date" value={filtros.fecha_hasta}
                  onChange={e => aplicar({ fecha_hasta: e.target.value })}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs font-medium">Sucursal</label>
                <select value={filtros.sucursal} onChange={e => aplicar({ sucursal: e.target.value })}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                  <option value="todas">Todas</option>
                  {data.sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs font-medium">Forma de pago</label>
                <select
                  value={filtros.rapido === "efectivo" ? "efectivo" : ""}
                  onChange={e => aplicar({ rapido: e.target.value === "efectivo" ? "efectivo" : "" })}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                  <option value="">Todas</option>
                  <option value="efectivo">Solo efectivo</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs font-medium">Monto mínimo</label>
                <input type="number" placeholder="0" value={filtros.monto_min}
                  onChange={e => aplicar({ monto_min: e.target.value })}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs font-medium">Monto máximo</label>
                <input type="number" placeholder="∞" value={filtros.monto_max}
                  onChange={e => aplicar({ monto_max: e.target.value })}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
              </div>
            </div>

            {/* Fila 2: Estatus de depósito */}
            <div className="flex flex-col gap-1 max-w-md">
              <label className="text-slate-500 text-xs font-medium">Estatus de depósito (efectivo)</label>
              <div className="flex gap-2">
                {[
                  { key: "",    label: "Todos" },
                  { key: "si",  label: "✓ Depositado" },
                  { key: "no",  label: "⚠ Pendiente" },
                ].map(op => (
                  <button key={op.key} onClick={() => aplicar({ depositado: op.key })}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                      filtros.depositado === op.key
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                    }`}>
                    {op.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Filtros rápidos ─────────────────────────────── */}
        <div className="flex gap-2 flex-wrap">
          {RAPIDOS_DASH.map(r => (
            <button key={r.key}
              onClick={() => aplicar({ rapido: filtros.rapido === r.key ? "" : r.key })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                filtros.rapido === r.key
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"
              }`}>
              <span>{r.icon}</span> {r.label}
            </button>
          ))}
        </div>

        {/* ── Chips ───────────────────────────────────────── */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((chip, i) => (
              <span key={i} className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-2.5 py-1 rounded-full">
                {chip.label}
                <button onClick={chip.quitar} className="hover:text-white transition-colors leading-none">✕</button>
              </span>
            ))}
          </div>
        )}

        {/* ── KPIs financieros ────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Ingresos"               value={fmt(totalIngresos)} sublabel={data.periodo}              color="emerald" icon="↑" />
          <KPICard label="Egresos"                value={fmt(totalGastos)}   sublabel="Gastos operativos"         color="rose"    icon="↓" />
          <KPICard label="Utilidad Neta"          value={fmt(utilidad)}      sublabel={`Margen ${pct(margen)}`}   color={utilidad >= 0 ? "blue" : "amber"} icon="◆" />
          <KPICard label="Efectivo sin depositar" value={fmt(efectivo)}      sublabel={filtros.depositado === "si" ? "Todo depositado ✓" : "Riesgo de fuga"}
            color="amber" icon="!" alert={efectivo > 0} />
        </div>

        {/* ── Sucursales ──────────────────────────────────── */}
        <section>
          <h2 className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-3">Por sucursal</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.sucursales.map((suc, i) => {
              const color = COLORES_SUCURSAL[i % COLORES_SUCURSAL.length];
              const margenSuc = suc.total_ingresos > 0 ? (suc.utilidad_bruta / suc.total_ingresos) * 100 : 0;
              const porcentaje = totalIngresos > 0 ? (suc.total_ingresos / totalIngresos) * 100 : 0;
              const pacSuc = pacTotalesSuc.find(p => p.id === suc.id);
              const ticketProm = pacSuc && pacSuc.pacientes > 0 ? suc.total_ingresos / pacSuc.pacientes : null;
              return (
                <div key={suc.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: color }} />
                  <div className="pl-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: color+"22", color }}>
                          {suc.serie_prefix}
                        </span>
                        <h3 className="text-white font-semibold text-base mt-1.5">{suc.nombre}</h3>
                        <p className="text-slate-500 text-xs">{suc.num_transacciones} transacciones</p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-500 text-xs">del total</p>
                        <p className="text-white text-2xl font-bold">{pct(porcentaje)}</p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1 mb-4">
                      <div className="h-1 rounded-full" style={{ width: `${porcentaje}%`, backgroundColor: color }} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div><p className="text-slate-500 text-xs mb-0.5">Ingresos</p><p className="text-emerald-400 font-semibold text-sm">{fmtK(suc.total_ingresos)}</p></div>
                      <div><p className="text-slate-500 text-xs mb-0.5">Gastos</p><p className="text-rose-400 font-semibold text-sm">{fmtK(suc.total_gastos)}</p></div>
                      <div><p className="text-slate-500 text-xs mb-0.5">Margen</p><p className={`font-semibold text-sm ${margenSuc >= 0 ? "text-blue-400" : "text-amber-400"}`}>{pct(margenSuc)}</p></div>
                    </div>
                    <div className="border-t border-slate-800 pt-3 grid grid-cols-3 gap-3">
                      <div><p className="text-slate-500 text-xs mb-0.5">Pacientes</p><p className="text-white font-semibold text-sm">{pacLoading ? "…" : (pacSuc?.pacientes??0).toLocaleString()}</p></div>
                      <div><p className="text-slate-500 text-xs mb-0.5">Días con pacientes</p><p className="text-white font-semibold text-sm">{pacLoading ? "…" : pacSuc?.dias??0}</p></div>
                      <div><p className="text-slate-500 text-xs mb-0.5">Ticket prom.</p><p className="font-semibold text-sm" style={{ color }}>{pacLoading ? "…" : ticketProm ? fmtK(ticketProm) : "—"}</p></div>
                    </div>
                    {suc.efectivo_sin_depositar > 0 && (
                      <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
                        <span className="text-amber-400 text-sm">⚠</span>
                        <span className="text-amber-400 text-xs">{fmt(suc.efectivo_sin_depositar)} en efectivo sin depositar</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Pacientes ───────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Atención de pacientes</h2>
            <div className="flex gap-1 p-0.5 bg-slate-800 rounded-lg text-xs">
              {(["pacientes","ingresos"] as const).map(t => (
                <button key={t} onClick={() => setPacTab(t)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${pacTab===t ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}>
                  {t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
              <div>
                <p className="text-slate-500 text-xs mb-1">Total pacientes</p>
                <p className="text-3xl font-bold text-white">
                  {pacLoading ? <span className="text-slate-600 animate-pulse">…</span> : totalPacVis.toLocaleString()}
                </p>
                <p className="text-slate-500 text-xs mt-1">{mesLabelPac}</p>
              </div>
              <div className="border-t border-slate-800 pt-4 space-y-3">
                {pacTotalesSuc.map((suc, i) => {
                  const p = totalPacVis > 0 ? (suc.pacientes/totalPacVis)*100 : 0;
                  return (
                    <div key={suc.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: COLORES_SUCURSAL[i] }} />
                          <span className="text-slate-400 text-xs">{suc.nombre.split(" ")[0]}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white text-xs font-semibold">{suc.pacientes.toLocaleString()}</span>
                          <span className="text-slate-600 text-xs">{p.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1">
                        <div className="h-1 rounded-full" style={{ width:`${p}%`, backgroundColor: COLORES_SUCURSAL[i] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
              <p className="text-slate-400 text-xs font-medium mb-4">Comparativa mensual · 2026</p>
              {pacLoading ? (
                <div className="h-32 flex items-center justify-center">
                  <span className="text-slate-600 text-sm animate-pulse">Cargando…</span>
                </div>
              ) : pacData && pacData.meses.length > 0 ? (
                <>
                  <PacBarChart data={pacData.meses} sucursales={pacData.sucursales} mode={pacTab} />
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800">
                    {pacData.sucursales.map((suc, i) => (
                      <div key={suc.id} className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORES_SUCURSAL[i] }} />
                        <span className="text-slate-400 text-xs">{suc.nombre}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500">
                          <th className="text-left font-normal pb-2">Mes</th>
                          {pacData.sucursales.map(suc => (
                            <th key={suc.id} className="text-right font-normal pb-2 px-2">{suc.nombre.split(" ")[0]}</th>
                          ))}
                          <th className="text-right font-normal pb-2 pl-2">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {pacData.meses.sort((a,b) => a.mes_num-b.mes_num).map(m => {
                          const mesTotal = m.sucursales.reduce((s,r) => s+(pacTab==="pacientes"?r.total_pacientes:r.total_ingresos), 0);
                          const isActive = m.mes_num === pacMes;
                          return (
                            <tr key={m.mes_num}
                              onClick={() => { const next=isActive?null:m.mes_num; setPacMes(next); setHeatOpen(next!==null); }}
                              className={`cursor-pointer transition-colors ${isActive?"bg-emerald-500/10":"hover:bg-slate-800/50"}`}>
                              <td className="py-2 text-slate-300 font-medium">
                                {m.mes.charAt(0)+m.mes.slice(1).toLowerCase()}
                                {isActive && <span className="ml-1.5 text-emerald-500 text-[10px]">▼</span>}
                              </td>
                              {pacData.sucursales.map((suc,i) => {
                                const r = m.sucursales.find(s => s.id===suc.id);
                                const val = pacTab==="pacientes"?(r?.total_pacientes||0):(r?.total_ingresos||0);
                                return (
                                  <td key={suc.id} className="py-2 text-right px-2 font-medium" style={{ color: COLORES_SUCURSAL[i] }}>
                                    {pacTab==="pacientes"?val.toLocaleString():fmtK(val)}
                                  </td>
                                );
                              })}
                              <td className="py-2 text-right pl-2 text-white font-medium">
                                {pacTab==="pacientes"?mesTotal.toLocaleString():fmtK(mesTotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-slate-600 text-xs text-center py-8">Sin datos de pacientes</p>
              )}
            </div>
          </div>

          {pacMes && (
            <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <button onClick={() => setHeatOpen(!heatOpen)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-800/50 transition-colors">
                <span className="text-slate-300 text-sm font-medium">Detalle diario · {mesLabelPac}</span>
                <span className="text-slate-500 text-xs">{heatOpen ? "Ocultar ↑" : "Ver detalle ↓"}</span>
              </button>
              {heatOpen && (
                <div className="px-5 pb-5 border-t border-slate-800">
                  {pacLoading
                    ? <p className="text-slate-600 text-xs text-center py-6 animate-pulse">Cargando…</p>
                    : <div className="pt-4"><HeatmapDiario detalle={pacData?.detalleDiario||[]} sucursales={pacData?.sucursales||[]} mesLabel={mesLabelPac} /></div>
                  }
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Formas de pago + Proveedores ────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-4">Formas de pago</h2>
            <div className="space-y-3">
              {data.formas_pago.map((fp, i) => (
                <div key={fp.forma} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORES_PAGO[i%COLORES_PAGO.length] }} />
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300">{fp.forma}</span>
                      <span className="text-slate-400">{fmt(fp.total)}</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1">
                      <div className="h-1 rounded-full" style={{ width:`${fp.porcentaje}%`, backgroundColor: COLORES_PAGO[i%COLORES_PAGO.length] }} />
                    </div>
                  </div>
                  <span className="text-slate-500 text-xs w-10 text-right">{pct(fp.porcentaje)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-4">Principales proveedores</h2>
            <div className="space-y-2">
              {data.top_proveedores.map((prov, i) => {
                const maxTotal = data.top_proveedores[0]?.total || 1;
                const p = (prov.total/maxTotal)*100;
                return (
                  <div key={prov.nombre} className="flex items-center gap-3">
                    <span className="text-slate-600 text-xs w-4 text-right">{i+1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300 truncate max-w-[180px]" title={prov.nombre}>{prov.nombre}</span>
                        <span className="text-rose-400">{fmtK(prov.total)}</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1">
                        <div className="h-1 rounded-full bg-rose-500/60" style={{ width:`${p}%` }} />
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
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-4">Resumen financiero mensual</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs">
                    <th className="text-left pb-3 font-normal">Mes</th>
                    <th className="text-right pb-3 font-normal">Ingresos</th>
                    <th className="text-right pb-3 font-normal">Gastos</th>
                    <th className="text-right pb-3 font-normal">Utilidad</th>
                    <th className="text-right pb-3 font-normal">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.resumen_mensual.map(row => {
                    const m = row.total_ingresos > 0 ? (row.utilidad/row.total_ingresos)*100 : 0;
                    return (
                      <tr key={row.mes} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 text-white font-medium text-xs">{row.mes.charAt(0)+row.mes.slice(1).toLowerCase()}</td>
                        <td className="py-2.5 text-right text-emerald-400 text-xs">{fmt(row.total_ingresos)}</td>
                        <td className="py-2.5 text-right text-rose-400 text-xs">{fmt(row.total_gastos)}</td>
                        <td className={`py-2.5 text-right text-xs font-semibold ${row.utilidad>=0?"text-blue-400":"text-amber-400"}`}>{fmt(row.utilidad)}</td>
                        <td className="py-2.5 text-right text-slate-400 text-xs">{pct(m)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <footer className="text-center text-slate-700 text-xs pb-4">
          Vitana Labs © {new Date().getFullYear()} · Datos en tiempo real
        </footer>
      </main>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────
interface KPICardProps {
  label: string; value: string; sublabel: string;
  color: "emerald"|"rose"|"blue"|"amber"; icon: string; alert?: boolean;
}
const colorMap = {
  emerald: { text:"text-emerald-400", bg:"bg-emerald-500/10", border:"border-emerald-500/20" },
  rose:    { text:"text-rose-400",    bg:"bg-rose-500/10",    border:"border-rose-500/20" },
  blue:    { text:"text-blue-400",    bg:"bg-blue-500/10",    border:"border-blue-500/20" },
  amber:   { text:"text-amber-400",   bg:"bg-amber-500/10",   border:"border-amber-500/20" },
};
function KPICard({ label, value, sublabel, color, icon, alert }: KPICardProps) {
  const c = colorMap[color];
  return (
    <div className={`rounded-xl p-4 border bg-slate-900 ${alert ? `${c.bg} ${c.border}` : "border-slate-800"}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-slate-400 text-xs font-medium">{label}</p>
        <span className={`text-base ${c.text}`}>{icon}</span>
      </div>
      <p className={`text-xl font-bold ${c.text} leading-none mb-1.5`}>{value}</p>
      <p className="text-slate-600 text-xs">{sublabel}</p>
    </div>
  );
}
