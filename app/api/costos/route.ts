// app/api/costos/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anio   = parseInt(searchParams.get("anio")  || "2026");
  const mesNum = searchParams.get("mes_num") ? parseInt(searchParams.get("mes_num")!) : null;

  const where: Record<string, unknown> = { anio };
  if (mesNum) where.mes_num = mesNum;

  const [sucursales, costos] = await Promise.all([
    prisma.sucursal.findMany({ where: { activa: true }, select: { id: true, nombre: true, serie_prefix: true } }),
    prisma.costoFijoMensual.findMany({
      where,
      orderBy: [{ mes_num: "asc" }, { sucursal_id: "asc" }, { categoria: "asc" }],
    }),
  ]);

  // Agrupar por categoría (global)
  const catMap = new Map<string, number>();
  for (const c of costos) {
    const cat = c.categoria || "OTROS";
    catMap.set(cat, (catMap.get(cat) || 0) + c.monto);
  }
  const porCategoria = Array.from(catMap.entries())
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);

  // Agrupar por sucursal y mes
  type SucMesKey = string;
  const sucMesMap = new Map<SucMesKey, { mes: string; mes_num: number; sucursal_id: string; total: number; conceptos: { concepto: string; categoria: string; monto: number }[] }>();
  
  for (const c of costos) {
    const key = `${c.sucursal_id || "sin-suc"}-${c.mes_num}`;
    if (!sucMesMap.has(key)) {
      sucMesMap.set(key, { mes: c.mes, mes_num: c.mes_num, sucursal_id: c.sucursal_id || "", total: 0, conceptos: [] });
    }
    const entry = sucMesMap.get(key)!;
    entry.total += c.monto;
    entry.conceptos.push({ concepto: c.concepto, categoria: c.categoria || "OTROS", monto: c.monto });
  }

  // Totales por sucursal
  const totalesPorSucursal = sucursales.map((suc) => {
    const total = costos.filter((c) => c.sucursal_id === suc.id).reduce((s, c) => s + c.monto, 0);
    const conceptos = costos
      .filter((c) => c.sucursal_id === suc.id)
      .map((c) => ({ concepto: c.concepto, categoria: c.categoria || "OTROS", monto: c.monto, mes: c.mes, mes_num: c.mes_num }));
    return { ...suc, total, conceptos };
  });

  // Meses disponibles
  const mesesSet = new Set<string>();
  costos.forEach((c) => mesesSet.add(`${c.mes_num}|${c.mes}`));
  const meses = Array.from(mesesSet)
    .map((k) => { const [n, m] = k.split("|"); return { mes_num: parseInt(n), mes: m }; })
    .sort((a, b) => a.mes_num - b.mes_num);

  const totalGeneral = costos.reduce((s, c) => s + c.monto, 0);

  return NextResponse.json({ sucursales, costos, porCategoria, totalesPorSucursal, meses, totalGeneral, anio });
}
