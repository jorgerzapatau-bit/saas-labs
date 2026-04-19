// app/sucursales/page.tsx
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import SucursalesClient from "@/components/SucursalesClient";
import type { DashboardData, ResumenSucursal } from "@/types";

export const dynamic = "force-dynamic";

export default async function SucursalesPage() {
  const [sucursales, transacciones, gastos] = await Promise.all([
    prisma.sucursal.findMany({ where: { activa: true } }),
    prisma.transaccion.findMany({
      select: {
        sucursal_id: true,
        total: true,
        forma_pago: true,
        efectivo_depositado: true,
        mes: true,
      },
    }),
    prisma.gasto.findMany({
      select: {
        sucursal_id: true,
        total: true,
        emisor_nombre: true,
        mes: true,
      },
    }),
  ]);

  const resumenSucursales: ResumenSucursal[] = sucursales.map((suc) => {
    const ing = transacciones.filter((t) => t.sucursal_id === suc.id);
    const gas = gastos.filter((g) => g.sucursal_id === suc.id);
    const total_ingresos = ing.reduce((s, t) => s + t.total, 0);
    const total_gastos = gas.reduce((s, g) => s + g.total, 0);
    const efectivo_sin_depositar = ing
      .filter((t) => t.forma_pago?.toLowerCase().includes("efectivo") && !t.efectivo_depositado)
      .reduce((s, t) => s + t.total, 0);
    return {
      id: suc.id,
      nombre: suc.nombre,
      serie_prefix: suc.serie_prefix,
      total_ingresos,
      total_gastos,
      utilidad_bruta: total_ingresos - total_gastos,
      num_transacciones: ing.length,
      efectivo_sin_depositar,
    };
  });

  const gran_total_ingresos = transacciones.reduce((s, t) => s + t.total, 0);
  const gran_total_gastos = gastos.reduce((s, g) => s + g.total, 0);
  const efectivo_sin_depositar = resumenSucursales.reduce((s, r) => s + r.efectivo_sin_depositar, 0);

  // Formas de pago
  const formasPagoMap = new Map<string, number>();
  transacciones.forEach((t) => {
    const f = normalizarFormaPago(t.forma_pago || "Sin especificar");
    formasPagoMap.set(f, (formasPagoMap.get(f) || 0) + t.total);
  });
  const formas_pago = Array.from(formasPagoMap.entries())
    .map(([forma, total]) => ({ forma, total, porcentaje: gran_total_ingresos > 0 ? (total / gran_total_ingresos) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);

  // Top proveedores
  const provsMap = new Map<string, number>();
  gastos.forEach((g) => {
    const p = g.emisor_nombre || "Sin nombre";
    provsMap.set(p, (provsMap.get(p) || 0) + g.total);
  });
  const top_proveedores = Array.from(provsMap.entries())
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const data: DashboardData = {
    gran_total_ingresos,
    gran_total_gastos,
    utilidad_neta: gran_total_ingresos - gran_total_gastos,
    sucursales: resumenSucursales,
    resumen_mensual: [],
    formas_pago,
    top_proveedores,
    efectivo_sin_depositar,
    periodo: "Todo el período",
  };

  return (
    <AppShell>
      <SucursalesClient data={data} />
    </AppShell>
  );
}

function normalizarFormaPago(forma: string): string {
  const f = forma.toLowerCase();
  if (f.includes("efectivo")) return "Efectivo";
  if (f.includes("tarjeta de cr")) return "Tarjeta Crédito";
  if (f.includes("tarjeta de d") || f.includes("débito")) return "Tarjeta Débito";
  if (f.includes("transfer")) return "Transferencia";
  return forma;
}
