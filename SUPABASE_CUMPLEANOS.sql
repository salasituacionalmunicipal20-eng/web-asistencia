-- ============================================================================
-- SUPABASE_CUMPLEANOS.sql
-- Agrega fecha_cumpleanos a empleados + RPC para actualizarla + vista
-- vw_cumpleanos_proximos + actualiza verificar_clave para devolverla.
-- Idempotente.
-- ============================================================================


-- ============================================================================
-- 1. Columna fecha_cumpleanos en empleados
-- ============================================================================
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_cumpleanos date;


-- ============================================================================
-- 2. RPC actualizar_cumpleanos (el empleado lo guarda desde la app)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.actualizar_cumpleanos(
  p_cedula text,
  p_fecha  date
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actualizadas int;
BEGIN
  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'La fecha es obligatoria';
  END IF;
  IF p_fecha > CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha no puede ser futura';
  END IF;
  IF p_fecha < (CURRENT_DATE - INTERVAL '100 years')::date THEN
    RAISE EXCEPTION 'La fecha no es valida';
  END IF;

  UPDATE empleados
  SET fecha_cumpleanos = p_fecha
  WHERE cedula = upper(trim(p_cedula));

  GET DIAGNOSTICS v_actualizadas = ROW_COUNT;
  RETURN v_actualizadas = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_cumpleanos(text, date) TO anon, authenticated;


-- ============================================================================
-- 3. verificar_clave actualizado para devolver foto_url y fecha_cumpleanos
-- ============================================================================
DROP FUNCTION IF EXISTS public.verificar_clave(text, text);

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
  requiere_cambio_clave  boolean,
  foto_url               text,
  fecha_cumpleanos       text
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
      e.requiere_cambio_clave,
      e.foto_url,
      e.fecha_cumpleanos::text
    FROM public.empleados e
    WHERE e.cedula = upper(trim(p_cedula))
      AND COALESCE(e.activo, true) = true
      AND (
        (e.clave_hash IS NOT NULL AND e.clave_hash = crypt(p_clave, e.clave_hash))
        OR
        (e.clave_hash IS NULL AND e.clave = p_clave)
      );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verificar_clave(text, text) TO anon, authenticated;


-- ============================================================================
-- 4. VISTA cumpleanos proximos (7 dias hacia adelante + hoy)
-- ----------------------------------------------------------------------------
-- Devuelve los empleados activos con su cumple, calculando dias_hasta_cumple
-- desde hoy. Util para que el admin web y la app vean en vivo quien cumple.
-- ============================================================================
CREATE OR REPLACE VIEW vw_cumpleanos_proximos AS
WITH base AS (
  SELECT
    cedula, nombres, apellidos, departamento, cargo, foto_url, fecha_cumpleanos,
    -- Cumpleaños de este año (mismo mes/dia, año actual)
    make_date(
      EXTRACT(YEAR FROM CURRENT_DATE)::int,
      EXTRACT(MONTH FROM fecha_cumpleanos)::int,
      LEAST(EXTRACT(DAY FROM fecha_cumpleanos)::int, 28)  -- evita errores con Feb 29
    ) AS cumple_este_anio
  FROM empleados
  WHERE fecha_cumpleanos IS NOT NULL
    AND COALESCE(activo, true) = true
),
con_proximo AS (
  SELECT
    *,
    CASE
      WHEN cumple_este_anio >= CURRENT_DATE THEN cumple_este_anio
      ELSE cumple_este_anio + INTERVAL '1 year'
    END::date AS proximo_cumple
  FROM base
)
SELECT
  cedula, nombres, apellidos, departamento, cargo, foto_url, fecha_cumpleanos,
  proximo_cumple,
  (proximo_cumple - CURRENT_DATE)::int AS dias_hasta_cumple,
  EXTRACT(YEAR FROM age(CURRENT_DATE, fecha_cumpleanos))::int AS edad_actual
FROM con_proximo
ORDER BY dias_hasta_cumple ASC;

GRANT SELECT ON vw_cumpleanos_proximos TO anon, authenticated;


-- ============================================================================
-- 5. VERIFICACION
-- ============================================================================
SELECT
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='empleados' AND column_name='fecha_cumpleanos') AS columna,
  EXISTS(SELECT 1 FROM pg_proc  WHERE proname='actualizar_cumpleanos') AS rpc_actualizar,
  EXISTS(SELECT 1 FROM pg_views WHERE viewname='vw_cumpleanos_proximos') AS vista_cumple;
