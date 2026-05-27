-- ============================================================================
-- OFICINAS_GEOFENCE.sql — sedes con geofence + RPC verificar_clave actualizado
-- ============================================================================
-- 1. Renombra las oficinas iniciales 'Charallave Central' y 'Sede Alterna' a
--    sus nombres reales (PSUV y CASA PROGRAMADOR), conserva sus ids para no
--    romper a empleados que ya las tuvieran asignadas.
-- 2. Actualiza coordenadas y radio.
-- 3. Reemplaza verificar_clave para que devuelva tambien oficina_id y la
--    posicion de la sede (lat, lon, radio_metros). La app Android usa estos
--    datos para validar el geofence INDIVIDUAL del empleado (antes validaba
--    contra dos coords hardcoded en el codigo).
--
-- IMPORTANTE: este SQL es idempotente, puedes correrlo varias veces.
-- ============================================================================


-- ============================================================================
-- 1. OFICINAS — PSUV y CASA PROGRAMADOR
-- ============================================================================
-- Renombra Charallave Central -> PSUV (las coords son practicamente identicas)
UPDATE oficinas
SET nombre = 'PSUV',
    direccion = 'Sede PSUV - Cristobal Rojas',
    latitud = 10.232420,
    longitud = -66.859276,
    radio_metros = 25,
    activa = true
WHERE nombre IN ('Charallave Central', 'PSUV');

-- Renombra Sede Alterna -> CASA PROGRAMADOR
UPDATE oficinas
SET nombre = 'CASA PROGRAMADOR',
    direccion = 'Casa Programador - Cristobal Rojas',
    latitud = 10.222778,
    longitud = -66.857472,
    radio_metros = 25,
    activa = true
WHERE nombre IN ('Sede Alterna', 'CASA PROGRAMADOR');

-- Por si no existian, las creamos (idempotente)
INSERT INTO oficinas (nombre, direccion, latitud, longitud, radio_metros, activa)
SELECT 'PSUV', 'Sede PSUV - Cristobal Rojas', 10.232420, -66.859276, 25, true
WHERE NOT EXISTS (SELECT 1 FROM oficinas WHERE nombre = 'PSUV');

INSERT INTO oficinas (nombre, direccion, latitud, longitud, radio_metros, activa)
SELECT 'CASA PROGRAMADOR', 'Casa Programador - Cristobal Rojas', 10.222778, -66.857472, 25, true
WHERE NOT EXISTS (SELECT 1 FROM oficinas WHERE nombre = 'CASA PROGRAMADOR');


-- ============================================================================
-- 2. RPC verificar_clave (REEMPLAZA) — ahora devuelve oficina geofence
-- ============================================================================
DROP FUNCTION IF EXISTS public.verificar_clave(text, text);
CREATE OR REPLACE FUNCTION public.verificar_clave(p_cedula text, p_clave text)
RETURNS TABLE (
    cedula text,
    nombres text,
    apellidos text,
    departamento text,
    cargo text,
    hora_entrada text,
    hora_salida text,
    tolerancia_minutos int,
    requiere_cambio_clave boolean,
    foto_url text,
    fecha_cumpleanos text,
    oficina_id text,
    oficina_nombre text,
    oficina_latitud double precision,
    oficina_longitud double precision,
    oficina_radio_metros int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
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
        e.fecha_cumpleanos::text,
        e.oficina_id::text,
        o.nombre,
        o.latitud,
        o.longitud,
        o.radio_metros
    FROM public.empleados e
    LEFT JOIN public.oficinas o ON o.id = e.oficina_id
    WHERE e.cedula = upper(trim(p_cedula))
      AND COALESCE(e.activo, true) = true
      AND ((e.clave_hash IS NOT NULL AND e.clave_hash = crypt(p_clave, e.clave_hash))
           OR (e.clave_hash IS NULL AND e.clave = p_clave));
END;
$$;
GRANT EXECUTE ON FUNCTION public.verificar_clave(text, text) TO anon, authenticated;


-- ============================================================================
-- 3. Reload del schema cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- 4. VERIFICACION
-- ============================================================================
SELECT id, nombre, direccion, latitud, longitud, radio_metros, activa
FROM oficinas
ORDER BY nombre;
