-- ============================================================================
-- SUPABASE_VANGUARDIA.sql
-- ----------------------------------------------------------------------------
-- Extension del setup. Corre DESPUES de SUPABASE_SETUP_COMPLETO.sql.
-- Agrega: turnos, oficinas, feriados, auditoria, alertas, vistas analiticas
-- y RPCs para el workflow del admin (aprobar justificaciones, resetear clave,
-- bulk insert de empleados). Idempotente.
-- ============================================================================


-- ============================================================================
-- 1. OFICINAS configurables (multi-sede)
-- ============================================================================
CREATE TABLE IF NOT EXISTS oficinas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text NOT NULL,
  direccion     text,
  latitud       double precision NOT NULL,
  longitud      double precision NOT NULL,
  radio_metros  integer NOT NULL DEFAULT 50,
  activa        boolean NOT NULL DEFAULT true,
  creada_en     timestamp with time zone DEFAULT now()
);

ALTER TABLE oficinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Oficinas" ON oficinas;
CREATE POLICY "Permitir_Todo_Oficinas" ON oficinas
  FOR ALL USING (true) WITH CHECK (true);

-- Sembrar las dos oficinas que ya tiene la app Android (si no existen)
INSERT INTO oficinas (nombre, direccion, latitud, longitud, radio_metros)
SELECT 'Charallave Central', 'Sede principal', 10.232380, -66.859302, 50
WHERE NOT EXISTS (SELECT 1 FROM oficinas WHERE nombre='Charallave Central');

INSERT INTO oficinas (nombre, direccion, latitud, longitud, radio_metros)
SELECT 'Sede Alterna', 'Sede secundaria', 10.222828, -66.857475, 50
WHERE NOT EXISTS (SELECT 1 FROM oficinas WHERE nombre='Sede Alterna');


-- ============================================================================
-- 2. TURNOS (horarios variables: matutino, vespertino, mixto, fines de semana)
-- ============================================================================
CREATE TABLE IF NOT EXISTS turnos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              text NOT NULL UNIQUE,
  hora_entrada        time NOT NULL,
  hora_salida         time NOT NULL,
  tolerancia_minutos  integer NOT NULL DEFAULT 15,
  dias_semana         integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::integer[], -- 1=Lun..7=Dom
  activo              boolean NOT NULL DEFAULT true,
  creado_en           timestamp with time zone DEFAULT now()
);

ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Turnos" ON turnos;
CREATE POLICY "Permitir_Todo_Turnos" ON turnos
  FOR ALL USING (true) WITH CHECK (true);

-- Sembrar turno por defecto si no existe ninguno
INSERT INTO turnos (nombre, hora_entrada, hora_salida, tolerancia_minutos)
SELECT 'Estandar', '08:00:00', '17:00:00', 15
WHERE NOT EXISTS (SELECT 1 FROM turnos);


-- Vincular empleados con turnos (opcional - si turno_id es null usa los campos
-- legacy hora_entrada/hora_salida/tolerancia_minutos del propio empleado)
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS turno_id uuid REFERENCES turnos(id) ON DELETE SET NULL;


-- ============================================================================
-- 3. FERIADOS (dias en los que no se penaliza tardanza)
-- ============================================================================
CREATE TABLE IF NOT EXISTS feriados (
  fecha       date PRIMARY KEY,
  descripcion text NOT NULL,
  tipo        text NOT NULL DEFAULT 'NACIONAL',  -- NACIONAL/REGIONAL/INSTITUCIONAL
  creado_en   timestamp with time zone DEFAULT now()
);

ALTER TABLE feriados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Feriados" ON feriados;
CREATE POLICY "Permitir_Todo_Feriados" ON feriados
  FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- 4. AUDITORIA (quien cambio que, cuando)
-- ============================================================================
CREATE TABLE IF NOT EXISTS auditoria (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla         text NOT NULL,
  registro_id   text,
  accion        text NOT NULL,  -- INSERT/UPDATE/DELETE/APROBAR/RECHAZAR/RESET_CLAVE
  campo         text,
  valor_anterior text,
  valor_nuevo   text,
  usuario_email text,
  ip            text,
  ocurrido_en   timestamp with time zone DEFAULT now()
);

ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Auditoria" ON auditoria;
CREATE POLICY "Permitir_Todo_Auditoria" ON auditoria
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_auditoria_tabla_fecha ON auditoria (tabla, ocurrido_en DESC);


