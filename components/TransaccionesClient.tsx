"use client";
// components/TransaccionesClient.tsx

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { TransaccionRow } from "@/app/transacciones/page";

// ── Utilidades ────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(n);

const fmtFecha = (d: Date) =>
  new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

// ── Tipos ─────────────────────────────────────────────────────
interface SumaFiltrada {
  total: number;
  iva: number;
  subtotal: number;
  promedio: number;
}

interface Meta {
  sucursales: { id: string; nombre: string; serie_prefix: string }[];
  formasPago: string[];
  tiposGasto: string[];
}

interface FiltrosActivos {
  search: string;
  unidad: string;
  forma_pago: string;
  tipo_gasto: string;
  monto_min: string;
  monto_max: string;
  fecha_desde: string;
  fecha_hasta: string;
  orden_campo: string;
  orden_dir: string;
  grupo: string;
  rapido: string;
  depositado: string;
}

interface Props {
  data: TransaccionRow[];
  total: number;
  page: number;
  limit: number;
  sumaFiltrada: SumaFiltrada;
  meta: Meta;
  filtrosActivos: FiltrosActivos;
}

const RAPIDOS = [
  { key: "hoy",           label: "Hoy",                icon: "◉" },
  { key: "semana",        label: "Esta semana",         icon: "◈" },
  { key: "mes",           label: "Este mes",            icon: "◷" },
  { key: "altos",         label: "Top 10 ingresos",     icon: "↑" },
  { key: "efectivo",      label: "Solo efectivo",       icon: "💵" },
  { key: "sin_depositar", label: "Sin depositar",       icon: "⚠" },
];

const GRUPOS = [
  { key: "",           label: "Sin agrupar" },
  { key: "sucursal",   label: "Por sucursal" },
  { key: "forma_pago", label: "Por forma de pago" },
  { key: "tipo",       label: "Por tipo" },
];

const CAMPOS_ORDEN = [
  { key: "fecha",      label: "Fecha" },
  { key: "total",      label: "Total" },
  { key: "sucursal",   label: "Sucursal" },
  { key: "forma_pago", label: "Forma de pago" },
];

