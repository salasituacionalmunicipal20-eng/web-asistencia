-- ============================================================================
-- SUPABASE_MEGASPRINT.sql
-- Extension del setup. Corre DESPUES de SUPABASE_TODO_EN_UNO.sql.
-- Agrega: vacaciones, foto_url empleados, storage bucket fotos, vistas
-- analiticas avanzadas (horas trabajadas + extras, ausentes hoy, heatmap
-- tardanzas), y RPCs adicionales. Idempotente.
-- ============================================================================


-- ============================================================================
-- 1. VACACIONES (workflow de solicitudes largas, separado de justificaciones)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vacaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id     text NOT NULL,
  fecha_inicio    date NOT NULL,
  fecha_fin       date NOT NULL,
  motivo          text NOT NULL,
  estado          text NOT NULL DEFAULT 'Pendiente',  -- Pendiente / Aprobado / Rechazado
  comentario_admin text,
  fecha_solicitud timestamp with time zone DEFAULT now(),
  fecha_decision  timestamp with time zone,
  decision_por    text
);

ALTER TABLE vacaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Vacaciones" ON vacaciones;
CREATE POLICY "Permitir_Todo_Vacaciones" ON vacaciones
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_vacaciones_empleado_estado
  ON vacaciones (empleado_id, estado, fecha_inicio DESC);


-- ============================================================================
-- 2. Comentario admin en justificaciones (acuse de recibo)
-- ============================================================================
ALTER TABLE justificaciones ADD COLUMN IF NOT EXISTS comentario_admin text;
ALTER TABLE justificaciones ADD COLUMN IF NOT EXISTS fecha_decision   timestamp with time zone;
ALTER TABLE justificaciones ADD COLUMN IF NOT EXISTS decision_por     text;


-- ============================================================================
-- 3. Foto de perfil del empleado
-- ============================================================================
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS foto_url text;

-- Sede asignada por defecto (oficina principal donde trabaja el empleado)
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS oficina_id uuid REFERENCES oficinas(id) ON DELETE SET NULL;


-- ============================================================================
-- 4. STORAGE bucket para fotos de empleados (publico de lectura)
-- ----------------------------------------------------------------------------
-- Crea el bucket si no existe. Las policies de storage se manejan via UI o
-- via supabase.storage.from(...). Las dejamos abiertas en lectura como el
-- resto del proyecto.
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
SELECT 'empleados-fotos', 'empleados-fotos', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'empleados-fotos');

INSERT INTO storage.buckets (id, name, public)
SELECT 'justificaciones', 'justificaciones', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'justificaciones');


-- ============================================================================
-- 5. VISTA: horas trabajadas y horas extras por empleado y mes
-- ----------------------------------------------------------------------------
-- Calcula la diferencia hora_salida - hora_entrada para cada dia con marca
-- completa (entrada y salida). Compara contra hora programada del empleado
-- (o del turno asignado) y calcula:
--   - horas_trabajadas: tiempo real dentro de la sede
--   - horas_extras: tiempo trabajado mas alla de hora_salida programada
--   - horas_esperadas: lo que deberia haber trabajado segun su turno
-- ============================================================================
CREATE OR REPLACE VIEW vw_horas_trabajadas AS
WITH base AS (
  SELECT
    ar.empleado_id,
    date_trunc('month', ar.fecha)::date AS mes,
    ar.fecha,
    ar.hora_entrada::time AS marca_entrada,
    ar.hora_salida::time  AS marca_salida,
    COALESCE(t.hora_entrada, e.hora_entrada) AS prog_entrada,
    COALESCE(t.hora_salida,  e.hora_salida)  AS prog_salida,
    EXTRACT(EPOCH FROM (ar.hora_salida::time - ar.hora_entrada::time))/3600.0 AS horas_trabajadas_dia
  FROM asistencia_registros ar
  LEFT JOIN empleados e ON e.cedula = ar.empleado_id
  LEFT JOIN turnos t    ON t.id = e.turno_id
  WHERE ar.hora_entrada IS NOT NULL AND ar.hora_salida IS NOT NULL
)
SELECT
  empleado_id,
  mes,
  ROUND(SUM(horas_trabajadas_dia)::numeric, 1) AS horas_trabajadas,
  ROUND(SUM(
    GREATEST(0, EXTRACT(EPOCH FROM (marca_salida - prog_salida))/3600.0)
  )::numeric, 1) AS horas_extras,
  ROUND(SUM(
    EXTRACT(EPOCH FROM (prog_salida - prog_entrada))/3600.0
  )::numeric, 1) AS horas_esperadas,
  count(*) AS dias_completados
