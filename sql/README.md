# Scripts SQL de Supabase

## ⭐ El único que importa

**`SUPABASE_DEFINITIVO.sql`** — script consolidado y canónico.
Lo pegas en Supabase Studio → SQL Editor → Run y deja todo el backend listo (tablas, RPCs, vistas, policies, RLS). Es idempotente: lo puedes correr cuantas veces necesites.

## `legacy/`

Versiones históricas/parciales que se consolidaron en `SUPABASE_DEFINITIVO.sql`. **No las corras**; quedan solo como referencia para entender la evolución del schema:

- `SUPABASE_SETUP.sql` — primer setup original
- `SUPABASE_SETUP_COMPLETO.sql` — primera consolidación
- `SUPABASE_TODO_EN_UNO.sql` — segunda consolidación
- `SUPABASE_AUTH_MIGRATION.sql` — migración pgcrypto (ya incluida)
- `SUPABASE_CUMPLEANOS.sql` — columna fecha_cumpleanos (ya incluida)
- `SUPABASE_MEGASPRINT.sql` — vacaciones, auditoría, alertas (ya incluido)
- `SUPABASE_VANGUARDIA.sql` — KPIs y vistas analíticas (ya incluido)
- `FIX_EMPLEADOS_COLUMNAS.sql` — parche de columnas faltantes (ya incluido)
- `CARGA_EMPLEADOS_SALA_SITUACIONAL.sql` — carga inicial de 36 empleados
