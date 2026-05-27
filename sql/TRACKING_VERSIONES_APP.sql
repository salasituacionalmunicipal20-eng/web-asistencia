-- ============================================================================
-- TRACKING_VERSIONES_APP.sql — saber que version del APK tiene cada empleado
-- ============================================================================
-- Agrega 3 columnas a `empleados` que se actualizan automaticamente cada vez
-- que el empleado abre la app:
--   app_version_nombre   — ej "1.0.7"
--   app_version_codigo   — ej 8
--   app_ultimo_ping      — timestamp del ultimo report (para saber si esta
--                          activo o lleva semanas sin abrir la app)
--
-- La app llama al RPC reportar_version_app en cada login y on-resume.
-- Idempotente, podes correrlo varias veces.
-- ============================================================================


ALTER TABLE empleados ADD COLUMN IF NOT EXISTS app_version_nombre text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS app_version_codigo int;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS app_ultimo_ping timestamp with time zone;


-- ============================================================================
-- RPC reportar_version_app: la app lo llama al iniciar
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER porque RLS de empleados no permite UPDATE desde anon.
-- ============================================================================
DROP FUNCTION IF EXISTS public.reportar_version_app(text, text, int);
CREATE OR REPLACE FUNCTION public.reportar_version_app(
    p_cedula text,
    p_version_nombre text,
    p_version_codigo int
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_cedula IS NULL OR length(trim(p_cedula)) = 0 THEN
        RETURN;
    END IF;
    UPDATE empleados
    SET app_version_nombre = p_version_nombre,
        app_version_codigo = p_version_codigo,
        app_ultimo_ping = NOW()
    WHERE cedula = upper(trim(p_cedula));
END;
$$;
GRANT EXECUTE ON FUNCTION public.reportar_version_app(text, text, int) TO anon, authenticated;


NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- Vista util para Carlos: empleados con su version y dias desde ultimo ping
-- ============================================================================
CREATE OR REPLACE VIEW vw_versiones_app AS
SELECT
    e.cedula,
    e.nombres,
    e.apellidos,
    e.departamento,
    e.cargo,
    e.activo,
    e.app_version_nombre,
    e.app_version_codigo,
    e.app_ultimo_ping,
    CASE
        WHEN e.app_ultimo_ping IS NULL THEN NULL
        ELSE EXTRACT(EPOCH FROM (NOW() - e.app_ultimo_ping)) / 86400
    END AS dias_desde_ping,
    (SELECT version_codigo FROM app_versiones WHERE id = 1) AS version_actual_codigo,
    (SELECT version_nombre FROM app_versiones WHERE id = 1) AS version_actual_nombre,
    CASE
        WHEN e.app_version_codigo IS NULL THEN 'NUNCA_ABRIO'
        WHEN e.app_version_codigo >= (SELECT version_codigo FROM app_versiones WHERE id = 1) THEN 'AL_DIA'
        ELSE 'DESACTUALIZADO'
    END AS estado_version
FROM empleados e
WHERE COALESCE(e.activo, true) = true
ORDER BY estado_version, e.apellidos, e.nombres;

GRANT SELECT ON vw_versiones_app TO anon, authenticated;


-- ============================================================================
-- VERIFICACION
-- ============================================================================
SELECT estado_version, count(*) AS total
FROM vw_versiones_app
GROUP BY estado_version;
