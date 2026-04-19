// app/gastos/page.tsx
// Ruta: app/gastos/page.tsx

import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import GastosClient from "@/components/GastosClient";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    unidad?: string;
    categorias?: string;      // separadas por coma
    forma_pago?: string;
    proveedor?: string;
    monto_min?: string;
    monto_max?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    orden_campo?: string;
    orden_dir?: string;
    grupo?: string;
    rapido?: string;          // hoy | semana | mes | altos | efectivo | recurrentes
  }>;
}

export default async function GastosPage({ searchParams }: PageProps) {
  const p = await searchParams;
  const page  = Math.max(1, parseInt(p.page || "1"));
  const limit = 50;

  // ── Construir where de Prisma ────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  // Búsqueda global
  if (p.search) {
    where.OR = [
      { emisor_nombre: { contains: p.search, mode: "insensitive" } },
      { descripcion:   { contains: p.search, mode: "insensitive" } },
      { categoria:     { is: { nombre: { contains: p.search, mode: "insensitive" } } } },
    ];
  }

  // Unidad / sucursal
  if (p.unidad && p.unidad !== "todas") {
    where.sucursal = { is: { nombre: { contains: p.unidad, mode: "insensitive" } } };
  }

  // Categorías (multi)
  if (p.categorias) {
    const cats = p.categorias.split(",").filter(Boolean);
    if (cats.length) where.categoria = { is: { nombre: { in: cats } } };
  }

  // Forma de pago
  if (p.forma_pago) {
    where.forma_pago = { contains: p.forma_pago, mode: "insensitive" };
  }

  // Proveedor
  if (p.proveedor) {
    where.emisor_nombre = { contains: p.proveedor, mode: "insensitive" };
  }

  // Rango de montos
  if (p.monto_min || p.monto_max) {
    where.total = {};
    if (p.monto_min) where.total.gte = parseFloat(p.monto_min);
    if (p.monto_max) where.total.lte = parseFloat(p.monto_max);
  }

  // Rango de fechas
  if (p.fecha_desde || p.fecha_hasta) {
    where.fecha = {};
    if (p.fecha_desde) where.fecha.gte = new Date(p.fecha_desde);
    if (p.fecha_hasta) {
      const hasta = new Date(p.fecha_hasta);
      hasta.setHours(23, 59, 59, 999);
      where.fecha.lte = hasta;
    }
  }

  // Filtros rápidos
  const hoy = new Date();
  if (p.rapido === "hoy") {
    const inicio = new Date(hoy); inicio.setHours(0,0,0,0);
    const fin    = new Date(hoy); fin.setHours(23,59,59,999);
    where.fecha = { gte: inicio, lte: fin };
  } else if (p.rapido === "semana") {
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - hoy.getDay());
    inicio.setHours(0,0,0,0);
    where.fecha = { gte: inicio };
  } else if (p.rapido === "mes") {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    where.fecha = { gte: inicio };
  } else if (p.rapido === "efectivo") {
    where.forma_pago = { contains: "efectivo", mode: "insensitive" };
  }

  // Ordenamiento
  const camposOrden: Record<string, object> = {
    fecha:    { fecha: p.orden_dir === "asc" ? "asc" : "desc" },
    total:    { total: p.orden_dir === "asc" ? "asc" : "desc" },
    proveedor:{ emisor_nombre: p.orden_dir === "asc" ? "asc" : "desc" },
    categoria:{ categoria: { nombre: p.orden_dir === "asc" ? "asc" : "desc" } },
  };
  const orderBy = camposOrden[p.orden_campo || "fecha"] || { fecha: "desc" };

  // ── Queries ─────────────────────────────────────────────
  const include = {
    sucursal:  { select: { nombre: true } },
    categoria: { select: { nombre: true, color: true } },
  };

  const [allFiltered, total, categorias, sucursales, formasPago] = await Promise.all([
    // Para filtro "altos" necesitamos todos primero, luego paginamos en cliente
    p.rapido === "altos"
      ? prisma.gasto.findMany({ where, orderBy: { total: "desc" }, take: 10, include })
      : prisma.gasto.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit, include }),
    prisma.gasto.count({ where }),
    // Metadatos para dropdowns
    prisma.categoria.findMany({ select: { nombre: true, color: true }, orderBy: { nombre: "asc" } }),
    prisma.sucursal.findMany({ select: { nombre: true }, where: { activa: true } }),
    prisma.gasto.groupBy({
      by: ["forma_pago"],
      _count: true,
      where: { forma_pago: { not: null } },
      orderBy: { _count: { forma_pago: "desc" } },
    }),
  ]);

  // Suma total de todos los registros filtrados (sin paginación)
  const sumaFiltrada = await prisma.gasto.aggregate({ where, _sum: { total: true, iva: true, subtotal: true } });

  // Proveedores para autocompletado
  const proveedoresTop = await prisma.gasto.groupBy({
    by: ["emisor_nombre"],
    _sum: { total: true },
    where: { emisor_nombre: { not: null } },
    orderBy: { _sum: { total: "desc" } },
    take: 30,
  });

  return (
    <AppShell>
      <GastosClient
        data={allFiltered as GastoRow[]}
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
          categorias: categorias,
          sucursales: sucursales.map((s) => s.nombre),
          formasPago: formasPago.map((f) => f.forma_pago!).filter(Boolean),
          proveedores: proveedoresTop.map((p) => p.emisor_nombre!).filter(Boolean),
        }}
        filtrosActivos={{
          search:       p.search       || "",
          unidad:       p.unidad       || "todas",
          categorias:   p.categorias   ? p.categorias.split(",").filter(Boolean) : [],
          forma_pago:   p.forma_pago   || "",
          proveedor:    p.proveedor    || "",
          monto_min:    p.monto_min    || "",
          monto_max:    p.monto_max    || "",
          fecha_desde:  p.fecha_desde  || "",
          fecha_hasta:  p.fecha_hasta  || "",
          orden_campo:  p.orden_campo  || "fecha",
          orden_dir:    p.orden_dir    || "desc",
          grupo:        p.grupo        || "",
          rapido:       p.rapido       || "",
        }}
      />
    </AppShell>
  );
}

export interface GastoRow {
  id: string;
  fecha: Date;
  serie: string | null;
  folio: string | null;
  total: number;
  subtotal: number;
  iva: number;
  forma_pago: string | null;
  emisor_nombre: string | null;
  descripcion: string | null;
  mes: string | null;
  sucursal: { nombre: string } | null;
  categoria: { nombre: string; color: string } | null;
}
