"use client";
// components/GastosClient.tsx
// Ruta: components/GastosClient.tsx

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { GastoRow } from "@/app/gastos/page";

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
  categorias: { nombre: string; color: string }[];
  sucursales: string[];
  formasPago: string[];
  proveedores: string[];
}

interface FiltrosActivos {
  search: string;
  unidad: string;
  categorias: string[];
  forma_pago: string;
  proveedor: string;
  monto_min: string;
  monto_max: string;
  fecha_desde: string;
  fecha_hasta: string;
  orden_campo: string;
  orden_dir: string;
  grupo: string;
  rapido: string;
}

interface Props {
  data: GastoRow[];
  total: number;
  page: number;
  limit: number;
  sumaFiltrada: SumaFiltrada;
  meta: Meta;
  filtrosActivos: FiltrosActivos;
}

const RAPIDOS = [
  { key: "hoy",         label: "Hoy",           icon: "◉" },
  { key: "semana",      label: "Esta semana",    icon: "◈" },
  { key: "mes",         label: "Este mes",       icon: "◷" },
  { key: "altos",       label: "Top 10 gastos",  icon: "↑" },
  { key: "efectivo",    label: "Solo efectivo",  icon: "💵" },
  { key: "recurrentes", label: "Recurrentes",    icon: "↻" },
];

const GRUPOS = [
  { key: "",           label: "Sin agrupar" },
  { key: "proveedor",  label: "Por proveedor" },
  { key: "categoria",  label: "Por categoría" },
  { key: "unidad",     label: "Por unidad" },
];

const CAMPOS_ORDEN = [
  { key: "fecha",     label: "Fecha" },
  { key: "total",     label: "Total" },
  { key: "proveedor", label: "Proveedor" },
  { key: "categoria", label: "Categoría" },
];

