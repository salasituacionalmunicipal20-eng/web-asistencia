-- ============================================================================
-- SUPABASE_AUTH_MIGRATION.sql
-- ----------------------------------------------------------------------------
-- Migración de auth de cleartext a pgcrypto (bcrypt). Idempotente.
--
-- QUE HACE:
--   1. Habilita la extension pgcrypto.
--   2. Agrega columna `clave_hash` (bcrypt) al lado de `clave`.
--   3. Backfill: hashea las claves existentes en `clave_hash`. NO toca `clave`
--      todavia para que los clientes viejos sigan funcionando durante la
--      transicion.
--   4. Crea las RPC `verificar_clave(p_cedula, p_clave)` y
--      `actualizar_clave(p_cedula, p_clave_nueva)` que ambos clientes usaran.
--   5. (Opcional, comentado) Al final hay un paso para borrar `clave` cuando
--      confirmes que todos los clientes ya estan actualizados.
--
-- ORDEN DE DESPLIEGUE:
--   PASO 1) Correr este SQL completo en Supabase Studio.
--   PASO 2) Desplegar la nueva version del cliente web (web-asistencia).
--   PASO 3) Desplegar la nueva version de la app Android (todos los empleados).
--   PASO 4) Cuando confirmes que no quedan instalaciones viejas, descomenta
--           el ultimo bloque de este archivo y volve a correrlo para borrar
--           definitivamente la columna `clave` en cleartext.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSION
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ----------------------------------------------------------------------------
-- 2. COLUMNA clave_hash
-- ----------------------------------------------------------------------------
ALTER TABLE public.empleados
  ADD COLUMN IF NOT EXISTS clave_hash text;


-- ----------------------------------------------------------------------------
-- 3. BACKFILL: hashear todas las claves en cleartext existentes
-- ----------------------------------------------------------------------------
-- Solo hasheamos filas que todavia no tengan hash (idempotente).
UPDATE public.empleados
SET clave_hash = crypt(clave, gen_salt('bf', 10))
WHERE clave_hash IS NULL
  AND clave IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 4. RPC verificar_clave(p_cedula, p_clave)
-- ----------------------------------------------------------------------------
-- Devuelve la fila del empleado SOLO si la clave coincide. Si no coincide,
-- devuelve cero filas. La columna `clave` NO se incluye en la respuesta.
-- SECURITY DEFINER para que pueda leer la tabla aunque la RLS bloquee al anon.

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
      e.hora_entrada,
      e.hora_salida,
      e.tolerancia_minutos,
      e.requiere_cambio_clave
    FROM public.empleados e
    WHERE e.cedula = upper(trim(p_cedula))
      AND (
        -- Fallback: si la fila todavia no tiene hash, comparar contra cleartext.
        -- Esto permite que el login funcione durante la ventana de transicion.
        (e.clave_hash IS NOT NULL AND e.clave_hash = crypt(p_clave, e.clave_hash))
        OR
        (e.clave_hash IS NULL AND e.clave = p_clave)
      );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verificar_clave(text, text) TO anon, authenticated;


-- ----------------------------------------------------------------------------
-- 5. RPC actualizar_clave(p_cedula, p_clave_nueva)
-- ----------------------------------------------------------------------------
-- Actualiza la clave hasheada del empleado y deja requiere_cambio_clave=false.
-- No exige clave anterior porque el flujo de la app la pide solo cuando el
-- empleado ya esta logueado o cuando el servidor le marco requiere_cambio_clave.
-- Si en el futuro queres requerir la clave anterior, agregale el parametro.

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
      clave = NULL,  -- limpiamos la copia cleartext en la misma operacion
      requiere_cambio_clave = false
  WHERE cedula = upper(trim(p_cedula));

  GET DIAGNOSTICS v_actualizadas = ROW_COUNT;
  RETURN v_actualizadas = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_clave(text, text) TO anon, authenticated;


-- ----------------------------------------------------------------------------
-- 6. VERIFICACION
-- ----------------------------------------------------------------------------
-- a) Verificar que el backfill corrio:
--      SELECT cedula,
--             clave IS NOT NULL AS aun_tiene_cleartext,
--             clave_hash IS NOT NULL AS tiene_hash
--      FROM public.empleados;
--    Idealmente todas las filas deben mostrar tiene_hash=true.
--
-- b) Probar verificar_clave (substitui la cedula y clave reales):
--      SELECT * FROM public.verificar_clave('V12345678', 'clave-actual');
--
-- c) Probar actualizar_clave (cambia la clave para esa cedula):
--      SELECT public.actualizar_clave('V12345678', 'clave-nueva-de-prueba');


-- ----------------------------------------------------------------------------
-- 7. PASO FINAL — DESCOMENTAR SOLO CUANDO TODOS LOS CLIENTES YA ESTEN MIGRADOS
-- ----------------------------------------------------------------------------
-- Este bloque borra la columna `clave` en cleartext. Una vez ejecutado, los
-- clientes que aun seleccionen `clave` van a romper. Asegurate de que la web
-- y todos los telefonos con la app vieja ya esten actualizados.
--
-- ALTER TABLE public.empleados DROP COLUMN IF EXISTS clave;
