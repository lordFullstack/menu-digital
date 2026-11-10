-- =====================================================================
-- MIGRACION 1 de 4: ESQUEMA (tablas, reglas de validacion, indices, triggers)
-- Panel de administracion de Cuadrao / menu-digital. Postgres 17 (Supabase).
-- Especificacion: docs/equipo/CONTRATO-ADMIN.md
--
-- En palabras simples: aqui se construyen las "hojas de calculo" (tablas)
-- donde viviran los negocios, categorias, platos y quien puede editar que.
-- Tambien se ponen las reglas que la base hace cumplir SIEMPRE, aunque el
-- programa del navegador falle o alguien intente saltarselo:
--   - limites de largo, colores validos, enlaces solo https, etc.
--   - maximo 30 categorias y 500 platos por negocio
--   - un plato solo puede estar en una categoria de SU MISMO negocio
--
-- Al final (secciones G y H) cierra los permisos y activa RLS en las tablas, para que
-- no haya ninguna ventana abierta; la migracion 3 concede despues lo justo.
-- Se puede ejecutar mas de una vez sin romper nada (idempotente).
-- ESTADO: escrita, NO aplicada, NO verificada contra la base.
-- =====================================================================


-- ---------------------------------------------------------------------
-- A. Funciones auxiliares de validacion (puras: no leen ninguna tabla)
--    "immutable" = siempre dan el mismo resultado para la misma entrada,
--    requisito para usarlas dentro de un CHECK.
-- ---------------------------------------------------------------------

-- Valida una lista de textos: maximo N elementos, ninguno vacio ni nulo,
-- y ninguno con mas de M letras.
create or replace function public.lista_textos_valida(p_lista text[], p_max_elementos int, p_max_largo int)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_lista is not null
     and cardinality(p_lista) <= p_max_elementos
     and not exists (
       select 1
       from unnest(p_lista) as e(t)
       where e.t is null
          or char_length(btrim(e.t)) = 0
          or char_length(e.t) > p_max_largo
     );
$$;

-- Valida el horario: [{ "dias": [0..6], "abre": "HH:MM", "cierra": "HH:MM" }, ...]
-- Maximo 14 franjas; dias del 0 (domingo) al 6 (sabado), 1 a 7 dias por franja;
-- horas en formato 24 h; "abre" y "cierra" no pueden ser iguales.
create or replace function public.horario_valido(p_horario jsonb)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  f jsonb;
  d jsonb;
begin
  if p_horario is null or jsonb_typeof(p_horario) <> 'array' then
    return false;
  end if;
  if jsonb_array_length(p_horario) > 14 then
    return false;
  end if;

  for f in select e from jsonb_array_elements(p_horario) as t(e) loop
    if jsonb_typeof(f) <> 'object' then
      return false;
    end if;
    -- Exactamente las 3 claves permitidas: ni mas ni menos (las que faltan las
    -- detectan las comprobaciones de abajo; aqui se rechazan las claves extra).
    if (select count(*) from jsonb_object_keys(f)) <> 3 then
      return false;
    end if;
    if jsonb_typeof(f -> 'dias') is distinct from 'array' then
      return false;
    end if;
    if jsonb_array_length(f -> 'dias') not between 1 and 7 then
      return false;
    end if;
    for d in select e from jsonb_array_elements(f -> 'dias') as t(e) loop
      if jsonb_typeof(d) <> 'number' or (d #>> '{}') !~ '^[0-6]$' then
        return false;
      end if;
    end loop;
    if jsonb_typeof(f -> 'abre') is distinct from 'string'
       or (f ->> 'abre') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      return false;
    end if;
    if jsonb_typeof(f -> 'cierra') is distinct from 'string'
       or (f ->> 'cierra') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      return false;
    end if;
    if (f ->> 'abre') = (f ->> 'cierra') then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- Valida la ruta de una foto dentro del bucket 'fotos':
--   <id_del_negocio>/<uuid>.<webp|jpg|jpeg|png>
-- Nunca es una URL. La carpeta debe ser el id del propio negocio.
-- Si la ruta es nula, es valida (la foto es opcional).
create or replace function public.ruta_foto_valida(p_ruta text, p_negocio uuid)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_ruta is null
      or (
        char_length(p_ruta) <= 120
        and p_ruta ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|jpeg|png)$'
        and split_part(p_ruta, '/', 1) = p_negocio::text
      );
