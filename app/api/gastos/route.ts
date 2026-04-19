// app/api/gastos/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const mes = searchParams.get("mes") || undefined;

    const where: Record<string, unknown> = {};
    if (mes) where.mes = { contains: mes.slice(0, 3), mode: "insensitive" };

    const [data, total] = await Promise.all([
      prisma.gasto.findMany({
        where,
        orderBy: { fecha: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          sucursal: { select: { nombre: true } },
          categoria: { select: { nombre: true, color: true } },
        },
      }),
      prisma.gasto.count({ where }),
    ]);

    return NextResponse.json({
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[API/gastos]", error);
    return NextResponse.json({ error: "Error al obtener gastos" }, { status: 500 });
  }
}
