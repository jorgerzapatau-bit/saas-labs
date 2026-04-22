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

/** Devuelve el rango de fechas [desde, hasta] para un filtro rápido */
function getRangoRapido(rapido: string): { gte: Date; lte: Date } | null {
  const now = new Date();
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1);

  if (rapido === "hoy") {
    return { gte: hoy, lte: manana };
  }
  if (rapido === "semana") {
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7)); // lunes de esta semana
    return { gte: lunes, lte: manana };
  }
  if (rapido === "mes") {
    const primerDia = new Date(now.getFullYear(), now.getMonth(), 1);
    return { gte: primerDia, lte: manana };
  }
  return null;
}

async function getDashboardData(
  mes?: string,
  rapido?: string,
  sucursalId?: string,
  depositado?: string
): Promise<DashboardData> {

  // ── Construir filtros de transacciones ───────────────────────
  const whereT: Record<string, unknown> = {};
  const whereG: Record<string, unknown> = {};

  // Filtro por mes textual (MARZO, ABRIL…)
  if (mes) {
    whereT.mes = { contains: mes.slice(0, 3), mode: "insensitive" };
    whereG.mes = { contains: mes.slice(0, 3), mode: "insensitive" };
  }

  // Filtro por rango de fechas (hoy / semana / mes actual)
  const rango = rapido ? getRangoRapido(rapido) : null;
  if (rango) {
    whereT.fecha = rango;
    whereG.fecha = rango;
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

  // Filtro: Sin depositar (efectivo no depositado)
  if (rapido === "sin_depositar" || depositado === "no") {
    whereT.forma_pago = { contains: "efectivo", mode: "insensitive" };
    whereT.efectivo_depositado = false;
  }
  if (depositado === "si") {
    whereT.efectivo_depositado = true;
  }

  // ── Queries en paralelo ──────────────────────────────────────
  const [sucursales, transacciones, gastos, todasTransacciones] = await Promise.all([
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

    // Resumen mensual siempre desde todos los datos (sin filtro de fecha/rápido)
    prisma.transaccion.findMany({
      select: { mes: true, total: true },
    }),
  ]);

  // ── Resumen por sucursal ─────────────────────────────────────
  const sucursalesFiltradas = (sucursalId && sucursalId !== "todas")
    ? sucursales.filter(s => s.id === sucursalId)
    : sucursales;

  const resumenSucursales = sucursalesFiltradas.map((suc) => {
    const ti = transacciones.filter((t) => t.sucursal_id === suc.id);
    const gi = gastos.filter((g) => g.sucursal_id === suc.id);
    const total_ingresos = ti.reduce((s, t) => s + t.total, 0);
    const total_gastos = gi.reduce((s, g) => s + g.total, 0);
    const efectivo_sin_depositar = ti
      .filter((t) => t.forma_pago?.toLowerCase().includes("efectivo") && !t.efectivo_depositado)
      .reduce((s, t) => s + t.total, 0);
    return {
      id: suc.id,
      nombre: suc.nombre,
      serie_prefix: suc.serie_prefix,
      total_ingresos,
      total_gastos,
      utilidad_bruta: total_ingresos - total_gastos,
      num_transacciones: ti.length,
      efectivo_sin_depositar,
    };
  });

  const gran_total_ingresos = transacciones.reduce((s, t) => s + t.total, 0);
  const gran_total_gastos = gastos.reduce((s, g) => s + g.total, 0);

  // ── Formas de pago ───────────────────────────────────────────
  const fpMap = new Map<string, number>();
  transacciones.forEach((t) => {
    const f = normalizarFormaPago(t.forma_pago || "Sin especificar");
    fpMap.set(f, (fpMap.get(f) || 0) + t.total);
  });
  const formas_pago = Array.from(fpMap.entries())
    .map(([forma, total]) => ({
      forma, total,
      porcentaje: gran_total_ingresos > 0 ? (total / gran_total_ingresos) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // ── Top proveedores ──────────────────────────────────────────
  const provMap = new Map<string, number>();
  gastos.forEach((g) => {
    const p = g.emisor_nombre || "Sin nombre";
    provMap.set(p, (provMap.get(p) || 0) + g.total);
  });
  const top_proveedores = Array.from(provMap.entries())
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // ── Resumen mensual (siempre sobre todos los datos) ──────────
  const mMap = new Map<string, { ingresos: number; gastos: number }>();
  todasTransacciones.forEach((t) => {
    const m = normalizarMes(t.mes || "?");
    const a = mMap.get(m) || { ingresos: 0, gastos: 0 };
    mMap.set(m, { ...a, ingresos: a.ingresos + t.total });
  });
  // Para gastos del resumen mensual, usar gastos sin filtro de fecha
  const todosGastos = await prisma.gasto.findMany({
    select: { mes: true, total: true },
  });
  todosGastos.forEach((g) => {
    const m = normalizarMes(g.mes || "?");
    const a = mMap.get(m) || { ingresos: 0, gastos: 0 };
    mMap.set(m, { ...a, gastos: a.gastos + g.total });
  });
  const resumen_mensual = Array.from(mMap.entries()).map(([mes, v]) => ({
    mes,
    total_ingresos: v.ingresos,
    total_gastos: v.gastos,
    utilidad: v.ingresos - v.gastos,
  }));

  // ── Etiqueta de período ──────────────────────────────────────
  const labels: Record<string, string> = {
    hoy: "Hoy",
    semana: "Esta semana",
    mes: "Este mes",
    sin_depositar: "Sin depositar",
    efectivo: "Solo efectivo",
  };
  const periodo = rapido
    ? labels[rapido] || "Todo el período"
    : mes
    ? mes.charAt(0) + mes.slice(1).toLowerCase()
    : "Todo el período";

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
  }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getDashboardData(
    params.mes,
    params.rapido,
    params.sucursal,
    params.depositado
  );
  return (
    <AppShell>
      <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
        <DashboardClient data={data} />
      </Suspense>
    </AppShell>
  );
}