$$;


-- ---------------------------------------------------------------------
-- B. Tabla NEGOCIOS (un restaurante = una fila)
-- ---------------------------------------------------------------------
create table if not exists public.negocios (
  id                 uuid primary key default gen_random_uuid(),
  -- slug = la parte de la direccion web: cuadrao.app/<slug>
  slug               text not null,
  nombre             text not null,
  eslogan            text,
  -- rutas dentro del bucket 'fotos' (nunca URLs)
  logo_ruta          text,
  portada_ruta       text,
  moneda             text not null default 'COP',
  whatsapp           text,
  direccion          text,
  mapa_url           text,
  instagram          text,
  facebook           text,
  tiktok             text,
  horario            jsonb not null default '[]'::jsonb,
  color_fondo        text not null,
  color_superficie   text not null,
  color_acento       text not null,
  tipografia         text not null default 'clasica',
  publicado          boolean not null default false,
  creado             timestamptz not null default now(),
  actualizado        timestamptz not null default now(),

  constraint negocios_slug_unico     unique (slug),
  -- minusculas, numeros y guiones sueltos; de 3 a 40 letras
  constraint negocios_slug_formato   check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  -- nombres que ya usa la propia aplicacion y no se pueden dar a un negocio
  constraint negocios_slug_reservado check (slug <> all (array['admin','assets','datos','img','iconos','api','sw','manifest','index','login'])),
  -- El tope se mide sobre el texto original (con espacios), no sobre el recortado.
  constraint negocios_nombre         check (char_length(nombre) <= 80 and btrim(nombre) <> ''),
  constraint negocios_eslogan        check (char_length(eslogan) <= 120),
  constraint negocios_logo_ruta      check (public.ruta_foto_valida(logo_ruta, id)),
  constraint negocios_portada_ruta   check (public.ruta_foto_valida(portada_ruta, id)),
  constraint negocios_moneda         check (moneda = 'COP'),
  constraint negocios_whatsapp       check (whatsapp ~ '^[0-9]{8,15}$'),
  constraint negocios_direccion      check (char_length(direccion) <= 200),
  -- enlaces: deben empezar por https://, maximo 300 letras, sin espacios ni caracteres de control.
  -- (La lista de sitios permitidos --Instagram, Maps, etc.-- la valida el navegador; aqui solo el prefijo.)
  constraint negocios_mapa_url       check (mapa_url  like 'https://%' and char_length(mapa_url)  <= 300 and mapa_url  !~ '[[:space:][:cntrl:]]'),
  constraint negocios_instagram      check (instagram like 'https://%' and char_length(instagram) <= 300 and instagram !~ '[[:space:][:cntrl:]]'),
  constraint negocios_facebook       check (facebook  like 'https://%' and char_length(facebook)  <= 300 and facebook  !~ '[[:space:][:cntrl:]]'),
  constraint negocios_tiktok         check (tiktok    like 'https://%' and char_length(tiktok)    <= 300 and tiktok    !~ '[[:space:][:cntrl:]]'),
  constraint negocios_horario        check (public.horario_valido(horario)),
  constraint negocios_horario_tamano check (octet_length(horario::text) <= 2000),
  constraint negocios_colores        check (
    color_fondo      ~ '^#[0-9A-Fa-f]{6}$' and
    color_superficie ~ '^#[0-9A-Fa-f]{6}$' and
    color_acento     ~ '^#[0-9A-Fa-f]{6}$'
  ),
  constraint negocios_tipografia     check (tipografia in ('clasica','moderna','calida'))
);

-- Mantiene al dia la fecha "actualizado" cada vez que se edita un negocio.
create or replace function public.tocar_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado := now();
  return new;
end;
$$;

drop trigger if exists negocios_tocar_actualizado on public.negocios;
create trigger negocios_tocar_actualizado
  before update on public.negocios
  for each row execute function public.tocar_actualizado();


