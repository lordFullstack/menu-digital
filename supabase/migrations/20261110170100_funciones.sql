-- =====================================================================
-- MIGRACION 2 de 4: FUNCIONES
-- Especificacion: docs/equipo/CONTRATO-ADMIN.md, seccion "Funciones".
--
-- En palabras simples: son "atajos" que viven dentro de la base:
--   es_admin()        -> "¿quien me esta preguntando es administrador?"
--   es_miembro(id)    -> "¿quien me esta preguntando es dueno de este negocio?"
--   menu_publico(slug)-> entrega el menu completo de un negocio publicado
--   mis_negocios()    -> lista los negocios que el usuario puede editar
--   asignar_dueno / quitar_dueno -> solo el administrador las puede usar
--
-- Seguridad:
--   - Las funciones "security definer" se ejecutan con permisos del dueno de la
--     funcion (para poder leer miembros/administradores aunque el usuario no
--     pueda). Por eso fijan search_path vacio y nombran cada objeto con su
--     esquema (public., auth.) para que nadie las pueda enganar.
--   - Ninguna recibe "de quien" preguntar: siempre usan al usuario que hace la llamada.
--   - El usuario anonimo NO puede ejecutarlas (salvo menu_publico).
--
-- Se puede ejecutar mas de una vez (create or replace).
-- ESTADO: escrita, NO aplicada, NO verificada contra la base.
-- =====================================================================


-- ---------------------------------------------------------------------
-- es_admin(): true si el usuario que llama esta en la tabla administradores.
-- ---------------------------------------------------------------------
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.administradores a
    where a.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------
-- es_miembro(negocio): true si el usuario que llama es dueno de ese negocio.
-- ---------------------------------------------------------------------
create or replace function public.es_miembro(negocio uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.miembros m
    where m.negocio_id = $1
      and m.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------
-- menu_publico(slug): devuelve { "menu": {...}, "tema": {...} } con la forma
-- de src/datos/tipos.ts, o NULL si el negocio no existe o no esta publicado.
-- Se ejecuta con los permisos de quien llama ("invoker"), asi que ademas del
-- filtro explicito "publicado" actuan las politicas de seguridad (RLS).
-- Las fotos salen como RUTA de storage; el navegador arma la URL completa.
-- Solo se publican los campos que el menu necesita (no sale id, slug, fechas...).
-- ---------------------------------------------------------------------
create or replace function public.menu_publico(p_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'menu', jsonb_build_object(
      'version', 1,
      'negocio', jsonb_strip_nulls(jsonb_build_object(
        'nombre',    n.nombre,
        'eslogan',   n.eslogan,
        'logo',      n.logo_ruta,
        'portada',   n.portada_ruta,
        'moneda',    n.moneda,
        'whatsapp',  n.whatsapp,
        'direccion', n.direccion,
        'mapaUrl',   n.mapa_url,
        'redes',     nullif(
                       jsonb_strip_nulls(jsonb_build_object(
                         'instagram', n.instagram,
                         'facebook',  n.facebook,
                         'tiktok',    n.tiktok
                       )),
                       '{}'::jsonb
                     ),
        'horario',   coalesce((
                       select jsonb_agg(
                                jsonb_build_object('dias', f.fr -> 'dias', 'abre', f.fr ->> 'abre', 'cierra', f.fr ->> 'cierra')
                                order by f.pos
                              )
                       from jsonb_array_elements(n.horario) with ordinality as f(fr, pos)
                     ), '[]'::jsonb)
      )),
      'categorias', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'id',     c.id,
                   'nombre', c.nombre,
                   'platos', coalesce((
                     select jsonb_agg(
                              jsonb_strip_nulls(jsonb_build_object(
                                'id',           p.id,
                                'nombre',       p.nombre,
                                'descripcion',  p.descripcion,
                                'precio',       p.precio,
                                'foto',         p.foto_ruta,
                                'etiquetas',    case when cardinality(p.etiquetas)    > 0 then to_jsonb(p.etiquetas)    end,
                                'ingredientes', case when cardinality(p.ingredientes) > 0 then to_jsonb(p.ingredientes) end,
                                'alergenos',    case when cardinality(p.alergenos)    > 0 then to_jsonb(p.alergenos)    end,
                                'recomendado',  case when p.recomendado then true end,
                                'agotado',      case when p.agotado then true end
                              ))
                              order by p.orden, p.nombre, p.id
                            )
                     from public.platos p
                     where p.categoria_id = c.id
                   ), '[]'::jsonb)
                 )
                 order by c.orden, c.nombre, c.id
               )
        from public.categorias c
        where c.negocio_id = n.id
      ), '[]'::jsonb)
    ),
    'tema', jsonb_build_object(
      'version', 1,
      'colores', jsonb_build_object(
        'fondo',      n.color_fondo,
        'superficie', n.color_superficie,
        'acento',     n.color_acento
      ),
      'tipografia', n.tipografia
    )
  )
  from public.negocios n
  where n.slug = p_slug
    and n.publicado;