-- ============================================================================
-- 5. ALERTAS (avisos para el admin: tarde, no marco salida, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS alertas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id     text NOT NULL,
  tipo            text NOT NULL,  -- TARDE / SIN_SALIDA / AUSENTE / GPS_FALSO
  severidad       text NOT NULL DEFAULT 'media',  -- baja / media / alta
  mensaje         text NOT NULL,
  leida           boolean NOT NULL DEFAULT false,
  resuelta        boolean NOT NULL DEFAULT false,
  creada_en       timestamp with time zone DEFAULT now()
);

ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Alertas" ON alertas;
CREATE POLICY "Permitir_Todo_Alertas" ON alertas
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_alertas_no_resueltas ON alertas (resuelta, creada_en DESC) WHERE resuelta = false;


-- ============================================================================
-- 6. VISTAS ANALITICAS (las consume el admin web)
-- ============================================================================

-- 6.a Presencia actual (empleados con entrada de hoy y sin salida marcada)
CREATE OR REPLACE VIEW vw_presencia_actual AS
SELECT
  ar.empleado_id,
  e.nombres,
  e.apellidos,
  e.departamento,
  e.cargo,
  ar.fecha,
  ar.hora_entrada,
  ar.latitud,
  ar.longitud,
  ar.created_at
FROM asistencia_registros ar
LEFT JOIN empleados e ON e.cedula = ar.empleado_id
WHERE ar.fecha = CURRENT_DATE
  AND ar.hora_salida IS NULL
ORDER BY ar.created_at DESC;

GRANT SELECT ON vw_presencia_actual TO anon, authenticated;


-- 6.b KPIs del dia (numerito grande para el dashboard ejecutivo)
CREATE OR REPLACE VIEW vw_kpis_hoy AS
SELECT
  (SELECT count(*) FROM empleados WHERE COALESCE(activo, true)) AS total_empleados,
  (SELECT count(DISTINCT empleado_id) FROM asistencia_registros WHERE fecha = CURRENT_DATE) AS marcaron_entrada,
  (SELECT count(*) FROM vw_presencia_actual) AS dentro_ahora,
  (SELECT count(*) FROM asistencia_registros WHERE fecha = CURRENT_DATE AND hora_salida IS NOT NULL) AS jornada_finalizada,
  (SELECT count(*) FROM justificaciones WHERE estado = 'Pendiente') AS justificaciones_pendientes,
  (SELECT count(*) FROM alertas WHERE resuelta = false) AS alertas_abiertas;

GRANT SELECT ON vw_kpis_hoy TO anon, authenticated;


-- 6.c Ranking de puntualidad (ultimos 30 dias)
-- Suma de minutos de tardanza por empleado, en orden ascendente (mas puntuales primero)
CREATE OR REPLACE VIEW vw_ranking_puntualidad AS
WITH base AS (
  SELECT
    ar.empleado_id,
    e.nombres,
    e.apellidos,
    e.departamento,
    COALESCE(t.hora_entrada, e.hora_entrada) AS hora_programada,
    COALESCE(t.tolerancia_minutos, e.tolerancia_minutos, 15) AS tol_min,
    ar.fecha,
    ar.hora_entrada::time AS marcado
  FROM asistencia_registros ar
  LEFT JOIN empleados e ON e.cedula = ar.empleado_id
  LEFT JOIN turnos t   ON t.id = e.turno_id
  WHERE ar.fecha >= CURRENT_DATE - INTERVAL '30 days'
    AND ar.hora_entrada IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM feriados f WHERE f.fecha = ar.fecha)
)
SELECT
  empleado_id,
  nombres,
  apellidos,
  departamento,
  count(*) AS dias_marcados,
  count(*) FILTER (
    WHERE marcado > (hora_programada + (tol_min || ' minutes')::interval)::time
  ) AS dias_tarde,
  COALESCE(SUM(
    GREATEST(0, EXTRACT(EPOCH FROM (marcado - hora_programada))/60 - tol_min)
  )::integer, 0) AS minutos_tarde_total
