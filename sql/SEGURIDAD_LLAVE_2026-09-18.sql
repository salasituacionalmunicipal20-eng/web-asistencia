-- =====================================================================
-- CIERRE URGENTE 2: LA LLAVE DE "VER CLAVE" ESTABA PUBLICADA
-- 18/09/2026
--
-- Lo que se encontró (verificado contra la base en producción):
--
--   Para que "Ver clave" funcione, cada vez que un empleado entra se guarda
--   una copia CIFRADA de su clave (empleados.clave_actual_cifrada). Pero:
--     · la llave con la que se cifraba estaba escrita dentro de seis
--       funciones Y en los archivos SQL de este repositorio, que es PÚBLICO
--       en GitHub;
--     · las 477 copias cifradas se podían leer con la clave pública de la
--       página (la tabla empleados está abierta por diseño).
--   Juntando las dos cosas, cualquiera podía descifrar 477 claves.
--
-- Lo que se hace aquí, SIN cambiar cómo funciona la app ni el panel:
--
--   1. Una llave NUEVA que inventa la propia base al azar y guarda en un
--      lugar que nadie de afuera puede leer (esquema "privado"). Nadie la
--      ve: ni quien corre este archivo ni el repositorio.
--   2. Las 477 copias se vuelven a cifrar con la llave nueva. La vieja,
--      la que está publicada, deja de abrir nada.
--   3. Las seis funciones dejan de tener la llave escrita: la piden a
--      privado.llave_claves() cuando la necesitan.
--
-- La llave vieja NO se escribe en este archivo: se saca de la propia
-- función que ya está en la base. Si las funciones ya no la tienen
-- escrita, el bloque avisa y no hace nada, así que se puede correr varias
-- veces. Si aparece de una forma que no se espera, se detiene y no cambia
-- nada.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. El lugar privado y la llave nueva.
-- ---------------------------------------------------------------------
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

create table if not exists privado.llaves (
  nombre    text primary key,
  valor     text not null,
  creada_en timestamptz not null default now()
);
revoke all on table privado.llaves from public, anon, authenticated;

-- La inventa la base: 32 bytes al azar. Si ya existe, se deja la que hay.
insert into privado.llaves (nombre, valor)
values ('claves_empleados', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (nombre) do nothing;

create or replace function privado.llave_claves()
returns text
language sql stable security definer set search_path = '' as $$
  select valor from privado.llaves where nombre = 'claves_empleados';
$$;
revoke all on function privado.llave_claves() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2 y 3. Volver a cifrar y quitar la llave escrita de las funciones.
-- ---------------------------------------------------------------------
do $$
declare
  v_vieja text;
  f       record;
  d_orig  text;
  d       text;
  n       int := 0;
begin
  v_vieja := substring(pg_get_functiondef('public.obtener_clave_empleado(text,text)'::regprocedure)
                       from $r$pgp_sym_decrypt\(clave_actual_cifrada, '([^']+)'\)$r$);
  if v_vieja is null then
    raise notice 'Las funciones ya no tienen la llave escrita: no hay nada que cambiar.';
    return;
  end if;

  update public.empleados
     set clave_actual_cifrada = extensions.pgp_sym_encrypt(
           extensions.pgp_sym_decrypt(clave_actual_cifrada, v_vieja),
           privado.llave_claves())
   where clave_actual_cifrada is not null;

  for f in
    select p.oid
      from pg_proc p
      join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public'
       and position(v_vieja in p.prosrc) > 0
  loop
    /* Las funciones están guardadas con saltos de línea de Windows: se
       quitan los retornos de carro (chr(13)) para que el texto coincida. */
    d_orig := replace(pg_get_functiondef(f.oid), chr(13), '');
    d := replace(d_orig, quote_literal(v_vieja), 'privado.llave_claves()');
    if d = d_orig or position(v_vieja in d) > 0 then
      raise exception '%: la llave aparece de una forma inesperada. No se cambió nada.', f.oid::regprocedure;
    end if;
    execute d;
    n := n + 1;
  end loop;

  raise notice 'Funciones que dejaron de tener la llave escrita: %', n;
end $$;

commit;
