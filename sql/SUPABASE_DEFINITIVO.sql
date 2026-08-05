-- ============================================================================
-- SUPABASE_DEFINITIVO.sql v3 — Setup completo, consolidado y arreglado
-- ============================================================================
-- Pega TODO en una sola query del SQL Editor y dale Run. Idempotente: crea
-- desde cero o repara lo existente sin perder datos.
-- ============================================================================


-- 0. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================================
-- 1. HABITANTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS habitantes (
    id serial primary key, id_firebase text UNIQUE, jefe_hogar_id text,
    ubch text, codigo_sigue_actual text, comuna text, consejo_comunal text,
    comunidad text, calle text, numero_casa text, tipo_vivienda text,
    tenencia_vivienda text, condiciones_vivienda text, responsabilidad_cbi_cm text,
    tiene_gas text, tipo_cilindro_gas text, nombre text, apellido text,
    tiene_cedula text, nacionalidad text, cedula text, telefono text,
    fecha_nacimiento text, sexo text, parentesco text, profesion text,
    trabaja text, esta_escolarizado text, esta_cedulado text, padece_enfermedad text,
    toma_medicamento text, cual_medicamento text, discapacitado text,
    tipo_discapacidad text, embarazada text, lactancia_materna text,
    cobra_amor_mayor text, carnet_patria text, mision_jose_gregorio text,
    hogares_patria_bono text, donde_vota text, vd_vb_vo_seleccion text,
    vd_vb_vo_detalle text, registrado_por_uid text, registrado_por_nombre text,
    fecha_registro text
);
ALTER TABLE habitantes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Admin" ON habitantes;
CREATE POLICY "Permitir_Todo_Admin" ON habitantes FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- 2. ASISTENCIA_REGISTROS
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'asistencia_registros' AND column_name = 'dispositivo_id') THEN
        DROP TABLE asistencia_registros CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS asistencia_registros (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id text NOT NULL,
    latitud double precision NOT NULL,
    longitud double precision NOT NULL,
    fecha date NOT NULL,
    hora_entrada text, hora_salida text,
    device_id text, network_type text,
    created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asistencia_empleado_fecha ON asistencia_registros (empleado_id, fecha DESC);
ALTER TABLE asistencia_registros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Asistencia" ON asistencia_registros;
CREATE POLICY "Permitir_Todo_Asistencia" ON asistencia_registros FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- 3. ADMINISTRADORES WEB
-- ============================================================================
CREATE TABLE IF NOT EXISTS administradores_web (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    correo text UNIQUE NOT NULL, nombre text NOT NULL,
    activo boolean DEFAULT true, fecha_creacion timestamp with time zone DEFAULT now()
);
ALTER TABLE administradores_web ADD COLUMN IF NOT EXISTS requiere_cambio_clave boolean DEFAULT true;
ALTER TABLE administradores_web ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Lectura_Admins" ON administradores_web;
DROP POLICY IF EXISTS "Permitir_Todo_Admins" ON administradores_web;
CREATE POLICY "Permitir_Todo_Admins" ON administradores_web FOR ALL USING (true) WITH CHECK (true);

INSERT INTO administradores_web (correo, nombre, activo, requiere_cambio_clave)
VALUES ('carlos.linares.es@gmail.com', 'Carlos Linares', true, false)
ON CONFLICT (correo) DO UPDATE SET activo = EXCLUDED.activo, requiere_cambio_clave = false;


-- ============================================================================
-- 4. EMPLEADOS (todas las columnas, incluyendo clave_actual_cifrada)
-- ============================================================================
CREATE TABLE IF NOT EXISTS empleados (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cedula text UNIQUE NOT NULL
);
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS nombres text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS apellidos text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS departamento text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS cargo text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS hora_entrada time;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS hora_salida time;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS tolerancia_minutos integer DEFAULT 15;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS activo boolean DEFAULT true;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_registro timestamp with time zone DEFAULT now();
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS clave text DEFAULT '123456';
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS clave_hash text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS clave_actual_cifrada bytea;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS requiere_cambio_clave boolean DEFAULT true;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_cumpleanos date;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS app_version_nombre text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS app_version_codigo int;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS app_ultimo_ping timestamp with time zone;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS telefono text;

UPDATE empleados SET clave_hash = extensions.crypt(clave, extensions.gen_salt('bf', 10))
WHERE clave_hash IS NULL AND clave IS NOT NULL;

ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Empleados" ON empleados;
CREATE POLICY "Permitir_Todo_Empleados" ON empleados FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- 5. JUSTIFICACIONES + 6. MEMORANDUMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS justificaciones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    empleado_id text NOT NULL, fecha_falta date NOT NULL, motivo text NOT NULL,
    estado text DEFAULT 'Pendiente', fecha_solicitud timestamp with time zone DEFAULT now()
);
ALTER TABLE justificaciones ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE justificaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Justificaciones" ON justificaciones;
CREATE POLICY "Permitir_Todo_Justificaciones" ON justificaciones FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS memorandums (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    empleado_id text NOT NULL, titulo text NOT NULL, descripcion text NOT NULL,
    fecha_emision date DEFAULT CURRENT_DATE, leido boolean DEFAULT false
);
ALTER TABLE memorandums ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Memorandums" ON memorandums;
CREATE POLICY "Permitir_Todo_Memorandums" ON memorandums FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- 7. OFICINAS (PSUV + CASA PROGRAMADOR — dedupe + UNIQUE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS oficinas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL, direccion text,
    latitud double precision NOT NULL, longitud double precision NOT NULL,
    radio_metros integer NOT NULL DEFAULT 50, activa boolean NOT NULL DEFAULT true,
    creada_en timestamp with time zone DEFAULT now()
);
ALTER TABLE oficinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Oficinas" ON oficinas;
CREATE POLICY "Permitir_Todo_Oficinas" ON oficinas FOR ALL USING (true) WITH CHECK (true);

UPDATE oficinas SET nombre = 'PSUV',
    direccion = 'Sede PSUV - Cristobal Rojas',
    latitud = 10.232420, longitud = -66.859276,
    radio_metros = 60, activa = true
WHERE nombre = 'Charallave Central';

UPDATE oficinas SET nombre = 'CASA PROGRAMADOR',
    direccion = 'Casa Programador - Cristobal Rojas',
    latitud = 10.222778, longitud = -66.857472,
    radio_metros = 60, activa = true
WHERE nombre = 'Sede Alterna';

-- DEDUPE: si hay duplicadas, reasigna empleados y borra las demas
DO $$
DECLARE v_psuv uuid; v_casa uuid;
BEGIN
    SELECT id INTO v_psuv FROM oficinas WHERE nombre = 'PSUV' ORDER BY creada_en ASC NULLS LAST LIMIT 1;
    SELECT id INTO v_casa FROM oficinas WHERE nombre = 'CASA PROGRAMADOR' ORDER BY creada_en ASC NULLS LAST LIMIT 1;
    IF v_psuv IS NOT NULL THEN
        UPDATE empleados SET oficina_id = v_psuv
        WHERE oficina_id IN (SELECT id FROM oficinas WHERE nombre = 'PSUV' AND id <> v_psuv);
        DELETE FROM oficinas WHERE nombre = 'PSUV' AND id <> v_psuv;
    END IF;
    IF v_casa IS NOT NULL THEN
        UPDATE empleados SET oficina_id = v_casa
        WHERE oficina_id IN (SELECT id FROM oficinas WHERE nombre = 'CASA PROGRAMADOR' AND id <> v_casa);
        DELETE FROM oficinas WHERE nombre = 'CASA PROGRAMADOR' AND id <> v_casa;
    END IF;