FROM base
GROUP BY empleado_id, mes;

GRANT SELECT ON vw_horas_trabajadas TO anon, authenticated;


-- ============================================================================
-- 6. VISTA: ausentes hoy (empleados activos sin marca)
-- ============================================================================
CREATE OR REPLACE VIEW vw_ausentes_hoy AS
SELECT
  e.cedula,
  e.nombres,
  e.apellidos,
  e.departamento,
  e.cargo,
  e.hora_entrada AS hora_programada,
  CASE
    WHEN EXISTS(SELECT 1 FROM vacaciones v WHERE v.empleado_id = e.cedula
                AND v.estado = 'Aprobado'
                AND CURRENT_DATE BETWEEN v.fecha_inicio AND v.fecha_fin)
      THEN 'EN_VACACIONES'
    WHEN EXISTS(SELECT 1 FROM justificaciones j WHERE j.empleado_id = e.cedula
                AND j.estado = 'Aprobado'
                AND j.fecha_falta = CURRENT_DATE)
      THEN 'JUSTIFICADO'
    ELSE 'AUSENTE'
  END AS estado_falta
FROM empleados e
WHERE COALESCE(e.activo, true) = true
  AND NOT EXISTS (
    SELECT 1 FROM asistencia_registros ar
    WHERE ar.empleado_id = e.cedula AND ar.fecha = CURRENT_DATE
  )
  AND NOT EXISTS (
    SELECT 1 FROM feriados f WHERE f.fecha = CURRENT_DATE
  );

GRANT SELECT ON vw_ausentes_hoy TO anon, authenticated;


-- ============================================================================
-- 7. VISTA: heatmap de tardanzas por dia de la semana
-- ----------------------------------------------------------------------------
-- Cuenta cuantas tardanzas hay en cada dia de la semana en los ultimos 60 dias.
-- Util para identificar patrones (los lunes son los peores, etc).
-- ============================================================================
CREATE OR REPLACE VIEW vw_tardanzas_por_dia_semana AS
WITH base AS (
  SELECT
    EXTRACT(DOW FROM ar.fecha)::int AS dia_semana,  -- 0=Dom, 1=Lun, ..., 6=Sab
    CASE WHEN ar.hora_entrada::time >
              (e.hora_entrada + (COALESCE(e.tolerancia_minutos, 15) || ' minutes')::interval)::time
         THEN 1 ELSE 0 END AS llego_tarde
  FROM asistencia_registros ar
  JOIN empleados e ON e.cedula = ar.empleado_id
  WHERE ar.fecha >= CURRENT_DATE - INTERVAL '60 days'
    AND ar.hora_entrada IS NOT NULL
)
SELECT
  dia_semana,
  CASE dia_semana
    WHEN 0 THEN 'Domingo'
    WHEN 1 THEN 'Lunes'
    WHEN 2 THEN 'Martes'
    WHEN 3 THEN 'Miercoles'
    WHEN 4 THEN 'Jueves'
    WHEN 5 THEN 'Viernes'
    WHEN 6 THEN 'Sabado'
  END AS nombre_dia,
  count(*) AS total_marcas,
  SUM(llego_tarde)::int AS tardanzas,
  CASE WHEN count(*) > 0
       THEN ROUND((SUM(llego_tarde)::numeric / count(*)) * 100, 1)
       ELSE 0 END AS pct_tardanzas
FROM base
GROUP BY dia_semana
ORDER BY dia_semana;

GRANT SELECT ON vw_tardanzas_por_dia_semana TO anon, authenticated;


