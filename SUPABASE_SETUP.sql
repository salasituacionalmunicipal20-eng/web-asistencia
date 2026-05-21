-- ============================================================================
-- SUPABASE_SETUP.sql
-- ----------------------------------------------------------------------------
-- Pegá este SQL en Supabase Studio → SQL Editor → New query → Run.
-- Es idempotente: podés correrlo varias veces sin romper nada existente.
--
-- INSTRUCCIONES:
--   1. Reemplazá 'TU_CORREO_DE_ADMIN@CHARALLAVE.GOB.VE' en la sección "ADMINS
--      INICIALES" por el correo (o los correos) que ya están creados en
--      Authentication → Users de tu proyecto Supabase.
--   2. Pegá todo y corré.
--   3. Volvé a tu app web → cerrá sesión → entrá con tu correo → confirmá que
--      podés ver el panel. Probá entrar con un correo NO listado → debería
--      rechazarte con el mensaje "Este correo no está autorizado".
-- ============================================================================


-- ============================================================================
-- 1. TABLA DE ADMINISTRADORES
-- ============================================================================
-- Lista de emails autorizados a entrar al panel web. Solo otros admins pueden
-- agregar/quitar emails (gestión manual desde Supabase Studio o desde la app).

CREATE TABLE IF NOT EXISTS public.administradores (
  email      text         PRIMARY KEY,
  nombre     text,
  creado_en  timestamptz  NOT NULL DEFAULT now()
);

-- Helper SQL: devuelve true si el usuario autenticado actual es admin.
-- La usamos en todas las policies de RLS de abajo.
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.administradores
    WHERE email = (auth.jwt() ->> 'email')
  );
$$;

-- Permite que clientes anónimos/autenticados invoquen la función
GRANT EXECUTE ON FUNCTION public.es_admin() TO anon, authenticated;


-- ============================================================================
-- 2. ADMINS INICIALES — ⚠️ REEMPLAZÁ ESTO CON TU CORREO REAL
-- ============================================================================
-- Si ya tenés admins cargados, podés saltar este INSERT.

INSERT INTO public.administradores (email, nombre) VALUES
  ('TU_CORREO_DE_ADMIN@CHARALLAVE.GOB.VE', 'Administrador Principal')
ON CONFLICT (email) DO NOTHING;


-- ============================================================================
-- 3. RLS — HABILITAR EN TODAS LAS TABLAS
-- ============================================================================

ALTER TABLE public.administradores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_registros  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.justificaciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memorandums           ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 4. POLICIES — administradores (la propia tabla)
-- ============================================================================
-- Solo otros admins pueden ver y modificar la tabla de admins.

DROP POLICY IF EXISTS admin_select ON public.administradores;
CREATE POLICY admin_select ON public.administradores
  FOR SELECT
  USING ( public.es_admin() );

DROP POLICY IF EXISTS admin_insert ON public.administradores;
CREATE POLICY admin_insert ON public.administradores
  FOR INSERT
  WITH CHECK ( public.es_admin() );

DROP POLICY IF EXISTS admin_update ON public.administradores;
CREATE POLICY admin_update ON public.administradores
  FOR UPDATE
  USING ( public.es_admin() )
  WITH CHECK ( public.es_admin() );

DROP POLICY IF EXISTS admin_delete ON public.administradores;
CREATE POLICY admin_delete ON public.administradores
  FOR DELETE
  USING ( public.es_admin() );

-- Excepción crítica: el endpoint público necesita poder leer la tabla
-- para responder a verificarAdmin() ANTES de que el front sepa si sos admin.
-- Por eso autorizamos SELECT a cualquier autenticado SOLO para verificar
-- su propio email. No expone otros emails.
DROP POLICY IF EXISTS auth_lee_su_propio_admin ON public.administradores;
CREATE POLICY auth_lee_su_propio_admin ON public.administradores
  FOR SELECT
  TO authenticated
  USING ( email = (auth.jwt() ->> 'email') );


-- ============================================================================
-- 5. POLICIES — empleados
-- ============================================================================
-- Estrategia:
--   - Admins: pueden hacer todo.
--   - Lectura pública (anon + authenticated): permitida porque la app Android
--     necesita listar empleados para que cada uno se identifique. Si más
--     adelante migrás la app a Supabase Auth, podemos restringir SELECT a "el
--     empleado solo ve su propio registro".

DROP POLICY IF EXISTS empleados_select_public ON public.empleados;
CREATE POLICY empleados_select_public ON public.empleados
  FOR SELECT
  USING ( true );

DROP POLICY IF EXISTS empleados_admin_write ON public.empleados;
CREATE POLICY empleados_admin_write ON public.empleados
  FOR INSERT
  WITH CHECK ( public.es_admin() );

DROP POLICY IF EXISTS empleados_admin_update ON public.empleados;
CREATE POLICY empleados_admin_update ON public.empleados
  FOR UPDATE
  USING ( public.es_admin() )
  WITH CHECK ( public.es_admin() );

DROP POLICY IF EXISTS empleados_admin_delete ON public.empleados;
CREATE POLICY empleados_admin_delete ON public.empleados
  FOR DELETE
  USING ( public.es_admin() );


-- ============================================================================
-- 6. POLICIES — asistencia_registros
-- ============================================================================
-- La app Android necesita INSERT (marcar entrada/salida) y SELECT (ver historial
-- propio). Admins pueden UPDATE/DELETE.

