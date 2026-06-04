-- =====================================================================
-- Schema para Edge Function `consultar-cedula` v2
-- Crea la tabla cache + RLS + función de limpieza opcional
-- Correr UNA VEZ en Supabase Dashboard → SQL Editor → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- TABLA: cedulas_cache
-- Guarda la respuesta del API cedula.com.ve por cédula con TTL.
-- La clave es {nacionalidad}{numero} (ej "V15234567") porque V y E
-- pueden tener mismo número (distintas personas).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cedulas_cache (
    cedula            TEXT PRIMARY KEY,
    payload           JSONB NOT NULL,
    fetched_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    ttl_until         TIMESTAMPTZ NOT NULL,
    credential_used   SMALLINT
);

COMMENT ON TABLE  public.cedulas_cache IS
  'Cache de respuestas del API cedula.com.ve. TTL diferenciado: 30d para datos exitosos, 24h para RECORD_NOT_FOUND. NO contiene errores temporales (RATE_LIMIT, INVALID_TOKEN).';
COMMENT ON COLUMN public.cedulas_cache.cedula IS
  'Clave compuesta: nacionalidad (V o E) + numero de cedula sin guiones. Ej: "V15234567".';
COMMENT ON COLUMN public.cedulas_cache.ttl_until IS
  'Timestamp en el que esta entrada deja de ser valida. La Edge Function la ignora si ya pasó.';
COMMENT ON COLUMN public.cedulas_cache.credential_used IS
  'Numero de credencial del pool que respondio (0 = par sin sufijo, 1..N = pares numerados). Util para debug.';

-- Indice por ttl_until para que la consulta WHERE ttl_until > now() (en lookup) y
-- WHERE ttl_until < now() (en cleanup) sean rapidas.
CREATE INDEX IF NOT EXISTS idx_cedulas_cache_ttl ON public.cedulas_cache (ttl_until);

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Habilitamos RLS y NO definimos politicas para anon/authenticated.
-- Asi, NADIE que use el anon key o un token de usuario puede leer la
-- tabla. Solo el SERVICE_ROLE (que la Edge Function tiene inyectado)
-- pasa por encima del RLS.
--
-- Esto es critico: si un atacante saca el anon key del frontend, no
-- puede dumpear los datos del CNE de todos los empleados/habitantes.
-- ---------------------------------------------------------------------
ALTER TABLE public.cedulas_cache ENABLE ROW LEVEL SECURITY;

-- Politica explicita de denegacion (defensa en profundidad — incluso
-- si algun dia se agrega una politica permisiva por error, esta sigue
-- prohibiendo lectura de anon/authenticated).
DROP POLICY IF EXISTS "cache_denegar_lectura_publica" ON public.cedulas_cache;
CREATE POLICY "cache_denegar_lectura_publica"
    ON public.cedulas_cache
    FOR SELECT
    TO anon, authenticated
    USING (false);

DROP POLICY IF EXISTS "cache_denegar_escritura_publica" ON public.cedulas_cache;
CREATE POLICY "cache_denegar_escritura_publica"
    ON public.cedulas_cache
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

-- ---------------------------------------------------------------------
-- LIMPIEZA OPCIONAL (manual o via pg_cron si esta habilitado)
-- Borra entradas vencidas hace >7 dias.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.limpiar_cache_cedulas()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    borradas INT;
BEGIN
    DELETE FROM public.cedulas_cache
    WHERE ttl_until < now() - INTERVAL '7 days';
    GET DIAGNOSTICS borradas = ROW_COUNT;
    RETURN borradas;
END;
$$;

COMMENT ON FUNCTION public.limpiar_cache_cedulas IS
  'Borra entradas del cache cuyo TTL vencio hace mas de 7 dias. Llamar manualmente:  SELECT limpiar_cache_cedulas();  o programar via pg_cron si esta disponible.';

REVOKE EXECUTE ON FUNCTION public.limpiar_cache_cedulas() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.limpiar_cache_cedulas() TO service_role;

-- =====================================================================
-- LISTO. La Edge Function consultar-cedula puede ahora leer y escribir
-- en cedulas_cache usando el SUPABASE_SERVICE_ROLE_KEY auto-inyectado.
-- =====================================================================
