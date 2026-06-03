-- ============================================================================
-- SUPABASE_DEFINITIVO.sql - Setup completo del backend
-- ============================================================================
-- Pega TODO en una sola query del SQL Editor de Supabase y dale Run.
-- Idempotente: crea de cero o repara lo existente sin perder datos.
--
-- NOTA: Este script NO carga los empleados. Esos los subes a mano desde el
-- panel web -> Gestion de Personal una vez que el setup quede listo.
-- ============================================================================


-- ============================================================================
-- 0. EXTENSIONES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================================
-- 1. HABITANTES (Alcaldia-admin)
-- ============================================================================
CREATE TABLE IF NOT EXISTS habitantes (
    id serial primary key,
    id_firebase text UNIQUE,
    jefe_hogar_id text,
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
-- 2. ASISTENCIA_REGISTROS - solo se borra si tiene el schema VIEJO
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'asistencia_registros' AND column_name = 'dispositivo_id') THEN
        RAISE NOTICE 'Detectado schema viejo de asistencia_registros, recreando...';
        DROP TABLE asistencia_registros CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS asistencia_registros (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empleado_id   text NOT NULL,
    latitud       double precision NOT NULL,
    longitud      double precision NOT NULL,
    fecha         date NOT NULL,
    hora_entrada  text,
    hora_salida   text,
    device_id     text,
    network_type  text,
    created_at    timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asistencia_empleado_fecha ON asistencia_registros (empleado_id, fecha DESC);
ALTER TABLE asistencia_registros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Asistencia" ON asistencia_registros;
CREATE POLICY "Permitir_Todo_Asistencia" ON asistencia_registros FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- 3. ADMINISTRADORES WEB
-- ----------------------------------------------------------------------------
-- FIX 1: la politica anterior era SOLO SELECT, lo que bloqueaba el INSERT/
--        UPDATE/DELETE del panel "Administradores". Ahora es FOR ALL.
-- FIX 2: columna requiere_cambio_clave para obligar al nuevo admin a cambiar
--        la clave inicial la primera vez que entre al panel.
-- ============================================================================
CREATE TABLE IF NOT EXISTS administradores_web (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    correo text UNIQUE NOT NULL,
    nombre text NOT NULL,
    activo boolean DEFAULT true,
    fecha_creacion timestamp with time zone DEFAULT now()
);
-- Columna nueva (idempotente). default true asi cualquier admin existente
-- que no haya cambiado clave queda obligado en su proximo login.
ALTER TABLE administradores_web ADD COLUMN IF NOT EXISTS requiere_cambio_clave boolean DEFAULT true;

ALTER TABLE administradores_web ENABLE ROW LEVEL SECURITY;
-- Limpia politicas viejas (cualquier nombre) y deja una FOR ALL
DROP POLICY IF EXISTS "Permitir_Lectura_Admins" ON administradores_web;
DROP POLICY IF EXISTS "Permitir_Todo_Admins" ON administradores_web;
CREATE POLICY "Permitir_Todo_Admins" ON administradores_web FOR ALL USING (true) WITH CHECK (true);

-- Carlos Linares es el admin raiz — NO le exigimos cambio obligatorio.
INSERT INTO administradores_web (correo, nombre, activo, requiere_cambio_clave)
VALUES ('carlos.linares.es@gmail.com', 'Carlos Linares', true, false)
ON CONFLICT (correo) DO UPDATE SET activo = EXCLUDED.activo;


-- ============================================================================
-- 4. EMPLEADOS - crea o repara todas las columnas faltantes
-- ============================================================================
CREATE TABLE IF NOT EXISTS empleados (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cedula text UNIQUE NOT NULL
);
-- ASEGURA cada columna requerida (idempotente)
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS nombres            text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS apellidos          text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS departamento       text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS cargo              text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS hora_entrada       time;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS hora_salida        time;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS tolerancia_minutos integer DEFAULT 15;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS activo             boolean DEFAULT true;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_registro     timestamp with time zone DEFAULT now();
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS clave              text DEFAULT '123456';
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS clave_hash         text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS requiere_cambio_clave boolean DEFAULT true;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS foto_url           text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_cumpleanos   date;

-- Backfill hash bcrypt para claves cleartext (usa extensions.crypt explicitamente)
UPDATE empleados SET clave_hash = extensions.crypt(clave, extensions.gen_salt('bf', 10))
WHERE clave_hash IS NULL AND clave IS NOT NULL;

ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Empleados" ON empleados;
CREATE POLICY "Permitir_Todo_Empleados" ON empleados FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- 5. JUSTIFICACIONES
-- ============================================================================
CREATE TABLE IF NOT EXISTS justificaciones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    empleado_id text NOT NULL,
    fecha_falta date NOT NULL,
    motivo text NOT NULL,
    estado text DEFAULT 'Pendiente',
    fecha_solicitud timestamp with time zone DEFAULT now()
);
ALTER TABLE justificaciones ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE justificaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Justificaciones" ON justificaciones;
CREATE POLICY "Permitir_Todo_Justificaciones" ON justificaciones FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- 6. MEMORANDUMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS memorandums (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    empleado_id text NOT NULL,
    titulo text NOT NULL,
    descripcion text NOT NULL,
    fecha_emision date DEFAULT CURRENT_DATE,
    leido boolean DEFAULT false
);
ALTER TABLE memorandums ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Todo_Memorandums" ON memorandums;
CREATE POLICY "Permitir_Todo_Memorandums" ON memorandums FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- 7. OFICINAS + TURNOS + FERIADOS + AUDITORIA + ALERTAS
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
INSERT INTO oficinas (nombre, direccion, latitud, longitud, radio_metros)
SELECT 'Charallave Central', 'Sede principal', 10.232380, -66.859302, 50
WHERE NOT EXISTS (SELECT 1 FROM oficinas WHERE nombre = 'Charallave Central');
INSERT INTO oficinas (nombre, direccion, latitud, longitud, radio_metros)
SELECT 'Sede Alterna', 'Sede secundaria', 10.222828, -66.857475, 50
WHERE NOT EXISTS (SELECT 1 FROM oficinas WHERE nombre = 'Sede Alterna');

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
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS turno_id   uuid REFERENCES turnos(id) ON DELETE SET NULL;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS oficina_id uuid REFERENCES oficinas(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS feriados (
    fecha date PRIMARY KEY, descripcion text NOT NULL,
    tipo text NOT NULL DEFAULT 'NACIONAL',
    creado_en timestamp with time zone DEFAULT now()
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


-- ============================================================================
-- 8. VISTAS ANALITICAS
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


-- ============================================================================
-- 9. RPCs
-- ----------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS: necesario porque CREATE OR REPLACE no permite
-- cambiar el tipo de retorno (las versiones nuevas anaden columnas).
-- search_path: incluye 'extensions' para que las funciones encuentren
-- gen_salt() y crypt() de pgcrypto (Supabase los instala en ese schema).
-- ============================================================================
DROP FUNCTION IF EXISTS public.verificar_clave(text, text);
DROP FUNCTION IF EXISTS public.actualizar_clave(text, text);
DROP FUNCTION IF EXISTS public.aprobar_justificacion(uuid, boolean, text, text);
DROP FUNCTION IF EXISTS public.resetear_clave_empleado(text, text, text);
DROP FUNCTION IF EXISTS public.importar_empleado(text, text, text, text, text, time, time, int, text);
DROP FUNCTION IF EXISTS public.actualizar_cumpleanos(text, date);

-- verificar_clave: login server-side de empleados (bcrypt + fallback cleartext)
CREATE OR REPLACE FUNCTION public.verificar_clave(p_cedula text, p_clave text)
RETURNS TABLE (cedula text, nombres text, apellidos text, departamento text,
               cargo text, hora_entrada text, hora_salida text,
               tolerancia_minutos int, requiere_cambio_clave boolean,
               foto_url text, fecha_cumpleanos text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
    RETURN QUERY
    SELECT e.cedula, e.nombres, e.apellidos, e.departamento, e.cargo,
           e.hora_entrada::text, e.hora_salida::text, e.tolerancia_minutos,
           e.requiere_cambio_clave, e.foto_url, e.fecha_cumpleanos::text
    FROM public.empleados e
    WHERE e.cedula = upper(trim(p_cedula))
      AND COALESCE(e.activo, true) = true
      AND ((e.clave_hash IS NOT NULL AND e.clave_hash = crypt(p_clave, e.clave_hash))
           OR (e.clave_hash IS NULL AND e.clave = p_clave));
END;
$$;
GRANT EXECUTE ON FUNCTION public.verificar_clave(text, text) TO anon, authenticated;

-- actualizar_clave: cambio de clave del propio empleado
CREATE OR REPLACE FUNCTION public.actualizar_clave(p_cedula text, p_clave_nueva text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_actualizadas int;
BEGIN
    IF p_clave_nueva IS NULL OR length(p_clave_nueva) < 4 THEN
        RAISE EXCEPTION 'La clave debe tener al menos 4 caracteres';
    END IF;
    UPDATE public.empleados
    SET clave_hash = crypt(p_clave_nueva, gen_salt('bf', 10)),
        clave = NULL, requiere_cambio_clave = false
    WHERE cedula = upper(trim(p_cedula));
    GET DIAGNOSTICS v_actualizadas = ROW_COUNT;
    RETURN v_actualizadas = 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.actualizar_clave(text, text) TO anon, authenticated;

-- aprobar_justificacion: admin aprueba/rechaza con auditoria
CREATE OR REPLACE FUNCTION public.aprobar_justificacion(
    p_id uuid, p_aprobar boolean, p_comentario text DEFAULT NULL, p_admin_email text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actualizadas int;
BEGIN
    UPDATE justificaciones SET estado = CASE WHEN p_aprobar THEN 'Aprobado' ELSE 'Rechazado' END
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

-- resetear_clave_empleado: admin resetea la clave de un empleado
CREATE OR REPLACE FUNCTION public.resetear_clave_empleado(
    p_cedula text, p_clave_nueva text, p_admin_email text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_actualizadas int;
BEGIN
    IF p_clave_nueva IS NULL OR length(p_clave_nueva) < 4 THEN
        RAISE EXCEPTION 'La clave debe tener al menos 4 caracteres';
    END IF;
    UPDATE empleados
    SET clave_hash = crypt(p_clave_nueva, gen_salt('bf', 10)),
        clave = NULL, requiere_cambio_clave = true
    WHERE cedula = upper(trim(p_cedula));
    GET DIAGNOSTICS v_actualizadas = ROW_COUNT;
    INSERT INTO auditoria (tabla, registro_id, accion, usuario_email)
    VALUES ('empleados', p_cedula, 'RESET_CLAVE', p_admin_email);
    RETURN v_actualizadas = 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.resetear_clave_empleado(text, text, text) TO anon, authenticated;

-- importar_empleado: bulk upsert (usado por el boton Importar CSV)
CREATE OR REPLACE FUNCTION public.importar_empleado(
    p_cedula text, p_nombres text, p_apellidos text,
    p_departamento text, p_cargo text,
    p_hora_entrada time, p_hora_salida time,
    p_tolerancia_minutos int DEFAULT 15,
    p_clave_inicial text DEFAULT '123456')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
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
                              clave_hash, requiere_cambio_clave)
        VALUES (v_ced, p_nombres, p_apellidos, p_departamento, p_cargo,
                p_hora_entrada, p_hora_salida, COALESCE(p_tolerancia_minutos, 15),
                crypt(p_clave_inicial, gen_salt('bf', 10)), true);
        RETURN 'CREADO';
    END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.importar_empleado(text, text, text, text, text, time, time, int, text) TO anon, authenticated;

-- actualizar_cumpleanos: el empleado guarda su fecha de nacimiento
CREATE OR REPLACE FUNCTION public.actualizar_cumpleanos(p_cedula text, p_fecha date)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_actualizadas int;
BEGIN
    IF p_fecha IS NULL THEN RAISE EXCEPTION 'La fecha es obligatoria'; END IF;
    IF p_fecha > CURRENT_DATE THEN RAISE EXCEPTION 'La fecha no puede ser futura'; END IF;
    UPDATE empleados SET fecha_cumpleanos = p_fecha
    WHERE cedula = upper(trim(p_cedula));
    GET DIAGNOSTICS v_actualizadas = ROW_COUNT;
    RETURN v_actualizadas = 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.actualizar_cumpleanos(text, date) TO anon, authenticated;


-- ============================================================================
-- 10. GRANTS finales
-- ============================================================================
GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;


-- ============================================================================
-- 11. RELOAD SCHEMA CACHE (importantisimo para que el web vea las columnas nuevas)
-- ============================================================================
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- 12. VERIFICACION FINAL
-- ============================================================================
SELECT
    (SELECT count(*)::int FROM empleados) AS total_empleados,
    (SELECT count(*)::int FROM administradores_web) AS admins,
    (SELECT count(*)::int FROM oficinas) AS oficinas,
    (SELECT count(*)::int FROM turnos) AS turnos,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='verificar_clave')         AS rpc_verificar_clave,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='actualizar_clave')        AS rpc_actualizar_clave,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='importar_empleado')       AS rpc_importar_empleado,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='resetear_clave_empleado') AS rpc_resetear,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='actualizar_cumpleanos')   AS rpc_cumpleanos,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='reportar_version_app')    AS rpc_reportar_version,
    EXISTS(SELECT 1 FROM pg_views WHERE viewname='vw_kpis_hoy')           AS vw_kpis,
    EXISTS(SELECT 1 FROM pg_views WHERE viewname='vw_versiones_app')      AS vw_versiones,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='app_versiones') AS tabla_app_versiones;