// ── Componente principal ──────────────────────────────────────
export default function GastosClient({ data, total, page, limit, sumaFiltrada, meta, filtrosActivos }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filtros, setFiltros] = useState<FiltrosActivos>(filtrosActivos);
  const [catOpen, setCatOpen]           = useState(false);
  const [provOpen, setProvOpen]         = useState(false);
  const [provQuery, setProvQuery]       = useState(filtrosActivos.proveedor);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const catRef  = useRef<HTMLDivElement>(null);
  const provRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdowns al click fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (catRef.current  && !catRef.current.contains(e.target  as Node)) setCatOpen(false);
      if (provRef.current && !provRef.current.contains(e.target as Node)) setProvOpen(false);
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
      "search","unidad","forma_pago","proveedor","monto_min","monto_max",
      "fecha_desde","fecha_hasta","orden_campo","orden_dir","grupo","rapido"
    ];
    campos.forEach((k) => { if (merged[k] && merged[k] !== "todas" && merged[k] !== "fecha" && merged[k] !== "desc") p.set(k, merged[k] as string); });
    if (merged.categorias.length) p.set("categorias", merged.categorias.join(","));
    router.push(`/gastos?${p.toString()}`);
  }, [filtros, router]);

  const limpiar = () => {
    const limpio: FiltrosActivos = {
      search:"", unidad:"todas", categorias:[], forma_pago:"", proveedor:"",
      monto_min:"", monto_max:"", fecha_desde:"", fecha_hasta:"",
      orden_campo:"fecha", orden_dir:"desc", grupo:"", rapido:""
    };
    setFiltros(limpio);
    setProvQuery("");
    router.push("/gastos");
  };

  // ── Chips de filtros activos ─────────────────────────────
  const chips: { label: string; quitar: () => void }[] = [];
  if (filtros.search)      chips.push({ label: `"${filtros.search}"`,                         quitar: () => aplicar({ search: "" }) });
  if (filtros.unidad && filtros.unidad !== "todas") chips.push({ label: filtros.unidad,        quitar: () => aplicar({ unidad: "todas" }) });
  filtros.categorias.forEach(c => chips.push({ label: c,                                       quitar: () => aplicar({ categorias: filtros.categorias.filter(x => x !== c) }) }));
  if (filtros.forma_pago)  chips.push({ label: filtros.forma_pago,                            quitar: () => aplicar({ forma_pago: "" }) });
  if (filtros.proveedor)   chips.push({ label: `Prov: ${filtros.proveedor}`,                  quitar: () => { aplicar({ proveedor: "" }); setProvQuery(""); } });
  if (filtros.monto_min)   chips.push({ label: `≥ ${fmt(+filtros.monto_min)}`,                quitar: () => aplicar({ monto_min: "" }) });
  if (filtros.monto_max)   chips.push({ label: `≤ ${fmt(+filtros.monto_max)}`,                quitar: () => aplicar({ monto_max: "" }) });
  if (filtros.fecha_desde) chips.push({ label: `Desde ${filtros.fecha_desde}`,                quitar: () => aplicar({ fecha_desde: "" }) });
  if (filtros.fecha_hasta) chips.push({ label: `Hasta ${filtros.fecha_hasta}`,                quitar: () => aplicar({ fecha_hasta: "" }) });
  if (filtros.rapido)      chips.push({ label: RAPIDOS.find(r => r.key === filtros.rapido)?.label || filtros.rapido, quitar: () => aplicar({ rapido: "" }) });

  // ── Agrupación (client-side) ─────────────────────────────
  const grouped = useMemo(() => {
    if (!filtros.grupo) return null;
    const map = new Map<string, GastoRow[]>();
    data.forEach((g) => {
      let key = "Sin definir";
      if (filtros.grupo === "proveedor")  key = g.emisor_nombre || "Sin proveedor";
      if (filtros.grupo === "categoria")  key = g.categoria?.nombre || "Sin categoría";
      if (filtros.grupo === "unidad")     key = g.sucursal?.nombre || "Sin unidad";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    });
    return Array.from(map.entries())
      .map(([grupo, rows]) => ({ grupo, rows, subtotal: rows.reduce((s, r) => s + r.total, 0) }))
      .sort((a, b) => b.subtotal - a.subtotal);
  }, [data, filtros.grupo]);

  // ── KPIs dinámicos ───────────────────────────────────────
  const catMayorGasto = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(g => {
      const c = g.categoria?.nombre || "Sin categoría";
      map.set(c, (map.get(c) || 0) + g.total);
    });
    return [...map.entries()].sort((a,b) => b[1]-a[1])[0];
  }, [data]);

  const provMayorGasto = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(g => {
      const p = g.emisor_nombre || "Sin proveedor";
      map.set(p, (map.get(p) || 0) + g.total);
    });
    return [...map.entries()].sort((a,b) => b[1]-a[1])[0];
  }, [data]);

  // ── Exportar CSV ─────────────────────────────────────────
  function exportarCSV() {
    const cols = ["Fecha","Proveedor","Descripción","Categoría","Unidad","Forma de Pago","Subtotal","IVA","Total"];
    const rows = data.map(g => [
      fmtFecha(g.fecha),
      g.emisor_nombre || "",
      g.descripcion || "",
      g.categoria?.nombre || "",
      g.sucursal?.nombre || "",
      g.forma_pago || "",
      g.subtotal,
      g.iva,
      g.total,
    ]);
    const csv = [cols, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "gastos.csv"; a.click();
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
            <h1 className="text-white font-bold text-lg">Gastos Operativos</h1>
            <p className="text-slate-500 text-xs mt-0.5">{total} registros · {chips.length > 0 ? `${chips.length} filtro${chips.length > 1 ? "s" : ""} activo${chips.length > 1 ? "s" : ""}` : "Sin filtros"}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Búsqueda global */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">⌕</span>
              <input
                type="text"
                placeholder="Buscar proveedor, descripción, categoría…"
                value={filtros.search}
                onChange={e => aplicar({ search: e.target.value, page: undefined } as never)}
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

            {/* Fila 1: Fechas + Unidad + Forma de pago */}
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
                <label className="text-slate-500 text-xs font-medium">Unidad</label>
                <select value={filtros.unidad} onChange={e => aplicar({ unidad: e.target.value })}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                  <option value="todas">Todas</option>
                  {meta.sucursales.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs font-medium">Forma de pago</label>
                <select value={filtros.forma_pago} onChange={e => aplicar({ forma_pago: e.target.value })}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500">
                  <option value="">Todas</option>
                  {meta.formasPago.map(f => <option key={f} value={f}>{f}</option>)}
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

            {/* Fila 2: Categorías multiselect + Proveedor autocomplete */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Multiselect categorías */}
              <div ref={catRef} className="flex flex-col gap-1 relative">
                <label className="text-slate-500 text-xs font-medium">Categorías</label>
                <button onClick={() => setCatOpen(!catOpen)}
                  className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-3 py-2 text-left flex justify-between items-center hover:border-emerald-500/50 transition-colors">
                  <span className="text-slate-300 truncate">
                    {filtros.categorias.length === 0 ? "Todas las categorías" : filtros.categorias.join(", ")}
                  </span>
                  <span className="text-slate-500 ml-2">{catOpen ? "▲" : "▼"}</span>
                </button>
                {catOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-2 space-y-0.5 max-h-52 overflow-y-auto">
                      {meta.categorias.map(cat => {
                        const sel = filtros.categorias.includes(cat.nombre);
                        return (
                          <button key={cat.nombre}
                            onClick={() => {
                              const nuevo = sel
                                ? filtros.categorias.filter(c => c !== cat.nombre)
                                : [...filtros.categorias, cat.nombre];
                              aplicar({ categorias: nuevo });
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors text-left ${sel ? "bg-emerald-500/15 text-emerald-400" : "text-slate-300 hover:bg-slate-700"}`}
                          >
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                            {cat.nombre}
                            {sel && <span className="ml-auto text-emerald-400">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                    {filtros.categorias.length > 0 && (
                      <div className="border-t border-slate-700 p-2">
                        <button onClick={() => aplicar({ categorias: [] })} className="w-full text-xs text-rose-400 hover:text-rose-300 py-1">
                          ✕ Quitar selección
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Autocompletado proveedor */}
              <div ref={provRef} className="flex flex-col gap-1 relative">
                <label className="text-slate-500 text-xs font-medium">Proveedor</label>
                <input
                  type="text"
                  placeholder="Buscar proveedor…"
                  value={provQuery}
                  onChange={e => { setProvQuery(e.target.value); setProvOpen(true); }}
                  onFocus={() => setProvOpen(true)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
                />
                {provOpen && provQuery.length >= 1 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="max-h-44 overflow-y-auto">
                      {meta.proveedores
                        .filter(p => p.toLowerCase().includes(provQuery.toLowerCase()))
                        .slice(0, 10)
                        .map(p => (
                          <button key={p} onClick={() => { setProvQuery(p); setProvOpen(false); aplicar({ proveedor: p }); }}
                            className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors truncate">
                            {p}
                          </button>
                        ))}
                      {meta.proveedores.filter(p => p.toLowerCase().includes(provQuery.toLowerCase())).length === 0 && (
                        <p className="px-4 py-3 text-xs text-slate-600">Sin resultados</p>
                      )}
                    </div>
                  </div>
                )}
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
                    <button key={g.key}
                      onClick={() => aplicar({ grupo: g.key })}
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
          <KPICard label="Total gastos" value={fmt(sumaFiltrada.total)} sub={`${total} registros`} color="rose" />
          <KPICard label="Promedio por registro" value={fmt(sumaFiltrada.promedio)} sub="por gasto" color="amber" />
          <KPICard
            label="Mayor categoría"
            value={catMayorGasto ? catMayorGasto[0] : "—"}
            sub={catMayorGasto ? fmt(catMayorGasto[1]) : ""}
            color="blue"
            small
          />
          <KPICard
            label="Mayor proveedor"
            value={provMayorGasto ? provMayorGasto[0] : "—"}
            sub={provMayorGasto ? fmt(provMayorGasto[1]) : ""}
            color="purple"
            small
          />
        </div>

        {/* ── Tabla / Vista agrupada ────────────────────────── */}
        {filtros.grupo && grouped ? (
          <GrupoView groups={grouped} meta={meta} />
        ) : (
          <TablaPlana
            data={data}
            total={total}
            page={page}
            limit={limit}
            totalPages={totalPages}
            meta={meta}
            onPagina={(n) => {
              const p = new URLSearchParams(searchParams.toString());
              p.set("page", String(n));
              router.push(`/gastos?${p.toString()}`);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Vista agrupada ────────────────────────────────────────────
function GrupoView({ groups, meta }: { groups: { grupo: string; rows: GastoRow[]; subtotal: number }[], meta: Meta }) {
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
                  <p className="text-slate-500 text-xs">{rows.length} registros</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <p className="text-slate-500 text-xs">% del total</p>
                  <p className="text-slate-300 text-sm font-medium">{pctGrupo.toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 text-xs">Subtotal</p>
                  <p className="text-rose-400 font-bold">{fmt(subtotal)}</p>
                </div>
              </div>
            </button>
            {/* Barra de proporción */}
            <div className="px-5 pb-1">
              <div className="w-full bg-slate-800 rounded-full h-1">
                <div className="h-1 rounded-full bg-rose-500/60" style={{ width: `${pctGrupo}%` }} />
              </div>
            </div>
            {open && (
              <div className="border-t border-slate-800 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-950/50 text-slate-500">
                      <th className="text-left px-5 py-2 font-medium">Fecha</th>
                      <th className="text-left px-4 py-2 font-medium">Proveedor</th>
                      <th className="text-left px-4 py-2 font-medium">Descripción</th>
                      <th className="text-left px-4 py-2 font-medium">Forma pago</th>
                      <th className="text-right px-4 py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {rows.map(g => (
                      <tr key={g.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-2.5 text-slate-400 font-mono whitespace-nowrap">{fmtFecha(g.fecha)}</td>
                        <td className="px-4 py-2.5 text-slate-200 max-w-[160px] truncate">{g.emisor_nombre || "—"}</td>
                        <td className="px-4 py-2.5 text-slate-400 max-w-[120px] truncate">{g.descripcion || "—"}</td>
                        <td className="px-4 py-2.5 text-slate-500">{g.forma_pago || "—"}</td>
                        <td className="px-4 py-2.5 text-right text-rose-400 font-mono font-semibold">{fmt(g.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800/30 border-t border-slate-700">
                      <td colSpan={4} className="px-5 py-2.5 text-slate-400 text-xs font-semibold">Subtotal {grupo}</td>
                      <td className="px-4 py-2.5 text-right text-rose-300 font-bold">{fmt(subtotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}
      {/* Gran total */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl px-5 py-4 flex justify-between items-center">
        <p className="text-slate-400 text-sm font-semibold">Gran Total</p>
        <p className="text-rose-400 font-black text-lg">{fmt(gran)}</p>
      </div>
    </div>
  );
}

// ── Tabla plana ───────────────────────────────────────────────
function TablaPlana({ data, total, page, limit, totalPages, meta, onPagina }: {
  data: GastoRow[]; total: number; page: number; limit: number; totalPages: number;
  meta: Meta; onPagina: (n: number) => void;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/50">
              <th className="text-left text-slate-500 font-medium px-4 py-3 text-xs">Fecha</th>
              <th className="text-left text-slate-500 font-medium px-4 py-3 text-xs">Proveedor</th>
              <th className="text-left text-slate-500 font-medium px-4 py-3 text-xs">Descripción</th>
              <th className="text-left text-slate-500 font-medium px-4 py-3 text-xs">Categoría</th>
              <th className="text-left text-slate-500 font-medium px-4 py-3 text-xs">Unidad</th>
              <th className="text-left text-slate-500 font-medium px-4 py-3 text-xs">Forma pago</th>
              <th className="text-right text-slate-500 font-medium px-4 py-3 text-xs">Subtotal</th>
              <th className="text-right text-slate-500 font-medium px-4 py-3 text-xs">IVA</th>
              <th className="text-right text-slate-500 font-medium px-4 py-3 text-xs">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {data.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-slate-600 py-16 text-sm">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl opacity-30">🔍</span>
                    <span>No hay gastos con los filtros seleccionados</span>
                  </div>
                </td>
              </tr>
            )}
            {data.map((g) => (
              <tr key={g.id} className="hover:bg-slate-800/40 transition-colors group">
                <td className="px-4 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">{fmtFecha(g.fecha)}</td>
                <td className="px-4 py-3 text-slate-200 text-xs max-w-[180px] truncate" title={g.emisor_nombre || ""}>{g.emisor_nombre || "—"}</td>
                <td className="px-4 py-3 text-slate-400 text-xs max-w-[140px] truncate" title={g.descripcion || ""}>{g.descripcion || "—"}</td>
                <td className="px-4 py-3">
                  {g.categoria ? (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                      style={{ backgroundColor: g.categoria.color + "22", color: g.categoria.color, border: `1px solid ${g.categoria.color}44` }}>
                      {g.categoria.nombre}
                    </span>
                  ) : (
                    <span className="text-slate-700 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{g.sucursal?.nombre || "—"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{g.forma_pago || "—"}</td>
                <td className="px-4 py-3 text-right text-slate-400 font-mono text-xs">{fmt(g.subtotal)}</td>
                <td className="px-4 py-3 text-right text-slate-600 font-mono text-xs">{fmt(g.iva)}</td>
                <td className="px-4 py-3 text-right text-rose-400 font-mono font-semibold">{fmt(g.total)}</td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-700 bg-slate-950/50">
                <td colSpan={6} className="px-4 py-3 text-slate-500 text-xs font-semibold">
                  Total en esta página ({data.length} de {total} registros)
                </td>
                <td className="px-4 py-3 text-right text-slate-400 font-mono text-xs font-semibold">
                  {fmt(data.reduce((s, g) => s + g.subtotal, 0))}
                </td>
                <td className="px-4 py-3 text-right text-slate-600 font-mono text-xs font-semibold">
                  {fmt(data.reduce((s, g) => s + g.iva, 0))}
                </td>
                <td className="px-4 py-3 text-right text-rose-400 font-mono font-bold">
                  {fmt(data.reduce((s, g) => s + g.total, 0))}
                </td>
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
  color: "rose" | "amber" | "blue" | "purple"; small?: boolean;
}) {
  const c = {
    rose:   { text: "text-rose-400",   bg: "bg-rose-500/5",   border: "border-rose-500/20" },
    amber:  { text: "text-amber-400",  bg: "bg-amber-500/5",  border: "border-amber-500/20" },
    blue:   { text: "text-blue-400",   bg: "bg-blue-500/5",   border: "border-blue-500/20" },
    purple: { text: "text-purple-400", bg: "bg-purple-500/5", border: "border-purple-500/20" },
  }[color];
  return (
    <div className={`rounded-xl p-4 border ${c.bg} ${c.border} bg-slate-900`}>
      <p className="text-slate-500 text-xs font-medium mb-2">{label}</p>
      <p className={`font-bold ${c.text} leading-tight ${small ? "text-sm line-clamp-2 break-words" : "text-xl"}`}>{value}</p>
      {sub && <p className="text-slate-600 text-xs mt-1">{sub}</p>}
    </div>
  );
}
