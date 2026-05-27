-- ============================================================================
-- REPORTES_AUSENCIAS.sql — parche idempotente
-- ============================================================================
-- Lo que hace:
--   1. Crea tabla `vacaciones` si no existe (la usa la vista).
--   2. Crea/actualiza la vista `vw_ausentes_hoy` con lógica correcta:
--      - Solo empleados activos
--      - No marcaron hoy
--      - Hoy NO es feriado
--      - Hoy es día laborable (L-V por default, o segun turno si tiene)
--   3. Crea tabla `ausencias_diarias` para guardar el snapshot de cada día.
--   4. Crea RPC `snapshot_ausencias_dia(fecha)` que toma una foto de las
--      ausencias de una fecha y la guarda en la tabla (idempotente).
--
-- Pega TODO en una sola query del SQL Editor de Supabase.
-- ============================================================================


-- ============================================================================
-- 1. TABLA VACACIONES (si no existe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vacaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id text NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date NOT NULL,
    motivo text,
    estado text NOT NULL DEFAULT 'Pendiente', -- Pendiente / Aprobado / Rechazado
    fecha_solicitud timestamp with time zone DEFAULT now()
);
ALTER TABLE vacaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Vacaciones" ON vacaciones;
CREATE POLICY "Permitir_Todo_Vacaciones" ON vacaciones FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- 2. VISTA vw_ausentes_hoy — CORREGIDA
-- ----------------------------------------------------------------------------
-- Antes la vista no contemplaba fines de semana ni dias_semana del turno,
-- por eso podia listar empleados ausentes los sabados/domingos aunque
-- ese dia no trabajaran.
--
-- Nueva logica de "es dia laborable hoy":
--   - Si el empleado tiene turno asignado -> usa turnos.dias_semana
--   - Si NO tiene turno -> asume Lunes-Viernes (ISO: 1..5)
--   - Si hoy es feriado, nadie sale como ausente.
-- ============================================================================
DROP VIEW IF EXISTS vw_ausentes_hoy CASCADE;
CREATE OR REPLACE VIEW vw_ausentes_hoy AS
SELECT
    e.cedula,
    e.nombres,
    e.apellidos,
    e.departamento,
    e.cargo,
    e.hora_entrada AS hora_programada,
    CASE
        WHEN EXISTS(SELECT 1 FROM vacaciones v
                    WHERE v.empleado_id = e.cedula
                      AND v.estado = 'Aprobado'
                      AND CURRENT_DATE BETWEEN v.fecha_inicio AND v.fecha_fin)
            THEN 'EN_VACACIONES'
        WHEN EXISTS(SELECT 1 FROM justificaciones j
                    WHERE j.empleado_id = e.cedula
                      AND j.estado = 'Aprobado'
                      AND j.fecha_falta = CURRENT_DATE)
            THEN 'JUSTIFICADO'
        ELSE 'AUSENTE'
    END AS estado_falta
FROM empleados e
LEFT JOIN turnos t ON t.id = e.turno_id
WHERE COALESCE(e.activo, true) = true
  AND NOT EXISTS (SELECT 1 FROM asistencia_registros ar
                  WHERE ar.empleado_id = e.cedula
                    AND ar.fecha = CURRENT_DATE)
  AND NOT EXISTS (SELECT 1 FROM feriados f WHERE f.fecha = CURRENT_DATE)
  AND (
      (t.id IS NOT NULL AND EXTRACT(ISODOW FROM CURRENT_DATE)::int = ANY(t.dias_semana))
      OR
      (t.id IS NULL AND EXTRACT(ISODOW FROM CURRENT_DATE)::int BETWEEN 1 AND 5)
  );
GRANT SELECT ON vw_ausentes_hoy TO anon, authenticated;