END $$;

INSERT INTO oficinas (nombre, direccion, latitud, longitud, radio_metros, activa)
SELECT 'PSUV', 'Sede PSUV - Cristobal Rojas', 10.232420, -66.859276, 60, true
WHERE NOT EXISTS (SELECT 1 FROM oficinas WHERE nombre = 'PSUV');

INSERT INTO oficinas (nombre, direccion, latitud, longitud, radio_metros, activa)
SELECT 'CASA PROGRAMADOR', 'Casa Programador - Cristobal Rojas', 10.222778, -66.857472, 60, true
WHERE NOT EXISTS (SELECT 1 FROM oficinas WHERE nombre = 'CASA PROGRAMADOR');

ALTER TABLE oficinas DROP CONSTRAINT IF EXISTS oficinas_nombre_unico;
ALTER TABLE oficinas ADD CONSTRAINT oficinas_nombre_unico UNIQUE (nombre);


-- ============================================================================
-- 7b. TURNOS + FERIADOS + AUDITORIA + ALERTAS + VACACIONES + AUSENCIAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS turnos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL UNIQUE,
    hora_entrada time NOT NULL, hora_salida time NOT NULL,
    tolerancia_minutos integer NOT NULL DEFAULT 15,
    dias_semana integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::integer[],
    activo boolean NOT NULL DEFAULT true,
    creado_en timestamp with time zone DEFAULT now()
);
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Turnos" ON turnos;
CREATE POLICY "Permitir_Todo_Turnos" ON turnos FOR ALL USING (true) WITH CHECK (true);
INSERT INTO turnos (nombre, hora_entrada, hora_salida, tolerancia_minutos)
SELECT 'Estandar', '08:00:00', '17:00:00', 15
WHERE NOT EXISTS (SELECT 1 FROM turnos WHERE nombre = 'Estandar');

ALTER TABLE empleados ADD COLUMN IF NOT EXISTS turno_id uuid REFERENCES turnos(id) ON DELETE SET NULL;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS oficina_id uuid REFERENCES oficinas(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS feriados (
    fecha date PRIMARY KEY, descripcion text NOT NULL,
    tipo text NOT NULL DEFAULT 'NACIONAL', creado_en timestamp with time zone DEFAULT now()
);
ALTER TABLE feriados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Feriados" ON feriados;
CREATE POLICY "Permitir_Todo_Feriados" ON feriados FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS auditoria (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tabla text NOT NULL, registro_id text, accion text NOT NULL,
    campo text, valor_anterior text, valor_nuevo text,
    usuario_email text, ip text,
    ocurrido_en timestamp with time zone DEFAULT now()
);
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Auditoria" ON auditoria;
CREATE POLICY "Permitir_Todo_Auditoria" ON auditoria FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla_fecha ON auditoria (tabla, ocurrido_en DESC);

CREATE TABLE IF NOT EXISTS alertas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id text NOT NULL, tipo text NOT NULL,
    severidad text NOT NULL DEFAULT 'media', mensaje text NOT NULL,
    leida boolean NOT NULL DEFAULT false, resuelta boolean NOT NULL DEFAULT false,
    creada_en timestamp with time zone DEFAULT now()
);
ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Alertas" ON alertas;
CREATE POLICY "Permitir_Todo_Alertas" ON alertas FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_alertas_no_resueltas ON alertas (resuelta, creada_en DESC) WHERE resuelta = false;

CREATE TABLE IF NOT EXISTS vacaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id text NOT NULL,
    fecha_inicio date NOT NULL, fecha_fin date NOT NULL,
    motivo text, estado text NOT NULL DEFAULT 'Pendiente',
    fecha_solicitud timestamp with time zone DEFAULT now()
);
ALTER TABLE vacaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Vacaciones" ON vacaciones;
CREATE POLICY "Permitir_Todo_Vacaciones" ON vacaciones FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS ausencias_diarias (
    fecha date NOT NULL, empleado_id text NOT NULL,
    nombres text, apellidos text, departamento text, cargo text,
    estado text NOT NULL, hora_programada text,
    generada_en timestamp with time zone DEFAULT now(),
    PRIMARY KEY (fecha, empleado_id)
);
CREATE INDEX IF NOT EXISTS idx_ausencias_fecha ON ausencias_diarias (fecha DESC);
ALTER TABLE ausencias_diarias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Ausencias" ON ausencias_diarias;
CREATE POLICY "Permitir_Todo_Ausencias" ON ausencias_diarias FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- 8. APP_VERSIONES — release vigente: 1.0.16 (versionCode 17)
-- ============================================================================
-- 1.0.16: PIN propio de la app de 4 digitos como respaldo cuando el telefono
-- no tiene biometria (huella/face) ni clave del sistema (PIN/patron/contrasena).
-- Se gestiona desde Perfil > Seguridad y Preferencias: crear/cambiar pide
-- confirmar la clave de login + PIN nuevo + repetir; eliminar tambien pide
-- clave de login. Almacenamiento con EncryptedSharedPreferences (AES-256-GCM)
-- + SHA-256 con salt y 5000 iteraciones + rate limiting (3 fallidos = 60s,
-- 6 = 5m, 9+ = 30m). Al marcar entrada/salida con biometria activa, si no hay
-- nada nativo disponible la app pide el PIN propio antes de ejecutar la marca.
-- 1.0.15: integracion Firebase Cloud Messaging para sistema de Reportes de
-- Cuadrilla (Fase 1 del modulo). La APK ahora se registra en Firebase con su
-- token al hacer login, y recibe push notifications al instante cuando la
-- Alcaldesa/supervisores validan o rechazan reportes (y vice versa cuando un
-- trabajador envia reporte nuevo). Backend: tablas reportes_cuadrilla,
-- tipos_actividad, fcm_tokens; columna empleados.rol_principal; Edge Function
-- enviar-notif-fcm-cuadrilla.
-- 1.0.14: recordatorio diario a las 19:02 hora Caracas. Si el empleado tiene
-- jornada abierta (entrada SI, salida NO) le llega una notificacion al telefono
-- con vibracion + importancia alta avisandole que esta a punto de incurrir en
-- falta. Complementa el memorandum automatico que se genera al dia siguiente.
-- 1.0.13: fix de verificacion biometrica para empleados con clave del telefono
-- alfanumerica. Antes el toggle se deshabilitaba si no tenian huella registrada
-- aunque tuvieran PIN/contrasena del telefono — y por eso marcaban sin
-- verificacion. Ahora el toggle se habilita cuando hay CUALQUIER credencial
-- de bloqueo del dispositivo (huella, face, PIN numerico, patron o contrasena
-- con letras), y el BiometricPrompt nativo acepta lo que tenga el empleado.
-- 1.0.12: agrega la seccion "Foto tipo carnet" en el perfil del empleado.
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_versiones (
    id int PRIMARY KEY DEFAULT 1,
    version_codigo int NOT NULL, version_nombre text NOT NULL,
    apk_url text NOT NULL, notas text,
    obligatoria boolean NOT NULL DEFAULT false,
    fecha_publicacion timestamp with time zone DEFAULT now(),
    CONSTRAINT app_versiones_unica CHECK (id = 1)
);
ALTER TABLE app_versiones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Lectura_Versiones" ON app_versiones;
DROP POLICY IF EXISTS "Permitir_Escritura_Versiones" ON app_versiones;
CREATE POLICY "Permitir_Lectura_Versiones" ON app_versiones FOR SELECT USING (true);
CREATE POLICY "Permitir_Escritura_Versiones" ON app_versiones FOR ALL USING (true) WITH CHECK (true);

