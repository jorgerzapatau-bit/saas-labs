// app/dashboard/page.tsx  (versión final con AppShell)
import { prisma } from "@/lib/prisma";
import type { DashboardData } from "@/types";
import DashboardClient from "@/components/DashboardClient";
import AppShell from "@/components/AppShell";
import { Suspense } from "react";

async function getDashboardData(mes?: string): Promise<DashboardData> {
  const whereT: Record<string, unknown> = {};
  const whereG: Record<string, unknown> = {};
  if (mes) {
    whereT.mes = { contains: mes.slice(0, 3), mode: "insensitive" };
    whereG.mes = { contains: mes.slice(0, 3), mode: "insensitive" };
  }

  const [sucursales, transacciones, gastos] = await Promise.all([
    prisma.sucursal.findMany({ where: { activa: true } }),
    prisma.transaccion.findMany({
      where: whereT,
      select: {
        sucursal_id: true, total: true, forma_pago: true,
        efectivo_depositado: true, mes: true,
      },
    }),
    prisma.gasto.findMany({
      where: whereG,
      select: { sucursal_id: true, total: true, emisor_nombre: true, mes: true },
    }),
  ]);

  const gran_total_ingresos = transacciones.reduce((s, t) => s + t.total, 0);
  const gran_total_gastos   = gastos.reduce((s, g) => s + g.total, 0);

  const resumenSucursales = sucursales.map((suc) => {
    const ti = transacciones.filter((t) => t.sucursal_id === suc.id);
    const gi = gastos.filter((g) => g.sucursal_id === suc.id);
    const total_ingresos = ti.reduce((s, t) => s + t.total, 0);
    const total_gastos   = gi.reduce((s, g) => s + g.total, 0);
    const efectivo_sin_depositar = ti
      .filter((t) => t.forma_pago?.toLowerCase().includes("efectivo") && !t.efectivo_depositado)
      .reduce((s, t) => s + t.total, 0);
    return {
      id: suc.id, nombre: suc.nombre, serie_prefix: suc.serie_prefix,
      total_ingresos, total_gastos,
      utilidad_bruta: total_ingresos - total_gastos,
      num_transacciones: ti.length, efectivo_sin_depositar,
    };
  });

  const fpMap = new Map<string, number>();
  transacciones.forEach((t) => {
    const f = normalizarFormaPago(t.forma_pago || "Sin especificar");
    fpMap.set(f, (fpMap.get(f) || 0) + t.total);
  });
  const formas_pago = Array.from(fpMap.entries())
    .map(([forma, total]) => ({ forma, total, porcentaje: gran_total_ingresos > 0 ? (total / gran_total_ingresos) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);

  const provMap = new Map<string, number>();
  gastos.forEach((g) => { const p = g.emisor_nombre || "Sin nombre"; provMap.set(p, (provMap.get(p) || 0) + g.total); });
  const top_proveedores = Array.from(provMap.entries())
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total).slice(0, 8);

  const mMap = new Map<string, { ingresos: number; gastos: number }>();
  transacciones.forEach((t) => {
    const m = normalizarMes(t.mes || "?");
    const a = mMap.get(m) || { ingresos: 0, gastos: 0 };
    mMap.set(m, { ...a, ingresos: a.ingresos + t.total });
  });
  gastos.forEach((g) => {
    const m = normalizarMes(g.mes || "?");
    const a = mMap.get(m) || { ingresos: 0, gastos: 0 };
    mMap.set(m, { ...a, gastos: a.gastos + g.total });
  });
  const resumen_mensual = Array.from(mMap.entries()).map(([mes, v]) => ({
    mes, total_ingresos: v.ingresos, total_gastos: v.gastos, utilidad: v.ingresos - v.gastos,
  }));

  return {
    gran_total_ingresos, gran_total_gastos,
    utilidad_neta: gran_total_ingresos - gran_total_gastos,
    sucursales: resumenSucursales, resumen_mensual, formas_pago, top_proveedores,
    efectivo_sin_depositar: resumenSucursales.reduce((s, r) => s + r.efectivo_sin_depositar, 0),
    periodo: mes || "Todo el período",
  };
}

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

interface PageProps { searchParams: Promise<{ mes?: string }> }

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await getDashboardData(params.mes);
  return (
    <AppShell>
      <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
        <DashboardClient data={data} />
      </Suspense>
    </AppShell>
  );
}
