// app/dashboard/page.tsx
import { prisma } from "@/lib/prisma";
import type { DashboardData } from "@/types";
import DashboardClient from "@/components/DashboardClient";
import AppShell from "@/components/AppShell";
import { Suspense } from "react";

// ── Helpers ────────────────────────────────────────────────────
function normalizarFormaPago(forma: string): string {
  const f = forma.toLowerCase();
  if (f.includes("efectivo")) return "Efectivo";
  if (f.includes("tarjeta de cr")) return "Tarjeta Crédito";
  if (f.includes("tarjeta de d") || f.includes("débito")) return "Tarjeta Débito";
  if (f.includes("transfer")) return "Transferencia";
  return forma.split(" ").slice(1).join(" ") || forma;
}

function normalizarMes(mes: string): string {
  const m = mes.trim().toUpperCase();
  if (m.startsWith("MAR")) return "MARZO";
  if (m.startsWith("ABR")) return "ABRIL";
  if (m.startsWith("MAY")) return "MAYO";
  if (m.startsWith("JUN")) return "JUNIO";
  if (m.startsWith("ENE")) return "ENERO";
  if (m.startsWith("FEB")) return "FEBRERO";
  return m;
}

function getRangoRapido(rapido: string): { gte: Date; lte: Date } | null {
  const now = new Date();
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1);

  if (rapido === "hoy")    return { gte: hoy, lte: manana };
  if (rapido === "semana") {
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    return { gte: lunes, lte: manana };
  }
  if (rapido === "mes") {
    return { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: manana };
  }
  return null;
}