-- ============================================================================
-- 13. APP_VERSIONES — distribucion de updates in-app del APK
-- ============================================================================
-- Tabla unica (id=1) con la version vigente del APK. La app la consulta cada
-- 4 horas (y al abrirse) y, si su versionCode local es menor, ofrece descargar
-- el APK desde apk_url.
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_versiones (
    id                int PRIMARY KEY DEFAULT 1,
    version_codigo    int NOT NULL,                            -- = build.gradle versionCode
    version_nombre    text NOT NULL,                           -- = build.gradle versionName
    apk_url           text NOT NULL,                           -- URL publica al APK
    notas             text,                                    -- changelog corto mostrado en dialog
    obligatoria       boolean NOT NULL DEFAULT false,          -- si true, no se puede posponer
    fecha_publicacion timestamp with time zone DEFAULT now(),
    CONSTRAINT app_versiones_unica CHECK (id = 1)
);

ALTER TABLE app_versiones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Lectura_Versiones"   ON app_versiones;
DROP POLICY IF EXISTS "Permitir_Escritura_Versiones" ON app_versiones;
CREATE POLICY "Permitir_Lectura_Versiones"   ON app_versiones FOR SELECT USING (true);
CREATE POLICY "Permitir_Escritura_Versiones" ON app_versiones FOR ALL    USING (true) WITH CHECK (true);