-- ============================================================================
-- 8. RPC: aprobar_vacaciones
-- ============================================================================
CREATE OR REPLACE FUNCTION public.aprobar_vacaciones(
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
  UPDATE vacaciones
  SET estado = CASE WHEN p_aprobar THEN 'Aprobado' ELSE 'Rechazado' END,
      comentario_admin = p_comentario,
      fecha_decision = now(),
      decision_por = p_admin_email
  WHERE id = p_id;

  GET DIAGNOSTICS v_actualizadas = ROW_COUNT;

  INSERT INTO auditoria (tabla, registro_id, accion, valor_nuevo, usuario_email)
  VALUES ('vacaciones', p_id::text,
          CASE WHEN p_aprobar THEN 'APROBAR' ELSE 'RECHAZAR' END,
          p_comentario, p_admin_email);

  RETURN v_actualizadas = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprobar_vacaciones(uuid, boolean, text, text) TO anon, authenticated;


-- ============================================================================
-- 9. RPC: aprobar_justificacion con comentario (extiende la version anterior)
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
  SET estado = CASE WHEN p_aprobar THEN 'Aprobado' ELSE 'Rechazado' END,
      comentario_admin = p_comentario,
      fecha_decision = now(),
      decision_por = p_admin_email
  WHERE id = p_id;

  GET DIAGNOSTICS v_actualizadas = ROW_COUNT;

  INSERT INTO auditoria (tabla, registro_id, accion, valor_nuevo, usuario_email)
  VALUES ('justificaciones', p_id::text,
          CASE WHEN p_aprobar THEN 'APROBAR' ELSE 'RECHAZAR' END,
          p_comentario, p_admin_email);

  RETURN v_actualizadas = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprobar_justificacion(uuid, boolean, text, text) TO anon, authenticated;


-- ============================================================================
-- 10. RPC: bulk activate/deactivate empleados
-- ============================================================================
CREATE OR REPLACE FUNCTION public.toggle_activo_empleado(
  p_cedula text,
  p_activo boolean,
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
  UPDATE empleados
  SET activo = p_activo
  WHERE cedula = upper(trim(p_cedula));

  GET DIAGNOSTICS v_actualizadas = ROW_COUNT;

  INSERT INTO auditoria (tabla, registro_id, accion, valor_nuevo, usuario_email)
  VALUES ('empleados', p_cedula,
          CASE WHEN p_activo THEN 'ACTIVAR' ELSE 'DESACTIVAR' END,
          p_activo::text, p_admin_email);

  RETURN v_actualizadas = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_activo_empleado(text, boolean, text) TO anon, authenticated;


-- ============================================================================
-- 11. RPC: eliminar_con_auditoria (borra memo / justificacion con audit log)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.eliminar_con_auditoria(
  p_tabla text,
  p_id uuid,
  p_admin_email text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_borradas int := 0;
BEGIN
  IF p_tabla NOT IN ('memorandums', 'justificaciones', 'vacaciones') THEN
    RAISE EXCEPTION 'Tabla no permitida: %', p_tabla;
  END IF;

  EXECUTE format('DELETE FROM public.%I WHERE id = $1', p_tabla)
  USING p_id;
  GET DIAGNOSTICS v_borradas = ROW_COUNT;

  INSERT INTO auditoria (tabla, registro_id, accion, usuario_email)
  VALUES (p_tabla, p_id::text, 'ELIMINAR', p_admin_email);

  RETURN v_borradas > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.eliminar_con_auditoria(text, uuid, text) TO anon, authenticated;


-- ============================================================================
-- 12. Realtime: publicar tablas para Supabase Realtime channels
-- ----------------------------------------------------------------------------
-- Habilita las suscripciones en vivo a estas tablas. La web va a escuchar
-- INSERTs/UPDATEs en asistencia_registros para refrescar el dashboard sin
-- polling.
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE asistencia_registros;
ALTER PUBLICATION supabase_realtime ADD TABLE justificaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE vacaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE alertas;


-- ============================================================================
-- 13. VERIFICACION
-- ============================================================================
SELECT
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='vacaciones')           AS tabla_vacaciones,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='empleados' AND column_name='foto_url') AS col_foto,
  EXISTS(SELECT 1 FROM storage.buckets WHERE id='empleados-fotos')                        AS bucket_fotos,
  EXISTS(SELECT 1 FROM pg_views WHERE viewname='vw_horas_trabajadas')                     AS vw_horas,
  EXISTS(SELECT 1 FROM pg_views WHERE viewname='vw_ausentes_hoy')                         AS vw_ausentes,
  EXISTS(SELECT 1 FROM pg_views WHERE viewname='vw_tardanzas_por_dia_semana')             AS vw_heatmap,
  EXISTS(SELECT 1 FROM pg_proc  WHERE proname='aprobar_vacaciones')                       AS rpc_vacaciones,
  EXISTS(SELECT 1 FROM pg_proc  WHERE proname='toggle_activo_empleado')                   AS rpc_toggle,
  EXISTS(SELECT 1 FROM pg_proc  WHERE proname='eliminar_con_auditoria')                   AS rpc_eliminar;
