-- ============================================================================
-- CARGA_EMPLEADOS_SALA_SITUACIONAL.sql
-- Insercion inicial de 36 empleados de la Sala Situacional PSUV - Cristobal Rojas
-- Excluye: Carlos Linares (admin) y Susej Quintero (sin cedula)
--
-- Como correr: Supabase Studio -> SQL Editor -> New query -> pegar -> Run
-- Idempotente: si la cedula ya existe, ACTUALIZA los campos (no falla).
--
-- Datos por defecto:
--   - Departamento: "Sala Situacional PSUV"
--   - Cargo: "Empleado" (excepto Jeferson Garcia: "Chofer")
--   - Hora entrada: 08:00 / Hora salida: 17:00 / Tolerancia: 15 min
--     (encaja con la ventana institucional 7:00-8:45 entrada y >=17:00 salida)
--   - Clave inicial: 123456 (cada empleado debe cambiarla en el primer login)
--   - requiere_cambio_clave: true (forzado por la RPC importar_empleado)
-- ============================================================================

-- VERIFICACION PREVIA: confirmar que la RPC existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'importar_empleado') THEN
    RAISE EXCEPTION 'Falta la RPC importar_empleado. Corre primero SUPABASE_TODO_EN_UNO.sql';
  END IF;
END $$;


-- ============================================================================
-- 36 EMPLEADOS
-- ============================================================================
SELECT importar_empleado('V14456114', 'LISMARY',     'GUTIERREZ',  'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V21117757', 'GENESIS',     'RIVAS',      'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V24672852', 'MARBELIS',    'LOPEZ',      'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V29905418', 'KAROLAY',     'ORTIZ',      'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V22348816', 'YULEYDIS',    'VILLALBA',   'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V29592390', 'EDGARDO',     'DURAN',      'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V25322562', 'MARYELIS',    'PACHECO',    'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V10891301', 'NIURKA',      'NORIEGA',    'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V6312547',  'YELITZA',     'ESCALONA',   'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V18710709', 'EVELYN',      'INFANTE',    'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V25284882', 'FELIX',       'HERAZO',     'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V17929170', 'LISMAINOR',   'GUTIERREZ',  'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V21149813', 'ANA',         'GARCIA',     'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V30176332', 'YEISY',       'CLARO',      'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V14142154', 'JOSELINE',    'RENGIFO',    'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V15419005', 'NANCY',       'MATO',       'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V15207777', 'LUZMARY',     'MUENTES',    'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V32681435', 'JOSE',        'CONTRERAS',  'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V25517865', 'ANYELIER',    'GUEVARA',    'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V15474648', 'NERYURY',     'ROJAS',      'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V33199881', 'LUCIA',       'RAMIREZ',    'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V30063114', 'ROYERMIR',    'LAYA',       'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V32897465', 'WUILMARYS',   'CHAPARRO',   'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V16521575', 'JENNY',       'ROJAS',      'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V33426838', 'DIEGO',       'MARTINEZ',   'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V12821744', 'MARLENES',    'ALAYON',     'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V14427441', 'YORLAND',     'MARTINEZ',   'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V26284072', 'JEFERSON',    'GARCIA',     'Sala Situacional PSUV', 'Chofer',   '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V25230385', 'NAIRE',       'PIÑANGO',    'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V16370021', 'AURISTELA',   'ZURITA',     'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V22348077', 'YIKEY',       'MACERO',     'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V15475146', 'JONATHAN',    'VILLALBA',   'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
-- #33 CARLOS LINARES omitido (admin del sistema)
SELECT importar_empleado('V25080245', 'VICMAR',      'INDRIAGO',   'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
-- #35 SUSEJ QUINTERO omitido (sin cedula)
SELECT importar_empleado('V13904317', 'JOEL',        'MOTORIZADO', 'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V13320802', 'JOSWAR',      'TIBALDO',    'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');
SELECT importar_empleado('V16577089', 'YURMI',       'MORA',       'Sala Situacional PSUV', 'Empleado', '08:00:00', '17:00:00', 15, '123456');


-- ============================================================================
-- VERIFICACION FINAL
-- ============================================================================
SELECT
  count(*) AS total_empleados_sala_situacional,
  count(*) FILTER (WHERE activo = true) AS activos,
  count(DISTINCT cargo) AS cargos_distintos
FROM empleados
WHERE departamento = 'Sala Situacional PSUV';

-- Listado completo recien cargado, ordenado por cedula:
SELECT cedula, nombres, apellidos, cargo, hora_entrada, hora_salida, requiere_cambio_clave
FROM empleados
WHERE departamento = 'Sala Situacional PSUV'
ORDER BY apellidos, nombres;