async function getDashboardData(params: {
  mes?: string;
  rapido?: string;
  sucursalId?: string;
  depositado?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  monto_min?: string;
  monto_max?: string;
}): Promise<DashboardData> {
  const { mes, rapido, sucursalId, depositado, fecha_desde, fecha_hasta, monto_min, monto_max } = params;

  const whereT: Record<string, unknown> = {};
  const whereG: Record<string, unknown> = {};

  // Filtro por mes textual
  if (mes) {
    whereT.mes = { contains: mes.slice(0, 3), mode: "insensitive" };
    whereG.mes = { contains: mes.slice(0, 3), mode: "insensitive" };
  }

  // Filtro por rango rápido de fechas (hoy / semana / mes actual)
  const rangoRapido = rapido ? getRangoRapido(rapido) : null;
  if (rangoRapido) {
    whereT.fecha = rangoRapido;
    whereG.fecha = rangoRapido;
  }

  // Filtro por rango de fecha manual (tiene prioridad sobre rápido si coexisten)
  if (fecha_desde || fecha_hasta) {
    const fechaFiltro: Record<string, Date> = {};
    if (fecha_desde) fechaFiltro.gte = new Date(fecha_desde);
    if (fecha_hasta) {
      const hasta = new Date(fecha_hasta);
      hasta.setDate(hasta.getDate() + 1); // incluir el día completo
      fechaFiltro.lte = hasta;
    }
    whereT.fecha = fechaFiltro;
    whereG.fecha = fechaFiltro;
  }

  // Filtro por sucursal
  if (sucursalId && sucursalId !== "todas") {
    whereT.sucursal_id = sucursalId;
    whereG.sucursal_id = sucursalId;
  }

  // Filtro: Solo efectivo
  if (rapido === "efectivo") {
    whereT.forma_pago = { contains: "efectivo", mode: "insensitive" };
  }

  // Filtro: Sin depositar
  if (rapido === "sin_depositar" || depositado === "no") {
    whereT.forma_pago = { contains: "efectivo", mode: "insensitive" };
    whereT.efectivo_depositado = false;
  }
  if (depositado === "si") {
    whereT.efectivo_depositado = true;
  }

  // Filtro por monto
  if (monto_min || monto_max) {
    const montoFiltro: Record<string, number> = {};
    if (monto_min) montoFiltro.gte = parseFloat(monto_min);
    if (monto_max) montoFiltro.lte = parseFloat(monto_max);
    whereT.total = montoFiltro;
  }

  // ── Queries en paralelo ──────────────────────────────────────
  const [sucursales, transacciones, gastos, todasTransacciones, todosGastos] = await Promise.all([
    prisma.sucursal.findMany({ where: { activa: true } }),

    prisma.transaccion.findMany({
      where: whereT,
      select: {
        sucursal_id: true,
        total: true,
        forma_pago: true,
        efectivo_depositado: true,
        mes: true,
        fecha: true,
      },
    }),

    prisma.gasto.findMany({
      where: whereG,
      select: { sucursal_id: true, total: true, emisor_nombre: true, mes: true },
    }),

    // Resumen mensual siempre sobre datos globales
    prisma.transaccion.findMany({ select: { mes: true, total: true } }),
    prisma.gasto.findMany({ select: { mes: true, total: true } }),
  ]);

  // ── Resumen por sucursal ─────────────────────────────────────
  const sucursalesFiltradas = (sucursalId && sucursalId !== "todas")
    ? sucursales.filter(s => s.id === sucursalId)
    : sucursales;

  const resumenSucursales = sucursalesFiltradas.map((suc) => {
    const ti = transacciones.filter(t => t.sucursal_id === suc.id);
    const gi = gastos.filter(g => g.sucursal_id === suc.id);
    const total_ingresos = ti.reduce((s, t) => s + t.total, 0);
    const total_gastos   = gi.reduce((s, g) => s + g.total, 0);
    const efectivo_sin_depositar = ti
      .filter(t => t.forma_pago?.toLowerCase().includes("efectivo") && !t.efectivo_depositado)
      .reduce((s, t) => s + t.total, 0);
    return {
      id: suc.id, nombre: suc.nombre, serie_prefix: suc.serie_prefix,
      total_ingresos, total_gastos,
      utilidad_bruta: total_ingresos - total_gastos,
      num_transacciones: ti.length, efectivo_sin_depositar,
    };
  });

  const gran_total_ingresos = transacciones.reduce((s, t) => s + t.total, 0);
  const gran_total_gastos   = gastos.reduce((s, g) => s + g.total, 0);

  // ── Formas de pago ───────────────────────────────────────────
  const fpMap = new Map<string, number>();
  transacciones.forEach(t => {
    const f = normalizarFormaPago(t.forma_pago || "Sin especificar");
    fpMap.set(f, (fpMap.get(f) || 0) + t.total);
  });
  const formas_pago = Array.from(fpMap.entries())
    .map(([forma, total]) => ({ forma, total, porcentaje: gran_total_ingresos > 0 ? (total/gran_total_ingresos)*100 : 0 }))
    .sort((a, b) => b.total - a.total);

  // ── Top proveedores ──────────────────────────────────────────
  const provMap = new Map<string, number>();
  gastos.forEach(g => {
    const p = g.emisor_nombre || "Sin nombre";
    provMap.set(p, (provMap.get(p) || 0) + g.total);
  });
  const top_proveedores = Array.from(provMap.entries())
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // ── Resumen mensual global ───────────────────────────────────
  const mMap = new Map<string, { ingresos: number; gastos: number }>();
  todasTransacciones.forEach(t => {
    const m = normalizarMes(t.mes || "?");
    const a = mMap.get(m) || { ingresos: 0, gastos: 0 };
    mMap.set(m, { ...a, ingresos: a.ingresos + t.total });
  });
  todosGastos.forEach(g => {
    const m = normalizarMes(g.mes || "?");
    const a = mMap.get(m) || { ingresos: 0, gastos: 0 };
    mMap.set(m, { ...a, gastos: a.gastos + g.total });
  });
  const resumen_mensual = Array.from(mMap.entries()).map(([mes, v]) => ({
    mes, total_ingresos: v.ingresos, total_gastos: v.gastos, utilidad: v.ingresos - v.gastos,
  }));

  // ── Etiqueta de período ──────────────────────────────────────
  const labels: Record<string, string> = {
    hoy: "Hoy", semana: "Esta semana", mes: "Este mes",
    sin_depositar: "Sin depositar", efectivo: "Solo efectivo",
  };
  let periodo = "Todo el período";
  if (rapido)       periodo = labels[rapido] || "Todo el período";
  else if (mes)     periodo = mes.charAt(0) + mes.slice(1).toLowerCase();
  else if (fecha_desde && fecha_hasta) periodo = `${fecha_desde} – ${fecha_hasta}`;
  else if (fecha_desde) periodo = `Desde ${fecha_desde}`;
  else if (fecha_hasta) periodo = `Hasta ${fecha_hasta}`;

  return {
    gran_total_ingresos,
    gran_total_gastos,
    utilidad_neta: gran_total_ingresos - gran_total_gastos,
    sucursales: resumenSucursales,
    resumen_mensual,
    formas_pago,
    top_proveedores,
    efectivo_sin_depositar: resumenSucursales.reduce((s, r) => s + r.efectivo_sin_depositar, 0),
    periodo,
  };
}

interface PageProps {
  searchParams: Promise<{
    mes?: string;
    rapido?: string;
    sucursal?: string;
    depositado?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    monto_min?: string;
    monto_max?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const p = await searchParams;
  const data = await getDashboardData({
    mes:         p.mes,
    rapido:      p.rapido,
    sucursalId:  p.sucursal,
    depositado:  p.depositado,
    fecha_desde: p.fecha_desde,
    fecha_hasta: p.fecha_hasta,
    monto_min:   p.monto_min,
    monto_max:   p.monto_max,
  });
  return (
    <AppShell>
      <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
        <DashboardClient data={data} />
      </Suspense>
    </AppShell>
  );
}
