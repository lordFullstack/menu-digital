-- =====================================================================
-- MIGRACION 3 de 4: SEGURIDAD POR FILAS (RLS) Y PERMISOS
-- Especificacion: docs/equipo/CONTRATO-ADMIN.md, secciones "Roles" y "Politicas RLS".
--
-- En palabras simples: es el "portero" de cada tabla. Cada fila decide
-- quien la puede ver o cambiar:
--   anonimo (cliente del restaurante) -> solo lee menus publicados; nunca escribe.
--   dueno (fila en miembros)          -> lee y edita SOLO su(s) negocio(s); no cambia
--                                        el slug, no crea ni borra negocios, no toca miembros.
--   administrador (Jorge)             -> todo.
--
-- Dos capas de defensa:
--   1) GRANT/REVOKE: que roles pueden intentar cada operacion y en que columnas.
--   2) POLITICAS RLS: que filas puede tocar quien lo intenta.
-- "FORCE" hace que ni el dueno de la tabla se salte las politicas por descuido.
--
-- Se puede ejecutar mas de una vez.
-- ESTADO: escrita, NO aplicada, NO verificada contra la base.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Comprobacion previa.
--    Las funciones es_admin()/es_miembro()/asignar_dueno() leen miembros y
--    administradores como "dueno de la tabla". Con FORCE RLS eso solo funciona
--    si ese rol puede saltarse la RLS (BYPASSRLS) o es superusuario. En Supabase
--    el rol postgres lo tiene. Si no, abortamos AHORA en vez de dejar un panel
--    donde nadie es administrador.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_roles r
    where r.rolname = current_user and (r.rolbypassrls or r.rolsuper)
  ) then
    raise exception 'El rol % no puede saltarse RLS (BYPASSRLS). Con FORCE RLS las funciones es_admin/es_miembro devolverian siempre false. Revisar con el Coordinador antes de continuar.', current_user;
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 1. Activar y forzar RLS en las 5 tablas
-- ---------------------------------------------------------------------
alter table public.negocios       enable row level security;
alter table public.negocios       force  row level security;
alter table public.categorias     enable row level security;
alter table public.categorias     force  row level security;
alter table public.platos         enable row level security;
alter table public.platos         force  row level security;
alter table public.miembros       enable row level security;
alter table public.miembros       force  row level security;
alter table public.administradores enable row level security;
alter table public.administradores force  row level security;


-- ---------------------------------------------------------------------
-- 2. Permisos de tabla: quitar todo y conceder lo minimo
--    (Supabase concede por defecto ALL a anon/authenticated en tablas nuevas.)
-- ---------------------------------------------------------------------
revoke all on table public.negocios, public.categorias, public.platos,
                    public.miembros, public.administradores
  from public, anon, authenticated;

-- Lectura: el anonimo solo en las tres tablas del menu (las politicas lo limitan a lo publicado).
grant select on table public.negocios, public.categorias, public.platos to anon;
grant select on table public.negocios, public.categorias, public.platos,
                      public.miembros, public.administradores
  to authenticated;

-- Borrado: solo en las tablas del menu (las politicas lo limitan: negocios solo admin).
-- miembros y administradores: sin insert/update/delete directo para nadie.
grant delete on table public.negocios, public.categorias, public.platos to authenticated;

-- Alta y edicion por COLUMNAS. Nadie puede editar id, creado ni actualizado.
-- negocios: se concede editar slug a nivel de columna porque tambien es "authenticated"
-- el administrador; el trigger de abajo impide que un dueno (no admin) lo cambie.
grant insert (id, slug, nombre, eslogan, logo_ruta, portada_ruta, moneda, whatsapp, direccion,
              mapa_url, instagram, facebook, tiktok, horario,
              color_fondo, color_superficie, color_acento, tipografia, publicado)
  on public.negocios to authenticated;
grant update (slug, nombre, eslogan, logo_ruta, portada_ruta, moneda, whatsapp, direccion,
              mapa_url, instagram, facebook, tiktok, horario,
              color_fondo, color_superficie, color_acento, tipografia, publicado)
  on public.negocios to authenticated;

-- categorias: negocio_id NO se puede cambiar despues de crear la categoria.
grant insert (id, negocio_id, nombre, orden) on public.categorias to authenticated;
grant update (nombre, orden)                 on public.categorias to authenticated;

-- platos: negocio_id NO se puede cambiar; si se cambia categoria_id, la llave
-- foranea compuesta exige que la nueva categoria sea del mismo negocio.
grant insert (id, negocio_id, categoria_id, nombre, descripcion, precio, foto_ruta,
              etiquetas, ingredientes, alergenos, recomendado, agotado, orden)
  on public.platos to authenticated;
grant update (categoria_id, nombre, descripcion, precio, foto_ruta,
              etiquetas, ingredientes, alergenos, recomendado, agotado, orden)
  on public.platos to authenticated;


-- ---------------------------------------------------------------------
-- 3. Trigger: solo el administrador cambia el slug (y el id nunca cambia)
-- ---------------------------------------------------------------------
create or replace function public.proteger_negocio()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'El identificador de un negocio no se puede cambiar.' using errcode = '42501';
  end if;

  -- current_user es el rol de quien hace la operacion (anon / authenticated).
  -- Las operaciones hechas con el rol postgres/service_role (mantenimiento a mano) no se bloquean.
  -- Falla CERRADO: se bloquea el cambio de slug salvo roles de mantenimiento
  -- (postgres, service_role, supabase_admin) o un administrador.
  if new.slug is distinct from old.slug
     and not (current_user in ('postgres', 'service_role', 'supabase_admin')
              or (select public.es_admin())) then
    raise exception 'Solo un administrador puede cambiar el slug de un negocio.' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.proteger_negocio() from public, anon, authenticated;

