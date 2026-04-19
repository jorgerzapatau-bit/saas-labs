// app/gastos/page.tsx
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import GastosClient from "@/components/GastosClient";

interface PageProps {
  searchParams: Promise<{ page?: string; mes?: string }>;
}

export default async function GastosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page  = parseInt(params.page || "1");
  const limit = 30;

  const where: Record<string, unknown> = {};
  if (params.mes) where.mes = { contains: params.mes.slice(0, 3), mode: "insensitive" };

  const [data, total] = await Promise.all([
    prisma.gasto.findMany({
      where,
      orderBy: { fecha: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sucursal:  { select: { nombre: true } },
        categoria: { select: { nombre: true, color: true } },
      },
    }),
    prisma.gasto.count({ where }),
  ]);

  return (
    <AppShell>
      <GastosClient
        data={data as GastoRow[]}
        total={total}
        page={page}
        limit={limit}
        filtros={{ mes: params.mes || "" }}
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
