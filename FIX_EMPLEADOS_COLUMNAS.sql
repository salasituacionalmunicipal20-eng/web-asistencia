-- ============================================================================
-- FIX_EMPLEADOS_COLUMNAS.sql
-- Agrega TODAS las columnas que la tabla empleados deberia tener para que
-- funcione el sistema completo. Idempotente: si la columna ya existe,
-- ALTER ADD COLUMN IF NOT EXISTS la salta.
--
-- Corrigelo ANTES de correr CARGA_EMPLEADOS_SALA_SITUACIONAL.sql.
-- ============================================================================

-- Columnas base del sistema
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS nombres            text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS apellidos          text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS departamento       text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS cargo              text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS hora_entrada       time;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS hora_salida        time;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS tolerancia_minutos integer DEFAULT 15;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS activo             boolean DEFAULT true;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_registro     timestamp with time zone DEFAULT now();

-- Columnas para auth bcrypt
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS clave                 text DEFAULT '123456';
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS clave_hash            text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS requiere_cambio_clave boolean DEFAULT true;

-- Columnas anadidas en sprints posteriores
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS foto_url         text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_cumpleanos date;

-- Columnas opcionales (turno y oficina) - solo si las tablas existen
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='turnos') THEN
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS turno_id uuid REFERENCES turnos(id) ON DELETE SET NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='oficinas') THEN
    ALTER TABLE empleados ADD COLUMN IF NOT EXISTS oficina_id uuid REFERENCES oficinas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Importante: refrescar el schema cache de PostgREST para que la API web/movil
-- detecte las columnas nuevas inmediatamente.
NOTIFY pgrst, 'reload schema';

-- Verificacion final
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'empleados'
ORDER BY ordinal_position;
