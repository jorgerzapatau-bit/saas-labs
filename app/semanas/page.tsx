// app/semanas/page.tsx
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import SemanasClient from "@/components/SemanasClient";

export default async function SemanasPage() {
  const [semanas, sucursales] = await Promise.all([
    prisma.ingresoSemanal.findMany({
      orderBy: [{ anio: "desc" }, { mes_num: "desc" }, { semana_codigo: "asc" }],
      include: { sucursal: { select: { nombre: true } } },
    }),
    prisma.sucursal.findMany({
      select: { id: true, nombre: true },
      where: { activa: true },
    }),
  ]);

  return (
    <AppShell>
      <SemanasClient
        data={semanas as SemanaSemanal[]}
        sucursales={sucursales}
      />
    </AppShell>
  );
}

export interface SemanaSemanal {
  id: string;
  anio: number;
  mes: string;
  mes_num: number;
  semana_codigo: string;
  tarjeta: number;
  efectivo: number;
  transferencia: number;
  total: number;
  sucursal: { nombre: string } | null;
}
