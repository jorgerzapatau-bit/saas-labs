// app/transacciones/page.tsx
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import TransaccionesClient from "@/components/TransaccionesClient";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    unidad?: string;
    forma_pago?: string;
    tipo_gasto?: string;
    monto_min?: string;
    monto_max?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    orden_campo?: string;
    orden_dir?: string;
    grupo?: string;
    rapido?: string;
    depositado?: string;
  }>;
}

export default async function TransaccionesPage({ searchParams }: PageProps) {
  const p = await searchParams;
  const page  = Math.max(1, parseInt(p.page || "1"));
  const limit = 50;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (p.search) {
    where.OR = [
      { emisor_nombre:  { contains: p.search, mode: "insensitive" } },
      { tipo_gasto:     { contains: p.search, mode: "insensitive" } },
      { forma_pago:     { contains: p.search, mode: "insensitive" } },
      { serie:          { contains: p.search, mode: "insensitive" } },
    ];
  }

  if (p.unidad && p.unidad !== "todas") {
    where.sucursal_id = p.unidad;
  }

  if (p.forma_pago) {
    where.forma_pago = { contains: p.forma_pago, mode: "insensitive" };
  }

  if (p.tipo_gasto) {
    where.tipo_gasto = { contains: p.tipo_gasto, mode: "insensitive" };
  }

  if (p.monto_min || p.monto_max) {
    where.total = {};
    if (p.monto_min) where.total.gte = parseFloat(p.monto_min);
    if (p.monto_max) where.total.lte = parseFloat(p.monto_max);
  }

  if (p.fecha_desde || p.fecha_hasta) {
    where.fecha = {};
    if (p.fecha_desde) where.fecha.gte = new Date(p.fecha_desde);
    if (p.fecha_hasta) {
      const hasta = new Date(p.fecha_hasta);
      hasta.setHours(23, 59, 59, 999);
      where.fecha.lte = hasta;
    }
  }

  if (p.depositado === "si")  where.efectivo_depositado = true;
  if (p.depositado === "no") {
    where.efectivo_depositado = false;
    where.forma_pago = { contains: "efectivo", mode: "insensitive" };
  }

  const hoy = new Date();
  if (p.rapido === "hoy") {
    const inicio = new Date(hoy); inicio.setHours(0, 0, 0, 0);
    const fin    = new Date(hoy); fin.setHours(23, 59, 59, 999);
    where.fecha = { gte: inicio, lte: fin };
  } else if (p.rapido === "semana") {
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - hoy.getDay());
    inicio.setHours(0, 0, 0, 0);
    where.fecha = { gte: inicio };
  } else if (p.rapido === "mes") {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    where.fecha = { gte: inicio };
  } else if (p.rapido === "efectivo") {
    where.forma_pago = { contains: "efectivo", mode: "insensitive" };
  } else if (p.rapido === "sin_depositar") {
    where.efectivo_depositado = false;
    where.forma_pago = { contains: "efectivo", mode: "insensitive" };
  }

  const camposOrden: Record<string, object> = {
    fecha:      { fecha:      p.orden_dir === "asc" ? "asc" : "desc" },
    total:      { total:      p.orden_dir === "asc" ? "asc" : "desc" },
    sucursal:   { sucursal:   { nombre: p.orden_dir === "asc" ? "asc" : "desc" } },
    forma_pago: { forma_pago: p.orden_dir === "asc" ? "asc" : "desc" },
  };
  const orderBy = camposOrden[p.orden_campo || "fecha"] || { fecha: "desc" };

  const include = {
    sucursal: { select: { nombre: true, serie_prefix: true } },
  };

  const [allFiltered, total, sucursales, formasPago, tiposGasto] = await Promise.all([
    p.rapido === "altos"
      ? prisma.transaccion.findMany({ where, orderBy: { total: "desc" }, take: 10, include })
      : prisma.transaccion.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit, include }),
    prisma.transaccion.count({ where }),
    prisma.sucursal.findMany({ select: { id: true, nombre: true, serie_prefix: true }, where: { activa: true } }),
    prisma.transaccion.groupBy({
      by: ["forma_pago"],
      _count: true,
      where: { forma_pago: { not: null } },
      orderBy: { _count: { forma_pago: "desc" } },
    }),
    prisma.transaccion.groupBy({
      by: ["tipo_gasto"],
      _count: true,
      where: { tipo_gasto: { not: null } },
      orderBy: { _count: { tipo_gasto: "desc" } },
    }),
  ]);

  const sumaFiltrada = await prisma.transaccion.aggregate({
    where,
    _sum: { total: true, iva: true, subtotal: true },
  });

  return (
    <AppShell>
      <TransaccionesClient
        data={allFiltered as TransaccionRow[]}
        total={p.rapido === "altos" ? allFiltered.length : total}
        page={page}
        limit={limit}
        sumaFiltrada={{
          total:    sumaFiltrada._sum.total    || 0,
          iva:      sumaFiltrada._sum.iva      || 0,
          subtotal: sumaFiltrada._sum.subtotal || 0,
          promedio: total > 0 ? (sumaFiltrada._sum.total || 0) / total : 0,
        }}
        meta={{
          sucursales,
          formasPago: formasPago.map((f) => f.forma_pago!).filter(Boolean),
          tiposGasto: tiposGasto.map((t) => t.tipo_gasto!).filter(Boolean),
        }}
        filtrosActivos={{
          search:      p.search      || "",
          unidad:      p.unidad      || "todas",
          forma_pago:  p.forma_pago  || "",
          tipo_gasto:  p.tipo_gasto  || "",
          monto_min:   p.monto_min   || "",
          monto_max:   p.monto_max   || "",
          fecha_desde: p.fecha_desde || "",
          fecha_hasta: p.fecha_hasta || "",
          orden_campo: p.orden_campo || "fecha",
          orden_dir:   p.orden_dir   || "desc",
          grupo:       p.grupo       || "",
          rapido:      p.rapido      || "",
          depositado:  p.depositado  || "",
        }}
      />
    </AppShell>
  );
}

export interface TransaccionRow {
  id: string;
  fecha: Date;
  serie: string;
  folio: number | null;
  total: number;
  subtotal: number;
  iva: number;
  forma_pago: string | null;
  emisor_nombre: string | null;
  tipo_gasto: string | null;
  efectivo_depositado: boolean;
  mes: string | null;
  sucursal: { nombre: string; serie_prefix: string } | null;
}