-- Insert inicial defensivo. Si la fila ya existe, NO la pisa: el UPDATE
-- final de la seccion 15 es el que manda la version vigente.
INSERT INTO app_versiones (id, version_codigo, version_nombre, apk_url, notas, obligatoria)
VALUES (
    1,
    1,
    '1.0.0',
    'https://salasituacionalmunicipal20-eng.github.io/web-asistencia/AlcaldiaControlAcceso.apk',
    'Version inicial.',
    false
) ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 14. TRACKING DE VERSION POR EMPLEADO + vista para super-admin
-- ============================================================================
-- Cada vez que el empleado abre la app, la app llama a reportar_version_app
-- y rellena estas 3 columnas en su fila de empleados. La vista vw_versiones_app
-- permite al panel del super-admin ver quien esta al dia y quien no.
-- ============================================================================
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS app_version_nombre text;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS app_version_codigo int;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS app_ultimo_ping    timestamp with time zone;

DROP FUNCTION IF EXISTS public.reportar_version_app(text, text, int);
CREATE OR REPLACE FUNCTION public.reportar_version_app(
    p_cedula         text,
    p_version_nombre text,
    p_version_codigo int
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_cedula IS NULL OR length(trim(p_cedula)) = 0 THEN RETURN; END IF;
    UPDATE empleados
    SET app_version_nombre = p_version_nombre,
        app_version_codigo = p_version_codigo,
        app_ultimo_ping    = NOW()
    WHERE cedula = upper(trim(p_cedula));
END;
$$;
GRANT EXECUTE ON FUNCTION public.reportar_version_app(text, text, int) TO anon, authenticated;

CREATE OR REPLACE VIEW vw_versiones_app AS
SELECT
    e.cedula, e.nombres, e.apellidos, e.departamento, e.cargo, e.activo,
    e.app_version_nombre, e.app_version_codigo, e.app_ultimo_ping,
    CASE WHEN e.app_ultimo_ping IS NULL THEN NULL
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

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- 15. ANUNCIO DE RELEASE — version vigente del APK
-- ============================================================================
-- Esta seccion es la unica que cambia con cada release. El UPDATE final
-- determina que version pedira la app. Bumpear version_codigo + version_nombre
-- aqui es lo que dispara que TODOS los telefonos vean la actualizacion en su
-- proximo chequeo (<= 4 horas).
--
-- Workflow para publicar:
--   1. Bumpear versionCode + versionName en app/build.gradle.kts
--   2. ./gradlew assembleRelease (con JAVA_HOME del JBR de Android Studio)
--   3. Copiar app-release.apk a web-asistencia/public/AlcaldiaControlAcceso.apk
--   4. npm run deploy (vite build + gh-pages)
--   5. Correr este SQL completo y dejar el UPDATE de abajo con la nueva version
-- ============================================================================
UPDATE app_versiones SET
    version_codigo    = 13,
    version_nombre    = '1.0.12',
    apk_url           = 'https://salasituacionalmunicipal20-eng.github.io/web-asistencia/AlcaldiaControlAcceso.apk',
    notas             = 'Nueva seccion "Foto tipo carnet" en el perfil: el empleado toma o elige su foto desde la app (camara + galeria) con instrucciones detalladas para que salga bien. Esta foto sera la que se imprima en el carnet institucional.',
    obligatoria       = false,
    fecha_publicacion = NOW()
WHERE id = 1;

-- Si por alguna razon no existe la fila id=1, la creamos
INSERT INTO app_versiones (id, version_codigo, version_nombre, apk_url, notas, obligatoria)
SELECT 1, 13, '1.0.12',
       'https://salasituacionalmunicipal20-eng.github.io/web-asistencia/AlcaldiaControlAcceso.apk',
       'Nueva seccion "Foto tipo carnet" en el perfil: el empleado toma o elige su foto desde la app (camara + galeria) con instrucciones detalladas para que salga bien. Esta foto sera la que se imprima en el carnet institucional.',
       false
WHERE NOT EXISTS (SELECT 1 FROM app_versiones WHERE id = 1);

-- Verificacion: la version vigente debe quedar 12 / 1.0.11
SELECT id, version_codigo, version_nombre, apk_url, fecha_publicacion FROM app_versiones;
