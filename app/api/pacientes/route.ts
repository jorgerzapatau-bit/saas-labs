// app/api/pacientes/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anio   = parseInt(searchParams.get("anio")  || "2026");
  const mesNum = searchParams.get("mes_num") ? parseInt(searchParams.get("mes_num")!) : null;

  const where: Record<string, unknown> = { anio };
  if (mesNum) where.mes_num = mesNum;

  const [sucursales, rows] = await Promise.all([
    prisma.sucursal.findMany({ where: { activa: true }, select: { id: true, nombre: true, serie_prefix: true } }),
    prisma.reportePacientesDiario.findMany({ where, orderBy: [{ mes_num: "asc" }, { dia: "asc" }] }),
  ]);

  // Resumen por mes y sucursal
  type MesKey = string;
  type SucursalResumen = { total_pacientes: number; total_ingresos: number; dias: number; max_pacientes: number };
  const resumenMap = new Map<MesKey, Record<string, SucursalResumen>>();

  for (const row of rows) {
    const key = `${row.mes_num}-${row.mes}`;
    if (!resumenMap.has(key)) resumenMap.set(key, {});
    const mes = resumenMap.get(key)!;
    if (!mes[row.sucursal_id]) mes[row.sucursal_id] = { total_pacientes: 0, total_ingresos: 0, dias: 0, max_pacientes: 0 };
    const s = mes[row.sucursal_id];
    s.total_pacientes += row.num_pacientes;
    s.total_ingresos  += row.ingreso_dia;
    if (row.num_pacientes > 0) s.dias++;
    if (row.num_pacientes > s.max_pacientes) s.max_pacientes = row.num_pacientes;
  }

  const meses = Array.from(resumenMap.entries())
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([key, sucMap]) => {
      const [mes_num, mes] = key.split("-");
      return {
        mes_num: parseInt(mes_num),
        mes,
        sucursales: sucursales.map((suc) => ({
          ...suc,
          ...(sucMap[suc.id] || { total_pacientes: 0, total_ingresos: 0, dias: 0, max_pacientes: 0 }),
        })),
      };
    });

  // Detalle diario (para mes seleccionado)
  const detalleDiario = mesNum
    ? rows.map((r) => ({
        dia: r.dia,
        sucursal_id: r.sucursal_id,
        num_pacientes: r.num_pacientes,
        ingreso_dia: r.ingreso_dia,
      }))
    : [];

  // KPIs globales
  const totalPacientes = rows.reduce((s, r) => s + r.num_pacientes, 0);
  const totalIngresos  = rows.reduce((s, r) => s + r.ingreso_dia, 0);

  return NextResponse.json({ sucursales, meses, detalleDiario, totalPacientes, totalIngresos, anio, mesNum });
}
