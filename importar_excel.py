#!/usr/bin/env python3
"""
scripts/importar_excel.py
=========================
Migra los 3 archivos Excel al formato limpio que espera la BD en Supabase.
Genera un archivo SQL listo para ejecutar en el SQL Editor de Supabase.

Uso:
  pip install pandas openpyxl
  python scripts/importar_excel.py

Salida:
  scripts/output/seed_transacciones.sql
  scripts/output/seed_gastos.sql
"""

import pandas as pd
import uuid
import re
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path("scripts/output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── IDs de sucursales (ajusta con los UUIDs reales de tu Supabase) ──────────
SUCURSAL_VIT  = "REEMPLAZA-CON-UUID-VIT-DE-SUPABASE"
SUCURSAL_PROG = "REEMPLAZA-CON-UUID-PROG-DE-SUPABASE"

ARCHIVOS_INGRESOS = [
    ("../CEDULA_DE_INGRESOS_Vitana26.xlsx",      "VIT-",  SUCURSAL_VIT),
    ("../marzo__CEDULA_DE_INGRESOS_Vitana26.xlsx","PROG-", SUCURSAL_PROG),
]
ARCHIVO_GASTOS = "../CEDULA_DE_GASTOS.xlsx"


def limpiar_fecha(valor) -> str | None:
    """Intenta parsear fechas con formatos incorrectos."""
    if pd.isna(valor):
        return None
    s = str(valor).strip()
    # Corrige "2026-03-3116:28:59" → "2026-03-31 16:28:59"
    s = re.sub(r"(\d{4}-\d{2}-\d{2})(\d{2}:\d{2}:\d{2})", r"\1 \2", s)
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s[:19], fmt).isoformat()
        except:
            continue
    return None


def normalizar_mes(mes) -> str:
    if pd.isna(mes):
        return "DESCONOCIDO"
    m = str(mes).strip().upper()
    if m.startswith("MAR"): return "MARZO"
    if m.startswith("ABR"): return "ABRIL"
    if m.startswith("MAY"): return "MAYO"
    if m.startswith("JUN"): return "JUNIO"
    return m