DROP POLICY IF EXISTS asistencia_select ON public.asistencia_registros;
CREATE POLICY asistencia_select ON public.asistencia_registros
  FOR SELECT
  USING ( true );

DROP POLICY IF EXISTS asistencia_insert ON public.asistencia_registros;
CREATE POLICY asistencia_insert ON public.asistencia_registros
  FOR INSERT
  WITH CHECK ( true );

DROP POLICY IF EXISTS asistencia_admin_update ON public.asistencia_registros;
CREATE POLICY asistencia_admin_update ON public.asistencia_registros
  FOR UPDATE
  USING ( public.es_admin() )
  WITH CHECK ( public.es_admin() );

DROP POLICY IF EXISTS asistencia_admin_delete ON public.asistencia_registros;
CREATE POLICY asistencia_admin_delete ON public.asistencia_registros
  FOR DELETE
  USING ( public.es_admin() );


-- ============================================================================
-- 7. POLICIES — justificaciones
-- ============================================================================
-- App Android envía nuevas justificaciones (INSERT). Admin las aprueba/rechaza
-- (UPDATE) y opcionalmente borra (DELETE).

DROP POLICY IF EXISTS justif_select ON public.justificaciones;
CREATE POLICY justif_select ON public.justificaciones
  FOR SELECT
  USING ( true );

DROP POLICY IF EXISTS justif_insert ON public.justificaciones;
CREATE POLICY justif_insert ON public.justificaciones
  FOR INSERT
  WITH CHECK ( true );

DROP POLICY IF EXISTS justif_admin_update ON public.justificaciones;
CREATE POLICY justif_admin_update ON public.justificaciones
  FOR UPDATE
  USING ( public.es_admin() )
  WITH CHECK ( public.es_admin() );

DROP POLICY IF EXISTS justif_admin_delete ON public.justificaciones;
CREATE POLICY justif_admin_delete ON public.justificaciones
  FOR DELETE
  USING ( public.es_admin() );


-- ============================================================================
-- 8. POLICIES — memorandums
-- ============================================================================
-- App Android lee los memos del empleado. Admin los crea y los borra.

DROP POLICY IF EXISTS memos_select ON public.memorandums;
CREATE POLICY memos_select ON public.memorandums
  FOR SELECT
  USING ( true );

DROP POLICY IF EXISTS memos_admin_insert ON public.memorandums;
CREATE POLICY memos_admin_insert ON public.memorandums
  FOR INSERT
  WITH CHECK ( public.es_admin() );

DROP POLICY IF EXISTS memos_admin_update ON public.memorandums;
CREATE POLICY memos_admin_update ON public.memorandums
  FOR UPDATE
  USING ( public.es_admin() )
  WITH CHECK ( public.es_admin() );

DROP POLICY IF EXISTS memos_admin_delete ON public.memorandums;
CREATE POLICY memos_admin_delete ON public.memorandums
  FOR DELETE
  USING ( public.es_admin() );

-- Excepción: la app Android necesita poder marcar como "leído" sus propios
-- memos. Si tenés columna `leido` y querés permitir que el empleado la cambie
-- sin ser admin, descomentá la policy de abajo y ajustá el filtro a tu modelo
-- de identificación de empleados (p.ej. comparando con `empleado_id` que la
-- app envía explícitamente).
-- DROP POLICY IF EXISTS memos_marcar_leido ON public.memorandums;
-- CREATE POLICY memos_marcar_leido ON public.memorandums
--   FOR UPDATE
--   USING ( true )
--   WITH CHECK ( true );


-- ============================================================================
-- 9. VERIFICACIÓN — corré estas queries para confirmar que quedó bien
-- ============================================================================
-- a) Que la tabla administradores existe y tiene tu correo:
--    SELECT * FROM public.administradores;
--
-- b) Que RLS está habilitado en todas las tablas:
--    SELECT relname, relrowsecurity
--    FROM pg_class
--    WHERE relname IN ('administradores','empleados','asistencia_registros','justificaciones','memorandums');
--    -- relrowsecurity debe ser 't' en todas.
--
-- c) Que las policies están creadas:
--    SELECT schemaname, tablename, policyname, cmd
--    FROM pg_policies
--    WHERE schemaname = 'public'
--    ORDER BY tablename, policyname;


-- ============================================================================
-- NOTAS DE SEGURIDAD PENDIENTES
-- ============================================================================
-- El modelo actual permite que cualquier cliente con la anon key (incluida tu
-- app Android) lea TODA la tabla de empleados, asistencias, justificaciones y
-- memos. Esto se mantiene así porque la app Android no usa Supabase Auth y por
-- tanto no podemos diferenciar "este empleado" en RLS.
--
-- Para blindar completamente:
--   - Migrá la app Android a Supabase Auth (cada empleado tiene su user.id).
--   - Agregá una columna `auth_uid uuid` a la tabla `empleados` que apunte a
--     `auth.users.id`.
--   - Cambiá las policies SELECT a: `public.es_admin() OR auth.uid() = auth_uid`
--     (o el patrón equivalente para asistencias/justificaciones/memos).
--   - Esto se hace sin perder los datos actuales — pegame un mensaje cuando
--     vayas a migrar y te paso el script.
-- ============================================================================
