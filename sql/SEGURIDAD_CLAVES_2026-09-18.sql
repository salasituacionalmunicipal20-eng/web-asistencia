-- =====================================================================
-- CIERRE URGENTE: CLAVES DE EMPLEADOS Y FUNCIONES DE ADMINISTRADOR
-- 18/09/2026
--
-- Lo que se encontró (verificado contra la base en producción):
--
--   1. 462 de 492 empleados tenían su clave EN TEXTO PLANO en la columna
--      empleados.clave, y esa tabla se puede leer con la clave pública de
--      la página. El login ya NO usa esa columna (los 492 tienen su clave
--      en huella bcrypt, clave_hash), así que esas copias sobraban.
--
--   2. Tres funciones de administrador decidían quién era el admin
--      mirando un correo que MANDA EL NAVEGADOR (p_admin_email). Cualquiera
--      podía escribir "soy carlos.linares.es@gmail.com" y:
--        · obtener_clave_empleado  -> ver la clave de CUALQUIER empleado
--        · resetear_clave_empleado -> cambiársela y entrar como él
--        · aprobar_justificacion   -> aprobar o rechazar justificaciones
--      y las tres las podía llamar cualquiera sin iniciar sesión.
--
-- Lo que se hace aquí, SIN romper la app ni el panel:
--
--   A. Un candado permanente: si algo escribe una clave en texto plano en
--      empleados.clave (el valor por defecto '123456' de un empleado nuevo,
--      por ejemplo), se convierte al instante en huella y la columna queda
--      vacía. Así un empleado nuevo sigue entrando con '123456', pero esa
--      clave ya no queda legible nunca más.
--   B. Se vacían las 462 claves en texto plano que había.
--   C. Las tres funciones ahora preguntan QUIÉN ES DE VERDAD con la sesión
--      (auth.jwt), no con el correo que manda el navegador, y dejan de
--      poder llamarse sin iniciar sesión.
--
-- Nota importante: las funciones se cambian DENTRO de la base (leyendo su
-- propia definición y reemplazando solo la comprobación). La llave con la
-- que "Ver clave" descifra NUNCA sale de la base ni pasa por este archivo.
-- Si el texto a reemplazar no aparece tal cual, el bloque se detiene y no
-- cambia nada (para no creer que se arregló algo que no se arregló).
-- Las funciones están guardadas con saltos de línea de Windows
-- (retorno de carro + salto): se quitan los retornos de carro (chr(13))
-- antes de buscar, si no el texto nunca coincide.
--
-- Se puede correr varias veces.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- A. Quién es administrador de verdad: el correo de la SESIÓN, no uno
--    que manda el navegador.
-- ---------------------------------------------------------------------
create or replace function public.es_admin_web()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.administradores_web a
     where lower(a.correo) = lower(coalesce(auth.jwt() ->> 'email', ''))
       and coalesce(a.activo, true)
  );
$$;
revoke all on function public.es_admin_web() from public, anon;
grant execute on function public.es_admin_web() to authenticated;

-- ---------------------------------------------------------------------
-- B. El candado de las claves: nada queda escrito en texto plano.
-- ---------------------------------------------------------------------
create or replace function public.fn_empleados_clave_segura()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.clave is not null and new.clave <> '' then
    new.clave_hash := crypt(new.clave, gen_salt('bf', 10));
    /* La copia cifrada que usa "Ver clave" se vuelve a llenar sola la
       próxima vez que la persona entre (lo hace verificar_clave). */
    new.clave_actual_cifrada := null;
    new.clave := null;
  end if;
  return new;
end $$;

drop trigger if exists tr_empleados_clave_segura on public.empleados;
create trigger tr_empleados_clave_segura
  before insert or update of clave on public.empleados
  for each row execute function public.fn_empleados_clave_segura();

-- Las que ya tienen huella: la copia en texto plano sobra.
update public.empleados set clave = null
 where clave is not null and clave_hash is not null;
-- Si quedara alguna SIN huella, se le crea (el candado de arriba lo hace).
update public.empleados set clave = clave
 where clave is not null and clave_hash is null;

-- ---------------------------------------------------------------------
-- C. Las tres funciones de administrador.
-- ---------------------------------------------------------------------
do $$
declare
  d_orig text;
  d      text;
begin
  -- C1. Ver clave: solo Carlos, comprobado con su SESIÓN.
  d_orig := replace(pg_get_functiondef('public.obtener_clave_empleado(text,text)'::regprocedure), chr(13), '');
  d := replace(d_orig,
    $x$IF p_admin_email IS NULL OR lower(p_admin_email) <> 'carlos.linares.es@gmail.com' THEN$x$,
    $x$IF lower(coalesce(auth.jwt() ->> 'email', '')) <> 'carlos.linares.es@gmail.com' THEN$x$);
  d := replace(d,
    $x$VALUES ('empleados', upper(trim(p_cedula)), 'VER_CLAVE', p_admin_email);$x$,
    $x$VALUES ('empleados', upper(trim(p_cedula)), 'VER_CLAVE', auth.jwt() ->> 'email');$x$);
  if d = d_orig then
    raise exception 'obtener_clave_empleado: no se encontró la comprobación a reemplazar. No se cambió nada.';
  end if;
  execute d;

  -- C2. Resetear clave: solo un administrador activo, con su SESIÓN.
  d_orig := replace(pg_get_functiondef('public.resetear_clave_empleado(text,text,text)'::regprocedure), chr(13), '');
  d := replace(d_orig,
    $x$BEGIN
    IF p_clave_nueva IS NULL$x$,
    $x$BEGIN
    IF NOT public.es_admin_web() THEN
        RAISE EXCEPTION 'Sin permisos';
    END IF;
    IF p_clave_nueva IS NULL$x$);
  d := replace(d,
    $x$VALUES ('empleados', p_cedula, 'RESET_CLAVE', p_admin_email);$x$,
    $x$VALUES ('empleados', p_cedula, 'RESET_CLAVE', auth.jwt() ->> 'email');$x$);
  if d = d_orig or position('es_admin_web' in d) = 0 then
    raise exception 'resetear_clave_empleado: no se encontró dónde poner el candado. No se cambió nada.';
  end if;
  execute d;

  -- C3. Aprobar justificaciones: solo un administrador activo.
  d_orig := replace(pg_get_functiondef('public.aprobar_justificacion(uuid,boolean,text,text)'::regprocedure), chr(13), '');
  d := replace(d_orig,
    $x$BEGIN
    UPDATE justificaciones$x$,
    $x$BEGIN
    IF NOT public.es_admin_web() THEN
        RAISE EXCEPTION 'Sin permisos';
    END IF;
    UPDATE justificaciones$x$);
  d := replace(d,
    $x$p_comentario, p_admin_email);$x$,
    $x$p_comentario, auth.jwt() ->> 'email');$x$);
  if d = d_orig or position('es_admin_web' in d) = 0 then
    raise exception 'aprobar_justificacion: no se encontró dónde poner el candado. No se cambió nada.';
  end if;
  execute d;
end $$;

-- Y ninguna de las tres se puede llamar sin haber iniciado sesión.
revoke execute on function public.obtener_clave_empleado(text, text) from public, anon;
revoke execute on function public.resetear_clave_empleado(text, text, text) from public, anon;
revoke execute on function public.aprobar_justificacion(uuid, boolean, text, text) from public, anon;
grant execute on function public.obtener_clave_empleado(text, text) to authenticated;
grant execute on function public.resetear_clave_empleado(text, text, text) to authenticated;
grant execute on function public.aprobar_justificacion(uuid, boolean, text, text) to authenticated;

commit;