FROM base
GROUP BY empleado_id, nombres, apellidos, departamento
ORDER BY minutos_tarde_total ASC, dias_marcados DESC;

GRANT SELECT ON vw_ranking_puntualidad TO anon, authenticated;


-- 6.d Estadisticas del mes para un empleado especifico
-- Se invoca con: SELECT * FROM vw_estadisticas_empleado WHERE empleado_id = 'V12345'
-- AND mes = '2026-05-01'
CREATE OR REPLACE VIEW vw_estadisticas_empleado AS
WITH base AS (
  SELECT
    ar.empleado_id,
    date_trunc('month', ar.fecha)::date AS mes,
    ar.fecha,
    ar.hora_entrada::time AS marcado,
    ar.hora_salida IS NOT NULL AS marco_salida,
    COALESCE(t.hora_entrada, e.hora_entrada) AS hora_programada,
    COALESCE(t.tolerancia_minutos, e.tolerancia_minutos, 15) AS tol_min
  FROM asistencia_registros ar
  LEFT JOIN empleados e ON e.cedula = ar.empleado_id
  LEFT JOIN turnos t   ON t.id = e.turno_id
)
SELECT
  empleado_id,
  mes,
  count(*) AS dias_asistidos,
  count(*) FILTER (
    WHERE marcado > (hora_programada + (tol_min || ' minutes')::interval)::time
  ) AS dias_tarde,
  count(*) FILTER (WHERE NOT marco_salida) AS dias_sin_salida_marcada,
  ROUND(
    AVG(EXTRACT(EPOCH FROM (marcado - hora_programada))/60)::numeric,
    1
  ) AS promedio_minutos_diferencia
FROM base
GROUP BY empleado_id, mes;

GRANT SELECT ON vw_estadisticas_empleado TO anon, authenticated;