INSERT INTO app_versiones (id, version_codigo, version_nombre, apk_url, notas, obligatoria)
VALUES (1, 17, '1.0.16',
    'https://salasituacionalmunicipal20-eng.github.io/web-asistencia/AlcaldiaControlAcceso.apk',
    'PIN propio de la app como respaldo: ahora puedes crear un PIN de 4 digitos para marcar entrada/salida cuando tu telefono no tenga huella, face, PIN o patron configurado. Lo configuras desde Perfil > Seguridad y Preferencias > PIN de respaldo.',
    false)
ON CONFLICT (id) DO UPDATE SET
    version_codigo = EXCLUDED.version_codigo,
    version_nombre = EXCLUDED.version_nombre,
    apk_url = EXCLUDED.apk_url,
    notas = EXCLUDED.notas,
    fecha_publicacion = NOW();


-- ============================================================================
-- 8b. STORAGE BUCKET empleados-fotos — fotos tipo carnet
-- ============================================================================
-- La app movil sube aqui las fotos tipo carnet desde el perfil del empleado
-- (1.0.12+). El panel admin tambien lo usa. Sin este bucket creado, la app
-- da error "Bucket not found" al intentar subir.
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'empleados-fotos', 'empleados-fotos', true, 5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "empleados_fotos_select" ON storage.objects;
DROP POLICY IF EXISTS "empleados_fotos_insert" ON storage.objects;
DROP POLICY IF EXISTS "empleados_fotos_update" ON storage.objects;
DROP POLICY IF EXISTS "empleados_fotos_delete" ON storage.objects;

CREATE POLICY "empleados_fotos_select" ON storage.objects FOR SELECT
USING (bucket_id = 'empleados-fotos');
CREATE POLICY "empleados_fotos_insert" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'empleados-fotos');
CREATE POLICY "empleados_fotos_update" ON storage.objects FOR UPDATE
USING (bucket_id = 'empleados-fotos') WITH CHECK (bucket_id = 'empleados-fotos');
CREATE POLICY "empleados_fotos_delete" ON storage.objects FOR DELETE
USING (bucket_id = 'empleados-fotos');


