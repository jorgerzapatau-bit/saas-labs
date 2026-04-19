// app/api/dashboard/route.ts
// API Route principal del Dashboard — Next.js App Router

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { DashboardData, ResumenSucursal } from "@/types";

export const dynamic = "force-dynamic"; // siempre datos frescos

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mes = searchParams.get("mes") || undefined; // filtro opcional: "MARZO"
    const año = searchParams.get("año") || undefined;

    // ── Construir filtros ──────────────────────────────────────
    const whereTransacciones: Record<string, unknown> = {};
    const whereGastos: Record<string, unknown> = {};
    if (mes) {
      // El mes puede tener variantes (MARO, MARZO, etc.) — buscar con contains
      whereTransacciones.mes = { contains: mes.slice(0, 3), mode: "insensitive" };
      whereGastos.mes = { contains: mes.slice(0, 3), mode: "insensitive" };
    }

    // ── Queries en paralelo para rendimiento ──────────────────
    const [sucursales, transacciones, gastos, todasTransacciones] = await Promise.all([
      // 1. Catálogo de sucursales
      prisma.sucursal.findMany({ where: { activa: true } }),

      // 2. Ingresos (con filtro)
      prisma.transaccion.findMany({
        where: whereTransacciones,
        select: {
          sucursal_id: true,
          total: true,
          forma_pago: true,
          efectivo_depositado: true,
          mes: true,
          fecha: true,
        },
      }),

      // 3. Gastos (con filtro)
      prisma.gasto.findMany({
        where: whereGastos,
        select: {
          sucursal_id: true,
          total: true,
          emisor_nombre: true,
          mes: true,
        },
      }),

      // 4. Para período sin filtro (resumen mensual)
      !mes
        ? prisma.transaccion.findMany({
            select: { mes: true, total: true },
          })
        : Promise.resolve([]),
    ]);

    // ── Cálculo por sucursal ──────────────────────────────────
    const resumenSucursales: ResumenSucursal[] = sucursales.map((suc) => {
      const ingresosSuc = transacciones.filter((t) => t.sucursal_id === suc.id);
      const gastosSuc = gastos.filter((g) => g.sucursal_id === suc.id);

      const total_ingresos = ingresosSuc.reduce((sum, t) => sum + t.total, 0);
      const total_gastos = gastosSuc.reduce((sum, g) => sum + g.total, 0);
      const efectivo_sin_depositar = ingresosSuc
        .filter(
          (t) =>
            t.forma_pago?.toLowerCase().includes("efectivo") &&
            !t.efectivo_depositado
        )
        .reduce((sum, t) => sum + t.total, 0);

      return {
        id: suc.id,
        nombre: suc.nombre,
        serie_prefix: suc.serie_prefix,
        total_ingresos,
        total_gastos,
        utilidad_bruta: total_ingresos - total_gastos,
        num_transacciones: ingresosSuc.length,
        efectivo_sin_depositar,
      };
    });

    // ── Gran total ────────────────────────────────────────────
    const gran_total_ingresos = transacciones.reduce((sum, t) => sum + t.total, 0);
    const gran_total_gastos = gastos.reduce((sum, g) => sum + g.total, 0);
    const efectivo_sin_depositar = resumenSucursales.reduce(
      (sum, s) => sum + s.efectivo_sin_depositar,
      0
    );

    // ── Formas de pago ────────────────────────────────────────
    const formasPagoMap = new Map<string, number>();
    transacciones.forEach((t) => {
      const forma = normalizarFormaPago(t.forma_pago || "Sin especificar");
      formasPagoMap.set(forma, (formasPagoMap.get(forma) || 0) + t.total);
    });
    const formas_pago = Array.from(formasPagoMap.entries())
      .map(([forma, total]) => ({
        forma,
        total,
        porcentaje: gran_total_ingresos > 0 ? (total / gran_total_ingresos) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // ── Top proveedores (gastos) ──────────────────────────────
    const proveedoresMap = new Map<string, number>();
    gastos.forEach((g) => {
      const prov = g.emisor_nombre || "Sin nombre";
      proveedoresMap.set(prov, (proveedoresMap.get(prov) || 0) + g.total);
    });
    const top_proveedores = Array.from(proveedoresMap.entries())
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // ── Resumen mensual ───────────────────────────────────────
    const fuenteMensual = mes ? transacciones : todasTransacciones;
    const mesesMap = new Map<string, { ingresos: number; gastos: number }>();
    fuenteMensual.forEach((t) => {
      const m = normalizarMes(t.mes || "?");
      const actual = mesesMap.get(m) || { ingresos: 0, gastos: 0 };
      mesesMap.set(m, { ...actual, ingresos: actual.ingresos + t.total });
    });
    gastos.forEach((g) => {
      const m = normalizarMes(g.mes || "?");
      const actual = mesesMap.get(m) || { ingresos: 0, gastos: 0 };
      mesesMap.set(m, { ...actual, gastos: actual.gastos + g.total });
    });
    const resumen_mensual = Array.from(mesesMap.entries()).map(([mes, v]) => ({
      mes,
      total_ingresos: v.ingresos,
      total_gastos: v.gastos,
      utilidad: v.ingresos - v.gastos,
    }));

    const data: DashboardData = {
      gran_total_ingresos,
      gran_total_gastos,
      utilidad_neta: gran_total_ingresos - gran_total_gastos,
      sucursales: resumenSucursales,
      resumen_mensual,
      formas_pago,
      top_proveedores,
      efectivo_sin_depositar,
      periodo: mes || "Todo el período",
    };

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[API/dashboard] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

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
  // Corregir errores tipográficos conocidos
  if (m.startsWith("MAR")) return "MARZO";
  if (m.startsWith("ABR")) return "ABRIL";
  if (m.startsWith("MAY")) return "MAYO";
  if (m.startsWith("JUN")) return "JUNIO";
  if (m.startsWith("ENE")) return "ENERO";
  if (m.startsWith("FEB")) return "FEBRERO";
  return m;
}
