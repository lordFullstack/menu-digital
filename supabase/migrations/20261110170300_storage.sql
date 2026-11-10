-- =====================================================================
-- MIGRACION 4 de 4: STORAGE (fotos)
-- Especificacion: docs/equipo/CONTRATO-ADMIN.md, seccion "Storage".
--
-- En palabras simples: crea la "carpeta de fotos" (bucket 'fotos'):
--   - cualquiera puede VER una foto si conoce su direccion (es publica),
--     pero nadie sin sesion puede listar el contenido ni subir nada;
--   - un dueno solo puede subir/cambiar/borrar fotos dentro de la carpeta de
--     SU negocio: <id_del_negocio>/<nombre>.<ext>;
--   - el administrador puede en cualquier negocio;
--   - maximo 2 MB por foto y solo JPEG, PNG o WebP (SVG prohibido).
--
-- Se puede ejecutar mas de una vez.
-- ESTADO: escrita, NO aplicada, NO verificada contra la base.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. El bucket
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 2. Funcion auxiliar: de una ruta como '<uuid>/archivo.webp' saca el uuid
--    del negocio. Si la ruta NO tiene esa forma (carpeta que no es uuid,
--    sin carpeta, o con subcarpetas) devuelve NULL en vez de lanzar un error
--    de conversion: asi una ruta rara simplemente se rechaza sin revelar nada.
--    "case" garantiza que el cast ::uuid solo se evalua si el patron coincide.
-- ---------------------------------------------------------------------
create or replace function public.negocio_de_ruta(p_ruta text)
returns uuid
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
           when p_ruta ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|jpeg|png)$'
             then (split_part(p_ruta, '/', 1))::uuid
         end;
$$;

-- Misma regla que public.ruta_foto_valida (esquema): minusculas, <uuid>/<uuid>.<ext>, sin '~*'.
revoke all on function public.negocio_de_ruta(text) from public, anon;
grant execute on function public.negocio_de_ruta(text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Politicas sobre storage.objects (solo rol authenticated; anon no tiene
--    ninguna: puede ver fotos por su URL publica, pero no listar, subir ni borrar).
--    Condicion comun: bucket 'fotos', ruta con forma <uuid>/<archivo>, y
--    (es admin o es miembro de ese negocio).
--    Nota: el contrato pedia solo "es_miembro o es_admin"; se exige ademas la
--    forma de ruta tambien para el admin (si no es '<uuid>/<archivo>' se rechaza).
--    La politica de select existe para que el dueno pueda reemplazar/borrar
--    (la API de storage lee la fila antes); no habilita listado a anonimos.
-- ---------------------------------------------------------------------
drop policy if exists fotos_select_dueno_admin on storage.objects;
create policy fotos_select_dueno_admin on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos'
    and public.negocio_de_ruta(name) is not null
    and ((select public.es_admin()) or public.es_miembro(public.negocio_de_ruta(name)))
  );

drop policy if exists fotos_insert_dueno_admin on storage.objects;
create policy fotos_insert_dueno_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and public.negocio_de_ruta(name) is not null
    and ((select public.es_admin()) or public.es_miembro(public.negocio_de_ruta(name)))
  );

drop policy if exists fotos_update_dueno_admin on storage.objects;
create policy fotos_update_dueno_admin on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fotos'
    and public.negocio_de_ruta(name) is not null
    and ((select public.es_admin()) or public.es_miembro(public.negocio_de_ruta(name)))
  )
  with check (
    bucket_id = 'fotos'
    and public.negocio_de_ruta(name) is not null
    and ((select public.es_admin()) or public.es_miembro(public.negocio_de_ruta(name)))
  );

drop policy if exists fotos_delete_dueno_admin on storage.objects;
create policy fotos_delete_dueno_admin on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fotos'
    and public.negocio_de_ruta(name) is not null
    and ((select public.es_admin()) or public.es_miembro(public.negocio_de_ruta(name)))
  );