-- ============================================================================
-- 3. TABLA ausencias_diarias — histórico
-- ----------------------------------------------------------------------------
-- Una fila por (fecha, empleado_id). Se llena al ejecutar
-- snapshot_ausencias_dia(fecha). Si vuelve a ejecutarse para la misma fecha,
-- borra el snapshot anterior y lo regenera (idempotente).
-- ============================================================================
CREATE TABLE IF NOT EXISTS ausencias_diarias (
    fecha date NOT NULL,
    empleado_id text NOT NULL,
    nombres text,
    apellidos text,
    departamento text,
    cargo text,
    estado text NOT NULL,            -- AUSENTE | JUSTIFICADO | EN_VACACIONES
    hora_programada text,
    generada_en timestamp with time zone DEFAULT now(),
    PRIMARY KEY (fecha, empleado_id)
);
CREATE INDEX IF NOT EXISTS idx_ausencias_fecha ON ausencias_diarias (fecha DESC);
ALTER TABLE ausencias_diarias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Ausencias" ON ausencias_diarias;
CREATE POLICY "Permitir_Todo_Ausencias" ON ausencias_diarias FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- 4. RPC snapshot_ausencias_dia(fecha)
-- ----------------------------------------------------------------------------
-- Genera el reporte de ausencias para una fecha y lo guarda en
-- ausencias_diarias. Devuelve cuantas filas insertó (cuantos ausentes).
--
-- Llamada típica desde la web:
--   await supabase.rpc('snapshot_ausencias_dia', { p_fecha: '2026-05-27' })
--
-- Si la fecha es futura, lanza error. Si ya existía un snapshot para esa
-- fecha, lo reemplaza (sirve para refrescar después de aprobar una
-- justificación tardía).
-- ============================================================================
DROP FUNCTION IF EXISTS public.snapshot_ausencias_dia(date);
CREATE OR REPLACE FUNCTION public.snapshot_ausencias_dia(p_fecha date DEFAULT CURRENT_DATE)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
    IF p_fecha IS NULL THEN
        RAISE EXCEPTION 'La fecha es obligatoria';
    END IF;
    IF p_fecha > CURRENT_DATE THEN
        RAISE EXCEPTION 'No se puede generar snapshot de una fecha futura';
    END IF;

    -- Borra snapshot previo de esa fecha (idempotente)
    DELETE FROM ausencias_diarias WHERE fecha = p_fecha;

    -- Si la fecha es feriado, queda registro vacio (0 ausentes)
    IF EXISTS (SELECT 1 FROM feriados f WHERE f.fecha = p_fecha) THEN
        RETURN 0;
    END IF;

    INSERT INTO ausencias_diarias (
        fecha, empleado_id, nombres, apellidos,
        departamento, cargo, estado, hora_programada
    )
    SELECT
        p_fecha,
        e.cedula, e.nombres, e.apellidos,
        e.departamento, e.cargo,
        CASE
            WHEN EXISTS(SELECT 1 FROM vacaciones v
                        WHERE v.empleado_id = e.cedula
                          AND v.estado = 'Aprobado'
                          AND p_fecha BETWEEN v.fecha_inicio AND v.fecha_fin)
                THEN 'EN_VACACIONES'
            WHEN EXISTS(SELECT 1 FROM justificaciones j
                        WHERE j.empleado_id = e.cedula
                          AND j.estado = 'Aprobado'
                          AND j.fecha_falta = p_fecha)
                THEN 'JUSTIFICADO'
            ELSE 'AUSENTE'
        END,
        e.hora_entrada::text
    FROM empleados e
    LEFT JOIN turnos t ON t.id = e.turno_id
    WHERE COALESCE(e.activo, true) = true
      AND NOT EXISTS (SELECT 1 FROM asistencia_registros ar
                      WHERE ar.empleado_id = e.cedula
                        AND ar.fecha = p_fecha)
      AND (
          (t.id IS NOT NULL AND EXTRACT(ISODOW FROM p_fecha)::int = ANY(t.dias_semana))
          OR
          (t.id IS NULL AND EXTRACT(ISODOW FROM p_fecha)::int BETWEEN 1 AND 5)
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.snapshot_ausencias_dia(date) TO anon, authenticated;


-- ============================================================================
-- 5. RELOAD SCHEMA CACHE
-- ============================================================================
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- 6. VERIFICACION
-- ============================================================================
SELECT
    (SELECT count(*)::int FROM vw_ausentes_hoy)                         AS ausentes_hoy_en_vivo,
    (SELECT count(*)::int FROM ausencias_diarias)                       AS snapshots_guardados,
    EXISTS(SELECT 1 FROM pg_views WHERE viewname='vw_ausentes_hoy')     AS vista_ok,
    EXISTS(SELECT 1 FROM pg_proc  WHERE proname='snapshot_ausencias_dia') AS rpc_ok;