$$;

-- ---------------------------------------------------------------------
-- mis_negocios(): los negocios que el usuario puede editar (los suyos, o todos si es admin).
-- Se ejecuta con permisos de quien llama: la seguridad por filas sigue aplicando.
-- ---------------------------------------------------------------------
create or replace function public.mis_negocios()
returns setof public.negocios
language sql
stable
security invoker
set search_path = ''
as $$
  select n.*
  from public.negocios n
  where (select public.es_admin())
     or public.es_miembro(n.id)
  order by n.nombre;
$$;

-- ---------------------------------------------------------------------
-- asignar_dueno(negocio, correo): el administrador da acceso a un usuario
-- (que Jorge ya creo en el panel de Supabase) sobre un negocio.
-- - Si quien llama no es admin: falla con "No autorizado".
-- - Si el correo no existe O el negocio no existe: MISMO mensaje generico,
--   para que nadie pueda averiguar que correos estan registrados.
-- - Si ya era dueno: no pasa nada (idempotente).
-- - No devuelve ningun dato de auth.users.
-- ---------------------------------------------------------------------
create or replace function public.asignar_dueno(p_negocio uuid, p_correo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_usuario uuid;
begin
  if not public.es_admin() then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  -- Solo cuentas con correo confirmado y no borradas. Si hay 0 o mas de 1
  -- coincidencia, se rechaza con el mismo mensaje generico (no se elige "una cualquiera").
  select array_agg(u.id)
    into v_ids
  from auth.users u
  where lower(u.email) = lower(btrim(coalesce(p_correo, '')))
    and u.email_confirmed_at is not null
    and u.deleted_at is null;

  if v_ids is not null and cardinality(v_ids) = 1 then
    v_usuario := v_ids[1];
  end if;

  if v_usuario is null
     or not exists (select 1 from public.negocios n where n.id = p_negocio) then
    raise exception 'No se pudo completar la asignación. Revise los datos.' using errcode = '22023';
  end if;

  insert into public.miembros (negocio_id, user_id)
  values (p_negocio, v_usuario)
  on conflict (negocio_id, user_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- quitar_dueno(negocio, usuario): el administrador retira un dueno.
-- No avisa si la relacion no existia (no filtra informacion).
-- ---------------------------------------------------------------------
create or replace function public.quitar_dueno(p_negocio uuid, p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  delete from public.miembros m
  where m.negocio_id = p_negocio
    and m.user_id = p_usuario;
end;
$$;


-- ---------------------------------------------------------------------
-- PERMISOS DE EJECUCION
-- Supabase da por defecto EXECUTE a anon y authenticated en funciones nuevas,
-- por eso se revoca explicitamente de public, anon y authenticated y luego se
-- concede solo lo justo.
-- ---------------------------------------------------------------------
revoke all on function public.es_admin()                    from public, anon, authenticated;
revoke all on function public.es_miembro(uuid)              from public, anon, authenticated;
revoke all on function public.menu_publico(text)            from public, anon, authenticated;
revoke all on function public.mis_negocios()                from public, anon, authenticated;
revoke all on function public.asignar_dueno(uuid, text)    from public, anon, authenticated;
revoke all on function public.quitar_dueno(uuid, uuid)     from public, anon, authenticated;

grant execute on function public.es_admin()                 to authenticated;
grant execute on function public.es_miembro(uuid)           to authenticated;
grant execute on function public.menu_publico(text)         to anon, authenticated;
grant execute on function public.mis_negocios()             to authenticated;
grant execute on function public.asignar_dueno(uuid, text) to authenticated;
grant execute on function public.quitar_dueno(uuid, uuid)  to authenticated;
