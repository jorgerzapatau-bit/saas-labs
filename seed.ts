// prisma/seed.ts
// Inserta datos iniciales: sucursales y categorías de gasto
// Ejecutar: npx ts-node prisma/seed.ts  ó  npx prisma db seed

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed...");

  // ── Sucursales ─────────────────────────────────────────────
  const vitana = await prisma.sucursal.upsert({
    where: { serie_prefix: "VIT-" },
    update: {},
    create: {
      nombre: "Vitana",
      serie_prefix: "VIT-",
      direccion: "Mérida, Yucatán",
      activa: true,
    },
  });

  const progresiva = await prisma.sucursal.upsert({
    where: { serie_prefix: "PROG-" },
    update: {},
    create: {
      nombre: "Progresiva",
      serie_prefix: "PROG-",
      direccion: "Mérida, Yucatán",
      activa: true,
    },
  });

  console.log(`✅ Sucursales: ${vitana.nombre}, ${progresiva.nombre}`);

  // ── Categorías de gasto ────────────────────────────────────
  const categorias = [
    { nombre: "Software y Tecnología", color: "#6366f1" },
    { nombre: "Maquila / Laboratorio", color: "#0ea5e9" },
    { nombre: "Nómina e IMSS", color: "#ec4899" },
    { nombre: "Combustible", color: "#f59e0b" },
    { nombre: "Servicios (Telmex, CFE)", color: "#10b981" },
    { nombre: "Arrendamiento", color: "#8b5cf6" },
    { nombre: "Materiales y Suministros", color: "#64748b" },
    { nombre: "Honorarios", color: "#f97316" },
    { nombre: "Otros", color: "#94a3b8" },
  ];

  for (const cat of categorias) {
    await prisma.categoria.upsert({
      where: { nombre: cat.nombre },
      update: {},
      create: cat,
    });
  }

  console.log(`✅ ${categorias.length} categorías de gasto creadas`);
  console.log("🎉 Seed completado");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