def esc(val) -> str:
    """Escapa strings para SQL."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return "NULL"
    return "'" + str(val).replace("'", "''").strip() + "'"


def to_float(val, default=0.0) -> float:
    try:
        return float(val)
    except:
        return default


# ── Generar SQL de Transacciones ────────────────────────────────────────────
rows_sql = []

for archivo, serie_default, sucursal_id in ARCHIVOS_INGRESOS:
    try:
        df = pd.read_excel(archivo, sheet_name="INGRESO")
    except FileNotFoundError:
        print(f"⚠  Archivo no encontrado: {archivo}")
        continue

    print(f"📄 {archivo}: {len(df)} filas")

    for _, row in df.iterrows():
        uid        = str(uuid.uuid4())
        cfdi       = esc(row.get("CFDI"))
        fecha      = limpiar_fecha(row.get("fecha factura"))
        mes        = esc(normalizar_mes(row.get("mes")))
        serie      = esc(row.get("serie") or serie_default)
        folio_val  = row.get("folio")
        folio      = int(folio_val) if not pd.isna(folio_val) else "NULL"
        subtotal   = to_float(row.get("subtotal"))
        iva        = to_float(row.get("Iva"))
        total      = to_float(row.get("total"))
        forma      = esc(row.get("forma de pago"))
        metodo     = esc(row.get("metodo de pago"))
        uso        = esc(row.get("uso cfdi"))
        rfc        = esc(row.get("emisor rfc"))
        nombre     = esc(row.get("emisor nombre"))
        regimen    = esc(row.get("emisor regimen"))
        tipo_gasto = esc(row.get("Tipo de gasto de acuerdo a catalogo"))
        efectivo   = "false"

        if fecha is None:
            print(f"  ⚠ Fila omitida (fecha inválida): folio={folio}")
            continue

        rows_sql.append(
            f"('{uid}', {cfdi}, '{fecha}', {mes}, {serie}, "
            f"{'NULL' if folio == 'NULL' else folio}, "
            f"{subtotal}, {iva}, {total}, "
            f"{forma}, {metodo}, {uso}, {rfc}, {nombre}, {regimen}, "
            f"{tipo_gasto}, {efectivo}, '{sucursal_id}', NOW(), NOW())"
        )

sql_trans = (
    "-- Transacciones (Ingresos)\n"
    "-- Ejecutar en Supabase → SQL Editor\n\n"
    "INSERT INTO transacciones (\n"
    "  id, cfdi, fecha, mes, serie, folio,\n"
    "  subtotal, iva, total,\n"
    "  forma_pago, metodo_pago, uso_cfdi, emisor_rfc, emisor_nombre, emisor_regimen,\n"
    "  tipo_gasto, efectivo_depositado, sucursal_id, created_at, updated_at\n"
    ") VALUES\n"
    + ",\n".join(rows_sql)
    + "\nON CONFLICT (cfdi) DO NOTHING;\n"
)

(OUTPUT_DIR / "seed_transacciones.sql").write_text(sql_trans, encoding="utf-8")
print(f"\n✅ {len(rows_sql)} transacciones → scripts/output/seed_transacciones.sql")


# ── Generar SQL de Gastos ────────────────────────────────────────────────────
gastos_sql = []

try:
    df_g = pd.read_excel(ARCHIVO_GASTOS, sheet_name=0)
    print(f"\n📄 {ARCHIVO_GASTOS}: {len(df_g)} filas")

    for _, row in df_g.iterrows():
        uid      = str(uuid.uuid4())
        cfdi     = esc(row.get("CFDI"))
        fecha    = limpiar_fecha(row.get("fecha factura"))
        mes      = esc(normalizar_mes(row.get("mes")))
        serie    = esc(row.get("serie"))
        folio    = esc(row.get("folio"))
        subtotal = to_float(row.get("subtotal"))
        iva      = to_float(row.get("Iva"))
        total    = to_float(row.get("total"))
        forma    = esc(row.get("forma de pago"))
        metodo   = esc(row.get("metodo de pago"))
        uso      = esc(row.get("uso cfdi"))
        rfc      = esc(row.get("emisor rfc"))
        nombre   = esc(row.get("emisor nombre"))
        regimen  = esc(row.get("emisor regimen"))
        desc     = esc(row.get("Tipo de gasto de acuerdo a catalogo"))

        if fecha is None:
            print(f"  ⚠ Fila omitida (fecha inválida)")
            continue

        gastos_sql.append(
            f"('{uid}', {cfdi}, '{fecha}', {mes}, {serie}, {folio},\n"
            f"  {subtotal}, {iva}, {total},\n"
            f"  {forma}, {metodo}, {uso}, {rfc}, {nombre}, {regimen},\n"
            f"  {desc}, NOW(), NOW())"
        )

    sql_gastos = (
        "-- Gastos (Egresos)\n"
        "-- Ejecutar en Supabase → SQL Editor\n\n"
        "INSERT INTO gastos (\n"
        "  id, cfdi, fecha, mes, serie, folio,\n"
        "  subtotal, iva, total,\n"
        "  forma_pago, metodo_pago, uso_cfdi, emisor_rfc, emisor_nombre, emisor_regimen,\n"
        "  descripcion, created_at, updated_at\n"
        ") VALUES\n"
        + ",\n".join(gastos_sql)
        + "\nON CONFLICT (cfdi) DO NOTHING;\n"
    )

    (OUTPUT_DIR / "seed_gastos.sql").write_text(sql_gastos, encoding="utf-8")
    print(f"✅ {len(gastos_sql)} gastos → scripts/output/seed_gastos.sql")

except FileNotFoundError:
    print(f"⚠  Archivo no encontrado: {ARCHIVO_GASTOS}")

print("\n🎉 Listo. Copia los archivos .sql al SQL Editor de Supabase y ejecútalos.")
print("   Recuerda actualizar SUCURSAL_VIT y SUCURSAL_PROG con los UUIDs reales.")