// ── Componente principal ──────────────────────────────────────
export default function TransaccionesClient({ data, total, page, limit, sumaFiltrada, meta, filtrosActivos }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filtros, setFiltros] = useState<FiltrosActivos>(filtrosActivos);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [tipoOpen, setTipoOpen]         = useState(false);
  const tipoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (tipoRef.current && !tipoRef.current.contains(e.target as Node)) setTipoOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Aplicar filtros al server ────────────────────────────
  const aplicar = useCallback((nuevo: Partial<FiltrosActivos>) => {
    const merged = { ...filtros, ...nuevo };
    setFiltros(merged);
    const p = new URLSearchParams();
    const campos: (keyof FiltrosActivos)[] = [
      "search", "unidad", "forma_pago", "tipo_gasto", "monto_min", "monto_max",
      "fecha_desde", "fecha_hasta", "orden_campo", "orden_dir", "grupo", "rapido", "depositado",
    ];
    campos.forEach((k) => {
      const v = merged[k] as string;
      if (v && v !== "todas" && v !== "fecha" && v !== "desc") p.set(k, v);
    });
    router.push(`/transacciones?${p.toString()}`);
  }, [filtros, router]);

  const limpiar = () => {
    const limpio: FiltrosActivos = {
      search: "", unidad: "todas", forma_pago: "", tipo_gasto: "",
      monto_min: "", monto_max: "", fecha_desde: "", fecha_hasta: "",
      orden_campo: "fecha", orden_dir: "desc", grupo: "", rapido: "", depositado: "",
    };
    setFiltros(limpio);
    router.push("/transacciones");
  };

  // ── Chips de filtros activos ─────────────────────────────
  const chips: { label: string; quitar: () => void }[] = [];
  if (filtros.search)     chips.push({ label: `"${filtros.search}"`,                          quitar: () => aplicar({ search: "" }) });
  if (filtros.unidad && filtros.unidad !== "todas") {
    const suc = meta.sucursales.find(s => s.id === filtros.unidad);
    chips.push({ label: suc?.nombre || filtros.unidad,                                         quitar: () => aplicar({ unidad: "todas" }) });
  }
  if (filtros.forma_pago) chips.push({ label: filtros.forma_pago,                             quitar: () => aplicar({ forma_pago: "" }) });
  if (filtros.tipo_gasto) chips.push({ label: `Tipo: ${filtros.tipo_gasto}`,                  quitar: () => aplicar({ tipo_gasto: "" }) });
  if (filtros.monto_min)  chips.push({ label: `≥ ${fmt(+filtros.monto_min)}`,                 quitar: () => aplicar({ monto_min: "" }) });
  if (filtros.monto_max)  chips.push({ label: `≤ ${fmt(+filtros.monto_max)}`,                 quitar: () => aplicar({ monto_max: "" }) });
  if (filtros.fecha_desde) chips.push({ label: `Desde ${filtros.fecha_desde}`,                quitar: () => aplicar({ fecha_desde: "" }) });
  if (filtros.fecha_hasta) chips.push({ label: `Hasta ${filtros.fecha_hasta}`,                quitar: () => aplicar({ fecha_hasta: "" }) });
  if (filtros.depositado) chips.push({ label: filtros.depositado === "si" ? "Depositado ✓" : "Sin depositar ⚠", quitar: () => aplicar({ depositado: "" }) });
  if (filtros.rapido)     chips.push({ label: RAPIDOS.find(r => r.key === filtros.rapido)?.label || filtros.rapido, quitar: () => aplicar({ rapido: "" }) });

  // ── Agrupación (client-side) ─────────────────────────────
  const grouped = useMemo(() => {
    if (!filtros.grupo) return null;
    const map = new Map<string, TransaccionRow[]>();
    data.forEach((t) => {
      let key = "Sin definir";
      if (filtros.grupo === "sucursal")   key = t.sucursal?.nombre || "Sin sucursal";
      if (filtros.grupo === "forma_pago") key = t.forma_pago?.split(" ").slice(1).join(" ") || t.forma_pago || "Sin especificar";
      if (filtros.grupo === "tipo")       key = t.tipo_gasto || "Sin tipo";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries())
      .map(([grupo, rows]) => ({ grupo, rows, subtotal: rows.reduce((s, r) => s + r.total, 0) }))
      .sort((a, b) => b.subtotal - a.subtotal);
  }, [data, filtros.grupo]);

  // ── KPIs dinámicos ───────────────────────────────────────
  const sucursalTop = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(t => {
      const s = t.sucursal?.nombre || "Sin sucursal";
      map.set(s, (map.get(s) || 0) + t.total);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1])[0];
  }, [data]);

  const efectivoPendiente = useMemo(() =>
    data.filter(t => t.forma_pago?.toLowerCase().includes("efectivo") && !t.efectivo_depositado)
        .reduce((s, t) => s + t.total, 0),
  [data]);

  // ── Exportar CSV ─────────────────────────────────────────
  function exportarCSV() {
    const cols = ["Fecha", "Serie/Folio", "Sucursal", "Forma de Pago", "Tipo", "Subtotal", "IVA", "Total", "Depositado"];
    const rows = data.map(t => [
      fmtFecha(t.fecha),
      `${t.serie}${t.folio ?? ""}`,
      t.sucursal?.nombre || "",
      t.forma_pago || "",
      t.tipo_gasto || "",
      t.subtotal,
      t.iva,
      t.total,
      t.efectivo_depositado ? "Sí" : "No",
    ]);
    const csv = [cols, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ingresos.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.ceil(total / limit);

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-white font-bold text-lg">Ingresos</h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {total} registros · {chips.length > 0 ? `${chips.length} filtro${chips.length > 1 ? "s" : ""} activo${chips.length > 1 ? "s" : ""}` : "Sin filtros"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Búsqueda global */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">⌕</span>
              <input
                type="text"
                placeholder="Buscar folio, forma de pago, tipo…"
                value={filtros.search}
                onChange={e => aplicar({ search: e.target.value })}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg pl-7 pr-3 py-2 w-72 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
              />
            </div>
            <button
              onClick={() => setPanelAbierto(!panelAbierto)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                panelAbierto ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
              }`}
            >
              ⚙ Filtros {chips.length > 0 && <span className="bg-emerald-500 text-slate-900 text-xs font-bold px-1.5 py-0.5 rounded-full">{chips.length}</span>}
            </button>
            <button onClick={exportarCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors">
              ↓ CSV
            </button>
            {chips.length > 0 && (
              <button onClick={limpiar} className="px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 transition-colors">
                ✕ Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

        {/* ── Panel de filtros avanzados ───────────────────── */}
        {panelAbierto && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-5">

            {/* Fila 1: Fechas + Sucursal + Forma de pago + Montos */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs font-medium">Desde</label>
                <input type="date" value={filtros.fecha_desde}
                  onChange={e => aplicar({ fecha_desde: e.target.value })}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs font-medium">Hasta</label>
                <input type="date" value={filtros.fecha_hasta}
                  onChange={e => aplicar({ fecha_hasta: e.target.value })}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs font-medium">Sucursal</label>
                <select value={filtros.unidad} onChange={e => aplicar({ unidad: e.target.value })}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                  <option value="todas">Todas</option>
                  {meta.sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs font-medium">Forma de pago</label>
                <select value={filtros.forma_pago} onChange={e => aplicar({ forma_pago: e.target.value })}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                  <option value="">Todas</option>
                  {meta.formasPago.map(f => <option key={f} value={f}>{f.split(" ").slice(1).join(" ") || f}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs font-medium">Monto mínimo</label>
                <input type="number" placeholder="0" value={filtros.monto_min}
                  onChange={e => aplicar({ monto_min: e.target.value })}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs font-medium">Monto máximo</label>
                <input type="number" placeholder="∞" value={filtros.monto_max}
                  onChange={e => aplicar({ monto_max: e.target.value })}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Fila 2: Tipo de gasto dropdown + Estatus depósito */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Dropdown tipo de gasto */}
              <div ref={tipoRef} className="flex flex-col gap-1 relative">
                <label className="text-slate-500 text-xs font-medium">Tipo de ingreso</label>
                <button onClick={() => setTipoOpen(!tipoOpen)}
                  className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-3 py-2 text-left flex justify-between items-center hover:border-emerald-500/50 transition-colors">
                  <span className="text-slate-300 truncate">{filtros.tipo_gasto || "Todos los tipos"}</span>
                  <span className="text-slate-500 ml-2">{tipoOpen ? "▲" : "▼"}</span>
                </button>
                {tipoOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="max-h-52 overflow-y-auto">
                      <button onClick={() => { aplicar({ tipo_gasto: "" }); setTipoOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-xs transition-colors ${!filtros.tipo_gasto ? "bg-emerald-500/15 text-emerald-400" : "text-slate-300 hover:bg-slate-700"}`}>
                        Todos los tipos
                      </button>
                      {meta.tiposGasto.map(t => (
                        <button key={t} onClick={() => { aplicar({ tipo_gasto: t }); setTipoOpen(false); }}
                          className={`w-full text-left px-4 py-2 text-xs transition-colors truncate ${filtros.tipo_gasto === t ? "bg-emerald-500/15 text-emerald-400" : "text-slate-300 hover:bg-slate-700"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Estatus de depósito de efectivo */}
              <div className="flex flex-col gap-1">
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

            {/* Fila 3: Ordenamiento + Agrupación */}
            <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-800">
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs font-medium">Ordenar por</label>
                <div className="flex gap-1">
                  {CAMPOS_ORDEN.map(c => (
                    <button key={c.key}
                      onClick={() => aplicar({ orden_campo: c.key, orden_dir: filtros.orden_campo === c.key && filtros.orden_dir === "desc" ? "asc" : "desc" })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        filtros.orden_campo === c.key
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                      }`}>
                      {c.label} {filtros.orden_campo === c.key ? (filtros.orden_dir === "desc" ? "↓" : "↑") : ""}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs font-medium">Agrupar por</label>
                <div className="flex gap-1">
                  {GRUPOS.map(g => (
                    <button key={g.key} onClick={() => aplicar({ grupo: g.key })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        filtros.grupo === g.key
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                      }`}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Filtros rápidos ───────────────────────────────── */}
        <div className="flex gap-2 flex-wrap">
          {RAPIDOS.map(r => (
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

        {/* ── Chips de filtros activos ─────────────────────── */}
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

        {/* ── KPIs dinámicos ────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Total ingresos"       value={fmt(sumaFiltrada.total)}   sub={`${total} registros`}  color="emerald" />
          <KPICard label="Promedio por ticket"  value={fmt(sumaFiltrada.promedio)} sub="por transacción"       color="blue" />
          <KPICard
            label="Sucursal líder"
            value={sucursalTop ? sucursalTop[0] : "—"}
            sub={sucursalTop ? fmt(sucursalTop[1]) : ""}
            color="purple"
            small
          />
          <KPICard
            label="Efectivo sin depositar"
            value={fmt(efectivoPendiente)}
            sub={efectivoPendiente > 0 ? "⚠ Pendiente" : "✓ Al día"}
            color={efectivoPendiente > 0 ? "amber" : "emerald"}
          />
        </div>

        {/* ── Tabla / Vista agrupada ────────────────────────── */}
        {filtros.grupo && grouped ? (
          <GrupoView groups={grouped} />
        ) : (
          <TablaPlana
            data={data}
            total={total}
            page={page}
            limit={limit}
            totalPages={totalPages}
            onPagina={(n) => {
              const p = new URLSearchParams(searchParams.toString());
              p.set("page", String(n));
              router.push(`/transacciones?${p.toString()}`);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Vista agrupada ────────────────────────────────────────────
function GrupoView({ groups }: { groups: { grupo: string; rows: TransaccionRow[]; subtotal: number }[] }) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const toggle = (g: string) => setAbiertos(prev => { const s = new Set(prev); s.has(g) ? s.delete(g) : s.add(g); return s; });
  const gran = groups.reduce((s, g) => s + g.subtotal, 0);

  return (
    <div className="space-y-3">
      {groups.map(({ grupo, rows, subtotal }) => {
        const open = abiertos.has(grupo);
        const pctGrupo = gran > 0 ? (subtotal / gran) * 100 : 0;
        return (
          <div key={grupo} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(grupo)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm">{open ? "▼" : "▶"}</span>
                <div>
                  <p className="text-white font-semibold text-sm text-left">{grupo}</p>
                  <p className="text-slate-500 text-xs">{rows.length} transacciones</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <p className="text-slate-500 text-xs">% del total</p>
                  <p className="text-slate-300 text-sm font-medium">{pctGrupo.toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs">Subtotal</p>
                  <p className="text-emerald-400 font-bold">{fmt(subtotal)}</p>
                </div>
              </div>
            </button>
            <div className="px-5 pb-1">
              <div className="w-full bg-slate-800 rounded-full h-1">
                <div className="h-1 rounded-full bg-emerald-500/60" style={{ width: `${pctGrupo}%` }} />
              </div>
            </div>
            {open && (
              <div className="border-t border-slate-800 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-950/50 text-slate-500">
                      <th className="text-left px-5 py-2 font-medium">Fecha</th>
                      <th className="text-left px-4 py-2 font-medium">Serie/Folio</th>
                      <th className="text-left px-4 py-2 font-medium">Forma de pago</th>
                      <th className="text-left px-4 py-2 font-medium">Tipo</th>
                      <th className="text-right px-4 py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {rows.map(t => (
                      <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-2.5 text-slate-400 font-mono whitespace-nowrap">{fmtFecha(t.fecha)}</td>
                        <td className="px-4 py-2.5 text-slate-200 font-mono">{t.serie}{t.folio ?? ""}</td>
                        <td className="px-4 py-2.5 text-slate-400">{t.forma_pago?.split(" ").slice(1).join(" ") || "—"}</td>
                        <td className="px-4 py-2.5 text-slate-500 max-w-[120px] truncate">{t.tipo_gasto || "—"}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-400 font-mono font-semibold">{fmt(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800/30 border-t border-slate-700">
                      <td colSpan={4} className="px-5 py-2.5 text-slate-400 text-xs font-semibold">Subtotal {grupo}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-300 font-bold">{fmt(subtotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}
      <div className="bg-slate-900 border border-slate-700 rounded-xl px-5 py-4 flex justify-between items-center">
        <p className="text-slate-400 text-sm font-semibold">Gran Total</p>
        <p className="text-emerald-400 font-black text-lg">{fmt(gran)}</p>
      </div>
    </div>
  );
}

// ── Tabla plana ───────────────────────────────────────────────
function TablaPlana({ data, total, page, limit, totalPages, onPagina }: {
  data: TransaccionRow[]; total: number; page: number; limit: number;
  totalPages: number; onPagina: (n: number) => void;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/50">
              <th className="text-left text-slate-500 font-medium px-4 py-3 text-xs">Fecha</th>
              <th className="text-left text-slate-500 font-medium px-4 py-3 text-xs">Serie / Folio</th>
              <th className="text-left text-slate-500 font-medium px-4 py-3 text-xs">Sucursal</th>
              <th className="text-left text-slate-500 font-medium px-4 py-3 text-xs">Forma de Pago</th>
              <th className="text-left text-slate-500 font-medium px-4 py-3 text-xs">Tipo</th>
              <th className="text-right text-slate-500 font-medium px-4 py-3 text-xs">Subtotal</th>
              <th className="text-right text-slate-500 font-medium px-4 py-3 text-xs">IVA</th>
              <th className="text-right text-slate-500 font-medium px-4 py-3 text-xs">Total</th>
              <th className="text-center text-slate-500 font-medium px-4 py-3 text-xs">Depositado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {data.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-slate-600 py-16 text-sm">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl opacity-30">🔍</span>
                    <span>No hay ingresos con los filtros seleccionados</span>
                  </div>
                </td>
              </tr>
            )}
            {data.map((t) => {
              const isEfectivo = t.forma_pago?.toLowerCase().includes("efectivo");
              return (
                <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">{fmtFecha(t.fecha)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {t.serie}{t.folio ?? ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{t.sucursal?.nombre || "—"}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs max-w-[140px] truncate">
                    {t.forma_pago?.split(" ").slice(1).join(" ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[120px] truncate">{t.tipo_gasto || "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-400 font-mono text-xs">{fmt(t.subtotal)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 font-mono text-xs">{fmt(t.iva)}</td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-mono font-semibold">{fmt(t.total)}</td>
                  <td className="px-4 py-3 text-center">
                    {isEfectivo ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        t.efectivo_depositado ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                      }`}>
                        {t.efectivo_depositado ? "✓ Sí" : "⚠ No"}
                      </span>
                    ) : (
                      <span className="text-slate-700 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {data.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-700 bg-slate-950/50">
                <td colSpan={5} className="px-4 py-3 text-slate-500 text-xs font-semibold">
                  Total en esta página ({data.length} de {total} registros)
                </td>
                <td className="px-4 py-3 text-right text-slate-400 font-mono text-xs font-semibold">
                  {fmt(data.reduce((s, t) => s + t.subtotal, 0))}
                </td>
                <td className="px-4 py-3 text-right text-slate-600 font-mono text-xs font-semibold">
                  {fmt(data.reduce((s, t) => s + t.iva, 0))}
                </td>
                <td className="px-4 py-3 text-right text-emerald-400 font-mono font-bold">
                  {fmt(data.reduce((s, t) => s + t.total, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
          <p className="text-slate-600 text-xs">Página {page} de {totalPages} · {total} registros</p>
          <div className="flex gap-1">
            <button onClick={() => onPagina(1)} disabled={page <= 1}
              className="px-2 py-1.5 text-xs rounded-md bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">«</button>
            <button onClick={() => onPagina(page - 1)} disabled={page <= 1}
              className="px-3 py-1.5 text-xs rounded-md bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">← Anterior</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
              return (
                <button key={n} onClick={() => onPagina(n)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${n === page ? "bg-emerald-500 text-slate-900 font-bold" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                  {n}
                </button>
              );
            })}
            <button onClick={() => onPagina(page + 1)} disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs rounded-md bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Siguiente →</button>
            <button onClick={() => onPagina(totalPages)} disabled={page >= totalPages}
              className="px-2 py-1.5 text-xs rounded-md bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">»</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────
function KPICard({ label, value, sub, color, small }: {
  label: string; value: string; sub: string;
  color: "emerald" | "blue" | "amber" | "purple"; small?: boolean;
}) {
  const c = {
    emerald: { text: "text-emerald-400", bg: "bg-emerald-500/5",  border: "border-emerald-500/20" },
    blue:    { text: "text-blue-400",    bg: "bg-blue-500/5",     border: "border-blue-500/20" },
    amber:   { text: "text-amber-400",   bg: "bg-amber-500/5",    border: "border-amber-500/20" },
    purple:  { text: "text-purple-400",  bg: "bg-purple-500/5",   border: "border-purple-500/20" },
  }[color];
  return (
    <div className={`rounded-xl p-4 border ${c.bg} ${c.border} bg-slate-900`}>
      <p className="text-slate-500 text-xs font-medium mb-2">{label}</p>
      <p className={`font-bold ${c.text} leading-tight ${small ? "text-sm line-clamp-2 break-words" : "text-xl"}`}>{value}</p>
      {sub && <p className="text-slate-600 text-xs mt-1">{sub}</p>}
    </div>
  );
}
