"use client";
// components/TransaccionesClient.tsx

import { useRouter, useSearchParams } from "next/navigation";
import type { TransaccionRow } from "@/app/transacciones/page";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(n);

const fmtFecha = (d: Date) =>
  new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });

const MESES = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];

interface Props {
  data: TransaccionRow[];
  total: number;
  page: number;
  limit: number;
  sucursales: { id: string; nombre: string; serie_prefix: string }[];
  filtros: { mes: string; sucursal: string };
}

export default function TransaccionesClient({ data, total, page, limit, sucursales, filtros }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function actualizarFiltro(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value); else p.delete(key);
    p.delete("page");
    router.push(`/transacciones?${p.toString()}`);
  }

  function irPagina(n: number) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("page", String(n));
    router.push(`/transacciones?${p.toString()}`);
  }

  const totalPages = Math.ceil(total / limit);
  const totalFiltrado = data.reduce((s, t) => s + t.total, 0);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Ingresos</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} registros totales</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-right">
          <p className="text-slate-500 text-xs">Total filtrado</p>
          <p className="text-emerald-400 font-bold">{fmt(totalFiltrado)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={filtros.mes}
          onChange={(e) => actualizarFiltro("mes", e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
        >
          <option value="">Todos los meses</option>
          {MESES.map((m) => (
            <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>
          ))}
        </select>

        <select
          value={filtros.sucursal}
          onChange={(e) => actualizarFiltro("sucursal", e.target.value)}
          className="bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
        >
          <option value="">Todas las sucursales</option>
          {sucursales.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre} ({s.serie_prefix})</option>
          ))}
        </select>

        {(filtros.mes || filtros.sucursal) && (
          <button
            onClick={() => router.push("/transacciones")}
            className="text-slate-500 hover:text-white text-sm px-3 py-2 transition-colors"
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
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
                  <td colSpan={9} className="text-center text-slate-600 py-12">
                    No hay transacciones con los filtros seleccionados
                  </td>
                </tr>
              )}
              {data.map((t) => {
                const isEfectivo = t.forma_pago?.toLowerCase().includes("efectivo");
                return (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">
                      {fmtFecha(t.fecha)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                          t.serie.includes("VIT") ? "badge-vit" : "badge-prog"
                        }`}
                      >
                        {t.serie}{t.folio}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">
                      {t.sucursal?.nombre || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-[140px] truncate">
                      {t.forma_pago?.split(" ").slice(1).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[120px] truncate">
                      {t.tipo_gasto || "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 font-mono text-xs">
                      {fmt(t.subtotal)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 font-mono text-xs">
                      {fmt(t.iva)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-mono font-semibold">
                      {fmt(t.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEfectivo ? (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            t.efectivo_depositado
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-amber-500/15 text-amber-400"
                          }`}
                        >
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
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <p className="text-slate-600 text-xs">
              Página {page} de {totalPages} · {total} registros
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => irPagina(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs rounded-md bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Anterior
              </button>
              <button
                onClick={() => irPagina(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs rounded-md bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
