-- ============================================================================
-- CLAVES_REVERSIBLES.sql — el super-admin puede ver claves en texto plano
-- ============================================================================
-- ADVERTENCIA DE SEGURIDAD:
-- Este script viola el principio "nunca almacenar contraseñas reversibles".
-- Se implementa por decision explicita del super-admin (carlos.linares.es)
-- para gestion operativa de empleados. Implicaciones:
--   - Si la cuenta admin se compromete, TODAS las claves quedan expuestas.
--   - Si alguien con acceso a Supabase SQL Editor lee el codigo de la RPC
--     `obtener_clave_empleado`, ve la clave maestra de cifrado.
--   - Idealmente, cambia la clave maestra abajo a algo unico y guardalo
--     fuera del codigo (Supabase Vault, env var, etc.). Por simplicidad
--     se deja inline.
-- ============================================================================


-- Columna para guardar la clave cifrada (reversible)
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS clave_actual_cifrada bytea;


-- ============================================================================
-- RPCs actualizadas — todas guardan tambien la version cifrada
-- ============================================================================

-- actualizar_clave: cambia hash + cifrada
DROP FUNCTION IF EXISTS public.actualizar_clave(text, text);
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
        clave_actual_cifrada = pgp_sym_encrypt(p_clave_nueva, 'ALCALDIA_CR_2026_MASTER_KEY_X9K2'),
        clave = NULL,
        requiere_cambio_clave = false
    WHERE cedula = upper(trim(p_cedula));
    GET DIAGNOSTICS v_actualizadas = ROW_COUNT;
    RETURN v_actualizadas = 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.actualizar_clave(text, text) TO anon, authenticated;


-- resetear_clave_empleado: admin define nueva clave temporal
DROP FUNCTION IF EXISTS public.resetear_clave_empleado(text, text, text);
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
        clave_actual_cifrada = pgp_sym_encrypt(p_clave_nueva, 'ALCALDIA_CR_2026_MASTER_KEY_X9K2'),
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


-- importar_empleado: crear con clave cifrada
DROP FUNCTION IF EXISTS public.importar_empleado(text, text, text, text, text, time, time, int, text);
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


-- verificar_clave: ademas de validar login, autocompleta la version cifrada
-- para empleados que ya tenian hash pero nunca pasaron por este nuevo flujo.
DROP FUNCTION IF EXISTS public.verificar_clave(text, text);
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
DECLARE v_ced text := upper(trim(p_cedula));
BEGIN
    -- Si el login es valido y aun no hay clave cifrada, la guardamos ahora.
    -- Asi llenamos retroactivamente la cifrada para empleados que existian
    -- antes de habilitar este registro.
    UPDATE public.empleados
    SET clave_actual_cifrada = pgp_sym_encrypt(p_clave, 'ALCALDIA_CR_2026_MASTER_KEY_X9K2')
    WHERE cedula = v_ced
      AND clave_actual_cifrada IS NULL
      AND ((clave_hash IS NOT NULL AND clave_hash = crypt(p_clave, clave_hash))
           OR (clave_hash IS NULL AND clave = p_clave));

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


-- ============================================================================
-- obtener_clave_empleado: SOLO la usa el panel del super-admin
-- ============================================================================
-- IMPORTANTE: el gate de "solo Carlos puede ver" se aplica en el FRONTEND
-- (App.jsx ya restringe la vista). Esta RPC en si esta abierta a anon, asi
-- que cualquier persona con la URL del proyecto Supabase puede llamarla si
-- conoce una cedula. Si quieres endurecer esto, agrega un parametro
-- p_admin_email y valida contra la tabla administradores_web.
-- ============================================================================
DROP FUNCTION IF EXISTS public.obtener_clave_empleado(text, text);
CREATE OR REPLACE FUNCTION public.obtener_clave_empleado(
    p_cedula text, p_admin_email text DEFAULT NULL
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE v_clave text;
BEGIN
    -- Solo Carlos Linares puede consultar (gate adicional)
    IF p_admin_email IS NULL OR lower(p_admin_email) <> 'carlos.linares.es@gmail.com' THEN
        RAISE EXCEPTION 'Sin permisos';
    END IF;

    SELECT pgp_sym_decrypt(clave_actual_cifrada, 'ALCALDIA_CR_2026_MASTER_KEY_X9K2')::text
    INTO v_clave
    FROM empleados
    WHERE cedula = upper(trim(p_cedula));

    -- Auditar el acceso (queda registrado en la tabla auditoria)
    INSERT INTO auditoria (tabla, registro_id, accion, usuario_email)
    VALUES ('empleados', upper(trim(p_cedula)), 'VER_CLAVE', p_admin_email);

    RETURN v_clave; -- NULL si nunca se grabó
END;
$$;
GRANT EXECUTE ON FUNCTION public.obtener_clave_empleado(text, text) TO anon, authenticated;


NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- VERIFICACION
-- ============================================================================
SELECT
    EXISTS(SELECT 1 FROM information_schema.columns
           WHERE table_name='empleados' AND column_name='clave_actual_cifrada') AS columna_creada,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='obtener_clave_empleado') AS rpc_ver_creado,
    (SELECT count(*) FROM empleados WHERE clave_actual_cifrada IS NOT NULL) AS claves_disponibles_ahora,
    (SELECT count(*) FROM empleados WHERE clave_actual_cifrada IS NULL) AS claves_pendientes_login;
