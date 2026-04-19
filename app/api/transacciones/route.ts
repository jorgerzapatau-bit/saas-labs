// app/api/transacciones/route.ts
// Lista paginada y filtrable de transacciones

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const sucursal = searchParams.get("sucursal") || undefined;
    const mes = searchParams.get("mes") || undefined;
    const forma_pago = searchParams.get("forma_pago") || undefined;

    const where: Record<string, unknown> = {};
    if (sucursal) where.sucursal_id = sucursal;
    if (mes) where.mes = { contains: mes.slice(0, 3), mode: "insensitive" };
    if (forma_pago) where.forma_pago = { contains: forma_pago, mode: "insensitive" };

    const [data, total] = await Promise.all([
      prisma.transaccion.findMany({
        where,
        orderBy: { fecha: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { sucursal: { select: { nombre: true, serie_prefix: true } } },
      }),
      prisma.transaccion.count({ where }),
    ]);

    return NextResponse.json({
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[API/transacciones]", error);
    return NextResponse.json({ error: "Error al obtener transacciones" }, { status: 500 });
  }
}