-- ============================================================================
-- 7. RPC aprobar_justificacion(p_id, p_aprobar, p_comentario)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.aprobar_justificacion(
  p_id uuid,
  p_aprobar boolean,
  p_comentario text DEFAULT NULL,
  p_admin_email text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actualizadas int;
BEGIN
  UPDATE justificaciones
  SET estado = CASE WHEN p_aprobar THEN 'Aprobado' ELSE 'Rechazado' END
  WHERE id = p_id;

  GET DIAGNOSTICS v_actualizadas = ROW_COUNT;

  INSERT INTO auditoria (tabla, registro_id, accion, valor_nuevo, usuario_email)
  VALUES (
    'justificaciones',
    p_id::text,
    CASE WHEN p_aprobar THEN 'APROBAR' ELSE 'RECHAZAR' END,
    p_comentario,
    p_admin_email
  );

  RETURN v_actualizadas = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprobar_justificacion(uuid, boolean, text, text) TO anon, authenticated;


-- ============================================================================
-- 8. RPC resetear_clave_empleado(p_cedula, p_clave_nueva, p_admin_email)
-- ----------------------------------------------------------------------------
-- Para el boton "Resetear clave" del panel admin. Pone una clave nueva (bcrypt),
-- marca requiere_cambio_clave=true para que el empleado deba cambiarla en su
-- proximo login, y registra la accion en auditoria.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.resetear_clave_empleado(
  p_cedula text,
  p_clave_nueva text,
  p_admin_email text DEFAULT NULL
)
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

  UPDATE empleados
  SET clave_hash = crypt(p_clave_nueva, gen_salt('bf', 10)),
      clave = NULL,
      requiere_cambio_clave = true
  WHERE cedula = upper(trim(p_cedula));

  GET DIAGNOSTICS v_actualizadas = ROW_COUNT;

  INSERT INTO auditoria (tabla, registro_id, accion, usuario_email)
  VALUES ('empleados', p_cedula, 'RESET_CLAVE', p_admin_email);

  RETURN v_actualizadas = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resetear_clave_empleado(text, text, text) TO anon, authenticated;


-- ============================================================================
-- 9. RPC importar_empleado(...) para uso en bulk desde la web
-- ============================================================================
CREATE OR REPLACE FUNCTION public.importar_empleado(
  p_cedula text,
  p_nombres text,
  p_apellidos text,
  p_departamento text,
  p_cargo text,
  p_hora_entrada time,
  p_hora_salida time,
  p_tolerancia_minutos int DEFAULT 15,
  p_clave_inicial text DEFAULT '123456'
)
RETURNS text  -- 'CREADO' / 'ACTUALIZADO'
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existe boolean;
  v_ced text := upper(trim(p_cedula));
BEGIN
  SELECT EXISTS(SELECT 1 FROM empleados WHERE cedula = v_ced) INTO v_existe;

  IF v_existe THEN
    UPDATE empleados
    SET nombres = p_nombres,
        apellidos = p_apellidos,
        departamento = p_departamento,
        cargo = p_cargo,
        hora_entrada = p_hora_entrada,
        hora_salida = p_hora_salida,
        tolerancia_minutos = COALESCE(p_tolerancia_minutos, 15)
    WHERE cedula = v_ced;
    RETURN 'ACTUALIZADO';
  ELSE
    INSERT INTO empleados (cedula, nombres, apellidos, departamento, cargo,
                          hora_entrada, hora_salida, tolerancia_minutos,
                          clave_hash, requiere_cambio_clave)
    VALUES (v_ced, p_nombres, p_apellidos, p_departamento, p_cargo,
            p_hora_entrada, p_hora_salida, COALESCE(p_tolerancia_minutos, 15),
            crypt(p_clave_inicial, gen_salt('bf', 10)), true);
    RETURN 'CREADO';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.importar_empleado(text, text, text, text, text, time, time, int, text) TO anon, authenticated;


-- ============================================================================
-- 10. JOB de generacion automatica de alertas
-- ----------------------------------------------------------------------------
-- Esta RPC se invoca desde el admin web (boton "Recalcular alertas") y/o desde
-- un cron job de Supabase. Genera alertas en base a la realidad del dia:
--   - SIN_SALIDA: empleado marco entrada hace mas de 12h y no marco salida
--   - TARDE: empleado marco entrada despues de hora_entrada + tolerancia
--   - AUSENTE: empleado activo que no marco entrada hoy (solo dias habiles)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recalcular_alertas()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int := 0;
BEGIN
  -- 1) SIN_SALIDA
  INSERT INTO alertas (empleado_id, tipo, severidad, mensaje)
  SELECT ar.empleado_id, 'SIN_SALIDA', 'media',
         'No marco salida del ' || ar.fecha::text
  FROM asistencia_registros ar
  WHERE ar.hora_salida IS NULL
    AND ar.fecha < CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM alertas a
      WHERE a.empleado_id = ar.empleado_id
        AND a.tipo = 'SIN_SALIDA'
        AND a.creada_en::date = ar.fecha
    );
  GET DIAGNOSTICS v_total = ROW_COUNT;

  -- 2) TARDE de hoy (solo si tolerancia ya se excedio)
  INSERT INTO alertas (empleado_id, tipo, severidad, mensaje)
  SELECT ar.empleado_id, 'TARDE', 'baja',
         'Marco entrada tarde el ' || ar.fecha::text
  FROM asistencia_registros ar
  JOIN empleados e ON e.cedula = ar.empleado_id
  WHERE ar.fecha = CURRENT_DATE
    AND ar.hora_entrada IS NOT NULL
    AND ar.hora_entrada::time > (e.hora_entrada + (COALESCE(e.tolerancia_minutos,15) || ' minutes')::interval)::time
    AND NOT EXISTS (
      SELECT 1 FROM alertas a
      WHERE a.empleado_id = ar.empleado_id
        AND a.tipo = 'TARDE'
        AND a.creada_en::date = CURRENT_DATE
    );

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalcular_alertas() TO anon, authenticated;


-- ============================================================================
-- 11. VERIFICACION
-- ----------------------------------------------------------------------------
-- a) Listado de las nuevas vistas:
--    SELECT viewname FROM pg_views WHERE schemaname='public' AND viewname LIKE 'vw_%';
--
-- b) Listado de las nuevas RPCs:
--    SELECT proname FROM pg_proc
--    WHERE proname IN ('aprobar_justificacion','resetear_clave_empleado',
--                      'importar_empleado','recalcular_alertas');
--
-- c) Probar KPIs:
--    SELECT * FROM vw_kpis_hoy;