-- ---------------------------------------------------------------------
-- C. Tabla CATEGORIAS (Entradas, Bebidas, Postres...)
-- ---------------------------------------------------------------------
create table if not exists public.categorias (
  id          uuid primary key default gen_random_uuid(),
  negocio_id  uuid not null references public.negocios (id) on delete cascade,
  nombre      text not null,
  orden       int  not null default 0,

  constraint categorias_nombre check (char_length(nombre) <= 80 and btrim(nombre) <> ''),
  constraint categorias_orden  check (orden between 0 and 100000),
  -- Necesario para la llave foranea compuesta de platos (ver abajo).
  constraint categorias_id_negocio_unico unique (id, negocio_id)
);

create index if not exists categorias_negocio_orden_idx on public.categorias (negocio_id, orden);


-- ---------------------------------------------------------------------
-- D. Tabla PLATOS
--    La llave foranea COMPUESTA (categoria_id, negocio_id) obliga a que el
--    negocio del plato sea el mismo negocio de su categoria. Asi nadie puede
--    "colar" un plato en la categoria de otro negocio, ni por error ni a proposito.
-- ---------------------------------------------------------------------
create table if not exists public.platos (
  id            uuid primary key default gen_random_uuid(),
  negocio_id    uuid not null references public.negocios (id) on delete cascade,
  categoria_id  uuid not null,
  nombre        text not null,
  descripcion   text,
  precio        int  not null,
  foto_ruta     text,
  etiquetas     text[] not null default '{}',
  ingredientes  text[] not null default '{}',
  alergenos     text[] not null default '{}',
  recomendado   boolean not null default false,
  agotado       boolean not null default false,
  orden         int not null default 0,

  constraint platos_categoria_mismo_negocio
    foreign key (categoria_id, negocio_id)
    references public.categorias (id, negocio_id) on delete cascade,
  constraint platos_nombre       check (char_length(nombre) <= 80 and btrim(nombre) <> ''),
  constraint platos_descripcion  check (char_length(descripcion) <= 300),
  constraint platos_precio       check (precio between 0 and 10000000),
  constraint platos_foto_ruta    check (public.ruta_foto_valida(foto_ruta, negocio_id)),
  constraint platos_etiquetas    check (
    cardinality(etiquetas) <= 5
    and etiquetas <@ array['vegano','vegetariano','picante','sin-gluten','nuevo']::text[]
  ),
  constraint platos_ingredientes check (public.lista_textos_valida(ingredientes, 30, 60)),
  constraint platos_alergenos    check (public.lista_textos_valida(alergenos, 30, 60)),
  constraint platos_orden        check (orden between 0 and 100000)
);

create index if not exists platos_categoria_negocio_idx on public.platos (categoria_id, negocio_id);
create index if not exists platos_negocio_idx           on public.platos (negocio_id);


