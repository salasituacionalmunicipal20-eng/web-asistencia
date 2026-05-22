-- ============================================================================
-- SUPABASE_SETUP_COMPLETO.sql
-- ----------------------------------------------------------------------------
-- Setup unico de tu Supabase. Pegalo completo en Supabase Studio -> SQL Editor
-- -> New query -> Run. Es idempotente: lo podes correr cuantas veces quieras.
--
-- Que incluye:
--   1. habitantes (Alcaldia-admin)
--   2. asistencia_registros (alineada con la app Android nueva)
--   3. administradores_web + primer admin (carlos.linares.es@gmail.com)
--   4. empleados con clave_hash (bcrypt via pgcrypto)
--   5. justificaciones (con foto_url)
--   6. memorandums
--   7. RPCs verificar_clave + actualizar_clave (auth segura)
--   8. RLS abierta + grants para anon/authenticated
-- ============================================================================


-- ============================================================================
-- 0. EXTENSIONES NECESARIAS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================================
-- 1. TABLA DE HABITANTES (sin cambios)
-- ============================================================================
CREATE TABLE IF NOT EXISTS habitantes (
  id serial primary key,
  id_firebase text UNIQUE,
  jefe_hogar_id text,
  ubch text,
  codigo_sigue_actual text,
  comuna text,
  consejo_comunal text,
  comunidad text,
  calle text,
  numero_casa text,
  tipo_vivienda text,
  tenencia_vivienda text,
  condiciones_vivienda text,
  responsabilidad_cbi_cm text,
  tiene_gas text,
  tipo_cilindro_gas text,
  nombre text,
  apellido text,
  tiene_cedula text,
  nacionalidad text,
  cedula text,
  telefono text,
  fecha_nacimiento text,
  sexo text,
  parentesco text,
  profesion text,
  trabaja text,
  esta_escolarizado text,
  esta_cedulado text,
  padece_enfermedad text,
  toma_medicamento text,
  cual_medicamento text,
  discapacitado text,
  tipo_discapacidad text,
  embarazada text,
  lactancia_materna text,
  cobra_amor_mayor text,
  carnet_patria text,
  mision_jose_gregorio text,
  hogares_patria_bono text,
  donde_vota text,
  vd_vb_vo_seleccion text,
  vd_vb_vo_detalle text,
  registrado_por_uid text,
  registrado_por_nombre text,
  fecha_registro text
);

ALTER TABLE habitantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir_Todo_Admin" ON habitantes;
CREATE POLICY "Permitir_Todo_Admin"
ON habitantes
FOR ALL
USING (true)
WITH CHECK (true);


-- ============================================================================
-- 2. ASISTENCIA_REGISTROS (REESCRITA para que coincida con la app Android)
-- ----------------------------------------------------------------------------
-- IMPORTANTE: Esta tabla se BORRA y vuelve a crear porque las columnas viejas
-- (dispositivo_id, tipo_red, tipo_registro NOT NULL) no coinciden con lo que
-- envia la app. Como confirmaste que aun no hay registros reales, es seguro.
-- ============================================================================
DROP TABLE IF EXISTS asistencia_registros CASCADE;

