-- =====================================================================
-- PRUEBAS DE PERMISOS del panel de administracion  (UN SOLO BLOQUE DO)
-- Ejecutar DESPUES de aplicar las 4 migraciones, como el rol postgres.
--
-- Que hace, en palabras simples:
--   1. Crea datos de PRUEBA: usuarios (dueno A, dueno B, administrador, uno sin
--      negocio y uno sin confirmar), 2 negocios (A publicado, B sin publicar),
--      con categorias, platos y fotos.
--   2. Simula a cada persona (anonimo, dueno A, dueno B, sin negocio,
--      administrador) y comprueba lo que PUEDE y lo que NO PUEDE hacer.
--      Cuando algo debe ser RECHAZADO, se comprueba el MOTIVO correcto (permiso
--      denegado / seguridad por filas / el texto propio de la regla). Un error
--      distinto (tabla inexistente, error de sintaxis...) cuenta como FALLO.
--   3. Al final SIEMPRE lanza una excepcion con el resumen:
--         PRUEBAS total=N ok=N fallan=N omitidas=N
--      seguido de las pruebas que fallan (codigo, nombre, detalle).
--      La excepcion DESHACE TODO: no queda ningun dato de prueba.
--      Ver "ERROR" en el cliente es lo esperado; lo importante es fallan=0.
--
-- Correos @ejemplo.invalid (no existen). No se usan secretos.
-- Slugs 'prueba-a' / 'prueba-b' (la base exige 3 a 40 letras).
-- ESTADO: escrito, NO ejecutado. Puede necesitar ajustes en la primera corrida.
-- =====================================================================

do $do$
declare
  -- usuarios de prueba (ids fijos)
  u_a    constant uuid := 'aaaaaaaa-0000-4000-8000-0000000000a1';
  u_b    constant uuid := 'bbbbbbbb-0000-4000-8000-0000000000b1';
  u_adm  constant uuid := 'cccccccc-0000-4000-8000-0000000000c1';
  u_sin  constant uuid := 'dddddddd-0000-4000-8000-0000000000d1';   -- autenticado sin negocio
  u_nc   constant uuid := 'eeeeeeee-0000-4000-8000-0000000000e1';   -- correo sin confirmar
  -- negocios, categorias y platos
  n_a    constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  n_b    constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  c_a    constant uuid := 'aaaaaaaa-0c0c-4a0c-8a0c-0000000000c1';
  c_b    constant uuid := 'bbbbbbbb-0c0c-4b0c-8b0c-0000000000c2';
  p_a    constant uuid := 'aaaaaaaa-0d0d-4a0d-8a0d-0000000000d1';
  p_b    constant uuid := 'bbbbbbbb-0d0d-4b0d-8b0d-0000000000d2';
  c_nueva   constant uuid := 'aaaaaaaa-0c0c-4a0c-8a0c-0000000000c9';
  p_nuevo   constant uuid := 'aaaaaaaa-0d0d-4a0d-8a0d-0000000000d9';
  p_b_nuevo constant uuid := 'bbbbbbbb-0d0d-4b0d-8b0d-0000000000d8';
  n_falso   constant uuid := 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  -- rutas de foto validas: <uuid>/<uuid>.webp
  foto_a  constant text := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/11111111-1111-4111-8111-111111111111.webp';
  foto_p  constant text := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/22222222-2222-4222-8222-222222222222.webp';
  -- nombres de archivo para storage
  f1 constant text := '33333333-3333-4333-8333-333333333331.webp';
  f2 constant text := '33333333-3333-4333-8333-333333333332.webp';
  f3 constant text := '33333333-3333-4333-8333-333333333333.webp';
  fb1 constant text := '44444444-4444-4444-8444-444444444441.webp';
  fb2 constant text := '44444444-4444-4444-8444-444444444442.webp';
  fb3 constant text := '44444444-4444-4444-8444-444444444443.webp';
  v_c1 uuid; v_c2 uuid; v_c3 uuid; v_plato_mover uuid;
  v_fatal text;
  v_total int; v_ok int; v_fallan int; v_omit int;
  v_msg text;
  r record;
