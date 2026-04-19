// app/transacciones/page.tsx
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import TransaccionesClient from "@/components/TransaccionesClient";

interface PageProps {
  searchParams: Promise<{ page?: string; mes?: string; sucursal?: string }>;
}

export default async function TransaccionesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page  = parseInt(params.page || "1");
  const limit = 30;

  const where: Record<string, unknown> = {};
  if (params.mes)      where.mes         = { contains: params.mes.slice(0, 3), mode: "insensitive" };
  if (params.sucursal) where.sucursal_id = params.sucursal;

  const [data, total, sucursales] = await Promise.all([
    prisma.transaccion.findMany({
      where,
      orderBy: { fecha: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { sucursal: { select: { nombre: true, serie_prefix: true } } },
    }),
    prisma.transaccion.count({ where }),
    prisma.sucursal.findMany({ select: { id: true, nombre: true, serie_prefix: true } }),
  ]);

  return (
    <AppShell>
      <TransaccionesClient
        data={data as TransaccionRow[]}
        total={total}
        page={page}
        limit={limit}
        sucursales={sucursales}
        filtros={{ mes: params.mes || "", sucursal: params.sucursal || "" }}
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