-- ---------------------------------------------------------------------
-- E. Tabla MIEMBROS (quien es dueno de que negocio) y ADMINISTRADORES
--    Estas dos tablas NO se editan directamente desde el panel:
--    miembros solo cambia con asignar_dueno()/quitar_dueno() (migracion 2).
--    administradores la llena solo Jorge a mano (ver supabase/README.md).
-- ---------------------------------------------------------------------
create table if not exists public.miembros (
  negocio_id  uuid not null references public.negocios (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  creado      timestamptz not null default now(),
  primary key (negocio_id, user_id)
);
create index if not exists miembros_user_idx on public.miembros (user_id);

create table if not exists public.administradores (
  user_id  uuid primary key references auth.users (id) on delete cascade
);


-- ---------------------------------------------------------------------
-- F. Limites por negocio (30 categorias, 500 platos, 200 platos por categoria)
--    El "advisory lock" hace que dos altas simultaneas no se salten el limite.
--    El limite de 200 platos por categoria replica lo que ya valida el
--    navegador (src/datos/validar.ts) para que un menu nunca quede imposible de mostrar.
-- ---------------------------------------------------------------------
create or replace function public.limitar_categorias()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Si quien escribe es un usuario de la API que NO es miembro ni admin de ese negocio,
  -- no se toma el candado (evita que un extrano bloquee a otros): la RLS lo rechazara.
  if current_user in ('anon', 'authenticated')
     and not (public.es_miembro(new.negocio_id) or public.es_admin()) then
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cat:' || new.negocio_id::text, 0));
  if (select count(*) from public.categorias c where c.negocio_id = new.negocio_id) >= 30 then
    raise exception 'Un negocio puede tener como máximo 30 categorías.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists categorias_limite on public.categorias;
create trigger categorias_limite
  before insert on public.categorias
  for each row execute function public.limitar_categorias();

create or replace function public.limitar_platos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and not (public.es_miembro(new.negocio_id) or public.es_admin()) then
    return new;   -- la RLS lo rechazara; no se toma el candado
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pla:' || new.negocio_id::text, 0));
  if (select count(*) from public.platos p where p.negocio_id = new.negocio_id) >= 500 then
    raise exception 'Un negocio puede tener como máximo 500 platos en total.' using errcode = '23514';
  end if;
  if (select count(*) from public.platos p where p.categoria_id = new.categoria_id) >= 200 then
    raise exception 'Una categoría puede tener como máximo 200 platos por categoría.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists platos_limite on public.platos;
create trigger platos_limite
  before insert on public.platos
  for each row execute function public.limitar_platos();

-- Al MOVER un plato a otra categoria tambien se respeta el tope de 200 por categoria.
create or replace function public.limitar_platos_mover()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.categoria_id is not distinct from old.categoria_id then
    return new;
  end if;
  if current_user in ('anon', 'authenticated')
     and not (public.es_miembro(new.negocio_id) or public.es_admin()) then
    return new;   -- la RLS lo rechazara
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('pla:' || new.negocio_id::text, 0));
  if (select count(*) from public.platos p where p.categoria_id = new.categoria_id) >= 200 then
    raise exception 'Una categoría puede tener como máximo 200 platos por categoría.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists platos_limite_mover on public.platos;
create trigger platos_limite_mover
  before update of categoria_id on public.platos
  for each row execute function public.limitar_platos_mover();


-- ---------------------------------------------------------------------
-- G. Permisos de ejecucion de las funciones de esta migracion
--    (Supabase concede EXECUTE a anon/authenticated/service_role por defecto
--    en funciones nuevas; por eso todo se revoca de forma explicita.)
--    - Funciones de trigger: nadie necesita llamarlas a mano.
--    - Funciones de validacion (las usan los CHECK): solo usuarios con sesion y service_role.
-- ---------------------------------------------------------------------
revoke all on function public.tocar_actualizado()      from public, anon, authenticated;
revoke all on function public.limitar_categorias()     from public, anon, authenticated;
revoke all on function public.limitar_platos()         from public, anon, authenticated;
revoke all on function public.limitar_platos_mover()   from public, anon, authenticated;

revoke all on function public.lista_textos_valida(text[], int, int) from public, anon;
revoke all on function public.horario_valido(jsonb)                 from public, anon;
revoke all on function public.ruta_foto_valida(text, uuid)          from public, anon;
grant execute on function public.lista_textos_valida(text[], int, int) to authenticated, service_role;
grant execute on function public.horario_valido(jsonb)                 to authenticated, service_role;
grant execute on function public.ruta_foto_valida(text, uuid)          to authenticated, service_role;


-- ---------------------------------------------------------------------
-- H. Cerrar la puerta YA: sin ventana sin RLS entre esta migracion y la 3.
--    RLS activada sin politicas = nadie (salvo el rol postgres) ve nada, y se
--    quitan los permisos por defecto. La migracion 3 concede despues lo justo.
-- ---------------------------------------------------------------------
alter table public.negocios        enable row level security;
alter table public.categorias      enable row level security;
alter table public.platos          enable row level security;
alter table public.miembros        enable row level security;
alter table public.administradores enable row level security;

revoke all on table public.negocios, public.categorias, public.platos,
                    public.miembros, public.administradores
  from public, anon, authenticated;
