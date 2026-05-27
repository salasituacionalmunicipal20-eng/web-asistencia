-- ============================================================================
-- APP_VERSIONES.sql — distribucion de updates in-app del APK
-- ============================================================================
-- Tabla unica con la version vigente del APK. La app la consulta cada 4h
-- (y cuando se abre) y, si su versionCode local es menor, ofrece descargar
-- la actualizacion.
--
-- Workflow para publicar una version nueva:
--   1. Bumpea versionCode + versionName en build.gradle.kts
--   2. ./gradlew assembleRelease
--   3. cp app/build/outputs/apk/release/app-release.apk web-asistencia/public/AlcaldiaControlAcceso.apk
--   4. git commit + push + npm run deploy
--   5. UPDATE app_versiones SET
--          version_codigo  = 4,
--          version_nombre  = '1.0.3',
--          notas           = 'Notificaciones y refresh automatico',
--          obligatoria     = false,
--          fecha_publicacion = NOW()
--      WHERE id = 1;
--
-- A los <=4h, todos los telefonos detectan la nueva version y ofrecen el
-- update.
-- ============================================================================


CREATE TABLE IF NOT EXISTS app_versiones (
    id              int PRIMARY KEY DEFAULT 1,
    version_codigo  int NOT NULL,         -- = build.gradle versionCode
    version_nombre  text NOT NULL,        -- = build.gradle versionName (ej '1.0.2')
    apk_url         text NOT NULL,        -- URL publica al APK
    notas           text,                 -- changelog corto mostrado en el dialog
    obligatoria     boolean NOT NULL DEFAULT false,  -- si true, no se puede posponer
    fecha_publicacion timestamp with time zone DEFAULT now(),
    -- Restriccion: solo una fila vigente. id=1 siempre.
    CONSTRAINT app_versiones_unica CHECK (id = 1)
);

ALTER TABLE app_versiones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir_Lectura_Versiones" ON app_versiones;
-- Lectura publica (la app sin sesion debe poder leer la version)
CREATE POLICY "Permitir_Lectura_Versiones" ON app_versiones FOR SELECT USING (true);
-- Escritura libre por ahora (solo admins acceden al SQL Editor)
DROP POLICY IF EXISTS "Permitir_Escritura_Versiones" ON app_versiones;
CREATE POLICY "Permitir_Escritura_Versiones" ON app_versiones FOR ALL USING (true) WITH CHECK (true);

-- Insert inicial: version actual (la que esta publicada ahora mismo). Si
-- alguien la actualiza despues, este INSERT no hace nada por el ON CONFLICT.
INSERT INTO app_versiones (id, version_codigo, version_nombre, apk_url, notas, obligatoria)
VALUES (
    1,
    2,
    '1.0.1',
    'https://salasituacionalmunicipal20-eng.github.io/web-asistencia/AlcaldiaControlAcceso.apk',
    'Version inicial con notificaciones de memos y refresh automatico.',
    false
)
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';

SELECT * FROM app_versiones;
