// app/rentabilidad/page.tsx
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import RentabilidadClient from "@/components/RentabilidadClient";

export default async function RentabilidadPage() {
  const [ingresos, gastos, costosFijos, sucursales] = await Promise.all([
    // Ingresos agrupados por mes/sucursal
    prisma.transaccion.groupBy({
      by: ["mes", "sucursal_id"],
      _sum: { total: true, subtotal: true, iva: true },
      _count: true,
      orderBy: [{ mes: "asc" }],
    }),
    // Gastos agrupados por mes/sucursal
    prisma.gasto.groupBy({
      by: ["mes", "sucursal_id"],
      _sum: { total: true },
      _count: true,
      orderBy: [{ mes: "asc" }],
    }),
    // Costos fijos mensuales
    prisma.costoFijoMensual.findMany({
      orderBy: [{ anio: "desc" }, { mes_num: "desc" }],
      include: { sucursal: { select: { nombre: true } } },
    }),
    // Sucursales
    prisma.sucursal.findMany({
      select: { id: true, nombre: true },
      where: { activa: true },
    }),
  ]);

  return (
    <AppShell>
      <RentabilidadClient
        ingresos={ingresos}
        gastos={gastos}
        costosFijos={costosFijos as CostoFijo[]}
        sucursales={sucursales}
      />
    </AppShell>
  );
}

export interface CostoFijo {
  id: string;
  anio: number;
  mes: string;
  mes_num: number;
  concepto: string;
  monto: number;
  categoria: string | null;
  sucursal: { nombre: string } | null;
}