begin
  -- Tabla temporal de resultados y funcion de ayuda (se esfuman con la excepcion final).
  create temp table resultados (prueba text, estado text, detalle text);

  -- pg_temp.t(nombre, rol, usuario, sql, esperado): ejecuta "sql" como ese rol/usuario
  -- (rol NULL = sin cambiar de rol) y anota OK / FALLA / OMITIDA.
  --   'n:K'      sin error y exactamente K filas
  --   'min:K'    sin error y al menos K filas
  --   'valor:V'  la consulta devuelve un valor de texto igual a V ('NULL' = nulo)
  --   'deny'     rechazado POR PERMISOS: sqlstate 42501, 'row-level security' o 'permission denied'
  --   'deny0'    como deny, o sin error pero 0 filas afectadas (la RLS filtra en silencio)
  --   'err:xx'   falla y el mensaje contiene xx (regla propia: constraint, texto de la funcion)
  execute $f$
  create function pg_temp.t(p_prueba text, p_rol text, p_uid uuid, p_sql text, p_espera text)
  returns void
  language plpgsql
  as $b$
  declare
    v_filas bigint := null;
    v_error text := null;
    v_state text := null;
    v_valor text := null;
    v_ok    boolean;
    v_estado text;
    v_modo  text := split_part(p_espera, ':', 1);
    v_arg   text := substr(p_espera, length(split_part(p_espera, ':', 1)) + 2);
    v_motivo boolean;
  begin
    if p_rol is not null then
      perform set_config(
        'request.jwt.claims',
        case when p_uid is null
             then json_build_object('role', p_rol)::text
             else json_build_object('sub', p_uid, 'role', p_rol)::text end,
        true);
      execute format('set local role %I', p_rol);
    end if;

    begin
      if v_modo = 'valor' then
        execute p_sql into v_valor;
      else
        execute p_sql;
        get diagnostics v_filas = row_count;
      end if;
    exception when others then
      v_error := sqlerrm;
      v_state := sqlstate;
    end;

    if p_rol is not null then
      reset role;
    end if;

    v_motivo := v_error is not null
                and (v_state = '42501' or v_error ilike '%row-level security%' or v_error ilike '%permission denied%');

    v_ok := case v_modo
      when 'n'     then v_error is null and v_filas = v_arg::bigint
      when 'min'   then v_error is null and v_filas >= v_arg::bigint
      when 'valor' then v_error is null and coalesce(v_valor, 'NULL') = v_arg
      when 'deny'  then v_motivo
      when 'deny0' then v_motivo or (v_error is null and v_filas = 0)
      when 'err'   then v_error is not null and v_error ilike '%' || v_arg || '%'
      else false
    end;

    -- El borrado directo en storage puede estar bloqueado por Supabase: se marca OMITIDA, no OK.
    v_estado := case
      when v_error ilike '%allow_delete_query%' then 'OMITIDA'
      when coalesce(v_ok, false) then 'OK'
      else 'FALLA' end;

    insert into resultados
    values (p_prueba, v_estado,
            'esperado=' || p_espera || ' | ' ||
            coalesce('sqlstate=' || v_state || ' error=' || v_error,
                     'filas=' || coalesce(v_filas::text, '-') || ' valor=' || coalesce(v_valor, '-')));
  end;
  $b$;
  $f$;

  -- ===================================================================
  -- Todo lo que sigue va en un sub-bloque: si el guion mismo se rompe,
  -- se informa como fallo en el resumen en vez de perder el reporte.
  -- ===================================================================
  begin
    -- Permite el DELETE directo sobre storage.objects durante esta transaccion (solo pruebas).
    perform set_config('storage.allow_delete_query', 'true', true);

    -- ===== PREPARACION (como postgres) =====
    insert into auth.users (id, aud, role, email, email_confirmed_at) values
      (u_a,   'authenticated', 'authenticated', 'dueno-a@ejemplo.invalid',  now()),
      (u_b,   'authenticated', 'authenticated', 'dueno-b@ejemplo.invalid',  now()),
      (u_adm, 'authenticated', 'authenticated', 'admin@ejemplo.invalid',    now()),
      (u_sin, 'authenticated', 'authenticated', 'sin-rol@ejemplo.invalid',  now());
    insert into auth.users (id, aud, role, email, email_confirmed_at) values
      (u_nc,  'authenticated', 'authenticated', 'sin-confirmar@ejemplo.invalid', null);

    insert into public.administradores (user_id) values (u_adm);

    insert into public.negocios (id, slug, nombre, eslogan, logo_ruta, whatsapp, direccion, mapa_url, instagram,
                                 horario, color_fondo, color_superficie, color_acento, tipografia, publicado)
    values
      (n_a, 'prueba-a', 'Negocio A', 'Eslogan A', foto_a, '573001234567', 'Calle 1 # 2-3',
       'https://www.google.com/maps?q=1', 'https://instagram.com/negocioa',
       '[{"dias":[1,2,3],"abre":"08:00","cierra":"18:00"}]'::jsonb,
       '#F5EFE6', '#FFFFFF', '#C2410C', 'clasica', true),
      (n_b, 'prueba-b', 'Negocio B', 'Eslogan B', null, null, null, null, null,
       '[]'::jsonb, '#101010', '#202020', '#30B0F0', 'moderna', false);

    insert into public.categorias (id, negocio_id, nombre, orden) values
      (c_a, n_a, 'Categoria A', 1),
      (c_b, n_b, 'Categoria B', 1);

    insert into public.platos (id, negocio_id, categoria_id, nombre, descripcion, precio, foto_ruta,
                               etiquetas, ingredientes, alergenos, recomendado, orden) values
      (p_a, n_a, c_a, 'Plato A', 'Descripcion A', 12000, foto_p, array['vegano'], array['Pan','Queso'], array['Gluten'], true, 1),
      (p_b, n_b, c_b, 'Plato B', null, 9000, null, '{}', '{}', '{}', false, 1);

    insert into public.miembros (negocio_id, user_id) values (n_a, u_a), (n_b, u_b);

    -- un objeto de storage en la carpeta de B (para probar que A no lo ve ni lo toca)
    insert into storage.objects (bucket_id, name) values ('fotos', n_b::text || '/' || fb1);

    -- ===== 0. ESTRUCTURA Y PRIVILEGIOS (como postgres) =====
    perform pg_temp.t('001 RLS activada y forzada en las 5 tablas', null, null,
      $q$select count(*)::text from pg_class
         where oid in ('public.negocios'::regclass, 'public.categorias'::regclass, 'public.platos'::regclass,
                       'public.miembros'::regclass, 'public.administradores'::regclass)
           and relrowsecurity and relforcerowsecurity$q$, 'valor:5');

    perform pg_temp.t('002 anon sin privilegios de escritura en ninguna tabla', null, null,
      $q$select count(*)::text
         from (values ('negocios'),('categorias'),('platos'),('miembros'),('administradores')) t(n)
         cross join (values ('insert'),('update'),('delete'),('truncate'),('references'),('trigger')) p(x)
         where has_table_privilege('anon', 'public.' || t.n, p.x)$q$, 'valor:0');

    perform pg_temp.t('003 authenticated sin truncate/references/trigger en ninguna tabla', null, null,
      $q$select count(*)::text
         from (values ('negocios'),('categorias'),('platos'),('miembros'),('administradores')) t(n)
         cross join (values ('truncate'),('references'),('trigger')) p(x)
         where has_table_privilege('authenticated', 'public.' || t.n, p.x)$q$, 'valor:0');

    perform pg_temp.t('004 authenticated sin insert/update/delete en miembros ni administradores (tabla ni columnas)', null, null,
      $q$select count(*)::text
         from (values ('miembros'),('administradores')) t(n)
         cross join (values ('insert'),('update'),('delete')) p(x)
         where (p.x <> 'delete' and has_any_column_privilege('authenticated', 'public.' || t.n, p.x))
            or has_table_privilege('authenticated', 'public.' || t.n, p.x)$q$, 'valor:0');

    perform pg_temp.t('005 anon no ejecuta es_admin, es_miembro, asignar_dueno, quitar_dueno, mis_negocios', null, null,
      $q$select count(*)::text from unnest(array[
           'public.es_admin()', 'public.es_miembro(uuid)', 'public.asignar_dueno(uuid,text)',
           'public.quitar_dueno(uuid,uuid)', 'public.mis_negocios()']) f
         where has_function_privilege('anon', f, 'execute')$q$, 'valor:0');

    perform pg_temp.t('006 anon y authenticated si ejecutan menu_publico', null, null,
      $q$select (has_function_privilege('anon', 'public.menu_publico(text)', 'execute')
             and has_function_privilege('authenticated', 'public.menu_publico(text)', 'execute'))::text$q$, 'valor:true');

    perform pg_temp.t('007 funciones security definer con search_path vacio (4 de 4)', null, null,
      $q$select count(*)::text from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.proname in ('es_admin','es_miembro','asignar_dueno','quitar_dueno')
           and p.prosecdef
           and exists (select 1 from unnest(p.proconfig) c where replace(c, '"', '') = 'search_path=')$q$, 'valor:4');

    perform pg_temp.t('008 ninguna politica de escritura con true literal', null, null,
      $q$select count(*)::text from pg_policies
         where schemaname in ('public', 'storage')
           and cmd in ('INSERT','UPDATE','DELETE','ALL')
           and (qual = 'true' or with_check = 'true')$q$, 'valor:0');

    perform pg_temp.t('009 toda politica de update tiene with check', null, null,
      $q$select count(*)::text from pg_policies
         where schemaname in ('public', 'storage') and cmd = 'UPDATE' and with_check is null$q$, 'valor:0');

    perform pg_temp.t('010 bucket fotos: publico, 2 MB, solo jpeg/png/webp', null, null,
      $q$select (public and file_size_limit = 2097152 and cardinality(allowed_mime_types) = 3
                 and allowed_mime_types @> array['image/jpeg','image/png','image/webp'])::text
         from storage.buckets where id = 'fotos'$q$, 'valor:true');

    perform pg_temp.t('011 TODAS las tablas de public tienen RLS activada y forzada', null, null,
      $q$select count(*)::text from pg_class c
         where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p')
           and not (c.relrowsecurity and c.relforcerowsecurity)$q$, 'valor:0');

    perform pg_temp.t('012 anon solo puede ejecutar menu_publico entre las funciones de public', null, null,
      $q$select coalesce(string_agg(p.proname, ',' order by p.proname), 'NINGUNA') from pg_proc p
         where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')$q$, 'valor:menu_publico');

    perform pg_temp.t('013 authenticated sin privilegio sobre id/negocio_id/creado/actualizado (update) ni creado/actualizado (insert)', null, null,
      $q$select count(*)::text from (values
           ('public.negocios','id','update'), ('public.negocios','creado','update'), ('public.negocios','actualizado','update'),
           ('public.negocios','creado','insert'), ('public.negocios','actualizado','insert'),
           ('public.categorias','id','update'), ('public.categorias','negocio_id','update'),
           ('public.platos','id','update'), ('public.platos','negocio_id','update')
         ) t(tabla, col, op)
         where has_column_privilege('authenticated', t.tabla, t.col, t.op)$q$, 'valor:0');

    perform pg_temp.t('014 authenticated y anon sin CREATE en el esquema public', null, null,
      $q$select (has_schema_privilege('authenticated', 'public', 'CREATE')
              or has_schema_privilege('anon', 'public', 'CREATE'))::text$q$, 'valor:false');

    perform pg_temp.t('015 funciones de trigger no ejecutables por anon ni authenticated', null, null,
      $q$select count(*)::text from pg_proc p
         where p.pronamespace = 'public'::regnamespace
           and p.proname in ('tocar_actualizado','limitar_categorias','limitar_platos','limitar_platos_mover','proteger_negocio')
           and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))$q$, 'valor:0');

    -- ===== 1. ANONIMO =====
    perform pg_temp.t('100 anon ve el negocio publicado A', 'anon', null,
      format('select 1 from public.negocios where id = %L', n_a), 'n:1');
    perform pg_temp.t('101 anon NO ve el negocio no publicado B', 'anon', null,
      format('select 1 from public.negocios where id = %L', n_b), 'n:0');
    perform pg_temp.t('102 anon ve categorias del negocio A', 'anon', null,
      format('select 1 from public.categorias where negocio_id = %L', n_a), 'n:1');
    perform pg_temp.t('103 anon ve platos del negocio A', 'anon', null,
      format('select 1 from public.platos where negocio_id = %L', n_a), 'n:1');
    perform pg_temp.t('104 anon NO ve categorias de B', 'anon', null,
      format('select 1 from public.categorias where negocio_id = %L', n_b), 'n:0');
    perform pg_temp.t('105 anon NO ve platos de B', 'anon', null,
      format('select 1 from public.platos where negocio_id = %L', n_b), 'n:0');
    perform pg_temp.t('106 anon NO puede insertar negocios', 'anon', null,
      $q$insert into public.negocios (slug, nombre, color_fondo, color_superficie, color_acento)
         values ('anon-intruso', 'X', '#FFFFFF', '#FFFFFF', '#000000')$q$, 'deny');
    perform pg_temp.t('107 anon NO puede actualizar negocios', 'anon', null,
      $q$update public.negocios set nombre = 'hack'$q$, 'deny');
    perform pg_temp.t('108 anon NO puede borrar platos', 'anon', null,
      $q$delete from public.platos$q$, 'deny');
    perform pg_temp.t('109 anon NO puede insertar categorias', 'anon', null,
      format('insert into public.categorias (negocio_id, nombre) values (%L, %L)', n_a, 'hack'), 'deny');
    perform pg_temp.t('110 anon NO puede leer miembros', 'anon', null,
      $q$select 1 from public.miembros$q$, 'deny');
    perform pg_temp.t('111 anon NO puede leer administradores', 'anon', null,
      $q$select 1 from public.administradores$q$, 'deny');
    perform pg_temp.t('112 anon NO puede llamar es_admin()', 'anon', null,
      $q$select public.es_admin()$q$, 'deny');
    perform pg_temp.t('113 anon NO puede llamar asignar_dueno()', 'anon', null,
      format('select public.asignar_dueno(%L, %L)', n_a, 'dueno-b@ejemplo.invalid'), 'deny');

    perform pg_temp.t('120 menu_publico(prueba-a) devuelve la forma esperada (anon)', 'anon', null,
      format($q$select (
        j is not null
        and j->'menu'->>'version' = '1'
        and j->'tema'->>'version' = '1'
        and j->'menu'->'negocio'->>'nombre' = 'Negocio A'
        and j->'menu'->'negocio'->>'eslogan' = 'Eslogan A'
        and j->'menu'->'negocio'->>'logo' = %L
        and j->'menu'->'negocio'->>'moneda' = 'COP'
        and j->'menu'->'negocio'->>'whatsapp' = '573001234567'
        and j->'menu'->'negocio'->>'mapaUrl' = 'https://www.google.com/maps?q=1'
        and j->'menu'->'negocio'->'redes'->>'instagram' = 'https://instagram.com/negocioa'
        and not (j->'menu'->'negocio'->'redes' ? 'facebook')
        and jsonb_typeof(j->'menu'->'negocio'->'horario') = 'array'
        and j->'menu'->'negocio'->'horario'->0->>'abre' = '08:00'
        and j->'menu'->'negocio'->'horario'->0->'dias' = '[1,2,3]'::jsonb
        and j->'tema'->'colores'->>'fondo' = '#F5EFE6'
        and j->'tema'->'colores'->>'superficie' = '#FFFFFF'
        and j->'tema'->'colores'->>'acento' = '#C2410C'
        and j->'tema'->>'tipografia' = 'clasica'
        and jsonb_array_length(j->'menu'->'categorias') = 1
        and j->'menu'->'categorias'->0->>'nombre' = 'Categoria A'
        and (j->'menu'->'categorias'->0->'platos'->0->>'precio')::int = 12000
        and j->'menu'->'categorias'->0->'platos'->0->>'foto' = %L
        and j->'menu'->'categorias'->0->'platos'->0->'etiquetas' = '["vegano"]'::jsonb
        and j->'menu'->'categorias'->0->'platos'->0->'ingredientes' = '["Pan","Queso"]'::jsonb
        and (j->'menu'->'categorias'->0->'platos'->0->>'recomendado')::boolean
        and not (j->'menu'->'categorias'->0->'platos'->0 ? 'agotado')
        and not (j->'menu'->'negocio' ? 'slug')
        and not exists (select 1 from jsonb_object_keys(j->'menu'->'negocio') k
                        where k <> all (array['nombre','eslogan','logo','portada','moneda','whatsapp','direccion','mapaUrl','redes','horario']))
      )::text from (select public.menu_publico('prueba-a') as j) s$q$, foto_a, foto_p), 'valor:true');
    perform pg_temp.t('121 menu_publico(prueba-b) es null para anon', 'anon', null,
      $q$select public.menu_publico('prueba-b')::text$q$, 'valor:NULL');
    perform pg_temp.t('122 menu_publico de un slug inexistente es null', 'anon', null,
      $q$select public.menu_publico('no-existe-xyz')::text$q$, 'valor:NULL');
    perform pg_temp.t('123 anon NO puede insertar en storage fotos', 'anon', null,
      format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'fotos', n_a::text || '/' || f1), 'deny');
    perform pg_temp.t('124 anon NO lista objetos de storage (hay 1 objeto de B)', 'anon', null,
      $q$select 1 from storage.objects where bucket_id = 'fotos'$q$, 'deny0');

    -- ===== 2. DUENO A =====
    perform pg_temp.t('200 dueno A lee su negocio A', 'authenticated', u_a,
      format('select 1 from public.negocios where id = %L', n_a), 'n:1');
    perform pg_temp.t('201 dueno A NO lee el negocio B (no publicado)', 'authenticated', u_a,
      format('select 1 from public.negocios where id = %L', n_b), 'n:0');
    perform pg_temp.t('202 dueno A NO lee categorias de B', 'authenticated', u_a,
      format('select 1 from public.categorias where negocio_id = %L', n_b), 'n:0');
    perform pg_temp.t('203 dueno A NO lee platos de B', 'authenticated', u_a,
      format('select 1 from public.platos where negocio_id = %L', n_b), 'n:0');
    perform pg_temp.t('204 dueno A edita su negocio A', 'authenticated', u_a,
      format($q$update public.negocios set eslogan = 'Nuevo eslogan' where id = %L$q$, n_a), 'n:1');
    perform pg_temp.t('205 (verif.) el eslogan de A cambio', null, null,
      format('select eslogan from public.negocios where id = %L', n_a), 'valor:Nuevo eslogan');
    perform pg_temp.t('206 dueno A NO edita el negocio B (0 filas)', 'authenticated', u_a,
      format($q$update public.negocios set eslogan = 'hack' where id = %L$q$, n_b), 'n:0');
    perform pg_temp.t('207 (verif.) el eslogan de B no cambio', null, null,
      format('select eslogan from public.negocios where id = %L', n_b), 'valor:Eslogan B');
    perform pg_temp.t('208 dueno A NO puede cambiar su slug', 'authenticated', u_a,
      format($q$update public.negocios set slug = 'otro-slug' where id = %L$q$, n_a), 'err:Solo un administrador puede cambiar el slug');
    perform pg_temp.t('209 (verif.) el slug de A sigue igual', null, null,
      format('select slug from public.negocios where id = %L', n_a), 'valor:prueba-a');
    perform pg_temp.t('210 dueno A NO crea negocios', 'authenticated', u_a,
      $q$insert into public.negocios (slug, nombre, color_fondo, color_superficie, color_acento)
         values ('dueno-intruso', 'X', '#FFFFFF', '#FFFFFF', '#000000')$q$, 'deny');
    perform pg_temp.t('211 dueno A NO borra su negocio', 'authenticated', u_a,
      format('delete from public.negocios where id = %L', n_a), 'deny0');
    perform pg_temp.t('212 (verif.) el negocio A sigue existiendo', null, null,
      format('select count(*)::text from public.negocios where id = %L', n_a), 'valor:1');
    perform pg_temp.t('213 dueno A NO se inserta en miembros', 'authenticated', u_a,
      format('insert into public.miembros (negocio_id, user_id) values (%L, %L)', n_b, u_a), 'deny');
    perform pg_temp.t('214 dueno A NO borra de miembros', 'authenticated', u_a,
      $q$delete from public.miembros$q$, 'deny');
    perform pg_temp.t('215 dueno A solo ve sus propias filas de miembros', 'authenticated', u_a,
      format('select 1 from public.miembros where user_id <> %L', u_a), 'n:0');
    perform pg_temp.t('216 dueno A NO se inserta en administradores', 'authenticated', u_a,
      format('insert into public.administradores (user_id) values (%L)', u_a), 'deny');
    perform pg_temp.t('217 dueno A no ve administradores ajenos', 'authenticated', u_a,
      $q$select 1 from public.administradores$q$, 'n:0');
    perform pg_temp.t('218 dueno A NO mueve un plato a una categoria de otro negocio', 'authenticated', u_a,
      format('update public.platos set categoria_id = %L where id = %L', c_b, p_a), 'err:platos_categoria_mismo_negocio');
    perform pg_temp.t('219 dueno A NO mueve un plato a otro negocio (privilegio de columna)', 'authenticated', u_a,
      format('update public.platos set negocio_id = %L where id = %L', n_b, p_a), 'deny');
    perform pg_temp.t('220 dueno A NO inserta platos en el negocio B', 'authenticated', u_a,
      format('insert into public.platos (negocio_id, categoria_id, nombre, precio) values (%L, %L, %L, 1000)', n_b, c_b, 'hack'), 'deny');
    perform pg_temp.t('221 dueno A NO inserta plato (negocio A, categoria de B)', 'authenticated', u_a,
      format('insert into public.platos (negocio_id, categoria_id, nombre, precio) values (%L, %L, %L, 1000)', n_a, c_b, 'hack'), 'err:platos_categoria_mismo_negocio');
    perform pg_temp.t('222 dueno A NO crea categorias en B', 'authenticated', u_a,
      format('insert into public.categorias (negocio_id, nombre) values (%L, %L)', n_b, 'hack'), 'deny');
    perform pg_temp.t('223 dueno A NO cambia negocio_id de una categoria', 'authenticated', u_a,
      format('update public.categorias set negocio_id = %L where id = %L', n_b, c_a), 'deny');
    perform pg_temp.t('224 dueno A crea una categoria en A', 'authenticated', u_a,
      format('insert into public.categorias (id, negocio_id, nombre, orden) values (%L, %L, %L, 2)', c_nueva, n_a, 'Nueva'), 'n:1');
    perform pg_temp.t('225 dueno A crea un plato en A', 'authenticated', u_a,
      format('insert into public.platos (id, negocio_id, categoria_id, nombre, precio) values (%L, %L, %L, %L, 5000)', p_nuevo, n_a, c_nueva, 'Plato nuevo'), 'n:1');
    perform pg_temp.t('226 dueno A edita un plato de A', 'authenticated', u_a,
      format($q$update public.platos set nombre = 'Plato editado', agotado = true where id = %L$q$, p_nuevo), 'n:1');
    perform pg_temp.t('227 dueno A mueve un plato entre categorias de A', 'authenticated', u_a,
      format('update public.platos set categoria_id = %L where id = %L', c_a, p_nuevo), 'n:1');
    perform pg_temp.t('228 dueno A borra un plato de A', 'authenticated', u_a,
      format('delete from public.platos where id = %L', p_nuevo), 'n:1');
    perform pg_temp.t('229 dueno A borra una categoria de A', 'authenticated', u_a,
      format('delete from public.categorias where id = %L', c_nueva), 'n:1');
    perform pg_temp.t('230 es_admin() es false para el dueno A', 'authenticated', u_a,
      $q$select public.es_admin()::text$q$, 'valor:false');
    perform pg_temp.t('231 es_miembro(A) true y es_miembro(B) false para dueno A', 'authenticated', u_a,
      format('select (public.es_miembro(%L) and not public.es_miembro(%L))::text', n_a, n_b), 'valor:true');
    perform pg_temp.t('232 dueno A NO puede asignar duenos', 'authenticated', u_a,
      format('select public.asignar_dueno(%L, %L)', n_a, 'dueno-b@ejemplo.invalid'), 'err:No autorizado');
    perform pg_temp.t('233 dueno A NO puede quitar duenos', 'authenticated', u_a,
      format('select public.quitar_dueno(%L, %L)', n_b, u_b), 'err:No autorizado');
    perform pg_temp.t('234 mis_negocios() del dueno A devuelve solo A', 'authenticated', u_a,
      $q$select 1 from public.mis_negocios()$q$, 'n:1');
    perform pg_temp.t('235 menu_publico(prueba-b) es null tambien para el dueno A', 'authenticated', u_a,
      $q$select public.menu_publico('prueba-b')::text$q$, 'valor:NULL');
    perform pg_temp.t('236 menu_publico(prueba-b) es null incluso para el dueno B (no publicado)', 'authenticated', u_b,
      $q$select public.menu_publico('prueba-b')::text$q$, 'valor:NULL');
    -- upsert / on conflict sobre filas de OTRO negocio
    perform pg_temp.t('237 dueno A NO puede hacer upsert sobre un plato de B (on conflict do update)', 'authenticated', u_a,
      format($q$insert into public.platos (id, negocio_id, categoria_id, nombre, precio)
                values (%L, %L, %L, 'hack', 1) on conflict (id) do update set nombre = 'hack'$q$, p_b, n_a, c_a), 'deny');
    perform pg_temp.t('238 (verif.) el plato de B no cambio', null, null,
      format('select nombre from public.platos where id = %L', p_b), 'valor:Plato B');
    perform pg_temp.t('239 dueno A NO puede hacer upsert sobre el negocio B', 'authenticated', u_a,
      format($q$insert into public.negocios (id, slug, nombre, color_fondo, color_superficie, color_acento)
                values (%L, 'prueba-b', 'hack', '#FFFFFF', '#FFFFFF', '#000000')
                on conflict (id) do update set nombre = 'hack'$q$, n_b), 'deny');
    perform pg_temp.t('240 (verif.) el nombre de B no cambio', null, null,
      format('select nombre from public.negocios where id = %L', n_b), 'valor:Negocio B');

    -- ===== 2b. USUARIO AUTENTICADO SIN NEGOCIO =====
    perform pg_temp.t('250 sin-negocio lee el negocio publicado A', 'authenticated', u_sin,
      format('select 1 from public.negocios where id = %L', n_a), 'n:1');
    perform pg_temp.t('251 sin-negocio NO lee el negocio no publicado B', 'authenticated', u_sin,
      format('select 1 from public.negocios where id = %L', n_b), 'n:0');
    perform pg_temp.t('252 sin-negocio NO lee categorias ni platos de B', 'authenticated', u_sin,
      format('select 1 from (select negocio_id from public.categorias union all select negocio_id from public.platos) s where negocio_id = %L', n_b), 'n:0');
    perform pg_temp.t('253 sin-negocio lee los platos publicados de A', 'authenticated', u_sin,
      format('select 1 from public.platos where negocio_id = %L', n_a), 'n:1');
    perform pg_temp.t('254 sin-negocio NO inserta negocios', 'authenticated', u_sin,
      $q$insert into public.negocios (slug, nombre, color_fondo, color_superficie, color_acento)
         values ('sin-rol-intruso', 'X', '#FFFFFF', '#FFFFFF', '#000000')$q$, 'deny');
    perform pg_temp.t('255 sin-negocio NO inserta categorias en A', 'authenticated', u_sin,
      format('insert into public.categorias (negocio_id, nombre) values (%L, %L)', n_a, 'hack'), 'deny');
    perform pg_temp.t('256 sin-negocio NO inserta platos en A', 'authenticated', u_sin,
      format('insert into public.platos (negocio_id, categoria_id, nombre, precio) values (%L, %L, %L, 1)', n_a, c_a, 'hack'), 'deny');
    perform pg_temp.t('257 sin-negocio NO edita A (0 filas)', 'authenticated', u_sin,
      format($q$update public.negocios set eslogan = 'hack' where id = %L$q$, n_a), 'n:0');
    perform pg_temp.t('258 sin-negocio NO borra platos de A (0 filas)', 'authenticated', u_sin,
      format('delete from public.platos where negocio_id = %L', n_a), 'n:0');
    perform pg_temp.t('259 es_miembro(A) es false para sin-negocio', 'authenticated', u_sin,
      format('select public.es_miembro(%L)::text', n_a), 'valor:false');
    perform pg_temp.t('260 sin-negocio NO puede asignar duenos', 'authenticated', u_sin,
      format('select public.asignar_dueno(%L, %L)', n_a, 'sin-rol@ejemplo.invalid'), 'err:No autorizado');
    perform pg_temp.t('261 mis_negocios() de sin-negocio esta vacio', 'authenticated', u_sin,
      $q$select 1 from public.mis_negocios()$q$, 'n:0');

    -- ===== 3. DUENO B =====
    perform pg_temp.t('300 dueno B edita su negocio B', 'authenticated', u_b,
      format($q$update public.negocios set eslogan = 'Eslogan B2' where id = %L$q$, n_b), 'n:1');
    perform pg_temp.t('301 dueno B NO edita el negocio A', 'authenticated', u_b,
      format($q$update public.negocios set eslogan = 'hack' where id = %L$q$, n_a), 'n:0');
    perform pg_temp.t('302 dueno B ve el negocio A (publicado) solo en lectura', 'authenticated', u_b,
      format('select 1 from public.negocios where id = %L', n_a), 'n:1');
    perform pg_temp.t('303 dueno B NO borra platos de A', 'authenticated', u_b,
      format('delete from public.platos where negocio_id = %L', n_a), 'n:0');

    -- ===== 4. ADMINISTRADOR =====
    perform pg_temp.t('400 admin ve el negocio no publicado B', 'authenticated', u_adm,
      format('select 1 from public.negocios where id = %L', n_b), 'n:1');
    perform pg_temp.t('401 admin edita el negocio B', 'authenticated', u_adm,
      format($q$update public.negocios set eslogan = 'Admin edito' where id = %L$q$, n_b), 'n:1');
    perform pg_temp.t('402 admin cambia el slug de B', 'authenticated', u_adm,
      format($q$update public.negocios set slug = 'prueba-b2' where id = %L$q$, n_b), 'n:1');
    perform pg_temp.t('403 (verif.) el slug de B cambio', null, null,
      format('select slug from public.negocios where id = %L', n_b), 'valor:prueba-b2');
    perform pg_temp.t('404 admin devuelve el slug de B a prueba-b', 'authenticated', u_adm,
      format($q$update public.negocios set slug = 'prueba-b' where id = %L$q$, n_b), 'n:1');
    perform pg_temp.t('405 admin NO puede cambiar el id de un negocio', 'authenticated', u_adm,
      format('update public.negocios set id = %L where id = %L', n_falso, n_b), 'deny');
    perform pg_temp.t('406 admin crea un negocio', 'authenticated', u_adm,
      $q$insert into public.negocios (slug, nombre, color_fondo, color_superficie, color_acento)
         values ('prueba-c', 'Negocio C', '#FFFFFF', '#EEEEEE', '#000000')$q$, 'n:1');
    perform pg_temp.t('407 admin borra un negocio', 'authenticated', u_adm,
      $q$delete from public.negocios where slug = 'prueba-c'$q$, 'n:1');
    perform pg_temp.t('408 admin crea un plato en B', 'authenticated', u_adm,
      format('insert into public.platos (id, negocio_id, categoria_id, nombre, precio) values (%L, %L, %L, %L, 7000)', p_b_nuevo, n_b, c_b, 'Plato admin'), 'n:1');
    perform pg_temp.t('409 admin edita un plato de B', 'authenticated', u_adm,
      format($q$update public.platos set precio = 7500 where id = %L$q$, p_b_nuevo), 'n:1');
    perform pg_temp.t('410 admin borra un plato de B', 'authenticated', u_adm,
      format('delete from public.platos where id = %L', p_b_nuevo), 'n:1');
    perform pg_temp.t('411 admin ve todas las filas de miembros', 'authenticated', u_adm,
      $q$select 1 from public.miembros$q$, 'min:2');
    perform pg_temp.t('412 admin NO inserta directo en miembros (solo via asignar_dueno)', 'authenticated', u_adm,
      format('insert into public.miembros (negocio_id, user_id) values (%L, %L)', n_a, u_b), 'deny');
    perform pg_temp.t('413 admin NO inserta directo en administradores', 'authenticated', u_adm,
      format('insert into public.administradores (user_id) values (%L)', u_a), 'deny');
    perform pg_temp.t('414 es_admin() es true para el admin', 'authenticated', u_adm,
      $q$select public.es_admin()::text$q$, 'valor:true');
    perform pg_temp.t('415 admin asigna a B como dueno de A', 'authenticated', u_adm,
      format('select public.asignar_dueno(%L, %L)', n_a, 'dueno-b@ejemplo.invalid'), 'n:1');
    perform pg_temp.t('416 (verif.) existe la fila en miembros', null, null,
      format('select count(*)::text from public.miembros where negocio_id = %L and user_id = %L', n_a, u_b), 'valor:1');
    perform pg_temp.t('417 asignar dos veces no falla (idempotente, correo en mayusculas)', 'authenticated', u_adm,
      format('select public.asignar_dueno(%L, %L)', n_a, 'DUENO-B@ejemplo.invalid'), 'n:1');
    perform pg_temp.t('418 admin quita al dueno', 'authenticated', u_adm,
      format('select public.quitar_dueno(%L, %L)', n_a, u_b), 'n:1');
    perform pg_temp.t('419 (verif.) la fila de miembros ya no existe', null, null,
      format('select count(*)::text from public.miembros where negocio_id = %L and user_id = %L', n_a, u_b), 'valor:0');
    perform pg_temp.t('420 asignar con correo inexistente: mensaje generico', 'authenticated', u_adm,
      format('select public.asignar_dueno(%L, %L)', n_a, 'nadie@ejemplo.invalid'), 'err:No se pudo completar la asignaci');
    perform pg_temp.t('421 asignar con negocio inexistente: MISMO mensaje generico', 'authenticated', u_adm,
      format('select public.asignar_dueno(%L, %L)', n_falso, 'dueno-b@ejemplo.invalid'), 'err:No se pudo completar la asignaci');
    perform pg_temp.t('422 asignar a un usuario con correo SIN confirmar: MISMO mensaje generico', 'authenticated', u_adm,
      format('select public.asignar_dueno(%L, %L)', n_a, 'sin-confirmar@ejemplo.invalid'), 'err:No se pudo completar la asignaci');
    perform pg_temp.t('423 mis_negocios() del admin devuelve todos', 'authenticated', u_adm,
      $q$select 1 from public.mis_negocios()$q$, 'min:2');

    -- ===== 5. STORAGE =====
    perform pg_temp.t('500 dueno A sube a <idA>/<uuid>.webp', 'authenticated', u_a,
      format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'fotos', n_a::text || '/' || f1), 'n:1');
    perform pg_temp.t('501 dueno A lee por SQL su propio objeto', 'authenticated', u_a,
      format('select 1 from storage.objects where bucket_id = %L and name = %L', 'fotos', n_a::text || '/' || f1), 'n:1');
    perform pg_temp.t('502 dueno A NO lee por SQL objetos de B', 'authenticated', u_a,
      format('select 1 from storage.objects where bucket_id = %L and name = %L', 'fotos', n_b::text || '/' || fb1), 'n:0');
    perform pg_temp.t('503 dueno A NO sube a <idB>/<uuid>.webp', 'authenticated', u_a,
      format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'fotos', n_b::text || '/' || fb2), 'deny');
    perform pg_temp.t('504 dueno A NO sube a cualquiera/<uuid>.webp (sin error de conversion que filtre info)', 'authenticated', u_a,
      format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'fotos', 'cualquiera/' || f2), 'deny');
    perform pg_temp.t('505 dueno A NO sube a cualquiera/x.webp', 'authenticated', u_a,
      $q$insert into storage.objects (bucket_id, name) values ('fotos', 'cualquiera/x.webp')$q$, 'deny');
    perform pg_temp.t('506 dueno A NO sube con subcarpeta <idA>/sub/<uuid>.webp', 'authenticated', u_a,
      format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'fotos', n_a::text || '/sub/' || f2), 'deny');
    perform pg_temp.t('507 dueno A NO sube con carpeta en MAYUSCULAS', 'authenticated', u_a,
      format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'fotos', upper(n_a::text) || '/' || f2), 'deny');
    perform pg_temp.t('508 dueno A NO sube con nombre que contiene ..', 'authenticated', u_a,
      format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'fotos', n_a::text || '/../' || f2), 'deny');
    perform pg_temp.t('509 dueno A NO sube con extension .html', 'authenticated', u_a,
      format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'fotos', n_a::text || '/' || replace(f2, '.webp', '.html')), 'deny');
    perform pg_temp.t('510 dueno A NO sube a otro bucket', 'authenticated', u_a,
      format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'otro', n_a::text || '/' || f2), 'deny');
    perform pg_temp.t('511 dueno A NO mueve su objeto a la carpeta de B', 'authenticated', u_a,
      format('update storage.objects set name = %L where bucket_id = %L and name = %L', n_b::text || '/' || fb2, 'fotos', n_a::text || '/' || f1), 'deny');
    perform pg_temp.t('512 dueno A NO cambia el bucket_id de su objeto', 'authenticated', u_a,
      format('update storage.objects set bucket_id = %L where bucket_id = %L and name = %L', 'otro', 'fotos', n_a::text || '/' || f1), 'deny');
    perform pg_temp.t('513 dueno A NO borra el objeto de B (0 filas)', 'authenticated', u_a,
      format('delete from storage.objects where bucket_id = %L and name = %L', 'fotos', n_b::text || '/' || fb1), 'deny0');
    perform pg_temp.t('514 admin sube a <idB>/<uuid>.webp', 'authenticated', u_adm,
      format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'fotos', n_b::text || '/' || fb3), 'n:1');
    perform pg_temp.t('515 admin NO sube a cualquiera/<uuid>.webp (forma de ruta obligatoria)', 'authenticated', u_adm,
      format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'fotos', 'cualquiera/' || f3), 'deny');
    perform pg_temp.t('516 usuario sin negocio NO sube a la carpeta de A', 'authenticated', u_sin,
      format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'fotos', n_a::text || '/' || f3), 'deny');
    perform pg_temp.t('517 dueno A borra su propio objeto', 'authenticated', u_a,
      format('delete from storage.objects where bucket_id = %L and name = %L', 'fotos', n_a::text || '/' || f1), 'n:1');

    -- ===== 6. REGLAS DE VALIDACION (como postgres: deben fallar por el CHECK indicado) =====
    perform pg_temp.t('600 slug reservado (admin)', null, null,
      $q$insert into public.negocios (slug,nombre,color_fondo,color_superficie,color_acento) values ('admin','X','#FFFFFF','#FFFFFF','#000000')$q$, 'err:negocios_slug_reservado');
    perform pg_temp.t('601 slug muy corto', null, null,
      $q$insert into public.negocios (slug,nombre,color_fondo,color_superficie,color_acento) values ('ab','X','#FFFFFF','#FFFFFF','#000000')$q$, 'err:negocios_slug_formato');
    perform pg_temp.t('602 slug con mayusculas', null, null,
      $q$insert into public.negocios (slug,nombre,color_fondo,color_superficie,color_acento) values ('Hola-Mundo','X','#FFFFFF','#FFFFFF','#000000')$q$, 'err:negocios_slug_formato');
    perform pg_temp.t('603 slug con doble guion', null, null,
      $q$insert into public.negocios (slug,nombre,color_fondo,color_superficie,color_acento) values ('a--b','X','#FFFFFF','#FFFFFF','#000000')$q$, 'err:negocios_slug_formato');
    perform pg_temp.t('604 slug duplicado', null, null,
      $q$insert into public.negocios (slug,nombre,color_fondo,color_superficie,color_acento) values ('prueba-a','X','#FFFFFF','#FFFFFF','#000000')$q$, 'err:negocios_slug_unico');
    perform pg_temp.t('605 color invalido', null, null,
      $q$insert into public.negocios (slug,nombre,color_fondo,color_superficie,color_acento) values ('color-malo','X','rojo','#FFFFFF','#000000')$q$, 'err:negocios_colores');
    perform pg_temp.t('606 nombre de negocio de 81 letras', null, null,
      format('insert into public.negocios (slug,nombre,color_fondo,color_superficie,color_acento) values (%L, %L, %L, %L, %L)', 'nombre-largo', repeat('x', 81), '#FFFFFF', '#FFFFFF', '#000000'), 'err:negocios_nombre');
    perform pg_temp.t('607 nombre de negocio de 50 000 espacios', null, null,
      format('insert into public.negocios (slug,nombre,color_fondo,color_superficie,color_acento) values (%L, %L, %L, %L, %L)', 'nombre-espacios', repeat(' ', 50000), '#FFFFFF', '#FFFFFF', '#000000'), 'err:negocios_nombre');
    perform pg_temp.t('608 nombre de negocio de 79 letras + 50 000 espacios (relleno)', null, null,
      format('insert into public.negocios (slug,nombre,color_fondo,color_superficie,color_acento) values (%L, %L, %L, %L, %L)', 'nombre-relleno', repeat('x', 79) || repeat(' ', 50000), '#FFFFFF', '#FFFFFF', '#000000'), 'err:negocios_nombre');
    perform pg_temp.t('609 nombre de categoria con 50 000 espacios', null, null,
      format('insert into public.categorias (negocio_id, nombre) values (%L, %L)', n_a, 'x' || repeat(' ', 50000)), 'err:categorias_nombre');
    perform pg_temp.t('610 nombre de plato con 50 000 espacios', null, null,
      format('insert into public.platos (negocio_id, categoria_id, nombre, precio) values (%L, %L, %L, 1)', n_a, c_a, 'x' || repeat(' ', 50000)), 'err:platos_nombre');
    perform pg_temp.t('611 whatsapp invalido', null, null,
      format($q$update public.negocios set whatsapp = '123' where id = %L$q$, n_a), 'err:negocios_whatsapp');
    perform pg_temp.t('612 mapa_url sin https', null, null,
      format($q$update public.negocios set mapa_url = 'http://x.com' where id = %L$q$, n_a), 'err:negocios_mapa_url');
    perform pg_temp.t('613 instagram con javascript:', null, null,
      format($q$update public.negocios set instagram = 'javascript:alert(1)' where id = %L$q$, n_a), 'err:negocios_instagram');
    perform pg_temp.t('614 enlace con espacio', null, null,
      format($q$update public.negocios set tiktok = 'https://tiktok.com/a b' where id = %L$q$, n_a), 'err:negocios_tiktok');
    perform pg_temp.t('615 horario con 15 franjas', null, null,
      format($q$update public.negocios set horario = (select jsonb_agg('{"dias":[1],"abre":"08:00","cierra":"09:00"}'::jsonb) from generate_series(1,15)) where id = %L$q$, n_a), 'err:negocios_horario');
    perform pg_temp.t('616 horario con dia 9', null, null,
      format($q$update public.negocios set horario = '[{"dias":[9],"abre":"08:00","cierra":"09:00"}]'::jsonb where id = %L$q$, n_a), 'err:negocios_horario');
    perform pg_temp.t('617 horario con abre = cierra', null, null,
      format($q$update public.negocios set horario = '[{"dias":[1],"abre":"08:00","cierra":"08:00"}]'::jsonb where id = %L$q$, n_a), 'err:negocios_horario');
    perform pg_temp.t('618 horario que no es lista', null, null,
      format($q$update public.negocios set horario = '{"dias":[1]}'::jsonb where id = %L$q$, n_a), 'err:negocios_horario');
    perform pg_temp.t('619 horario con una clave extra en la franja', null, null,
      format($q$update public.negocios set horario = '[{"dias":[1],"abre":"08:00","cierra":"09:00","extra":1}]'::jsonb where id = %L$q$, n_a), 'err:negocios_horario');
    perform pg_temp.t('620 horario con clave faltante', null, null,
      format($q$update public.negocios set horario = '[{"dias":[1],"abre":"08:00"}]'::jsonb where id = %L$q$, n_a), 'err:negocios_horario');
    perform pg_temp.t('621 moneda distinta de COP', null, null,
      format($q$update public.negocios set moneda = 'USD' where id = %L$q$, n_a), 'err:negocios_moneda');
    perform pg_temp.t('622 tipografia desconocida', null, null,
      format($q$update public.negocios set tipografia = 'comic' where id = %L$q$, n_a), 'err:negocios_tipografia');
    perform pg_temp.t('623 logo_ruta como URL', null, null,
      format($q$update public.negocios set logo_ruta = 'https://evil.example/x.png' where id = %L$q$, n_a), 'err:negocios_logo_ruta');
    perform pg_temp.t('624 logo_ruta apuntando a la carpeta de otro negocio', null, null,
      format('update public.negocios set logo_ruta = %L where id = %L', foto_a, n_b), 'err:negocios_logo_ruta');
    perform pg_temp.t('625 precio negativo', null, null,
      format('insert into public.platos (negocio_id, categoria_id, nombre, precio) values (%L, %L, %L, -1)', n_a, c_a, 'x'), 'err:platos_precio');
    perform pg_temp.t('626 precio por encima del maximo', null, null,
      format('insert into public.platos (negocio_id, categoria_id, nombre, precio) values (%L, %L, %L, 10000001)', n_a, c_a, 'x'), 'err:platos_precio');
    perform pg_temp.t('627 etiqueta desconocida', null, null,
      format($q$insert into public.platos (negocio_id, categoria_id, nombre, precio, etiquetas) values (%L, %L, 'x', 1, array['xx'])$q$, n_a, c_a), 'err:platos_etiquetas');
    perform pg_temp.t('628 31 ingredientes', null, null,
      format($q$insert into public.platos (negocio_id, categoria_id, nombre, precio, ingredientes) values (%L, %L, 'x', 1, (select array_agg('i' || g) from generate_series(1,31) g))$q$, n_a, c_a), 'err:platos_ingredientes');
    perform pg_temp.t('629 ingrediente de 61 letras', null, null,
      format($q$insert into public.platos (negocio_id, categoria_id, nombre, precio, ingredientes) values (%L, %L, 'x', 1, array[repeat('x', 61)])$q$, n_a, c_a), 'err:platos_ingredientes');
    perform pg_temp.t('630 alergeno vacio', null, null,
      format($q$insert into public.platos (negocio_id, categoria_id, nombre, precio, alergenos) values (%L, %L, 'x', 1, array[''])$q$, n_a, c_a), 'err:platos_alergenos');
    perform pg_temp.t('631 foto_ruta como URL', null, null,
      format($q$insert into public.platos (negocio_id, categoria_id, nombre, precio, foto_ruta) values (%L, %L, 'x', 1, 'https://evil.example/x.png')$q$, n_a, c_a), 'err:platos_foto_ruta');
    perform pg_temp.t('632 foto_ruta de la carpeta de otro negocio', null, null,
      format('insert into public.platos (negocio_id, categoria_id, nombre, precio, foto_ruta) values (%L, %L, %L, 1, %L)', n_b, c_b, 'x', foto_p), 'err:platos_foto_ruta');
    perform pg_temp.t('633 descripcion de 301 letras', null, null,
      format('insert into public.platos (negocio_id, categoria_id, nombre, precio, descripcion) values (%L, %L, %L, 1, %L)', n_a, c_a, 'x', repeat('x', 301)), 'err:platos_descripcion');
    perform pg_temp.t('634 nombre de categoria vacio', null, null,
      format($q$insert into public.categorias (negocio_id, nombre) values (%L, '   ')$q$, n_a), 'err:categorias_nombre');
    perform pg_temp.t('635 plato con negocio distinto al de su categoria (llave compuesta)', null, null,
      format('insert into public.platos (negocio_id, categoria_id, nombre, precio) values (%L, %L, %L, 1)', n_a, c_b, 'x'), 'err:platos_categoria_mismo_negocio');
    perform pg_temp.t('636 borrar una categoria borra sus platos (cascada)', null, null,
      format($q$with d as (delete from public.categorias where id = %L returning id)
        select count(*)::text from d$q$, c_b), 'valor:1');
    perform pg_temp.t('637 (verif.) los platos de la categoria borrada ya no existen', null, null,
      format('select count(*)::text from public.platos where categoria_id = %L', c_b), 'valor:0');

    -- ===== 7. LIMITES, ejecutados como DUENO A autenticado =====
    -- Negocio A tiene 1 categoria (c_a) con 1 plato (p_a) en este punto.
    perform pg_temp.t('700 dueno A crea 29 categorias mas (total 30)', 'authenticated', u_a,
      format('insert into public.categorias (negocio_id, nombre, orden) select %L, %L || g, g from generate_series(1, 29) g', n_a, 'Extra '), 'n:29');
    perform pg_temp.t('701 categoria numero 31 rechazada (dueno A)', 'authenticated', u_a,
      format('insert into public.categorias (negocio_id, nombre) values (%L, %L)', n_a, 'Sobra'), 'err:30 categor');

    select id into v_c1 from public.categorias where negocio_id = n_a and nombre = 'Extra 1';
    select id into v_c2 from public.categorias where negocio_id = n_a and nombre = 'Extra 2';
    select id into v_c3 from public.categorias where negocio_id = n_a and nombre = 'Extra 3';

    perform pg_temp.t('702 dueno A llena una categoria hasta 200 platos', 'authenticated', u_a,
      format('insert into public.platos (negocio_id, categoria_id, nombre, precio) select %L, %L, %L || g, 1000 from generate_series(1, 199) g', n_a, c_a, 'P'), 'n:199');
    perform pg_temp.t('703 plato 201 en una categoria rechazado (dueno A)', 'authenticated', u_a,
      format('insert into public.platos (negocio_id, categoria_id, nombre, precio) values (%L, %L, %L, 1000)', n_a, c_a, 'Sobra'), 'err:200 platos');
    perform pg_temp.t('704 dueno A llena otra categoria con 200 platos', 'authenticated', u_a,
      format('insert into public.platos (negocio_id, categoria_id, nombre, precio) select %L, %L, %L || g, 1000 from generate_series(1, 200) g', n_a, v_c1, 'Q'), 'n:200');
    perform pg_temp.t('705 dueno A agrega 100 platos mas (total 500)', 'authenticated', u_a,
      format('insert into public.platos (negocio_id, categoria_id, nombre, precio) select %L, %L, %L || g, 1000 from generate_series(1, 100) g', n_a, v_c2, 'R'), 'n:100');
    perform pg_temp.t('706 plato 501 del negocio rechazado (dueno A)', 'authenticated', u_a,
      format('insert into public.platos (negocio_id, categoria_id, nombre, precio) values (%L, %L, %L, 1000)', n_a, v_c3, 'Sobra'), 'err:500 platos');

    select id into v_plato_mover from public.platos where categoria_id = v_c2 limit 1;
    perform pg_temp.t('707 mover un plato a una categoria que ya tiene 200 es rechazado', 'authenticated', u_a,
      format('update public.platos set categoria_id = %L where id = %L', c_a, v_plato_mover), 'err:200 platos');
    perform pg_temp.t('708 mover un plato a una categoria con espacio si se puede', 'authenticated', u_a,
      format('update public.platos set categoria_id = %L where id = %L', v_c3, v_plato_mover), 'n:1');

  exception when others then
    v_fatal := sqlstate || ' - ' || sqlerrm;
  end;

  -- ===== RESUMEN: siempre se lanza una excepcion (deshace todo) =====
  select count(*), count(*) filter (where estado = 'OK'),
         count(*) filter (where estado = 'FALLA'), count(*) filter (where estado = 'OMITIDA')
    into v_total, v_ok, v_fallan, v_omit
  from resultados;

  if v_fatal is not null then
    v_fallan := v_fallan + 1;
    v_total  := v_total + 1;
  end if;

  v_msg := format('PRUEBAS total=%s ok=%s fallan=%s omitidas=%s', v_total, v_ok, v_fallan, v_omit);
  if v_fatal is not null then
    v_msg := v_msg || E'\nFALLA | 000 ERROR DEL GUION (se perdieron los resultados parciales) | ' || left(v_fatal, 200);
  end if;
  for r in select * from resultados where estado = 'FALLA' order by prueba loop
    v_msg := v_msg || E'\nFALLA | ' || r.prueba || ' | ' || left(r.detalle, 200);
  end loop;
  for r in select * from resultados where estado = 'OMITIDA' order by prueba loop
    v_msg := v_msg || E'\nOMITIDA | ' || r.prueba || ' | ' || left(r.detalle, 200);
  end loop;

  raise exception '%', v_msg;
end;
$do$;
