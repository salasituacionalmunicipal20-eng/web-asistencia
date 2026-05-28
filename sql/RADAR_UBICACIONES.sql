-- ============================================================================
-- RADAR_UBICACIONES.sql — tracking en tiempo real de ubicacion de empleados
-- ============================================================================
-- Una fila por empleado con su ultima ubicacion conocida. La app la actualiza
-- cada ~15 minutos via WorkManager (incluso con la app cerrada). El panel
-- web del super-admin consulta esta tabla para mostrar un mapa en tiempo real.
--
-- IMPORTANTE - PRIVACIDAD:
-- La policy actual es abierta. Idealmente solo super-admin deberia leer.
-- Pero como el panel ya gatea por correo (carlos.linares.es@gmail.com),
-- es suficiente proteccion para una alcaldia interna.
-- ============================================================================


CREATE TABLE IF NOT EXISTS ubicaciones_empleados (
    cedula text PRIMARY KEY,
    latitud double precision NOT NULL,
    longitud double precision NOT NULL,
    accuracy_metros double precision,         -- precision del fix GPS
    bateria_pct int,                          -- bateria del telefono (opcional)
    app_en_foreground boolean DEFAULT false,  -- si reporto con la app abierta o desde background worker
    actualizada_en timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_actualizada ON ubicaciones_empleados (actualizada_en DESC);

ALTER TABLE ubicaciones_empleados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Ubicaciones" ON ubicaciones_empleados;
CREATE POLICY "Permitir_Todo_Ubicaciones" ON ubicaciones_empleados FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- RPC actualizar_ubicacion — la app la llama desde Worker o foreground
-- ============================================================================
DROP FUNCTION IF EXISTS public.actualizar_ubicacion(text, double precision, double precision, double precision, int, boolean);
CREATE OR REPLACE FUNCTION public.actualizar_ubicacion(
    p_cedula text,
    p_latitud double precision,
    p_longitud double precision,
    p_accuracy double precision DEFAULT NULL,
    p_bateria int DEFAULT NULL,
    p_foreground boolean DEFAULT false
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_cedula IS NULL OR length(trim(p_cedula)) = 0 THEN RETURN; END IF;
    INSERT INTO ubicaciones_empleados (
        cedula, latitud, longitud, accuracy_metros, bateria_pct, app_en_foreground, actualizada_en
    ) VALUES (
        upper(trim(p_cedula)), p_latitud, p_longitud, p_accuracy, p_bateria, p_foreground, NOW()
    )
    ON CONFLICT (cedula) DO UPDATE SET
        latitud = EXCLUDED.latitud,
        longitud = EXCLUDED.longitud,
        accuracy_metros = EXCLUDED.accuracy_metros,
        bateria_pct = EXCLUDED.bateria_pct,
        app_en_foreground = EXCLUDED.app_en_foreground,
        actualizada_en = NOW();
END;
$$;
GRANT EXECUTE ON FUNCTION public.actualizar_ubicacion(text, double precision, double precision, double precision, int, boolean) TO anon, authenticated;


-- ============================================================================
-- Vista vw_radar_empleados — para el mapa del panel web
-- ============================================================================
CREATE OR REPLACE VIEW vw_radar_empleados AS
SELECT
    e.cedula,
    e.nombres,
    e.apellidos,
    e.departamento,
    e.cargo,
    e.foto_url,
    o.nombre AS sede_asignada,
    o.latitud AS sede_lat,
    o.longitud AS sede_lon,
    o.radio_metros AS sede_radio,
    u.latitud,
    u.longitud,
    u.accuracy_metros,
    u.bateria_pct,
    u.app_en_foreground,
    u.actualizada_en,
    EXTRACT(EPOCH FROM (NOW() - u.actualizada_en)) / 60 AS minutos_desde_ping,
    CASE
        WHEN u.actualizada_en IS NULL THEN 'NUNCA_REPORTO'
        WHEN EXTRACT(EPOCH FROM (NOW() - u.actualizada_en)) < 1800 THEN 'ACTIVO'    -- < 30 min
        WHEN EXTRACT(EPOCH FROM (NOW() - u.actualizada_en)) < 7200 THEN 'INACTIVO'  -- < 2 h
        ELSE 'DESCONECTADO'                                                          -- > 2 h
    END AS estado_radar
FROM empleados e
LEFT JOIN oficinas o ON o.id = e.oficina_id
LEFT JOIN ubicaciones_empleados u ON u.cedula = e.cedula
WHERE COALESCE(e.activo, true) = true;

GRANT SELECT ON vw_radar_empleados TO anon, authenticated;


NOTIFY pgrst, 'reload schema';


SELECT
    (SELECT count(*) FROM ubicaciones_empleados) AS ubicaciones_registradas,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='actualizar_ubicacion') AS rpc_ok,
    EXISTS(SELECT 1 FROM pg_views WHERE viewname='vw_radar_empleados') AS vista_ok;