drop trigger if exists negocios_proteger on public.negocios;
create trigger negocios_proteger
  before update on public.negocios
  for each row execute function public.proteger_negocio();


-- ---------------------------------------------------------------------
-- 4. POLITICAS
--    Regla: una politica por operacion y por rol, siempre con "to anon" o
--    "to authenticated" explicito. Nunca "using (true)" para escribir.
--    (select ...) alrededor de las funciones: Postgres lo calcula una vez por
--    consulta en vez de una vez por fila (mas rapido).
--    Las politicas de anon NO llaman a es_admin()/es_miembro(): anon no tiene
--    permiso de ejecutarlas y daria error.
-- ---------------------------------------------------------------------

-- ===== negocios =====
drop policy if exists negocios_select_anon on public.negocios;
create policy negocios_select_anon on public.negocios
  for select to anon
  using (publicado);

drop policy if exists negocios_select_auth on public.negocios;
create policy negocios_select_auth on public.negocios
  for select to authenticated
  using (publicado or (select public.es_admin()) or public.es_miembro(id));

drop policy if exists negocios_insert_admin on public.negocios;
create policy negocios_insert_admin on public.negocios
  for insert to authenticated
  with check ((select public.es_admin()));

drop policy if exists negocios_update_auth on public.negocios;
create policy negocios_update_auth on public.negocios
  for update to authenticated
  using      ((select public.es_admin()) or public.es_miembro(id))
  with check ((select public.es_admin()) or public.es_miembro(id));

drop policy if exists negocios_delete_admin on public.negocios;
create policy negocios_delete_admin on public.negocios
  for delete to authenticated
  using ((select public.es_admin()));

-- ===== categorias =====
drop policy if exists categorias_select_anon on public.categorias;
create policy categorias_select_anon on public.categorias
  for select to anon
  using (exists (select 1 from public.negocios n where n.id = categorias.negocio_id and n.publicado));

drop policy if exists categorias_select_auth on public.categorias;
create policy categorias_select_auth on public.categorias
  for select to authenticated
  using (
    (select public.es_admin())
    or public.es_miembro(negocio_id)
    or exists (select 1 from public.negocios n where n.id = categorias.negocio_id and n.publicado)
  );

drop policy if exists categorias_insert_auth on public.categorias;
create policy categorias_insert_auth on public.categorias
  for insert to authenticated
  with check ((select public.es_admin()) or public.es_miembro(negocio_id));

drop policy if exists categorias_update_auth on public.categorias;
create policy categorias_update_auth on public.categorias
  for update to authenticated
  using      ((select public.es_admin()) or public.es_miembro(negocio_id))
  with check ((select public.es_admin()) or public.es_miembro(negocio_id));

drop policy if exists categorias_delete_auth on public.categorias;
create policy categorias_delete_auth on public.categorias
  for delete to authenticated
  using ((select public.es_admin()) or public.es_miembro(negocio_id));

-- ===== platos =====
drop policy if exists platos_select_anon on public.platos;
create policy platos_select_anon on public.platos
  for select to anon
  using (exists (select 1 from public.negocios n where n.id = platos.negocio_id and n.publicado));

drop policy if exists platos_select_auth on public.platos;
create policy platos_select_auth on public.platos
  for select to authenticated
  using (
    (select public.es_admin())
    or public.es_miembro(negocio_id)
    or exists (select 1 from public.negocios n where n.id = platos.negocio_id and n.publicado)
  );

drop policy if exists platos_insert_auth on public.platos;
create policy platos_insert_auth on public.platos
  for insert to authenticated
  with check ((select public.es_admin()) or public.es_miembro(negocio_id));

drop policy if exists platos_update_auth on public.platos;
create policy platos_update_auth on public.platos
  for update to authenticated
  using      ((select public.es_admin()) or public.es_miembro(negocio_id))
  with check ((select public.es_admin()) or public.es_miembro(negocio_id));

drop policy if exists platos_delete_auth on public.platos;
create policy platos_delete_auth on public.platos
  for delete to authenticated
  using ((select public.es_admin()) or public.es_miembro(negocio_id));

-- ===== miembros =====
-- Solo lectura: cada usuario ve sus propias filas; el admin ve todas.
-- NO hay politicas de insert/update/delete: solo asignar_dueno()/quitar_dueno().
drop policy if exists miembros_select_auth on public.miembros;
create policy miembros_select_auth on public.miembros
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.es_admin()));

-- ===== administradores =====
-- Solo lectura de la fila propia. Nadie escribe desde la API (Jorge inserta por SQL).
drop policy if exists administradores_select_auth on public.administradores;
create policy administradores_select_auth on public.administradores
  for select to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- 5. AUTOCOMPROBACION: si algo quedo mal abierto, la migracion falla (y se deshace).
-- ---------------------------------------------------------------------
do $$
declare
  v_funciones text;
  v_tablas    text;
begin
  -- anon solo puede ejecutar menu_publico entre las funciones de public
  select string_agg(p.oid::regprocedure::text, ', ')
    into v_funciones
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname <> 'menu_publico'
    and has_function_privilege('anon', p.oid, 'execute');
  if v_funciones is not null then
    raise exception 'anon puede ejecutar funciones de public que no debe: %', v_funciones;
  end if;

  -- toda tabla de public con RLS activada y forzada
  select string_agg(c.relname, ', ')
    into v_tablas
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind in ('r', 'p')
    and not (c.relrowsecurity and c.relforcerowsecurity);
  if v_tablas is not null then
    raise exception 'Tablas de public sin RLS activada y forzada: %', v_tablas;
  end if;
end;
$$;
