# Scripts SQL de Supabase

## ⭐ El único que importa

**`SUPABASE_DEFINITIVO.sql`** — script consolidado y canónico.
Lo pegas en Supabase Studio → SQL Editor → Run y deja todo el backend listo (tablas, RPCs, vistas, policies, RLS). Es idempotente: lo puedes correr cuantas veces necesites.

## Parches de seguridad del 18/09/2026 (ya aplicados)

Quedan como constancia de lo que se corrió en producción. **Todo lo que hacen ya está dentro de `SUPABASE_DEFINITIVO.sql`**, así que no hace falta volver a correrlos (aunque se pueden: no hacen nada si ya están aplicados).

- `SEGURIDAD_CLAVES_2026-09-18.sql` — borra las claves en texto plano (quedan solo en huella), pone un candado para que no vuelvan a escribirse, y hace que "Ver clave", "Resetear clave" y "Aprobar justificación" comprueben la **sesión** del administrador en vez del correo que manda el navegador.
- `SEGURIDAD_LLAVE_2026-09-18.sql` — la llave de "Ver clave" estaba escrita en este repositorio público. La base crea una llave nueva al azar en el esquema `privado` (nadie la ve), vuelve a cifrar las copias y las funciones la piden con `privado.llave_claves()`.

**Nunca escribas una llave o una clave en estos archivos.** La llave de "Ver clave" vive solo dentro de la base.

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
- `CLAVES_REVERSIBLES.sql` — primera versión de "Ver clave" (ya incluida; **correrlo reabriría huecos de seguridad**)