CREATE TABLE asistencia_registros (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id   text NOT NULL,
  latitud       double precision NOT NULL,
  longitud      double precision NOT NULL,
  fecha         date NOT NULL,
  hora_entrada  text,                                   -- "HH:mm:ss"
  hora_salida   text,                                   -- null hasta marcar salida
  device_id     text,                                   -- huella del dispositivo
  network_type  text,                                   -- "wifi" / "movil" / ...
  created_at    timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asistencia_empleado_fecha
  ON asistencia_registros (empleado_id, fecha DESC);

ALTER TABLE asistencia_registros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir_Todo_Asistencia" ON asistencia_registros;
CREATE POLICY "Permitir_Todo_Asistencia"
ON asistencia_registros
FOR ALL
USING (true)
WITH CHECK (true);


-- ============================================================================
-- 3. CONTROL DE ACCESO WEB (ajustes y administradores) - sin cambios
-- ============================================================================
CREATE TABLE IF NOT EXISTS administradores_web (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  correo text UNIQUE NOT NULL,
  nombre text NOT NULL,
  activo boolean DEFAULT true,
  fecha_creacion timestamp with time zone DEFAULT now()
);

ALTER TABLE administradores_web ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir_Lectura_Admins" ON administradores_web;
CREATE POLICY "Permitir_Lectura_Admins"
ON administradores_web
FOR SELECT
USING (true);


-- ============================================================================
-- 4. PRIMER ADMINISTRADOR - sin cambios
-- ============================================================================
INSERT INTO administradores_web (correo, nombre)
VALUES ('carlos.linares.es@gmail.com', 'Carlos Linares')
ON CONFLICT (correo) DO NOTHING;


-- ============================================================================
-- 5. EMPLEADOS (con migracion de auth a bcrypt)
-- ============================================================================
CREATE TABLE IF NOT EXISTS empleados (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cedula text UNIQUE NOT NULL,
  nombres text NOT NULL,
  apellidos text NOT NULL,
  departamento text NOT NULL,
  cargo text NOT NULL,
  hora_entrada time NOT NULL,
  hora_salida time NOT NULL,
  tolerancia_minutos integer DEFAULT 15,
  activo boolean DEFAULT true,
  fecha_registro timestamp with time zone DEFAULT now(),
  clave text DEFAULT '123456',
  requiere_cambio_clave boolean DEFAULT true
);

-- Migracion AUTH: agregar columna clave_hash y backfill con bcrypt
ALTER TABLE empleados
  ADD COLUMN IF NOT EXISTS clave_hash text;

-- Hashea claves cleartext existentes (idempotente: solo filas sin hash)
UPDATE empleados
SET clave_hash = crypt(clave, gen_salt('bf', 10))
WHERE clave_hash IS NULL
  AND clave IS NOT NULL;

ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir_Todo_Empleados" ON empleados;
CREATE POLICY "Permitir_Todo_Empleados"
ON empleados
FOR ALL
USING (true)
WITH CHECK (true);


-- ============================================================================
-- 6. RPC verificar_clave(p_cedula, p_clave)
-- ----------------------------------------------------------------------------
-- Devuelve la fila del empleado SOLO si la clave coincide. La columna `clave`
-- y `clave_hash` NUNCA viajan al cliente. Acepta tanto bcrypt (preferido) como
-- cleartext (fallback durante la transicion).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verificar_clave(p_cedula text, p_clave text)
RETURNS TABLE (
  cedula                 text,
  nombres                text,
  apellidos              text,
  departamento           text,
  cargo                  text,
  hora_entrada           text,
  hora_salida            text,
  tolerancia_minutos     int,
  requiere_cambio_clave  boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      e.cedula,
      e.nombres,
      e.apellidos,
      e.departamento,
      e.cargo,
      e.hora_entrada::text,
      e.hora_salida::text,
      e.tolerancia_minutos,
      e.requiere_cambio_clave
    FROM public.empleados e
    WHERE e.cedula = upper(trim(p_cedula))
      AND COALESCE(e.activo, true) = true
      AND (
        -- Path principal: bcrypt
        (e.clave_hash IS NOT NULL AND e.clave_hash = crypt(p_clave, e.clave_hash))
        OR
        -- Fallback: cleartext (para empleados nuevos creados desde el panel
        -- web antes de su primer login)
        (e.clave_hash IS NULL AND e.clave = p_clave)
      );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verificar_clave(text, text) TO anon, authenticated;


-- ============================================================================
-- 7. RPC actualizar_clave(p_cedula, p_clave_nueva)
-- ----------------------------------------------------------------------------
-- Hashea la nueva clave con bcrypt, limpia la columna cleartext y pone
-- requiere_cambio_clave=false en una sola operacion atomica.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.actualizar_clave(p_cedula text, p_clave_nueva text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actualizadas int;
BEGIN
  IF p_clave_nueva IS NULL OR length(p_clave_nueva) < 4 THEN
    RAISE EXCEPTION 'La clave debe tener al menos 4 caracteres';
  END IF;

  UPDATE public.empleados
  SET clave_hash = crypt(p_clave_nueva, gen_salt('bf', 10)),
      clave = NULL,
      requiere_cambio_clave = false
  WHERE cedula = upper(trim(p_cedula));

  GET DIAGNOSTICS v_actualizadas = ROW_COUNT;
  RETURN v_actualizadas = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_clave(text, text) TO anon, authenticated;


-- ============================================================================
-- 8. JUSTIFICACIONES (con foto_url)
-- ============================================================================
CREATE TABLE IF NOT EXISTS justificaciones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empleado_id text NOT NULL,
  fecha_falta date NOT NULL,
  motivo text NOT NULL,
  foto_url text,
  estado text DEFAULT 'Pendiente',
  fecha_solicitud timestamp with time zone DEFAULT now()
);

-- Por si la tabla ya existia sin foto_url
ALTER TABLE justificaciones ADD COLUMN IF NOT EXISTS foto_url text;

ALTER TABLE justificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir_Todo_Justificaciones" ON justificaciones;
CREATE POLICY "Permitir_Todo_Justificaciones"
ON justificaciones FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- 9. MEMORANDUMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS memorandums (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empleado_id text NOT NULL,
  titulo text NOT NULL,
  descripcion text NOT NULL,
  fecha_emision date DEFAULT CURRENT_DATE,
  leido boolean DEFAULT false
);

ALTER TABLE memorandums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir_Todo_Memorandums" ON memorandums;
CREATE POLICY "Permitir_Todo_Memorandums"
ON memorandums FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- 10. GRANTS finales para la API REST de Supabase
-- ============================================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;


-- ============================================================================
-- 11. VERIFICACION
-- ----------------------------------------------------------------------------
-- a) Confirmar tabla nueva de asistencia:
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name='asistencia_registros' ORDER BY ordinal_position;
--
-- b) Confirmar que existen las RPCs:
--    SELECT proname FROM pg_proc
--    WHERE proname IN ('verificar_clave','actualizar_clave');
--
-- c) Probar verificar_clave con un empleado real:
--    SELECT * FROM public.verificar_clave('V12345678', '123456');
--
-- d) Confirmar que los empleados tienen hash:
--    SELECT cedula, clave_hash IS NOT NULL AS tiene_hash FROM empleados;