-- ============================================================================
-- 9. UBICACIONES_EMPLEADOS (para el radar tiempo real)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ubicaciones_empleados (
    cedula text PRIMARY KEY,
    latitud double precision NOT NULL,
    longitud double precision NOT NULL,
    accuracy_metros double precision,
    bateria_pct int,
    app_en_foreground boolean DEFAULT false,
    actualizada_en timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_actualizada ON ubicaciones_empleados (actualizada_en DESC);
ALTER TABLE ubicaciones_empleados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Ubicaciones" ON ubicaciones_empleados;
CREATE POLICY "Permitir_Todo_Ubicaciones" ON ubicaciones_empleados FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- 10. VISTAS ANALITICAS
-- ============================================================================
CREATE OR REPLACE VIEW vw_presencia_actual AS
SELECT ar.empleado_id, e.nombres, e.apellidos, e.departamento, e.cargo,
       ar.fecha, ar.hora_entrada, ar.latitud, ar.longitud, ar.created_at
FROM asistencia_registros ar
LEFT JOIN empleados e ON e.cedula = ar.empleado_id
WHERE ar.fecha = CURRENT_DATE AND ar.hora_salida IS NULL
ORDER BY ar.created_at DESC;
GRANT SELECT ON vw_presencia_actual TO anon, authenticated;

CREATE OR REPLACE VIEW vw_kpis_hoy AS
SELECT
    (SELECT count(*) FROM empleados WHERE COALESCE(activo, true)) AS total_empleados,
    (SELECT count(DISTINCT empleado_id) FROM asistencia_registros WHERE fecha = CURRENT_DATE) AS marcaron_entrada,
    (SELECT count(*) FROM vw_presencia_actual) AS dentro_ahora,
    (SELECT count(*) FROM asistencia_registros WHERE fecha = CURRENT_DATE AND hora_salida IS NOT NULL) AS jornada_finalizada,
    (SELECT count(*) FROM justificaciones WHERE estado = 'Pendiente') AS justificaciones_pendientes,
    (SELECT count(*) FROM alertas WHERE resuelta = false) AS alertas_abiertas;
GRANT SELECT ON vw_kpis_hoy TO anon, authenticated;

DROP VIEW IF EXISTS vw_ausentes_hoy CASCADE;
CREATE OR REPLACE VIEW vw_ausentes_hoy AS
SELECT e.cedula, e.nombres, e.apellidos, e.departamento, e.cargo,
    e.hora_entrada AS hora_programada,
    CASE
        WHEN EXISTS(SELECT 1 FROM vacaciones v WHERE v.empleado_id = e.cedula
                    AND v.estado = 'Aprobado' AND CURRENT_DATE BETWEEN v.fecha_inicio AND v.fecha_fin)
            THEN 'EN_VACACIONES'
        WHEN EXISTS(SELECT 1 FROM justificaciones j WHERE j.empleado_id = e.cedula
                    AND j.estado = 'Aprobado' AND j.fecha_falta = CURRENT_DATE)
            THEN 'JUSTIFICADO'
        ELSE 'AUSENTE'
    END AS estado_falta
FROM empleados e
LEFT JOIN turnos t ON t.id = e.turno_id
WHERE COALESCE(e.activo, true) = true
  AND NOT EXISTS (SELECT 1 FROM asistencia_registros ar WHERE ar.empleado_id = e.cedula AND ar.fecha = CURRENT_DATE)
  AND NOT EXISTS (SELECT 1 FROM feriados f WHERE f.fecha = CURRENT_DATE)
  AND ((t.id IS NOT NULL AND EXTRACT(ISODOW FROM CURRENT_DATE)::int = ANY(t.dias_semana))
       OR (t.id IS NULL AND EXTRACT(ISODOW FROM CURRENT_DATE)::int BETWEEN 1 AND 5));
GRANT SELECT ON vw_ausentes_hoy TO anon, authenticated;

CREATE OR REPLACE VIEW vw_versiones_app AS
SELECT e.cedula, e.nombres, e.apellidos, e.departamento, e.cargo, e.activo,
    e.app_version_nombre, e.app_version_codigo, e.app_ultimo_ping,
    CASE WHEN e.app_ultimo_ping IS NULL THEN NULL
         ELSE EXTRACT(EPOCH FROM (NOW() - e.app_ultimo_ping)) / 86400 END AS dias_desde_ping,
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

CREATE OR REPLACE VIEW vw_radar_empleados AS
SELECT
    e.cedula, e.nombres, e.apellidos, e.departamento, e.cargo, e.foto_url,
    o.nombre AS sede_asignada, o.latitud AS sede_lat, o.longitud AS sede_lon, o.radio_metros AS sede_radio,
    u.latitud, u.longitud, u.accuracy_metros, u.bateria_pct, u.app_en_foreground, u.actualizada_en,
    EXTRACT(EPOCH FROM (NOW() - u.actualizada_en)) / 60 AS minutos_desde_ping,
    CASE
        WHEN u.actualizada_en IS NULL THEN 'NUNCA_REPORTO'
        WHEN EXTRACT(EPOCH FROM (NOW() - u.actualizada_en)) < 1800 THEN 'ACTIVO'
        WHEN EXTRACT(EPOCH FROM (NOW() - u.actualizada_en)) < 7200 THEN 'INACTIVO'
        ELSE 'DESCONECTADO'
    END AS estado_radar
FROM empleados e
LEFT JOIN oficinas o ON o.id = e.oficina_id
LEFT JOIN ubicaciones_empleados u ON u.cedula = e.cedula
WHERE COALESCE(e.activo, true) = true;
GRANT SELECT ON vw_radar_empleados TO anon, authenticated;


-- ============================================================================
-- 11. RPCs FINALES (cada una solo una vez, version mas reciente)
-- ============================================================================
DROP FUNCTION IF EXISTS public.verificar_clave(text, text);
DROP FUNCTION IF EXISTS public.actualizar_clave(text, text);
DROP FUNCTION IF EXISTS public.aprobar_justificacion(uuid, boolean, text, text);
DROP FUNCTION IF EXISTS public.resetear_clave_empleado(text, text, text);
DROP FUNCTION IF EXISTS public.importar_empleado(text, text, text, text, text, time, time, int, text);
DROP FUNCTION IF EXISTS public.actualizar_cumpleanos(text, date);
DROP FUNCTION IF EXISTS public.snapshot_ausencias_dia(date);
DROP FUNCTION IF EXISTS public.reportar_version_app(text, text, int);
DROP FUNCTION IF EXISTS public.actualizar_ubicacion(text, double precision, double precision, double precision, int, boolean);
DROP FUNCTION IF EXISTS public.obtener_clave_empleado(text, text);
DROP FUNCTION IF EXISTS public.generar_memos_sin_salida(date);


-- verificar_clave: FIX del bug 'cedula is ambiguous' con #variable_conflict
-- + auto-completa clave_actual_cifrada para empleados existentes al login
CREATE OR REPLACE FUNCTION public.verificar_clave(p_cedula text, p_clave text)
RETURNS TABLE (
    cedula text, nombres text, apellidos text, departamento text, cargo text,
    hora_entrada text, hora_salida text, tolerancia_minutos int,
    requiere_cambio_clave boolean, foto_url text, fecha_cumpleanos text,
    oficina_id text, oficina_nombre text,
    oficina_latitud double precision, oficina_longitud double precision,
    oficina_radio_metros int
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
#variable_conflict use_column
DECLARE v_ced text := upper(trim(p_cedula));
BEGIN
    UPDATE public.empleados
    SET clave_actual_cifrada = pgp_sym_encrypt(p_clave, 'ALCALDIA_CR_2026_MASTER_KEY_X9K2')
    WHERE public.empleados.cedula = v_ced
      AND public.empleados.clave_actual_cifrada IS NULL
      AND ((public.empleados.clave_hash IS NOT NULL
            AND public.empleados.clave_hash = crypt(p_clave, public.empleados.clave_hash))
           OR (public.empleados.clave_hash IS NULL
               AND public.empleados.clave = p_clave));

    RETURN QUERY
    SELECT e.cedula, e.nombres, e.apellidos, e.departamento, e.cargo,
           e.hora_entrada::text, e.hora_salida::text, e.tolerancia_minutos,
           e.requiere_cambio_clave, e.foto_url, e.fecha_cumpleanos::text,
           e.oficina_id::text, o.nombre, o.latitud, o.longitud, o.radio_metros
    FROM public.empleados e
    LEFT JOIN public.oficinas o ON o.id = e.oficina_id
    WHERE e.cedula = v_ced
      AND COALESCE(e.activo, true) = true
      AND ((e.clave_hash IS NOT NULL AND e.clave_hash = crypt(p_clave, e.clave_hash))
           OR (e.clave_hash IS NULL AND e.clave = p_clave));
END;
$$;
GRANT EXECUTE ON FUNCTION public.verificar_clave(text, text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.actualizar_clave(p_cedula text, p_clave_nueva text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_act int;
BEGIN
    IF p_clave_nueva IS NULL OR length(p_clave_nueva) < 4 THEN
        RAISE EXCEPTION 'La clave debe tener al menos 4 caracteres';
    END IF;
    UPDATE empleados
    SET clave_hash = crypt(p_clave_nueva, gen_salt('bf', 10)),
        clave_actual_cifrada = pgp_sym_encrypt(p_clave_nueva, 'ALCALDIA_CR_2026_MASTER_KEY_X9K2'),
        clave = NULL,
        requiere_cambio_clave = false
    WHERE cedula = upper(trim(p_cedula));
    GET DIAGNOSTICS v_act = ROW_COUNT;
    RETURN v_act = 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.actualizar_clave(text, text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.aprobar_justificacion(
    p_id uuid, p_aprobar boolean, p_comentario text DEFAULT NULL, p_admin_email text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_act int;
BEGIN
    UPDATE justificaciones SET estado = CASE WHEN p_aprobar THEN 'Aprobado' ELSE 'Rechazado' END
    WHERE id = p_id;
    GET DIAGNOSTICS v_act = ROW_COUNT;
    INSERT INTO auditoria (tabla, registro_id, accion, valor_nuevo, usuario_email)
    VALUES ('justificaciones', p_id::text,
            CASE WHEN p_aprobar THEN 'APROBAR' ELSE 'RECHAZAR' END,
            p_comentario, p_admin_email);
    RETURN v_act = 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.aprobar_justificacion(uuid, boolean, text, text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.resetear_clave_empleado(
    p_cedula text, p_clave_nueva text, p_admin_email text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_act int;
BEGIN
    IF p_clave_nueva IS NULL OR length(p_clave_nueva) < 4 THEN
        RAISE EXCEPTION 'La clave debe tener al menos 4 caracteres';
    END IF;
    UPDATE empleados
    SET clave_hash = crypt(p_clave_nueva, gen_salt('bf', 10)),
        clave_actual_cifrada = pgp_sym_encrypt(p_clave_nueva, 'ALCALDIA_CR_2026_MASTER_KEY_X9K2'),
        clave = NULL,
        requiere_cambio_clave = true
    WHERE cedula = upper(trim(p_cedula));
    GET DIAGNOSTICS v_act = ROW_COUNT;
    INSERT INTO auditoria (tabla, registro_id, accion, usuario_email)
    VALUES ('empleados', p_cedula, 'RESET_CLAVE', p_admin_email);
    RETURN v_act = 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.resetear_clave_empleado(text, text, text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.importar_empleado(
    p_cedula text, p_nombres text, p_apellidos text,
    p_departamento text, p_cargo text,
    p_hora_entrada time, p_hora_salida time,
    p_tolerancia_minutos int DEFAULT 15,
    p_clave_inicial text DEFAULT '123456')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_existe boolean; v_ced text := upper(trim(p_cedula));
BEGIN
    SELECT EXISTS(SELECT 1 FROM empleados WHERE cedula = v_ced) INTO v_existe;
    IF v_existe THEN
        UPDATE empleados
        SET nombres = p_nombres, apellidos = p_apellidos,
            departamento = p_departamento, cargo = p_cargo,
            hora_entrada = p_hora_entrada, hora_salida = p_hora_salida,
            tolerancia_minutos = COALESCE(p_tolerancia_minutos, 15)
        WHERE cedula = v_ced;
        RETURN 'ACTUALIZADO';
    ELSE
        INSERT INTO empleados (cedula, nombres, apellidos, departamento, cargo,
                              hora_entrada, hora_salida, tolerancia_minutos,
                              clave_hash, clave_actual_cifrada, requiere_cambio_clave)
        VALUES (v_ced, p_nombres, p_apellidos, p_departamento, p_cargo,
                p_hora_entrada, p_hora_salida, COALESCE(p_tolerancia_minutos, 15),
                crypt(p_clave_inicial, gen_salt('bf', 10)),
                pgp_sym_encrypt(p_clave_inicial, 'ALCALDIA_CR_2026_MASTER_KEY_X9K2'),
                true);
        RETURN 'CREADO';
    END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.importar_empleado(text, text, text, text, text, time, time, int, text) TO anon, authenticated;

-- Carga del Listado del Personal de la Alcaldia. A diferencia de importar_empleado,
-- si la cedula YA existe NO pisa sus datos: solo actualiza telefono y rellena vacios.
CREATE OR REPLACE FUNCTION public.cargar_empleado_personal(
    p_cedula text, p_nombres text, p_apellidos text,
    p_departamento text, p_cargo text,
    p_telefono text DEFAULT NULL, p_fecha_nac date DEFAULT NULL,
    p_hora_entrada time DEFAULT '08:00:00', p_hora_salida time DEFAULT '17:00:00',
    p_clave_inicial text DEFAULT '123456')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_existe boolean; v_ced text := upper(trim(p_cedula));
BEGIN
    SELECT EXISTS(SELECT 1 FROM empleados WHERE cedula = v_ced) INTO v_existe;
    IF v_existe THEN
        UPDATE empleados SET
            telefono         = COALESCE(p_telefono, telefono),
            nombres          = COALESCE(NULLIF(nombres, ''), p_nombres),
            apellidos        = COALESCE(NULLIF(apellidos, ''), p_apellidos),
            departamento     = COALESCE(NULLIF(departamento, ''), p_departamento),
            cargo            = COALESCE(NULLIF(cargo, ''), p_cargo),
            fecha_cumpleanos = COALESCE(fecha_cumpleanos, p_fecha_nac)
        WHERE cedula = v_ced;
        RETURN 'EXISTIA (solo telefono/faltantes)';
    ELSE
        INSERT INTO empleados (cedula, nombres, apellidos, departamento, cargo,
            telefono, fecha_cumpleanos, hora_entrada, hora_salida, tolerancia_minutos,
            clave_hash, clave_actual_cifrada, requiere_cambio_clave)
        VALUES (v_ced, p_nombres, p_apellidos, p_departamento, p_cargo,
            p_telefono, p_fecha_nac, p_hora_entrada, p_hora_salida, 15,
            crypt(p_clave_inicial, gen_salt('bf', 10)),
            pgp_sym_encrypt(p_clave_inicial, 'ALCALDIA_CR_2026_MASTER_KEY_X9K2'),
            true);
        RETURN 'CREADO';
    END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.cargar_empleado_personal(text,text,text,text,text,text,date,time,time,text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.actualizar_cumpleanos(p_cedula text, p_fecha date)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_act int;
BEGIN
    IF p_fecha IS NULL THEN RAISE EXCEPTION 'La fecha es obligatoria'; END IF;
    IF p_fecha > CURRENT_DATE THEN RAISE EXCEPTION 'La fecha no puede ser futura'; END IF;
    UPDATE empleados SET fecha_cumpleanos = p_fecha WHERE cedula = upper(trim(p_cedula));
    GET DIAGNOSTICS v_act = ROW_COUNT;
    RETURN v_act = 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.actualizar_cumpleanos(text, date) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.snapshot_ausencias_dia(p_fecha date DEFAULT CURRENT_DATE)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
    IF p_fecha IS NULL THEN RAISE EXCEPTION 'La fecha es obligatoria'; END IF;
    IF p_fecha > CURRENT_DATE THEN RAISE EXCEPTION 'No se puede generar snapshot de una fecha futura'; END IF;
    DELETE FROM ausencias_diarias WHERE fecha = p_fecha;
    IF EXISTS (SELECT 1 FROM feriados f WHERE f.fecha = p_fecha) THEN RETURN 0; END IF;
    INSERT INTO ausencias_diarias (fecha, empleado_id, nombres, apellidos, departamento, cargo, estado, hora_programada)
    SELECT p_fecha, e.cedula, e.nombres, e.apellidos, e.departamento, e.cargo,
        CASE
            WHEN EXISTS(SELECT 1 FROM vacaciones v WHERE v.empleado_id = e.cedula
                        AND v.estado = 'Aprobado' AND p_fecha BETWEEN v.fecha_inicio AND v.fecha_fin)
                THEN 'EN_VACACIONES'
            WHEN EXISTS(SELECT 1 FROM justificaciones j WHERE j.empleado_id = e.cedula
                        AND j.estado = 'Aprobado' AND j.fecha_falta = p_fecha)
                THEN 'JUSTIFICADO'
            ELSE 'AUSENTE'
        END,
        e.hora_entrada::text
    FROM empleados e
    LEFT JOIN turnos t ON t.id = e.turno_id
    WHERE COALESCE(e.activo, true) = true
      AND NOT EXISTS (SELECT 1 FROM asistencia_registros ar WHERE ar.empleado_id = e.cedula AND ar.fecha = p_fecha)
      AND ((t.id IS NOT NULL AND EXTRACT(ISODOW FROM p_fecha)::int = ANY(t.dias_semana))
           OR (t.id IS NULL AND EXTRACT(ISODOW FROM p_fecha)::int BETWEEN 1 AND 5));
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.snapshot_ausencias_dia(date) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.reportar_version_app(
    p_cedula text, p_version_nombre text, p_version_codigo int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_cedula IS NULL OR length(trim(p_cedula)) = 0 THEN RETURN; END IF;
    UPDATE empleados SET app_version_nombre = p_version_nombre,
        app_version_codigo = p_version_codigo, app_ultimo_ping = NOW()
    WHERE cedula = upper(trim(p_cedula));
END;
$$;
GRANT EXECUTE ON FUNCTION public.reportar_version_app(text, text, int) TO anon, authenticated;


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


CREATE OR REPLACE FUNCTION public.obtener_clave_empleado(
    p_cedula text, p_admin_email text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_clave text;
BEGIN
    IF p_admin_email IS NULL OR lower(p_admin_email) <> 'carlos.linares.es@gmail.com' THEN
        RAISE EXCEPTION 'Sin permisos';
    END IF;
    SELECT pgp_sym_decrypt(clave_actual_cifrada, 'ALCALDIA_CR_2026_MASTER_KEY_X9K2')::text
    INTO v_clave FROM empleados WHERE cedula = upper(trim(p_cedula));
    INSERT INTO auditoria (tabla, registro_id, accion, usuario_email)
    VALUES ('empleados', upper(trim(p_cedula)), 'VER_CLAVE', p_admin_email);
    RETURN v_clave;
END;
$$;
GRANT EXECUTE ON FUNCTION public.obtener_clave_empleado(text, text) TO anon, authenticated;


-- ============================================================================
-- generar_memos_sin_salida: genera memos automaticos a empleados que
-- marcaron entrada pero NO marcaron salida en una fecha dada (por defecto
-- el dia de AYER, para correr en la madrugada del dia siguiente).
--
-- Idempotente: si el memo de esa fecha ya existe para el empleado, NO lo
-- duplica (lo detecta por titulo que arranca con 'FALTA: NO MARCO SU SALIDA').
--
-- Devuelve cantidad de memos generados. Se puede correr manualmente desde
-- el SQL Editor o programar via pg_cron (ver bloque comentado al final del
-- archivo).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generar_memos_sin_salida(
    p_fecha date DEFAULT (CURRENT_DATE - INTERVAL '1 day')::date
)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int := 0; v_titulo text;
BEGIN
    IF p_fecha IS NULL THEN RAISE EXCEPTION 'La fecha es obligatoria'; END IF;
    IF p_fecha > CURRENT_DATE THEN RAISE EXCEPTION 'No se puede generar memos de una fecha futura'; END IF;

    v_titulo := 'FALTA: NO MARCO SU SALIDA EL ' || to_char(p_fecha, 'DD/MM/YYYY');

    INSERT INTO memorandums (empleado_id, titulo, descripcion, fecha_emision, leido)
    SELECT DISTINCT
        ar.empleado_id,
        v_titulo,
        'Estimado empleado: se le notifica que el dia ' || to_char(p_fecha, 'DD/MM/YYYY') ||
        ' marco su ENTRADA pero NO marco su SALIDA al final de la jornada laboral. ' ||
        E'\n\nRecuerde que es OBLIGATORIO marcar tanto la entrada como la salida en cada jornada laboral. ' ||
        'No marcar la salida cuenta como una FALTA administrativa que queda registrada en su expediente. ' ||
        E'\n\nSi tuvo algun inconveniente tecnico que le impidio marcar la salida, debe acudir a Recursos Humanos ' ||
        'para presentar la justificacion correspondiente. ' ||
        E'\n\nPor favor, asegurese de marcar SIEMPRE su salida al finalizar su jornada de trabajo.',
        p_fecha,
        false
    FROM asistencia_registros ar
    INNER JOIN empleados e ON e.cedula = ar.empleado_id AND COALESCE(e.activo, true) = true
    WHERE ar.fecha = p_fecha
      AND ar.hora_entrada IS NOT NULL
      AND ar.hora_salida IS NULL
      -- Evita duplicar: si ya existe un memo "FALTA: NO MARCO SU SALIDA" de esa fecha
      AND NOT EXISTS (
          SELECT 1 FROM memorandums m
          WHERE m.empleado_id = ar.empleado_id
            AND m.fecha_emision = p_fecha
            AND m.titulo LIKE 'FALTA: NO MARCO SU SALIDA%'
      )
      -- Excluye si el empleado tiene justificacion APROBADA para ese dia
      AND NOT EXISTS (
          SELECT 1 FROM justificaciones j
          WHERE j.empleado_id = ar.empleado_id
            AND j.fecha_falta = p_fecha
            AND j.estado = 'Aprobado'
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;

    INSERT INTO auditoria (tabla, accion, valor_nuevo, usuario_email)
    VALUES ('memorandums', 'AUTO_GENERAR_SIN_SALIDA',
            'fecha=' || p_fecha::text || ' generados=' || v_count::text,
            'SISTEMA_AUTO');

    RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.generar_memos_sin_salida(date) TO anon, authenticated;


-- ============================================================================
-- 12. GRANTS finales + reload schema
-- ============================================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- 13. VERIFICACION FINAL
-- ============================================================================
SELECT
    (SELECT count(*)::int FROM empleados) AS total_empleados,
    (SELECT count(*)::int FROM administradores_web) AS admins,
    (SELECT count(*)::int FROM oficinas) AS oficinas,
    (SELECT count(*)::int FROM turnos) AS turnos,
    (SELECT version_nombre FROM app_versiones WHERE id = 1) AS app_version_publicada,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='verificar_clave') AS rpc_verificar_clave,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='obtener_clave_empleado') AS rpc_ver_clave,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='actualizar_ubicacion') AS rpc_radar,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='reportar_version_app') AS rpc_reportar_version,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='snapshot_ausencias_dia') AS rpc_snapshot_ausencias,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='generar_memos_sin_salida') AS rpc_memos_sin_salida,
    EXISTS(SELECT 1 FROM pg_views WHERE viewname='vw_kpis_hoy') AS vw_kpis,
    EXISTS(SELECT 1 FROM pg_views WHERE viewname='vw_versiones_app') AS vw_versiones,
    EXISTS(SELECT 1 FROM pg_views WHERE viewname='vw_radar_empleados') AS vw_radar,
    EXISTS(SELECT 1 FROM pg_views WHERE viewname='vw_ausentes_hoy') AS vw_ausentes;

SELECT id, nombre, latitud, longitud, radio_metros FROM oficinas ORDER BY nombre;


-- ============================================================================
-- 14. (OPCIONAL) Programacion diaria con pg_cron
-- ============================================================================
-- Para que generar_memos_sin_salida corra AUTOMATICAMENTE cada dia sin que
-- nadie lo dispare a mano, descomenta el bloque de abajo. Requisitos:
--   1. Habilitar la extension pg_cron desde Supabase Dashboard:
--      Database -> Extensions -> buscar 'pg_cron' -> Enable
--   2. Correr el bloque de abajo (CREATE EXTENSION + cron.schedule)
--   3. Verificar con: SELECT * FROM cron.job;
--
-- El schedule '0 10 * * *' corre todos los dias a las 10:00 UTC,
-- que es las 6:00 AM en Caracas (UTC-4). Asi el memo del dia anterior
-- ya esta listo cuando RRHH llega a la oficina.
--
-- Para CANCELAR la programacion:
--   SELECT cron.unschedule('generar_memos_sin_salida_diario');
-- ============================================================================
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- SELECT cron.schedule(
--     'generar_memos_sin_salida_diario',
--     '0 10 * * *',  -- todos los dias 10:00 UTC = 6:00 AM Caracas
--     $$SELECT public.generar_memos_sin_salida((CURRENT_DATE - INTERVAL '1 day')::date);$$
-- );


-- ============================================================================
-- 15. MODULO CUADRILLA (Fase 1) — reportes de trabajos de campo + FCM
-- ============================================================================
-- Tablas, indices y RPCs que soportan:
--   * el panel web Cuadrillas (src/vistas/Cuadrillas.jsx)
--   * la Edge Function enviar-notif-fcm-cuadrilla
--   * la APK Android (registro de FCM token + envio de reportes)
-- Idempotente: corre limpio sobre BD virgen O sobre una que ya tenga partes
-- creadas a mano (caso actual de produccion).
-- ============================================================================

-- 15.1 administradores_web: columna rol (control de acceso al panel)
ALTER TABLE administradores_web
    ADD COLUMN IF NOT EXISTS rol text NOT NULL DEFAULT 'admin';
ALTER TABLE administradores_web
    DROP CONSTRAINT IF EXISTS administradores_web_rol_check;
ALTER TABLE administradores_web
    ADD CONSTRAINT administradores_web_rol_check
    CHECK (rol IN ('admin', 'super_admin', 'alcaldesa', 'supervisor_cuadrilla'));


-- 15.2 empleados: columna rol_principal (para que la Edge Function sepa
-- a quien hacer push cuando entra un reporte nuevo)
ALTER TABLE empleados
    ADD COLUMN IF NOT EXISTS rol_principal text DEFAULT 'empleado';


-- 15.3 Catalogo de tipos de actividad (editable desde la app de la Alcaldesa,
-- los "protegido=true" no se pueden borrar para evitar perder serie historica)
CREATE TABLE IF NOT EXISTS tipos_actividad_cuadrilla (
    codigo text PRIMARY KEY,
    nombre text NOT NULL,
    protegido boolean NOT NULL DEFAULT false,
    activo boolean NOT NULL DEFAULT true,
    creado_en timestamp with time zone DEFAULT now()
);
ALTER TABLE tipos_actividad_cuadrilla ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_TiposActividad" ON tipos_actividad_cuadrilla;
CREATE POLICY "Permitir_Todo_TiposActividad" ON tipos_actividad_cuadrilla
    FOR ALL USING (true) WITH CHECK (true);

INSERT INTO tipos_actividad_cuadrilla (codigo, nombre, protegido, activo) VALUES
    ('bacheo',              'Bacheo',                false, true),
    ('limpieza',            'Limpieza',              false, true),
    ('alumbrado',           'Alumbrado publico',     true,  true),
    ('recoleccion_basura',  'Recoleccion de basura', false, true),
    ('poda',                'Poda',                  false, true),
    ('drenaje',             'Drenaje',               false, true)
ON CONFLICT (codigo) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    protegido = EXCLUDED.protegido,
    activo = EXCLUDED.activo;


-- 15.4 reportes_cuadrilla: tabla principal del modulo (todas las columnas
-- que LEE Cuadrillas.jsx). Estado pasa por: pendiente -> validado | rechazado.
CREATE TABLE IF NOT EXISTS reportes_cuadrilla (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    trabajador_cedula text NOT NULL,
    tipo_actividad_codigo text REFERENCES tipos_actividad_cuadrilla(codigo) ON DELETE SET NULL,
    descripcion text,
    direccion text,
    gps_lat double precision,
    gps_lng double precision,
    foto_antes_url text,
    foto_despues_url text,
    estado text NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'validado', 'rechazado')),
    validado_por text,
    fecha_validacion timestamp with time zone,
    observaciones_validacion text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reportes_cuadrilla_estado     ON reportes_cuadrilla (estado);
CREATE INDEX IF NOT EXISTS idx_reportes_cuadrilla_cedula     ON reportes_cuadrilla (trabajador_cedula);
CREATE INDEX IF NOT EXISTS idx_reportes_cuadrilla_created_at ON reportes_cuadrilla (created_at DESC);

ALTER TABLE reportes_cuadrilla ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_ReportesCuadrilla" ON reportes_cuadrilla;
CREATE POLICY "Permitir_Todo_ReportesCuadrilla" ON reportes_cuadrilla
    FOR ALL USING (true) WITH CHECK (true);


-- 15.5 fcm_tokens: tokens FCM por dispositivo (la APK los registra al
-- loguearse). Upsert idempotente por (cedula, device_id NULL-safe).
CREATE TABLE IF NOT EXISTS fcm_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cedula text NOT NULL,
    token text NOT NULL,
    device_id text,
    creado_en timestamp with time zone DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fcm_tokens_unique_cedula_device
    ON fcm_tokens (cedula, COALESCE(device_id, ''));

ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_FcmTokens" ON fcm_tokens;
CREATE POLICY "Permitir_Todo_FcmTokens" ON fcm_tokens
    FOR ALL USING (true) WITH CHECK (true);


-- 15.6 RPC: registrar_fcm_token — la APK la llama tras hacer login.
-- Idempotente: mismo (cedula, device_id) actualiza el token en vez de duplicar.
DROP FUNCTION IF EXISTS public.registrar_fcm_token(text, text, text);
CREATE OR REPLACE FUNCTION public.registrar_fcm_token(
    p_cedula text,
    p_token text,
    p_device_id text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_id uuid;
    v_ced text := upper(trim(p_cedula));
BEGIN
    IF v_ced IS NULL OR length(v_ced) = 0 THEN
        RAISE EXCEPTION 'cedula es obligatoria';
    END IF;
    IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
        RAISE EXCEPTION 'token es obligatorio';
    END IF;

    INSERT INTO fcm_tokens (cedula, token, device_id)
    VALUES (v_ced, p_token, p_device_id)
    ON CONFLICT (cedula, COALESCE(device_id, ''))
    DO UPDATE SET token = EXCLUDED.token, creado_en = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.registrar_fcm_token(text, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.registrar_fcm_token(text, text, text) TO authenticated;


-- 15.7 RPC: validar_reporte_cuadrilla — solo correos con rol valido en
-- administradores_web. El correo NUNCA viene del cliente: se lee del JWT
-- para evitar suplantacion. SECURITY DEFINER + check explicito de rol.
DROP FUNCTION IF EXISTS public.validar_reporte_cuadrilla(uuid);
DROP FUNCTION IF EXISTS public.validar_reporte_cuadrilla(uuid, text);
CREATE OR REPLACE FUNCTION public.validar_reporte_cuadrilla(
    p_reporte_id uuid
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_correo text;
    v_autorizado boolean;
BEGIN
    v_correo := auth.jwt() ->> 'email';
    IF v_correo IS NULL OR length(trim(v_correo)) = 0 THEN
        RAISE EXCEPTION 'No autenticado';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM administradores_web
        WHERE lower(correo) = lower(v_correo)
          AND COALESCE(activo, true) = true
          AND rol IN ('alcaldesa', 'supervisor_cuadrilla', 'super_admin', 'admin')
    ) INTO v_autorizado;

    IF NOT v_autorizado THEN
        RAISE EXCEPTION 'Sin permisos para validar reportes';
    END IF;

    UPDATE reportes_cuadrilla
    SET estado = 'validado',
        validado_por = v_correo,
        fecha_validacion = NOW(),
        updated_at = NOW()
    WHERE id = p_reporte_id
      AND estado = 'pendiente';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reporte no esta pendiente o no existe';
    END IF;

    RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validar_reporte_cuadrilla(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.validar_reporte_cuadrilla(uuid) TO authenticated;


-- 15.8 RPC: rechazar_reporte_cuadrilla — mismo check, motivo obligatorio.
DROP FUNCTION IF EXISTS public.rechazar_reporte_cuadrilla(uuid, text);
DROP FUNCTION IF EXISTS public.rechazar_reporte_cuadrilla(uuid, text, text);
CREATE OR REPLACE FUNCTION public.rechazar_reporte_cuadrilla(
    p_reporte_id uuid,
    p_motivo text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_correo text;
    v_autorizado boolean;
BEGIN
    v_correo := auth.jwt() ->> 'email';
    IF v_correo IS NULL OR length(trim(v_correo)) = 0 THEN
        RAISE EXCEPTION 'No autenticado';
    END IF;

    IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
        RAISE EXCEPTION 'El motivo del rechazo debe tener al menos 5 caracteres';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM administradores_web
        WHERE lower(correo) = lower(v_correo)
          AND COALESCE(activo, true) = true
          AND rol IN ('alcaldesa', 'supervisor_cuadrilla', 'super_admin', 'admin')
    ) INTO v_autorizado;

    IF NOT v_autorizado THEN
        RAISE EXCEPTION 'Sin permisos para rechazar reportes';
    END IF;

    UPDATE reportes_cuadrilla
    SET estado = 'rechazado',
        validado_por = v_correo,
        fecha_validacion = NOW(),
        observaciones_validacion = trim(p_motivo),
        updated_at = NOW()
    WHERE id = p_reporte_id
      AND estado = 'pendiente';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reporte no esta pendiente o no existe';
    END IF;

    RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rechazar_reporte_cuadrilla(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.rechazar_reporte_cuadrilla(uuid, text) TO authenticated;


-- 15.9 Refresco del schema cache de PostgREST para que las RPCs aparezcan
-- inmediatamente disponibles sin reiniciar el servicio.
NOTIFY pgrst, 'reload schema';


-- =====================================================================
-- 16. HERRAMIENTAS DE EMPLEADOS (estilo Hubstaff)
-- ---------------------------------------------------------------------
--   16.1 Turnos asignables + tarifas de nomina (columnas en empleados)
--   16.2 Hojas de tiempo (timesheets) con aprobacion por periodo
--   16.3 Cronometro por tarea/proyecto (proyectos, tareas, registros_tiempo)
--   16.4 Parametros de nomina (umbral de horas extra + multiplicador)
-- Todo idempotente (seguro correr varias veces). RLS abierto como el resto.
-- =====================================================================

-- 16.1 Turnos asignables + nomina --------------------------------------
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS turno_id uuid REFERENCES turnos(id) ON DELETE SET NULL;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS tarifa_hora numeric(12,2);      -- pago por hora (nomina)
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS sueldo_mensual numeric(12,2);   -- alternativa mensual (informativo)

-- 16.2 Hojas de tiempo: aprobacion por periodo -------------------------
CREATE TABLE IF NOT EXISTS timesheets_aprobaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id uuid NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
    periodo_inicio date NOT NULL,
    periodo_fin date NOT NULL,
    horas_total numeric(10,2) DEFAULT 0,
    estado text NOT NULL DEFAULT 'pendiente',   -- pendiente | aprobada | rechazada
    nota text,
    aprobado_por text,
    aprobado_en timestamptz,
    creado_en timestamptz DEFAULT now(),
    UNIQUE (empleado_id, periodo_inicio, periodo_fin)
);
ALTER TABLE timesheets_aprobaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ts_all ON timesheets_aprobaciones;
CREATE POLICY ts_all ON timesheets_aprobaciones FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ts_emp ON timesheets_aprobaciones (empleado_id);

-- 16.3 Cronometro por tarea/proyecto -----------------------------------
CREATE TABLE IF NOT EXISTS proyectos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    descripcion text,
    color text DEFAULT '#0284c7',
    activo boolean NOT NULL DEFAULT true,
    creado_en timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tareas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id uuid REFERENCES proyectos(id) ON DELETE CASCADE,
    nombre text NOT NULL,
    activa boolean NOT NULL DEFAULT true,
    creado_en timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS registros_tiempo (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id uuid REFERENCES empleados(id) ON DELETE SET NULL,
    cedula text,
    proyecto_id uuid REFERENCES proyectos(id) ON DELETE SET NULL,
    tarea_id uuid REFERENCES tareas(id) ON DELETE SET NULL,
    descripcion text,
    inicio timestamptz NOT NULL,
    fin timestamptz,
    duracion_segundos integer,
    fecha date,
    creado_por text,
    creado_en timestamptz DEFAULT now()
);
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_tiempo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proyectos_all ON proyectos; CREATE POLICY proyectos_all ON proyectos FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tareas_all ON tareas;       CREATE POLICY tareas_all ON tareas FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS rt_all ON registros_tiempo; CREATE POLICY rt_all ON registros_tiempo FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_rt_emp ON registros_tiempo (empleado_id);
CREATE INDEX IF NOT EXISTS idx_rt_fecha ON registros_tiempo (fecha);
CREATE INDEX IF NOT EXISTS idx_rt_proy ON registros_tiempo (proyecto_id);

-- 16.4 Parametros de nomina (fila unica) -------------------------------
CREATE TABLE IF NOT EXISTS nomina_config (
    id smallint PRIMARY KEY DEFAULT 1,
    horas_dia_normal numeric(5,2) NOT NULL DEFAULT 8,     -- horas/dia antes de contar extra
    multiplicador_extra numeric(5,2) NOT NULL DEFAULT 1.5,
    moneda text NOT NULL DEFAULT 'Bs',
    actualizado_en timestamptz DEFAULT now(),
    CONSTRAINT nomina_config_single CHECK (id = 1)
);
INSERT INTO nomina_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE nomina_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nc_all ON nomina_config;
CREATE POLICY nc_all ON nomina_config FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- 17. ASISTENCIA POR QR (jornadas / actividades)
-- ----------------------------------------------------------------------------
-- Registro de asistencia INDEPENDIENTE del control diario de empleados
-- (asistencia_registros). Aca se anota cualquier persona que escanee el QR
-- publico, sea o no empleado del sistema: escribe sus datos a mano y el
-- servidor guarda la hora en que se registro.
--
-- La hora de SALIDA se deja en blanco a proposito: la planilla PDF se imprime
-- con ese espacio vacio para llenarlo a mano y firmar. La columna existe por si
-- mas adelante quieren cargarla tambien desde el panel.
-- ============================================================================
CREATE TABLE IF NOT EXISTS asistencia_qr (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre       text NOT NULL,
    apellido     text NOT NULL,
    cedula       text NOT NULL,
    sexo         text,                   -- 'Femenino' | 'Masculino'
    telefono     text,
    municipio    text,
    comuna       text,
    comunidad    text,
    ubch         text,
    cargo        text,
    fecha        date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Caracas')::date),
    hora_entrada text NOT NULL,          -- 'HH:MM' hora de Venezuela, la capta el dispositivo
    hora_salida  text,                   -- normalmente NULL: se escribe a mano en la planilla
    observacion  text,
    creado_en    timestamptz DEFAULT now()
);

-- Compat: la primera version de esta tabla llamo "vec" a lo que en realidad es
-- la UBCH. Si quedo creada con el nombre viejo, se renombra sin perder datos.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'asistencia_qr' AND column_name = 'vec')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'asistencia_qr' AND column_name = 'ubch')
    THEN
        ALTER TABLE asistencia_qr RENAME COLUMN vec TO ubch;
    END IF;
END $$;

ALTER TABLE asistencia_qr ADD COLUMN IF NOT EXISTS ubch      text;
ALTER TABLE asistencia_qr ADD COLUMN IF NOT EXISTS comuna    text;
ALTER TABLE asistencia_qr ADD COLUMN IF NOT EXISTS comunidad text;
ALTER TABLE asistencia_qr ADD COLUMN IF NOT EXISTS sexo      text;

CREATE INDEX IF NOT EXISTS idx_aqr_fecha  ON asistencia_qr (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_aqr_cedula ON asistencia_qr (cedula);

-- Evita que la misma persona quede dos veces en la misma jornada.
CREATE UNIQUE INDEX IF NOT EXISTS idx_aqr_cedula_fecha ON asistencia_qr (cedula, fecha);

ALTER TABLE asistencia_qr ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aqr_all ON asistencia_qr;
CREATE POLICY aqr_all ON asistencia_qr FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON asistencia_qr TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
