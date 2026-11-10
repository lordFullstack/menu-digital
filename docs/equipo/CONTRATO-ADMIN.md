# Contrato Fase 2 — Panel de administración (Supabase)

> Lo decide el Coordinador. Ningún agente lo cambia por su cuenta. Complementa a `CONTRATO.md` (sigue vigente todo lo de la v1).

## Entorno
- Supabase proyecto `menu-digital`, ref `smiskzilpnvsbqwtmbwz`, región us-east-1, Postgres 17. URL: `https://smiskzilpnvsbqwtmbwz.supabase.co`.
- El cliente usa SOLO la clave publicable (pública por diseño). La clave `service_role` / secreta NUNCA entra al repo, al navegador, a prompts ni a logs.
- Las migraciones viven en `supabase/migrations/*.sql` (una por cambio, idempotentes donde se pueda). Las aplica el Coordinador, no los agentes.
- Altas de usuarios: registro público DESACTIVADO. Jorge crea al usuario en el panel de Supabase y luego lo asigna a un negocio desde `/admin`.

## Roles
| Rol | Quién | Puede |
|---|---|---|
| anónimo | cliente del restaurante | leer menús con `publicado = true` |
| dueño | fila en `miembros` | leer y editar SOLO su(s) negocio(s): datos, tema, categorías, platos, fotos. No puede cambiar `slug`, ni crear/borrar negocios, ni tocar `miembros` |
| administrador | fila en `administradores` (Jorge) | todo lo anterior en cualquier negocio + crear/borrar negocios, cambiar `slug`, asignar/quitar dueños |

## Tablas (esquema `public`, todas con RLS activado y forzado)
```
negocios(
  id uuid pk default gen_random_uuid(),
  slug text unique not null,          -- ^[a-z0-9]+(-[a-z0-9]+)*$ , 3..40, no reservado
  nombre text not null,               -- 1..80
  eslogan text,                       -- <= 120
  logo_ruta text, portada_ruta text,  -- ruta dentro del bucket 'fotos' (nunca URL)
  moneda text not null default 'COP' check (moneda = 'COP'),
  whatsapp text,                      -- ^[0-9]{8,15}$
  direccion text,                     -- <= 200
  mapa_url text, instagram text, facebook text, tiktok text,  -- https://, <= 300 (lista blanca se valida en cliente Y con check de prefijo https://)
  horario jsonb not null default '[]',-- [{dias:int[0..6], abre:'HH:MM', cierra:'HH:MM'}], <= 14 franjas (validado por función)
  color_fondo text not null, color_superficie text not null, color_acento text not null, -- ^#[0-9A-Fa-f]{6}$
  tipografia text not null default 'clasica' check in ('clasica','moderna','calida'),
  publicado boolean not null default false,
  creado timestamptz default now(), actualizado timestamptz default now()
)
categorias(id uuid pk, negocio_id fk -> negocios on delete cascade, nombre text 1..80, orden int not null default 0)
platos(
  id uuid pk, negocio_id fk -> negocios on delete cascade, categoria_id fk -> categorias on delete cascade,
  nombre text 1..80, descripcion text <= 300, precio int check (0..10000000),
  foto_ruta text, etiquetas text[] (subconjunto de vegano, vegetariano, picante, sin-gluten, nuevo),
  ingredientes text[] (<= 30 de <= 60), alergenos text[] (<= 30 de <= 60),
  recomendado boolean default false, agotado boolean default false, orden int default 0
)
miembros(negocio_id fk cascade, user_id uuid fk -> auth.users on delete cascade, pk(negocio_id, user_id), creado)
administradores(user_id uuid pk fk -> auth.users on delete cascade)
```
Slugs reservados: `admin, assets, datos, img, iconos, api, sw, manifest, index, login`.
Límites: 30 categorías y 500 platos por negocio (trigger). `platos.negocio_id` debe coincidir con el de su categoría (trigger o FK compuesta).
Índices en todas las FK y en lo que usen las políticas.

## Funciones
- `es_admin() returns boolean` y `es_miembro(negocio uuid) returns boolean`: `security definer`, `stable`, `set search_path = ''`, sin parámetros que permitan consultar a otro usuario (usan `auth.uid()`); `revoke all from public, anon` y `grant execute` solo a `authenticated`.
- `menu_publico(p_slug text) returns jsonb`: `security invoker`, `stable`. Devuelve `null` si no existe o no está publicado; si existe, `{ "menu": <forma Menu de tipos.ts>, "tema": <forma Tema> }` con categorías y platos ordenados por `orden`, y `foto/logo/portada` como RUTA de storage (el cliente arma la URL). `grant execute` a `anon, authenticated`.
- `asignar_dueno(p_negocio uuid, p_correo text) returns void` y `quitar_dueno(p_negocio uuid, p_usuario uuid)`: `security definer`, verifican `es_admin()` adentro y fallan con excepción si no; no devuelven datos de `auth.users` (no filtrar si un correo existe: mismo mensaje genérico).
- `mis_negocios() returns setof negocios` (invoker) para el panel.

## Políticas RLS (resumen exigible)
| Tabla | select | insert | update | delete |
|---|---|---|---|---|
| negocios | `publicado` (anon+auth) o `es_miembro(id)` o `es_admin()` | solo admin | miembro o admin; `slug` solo admin (privilegio de columna o trigger) | solo admin |
| categorias, platos | negocio publicado, o miembro, o admin | miembro o admin | miembro o admin (`with check` igual que `using`: no se puede mover una fila a otro negocio) | miembro o admin |
| miembros | solo las propias (`user_id = auth.uid()`) o admin | ninguna directa (solo vía `asignar_dueno`) | ninguna | ninguna directa (solo vía `quitar_dueno`) |
| administradores | solo la propia | ninguna | ninguna | ninguna |

`anon` no tiene `insert/update/delete` en nada. Sin `grant` amplios: revocar y conceder lo justo.

## Storage
- Bucket `fotos`: público de lectura, `file_size_limit` 2 MB, `allowed_mime_types` `image/jpeg, image/png, image/webp` (SVG prohibido).
- Ruta obligatoria: `<negocio_id>/<uuid>.<ext>`. Políticas en `storage.objects`: insert/update/delete solo si `bucket_id = 'fotos'` y `es_miembro(((storage.foldername(name))[1])::uuid)` o `es_admin()`. Sin listado para anon.

## Frontend
- `@supabase/supabase-js` por npm. Cliente en `src/supabase/cliente.ts` con URL y clave publicable desde `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_CLAVE` (archivo `.env` local ignorado por git + variables en Vercel). `.env.example` sí va al repo, sin valores reales salvo la URL.
- Panel: segunda entrada de Vite `admin.html` → `/admin`. Carpeta `src/admin/**`. Mismo motor de tema y mismas reglas (sin innerHTML, sin colores literales, textContent).
- Menú público por negocio: `/<slug>` (rewrite en `vercel.json` a `index.html`). Sin slug → menú de muestra estático actual. Todo lo que llega de Supabase pasa por `validarMenu` / `validarTema` antes de pintarse.
- Fotos de Supabase: se aceptan SOLO URLs que empiecen exactamente por `https://smiskzilpnvsbqwtmbwz.supabase.co/storage/v1/object/public/fotos/` armadas por el cliente a partir de la ruta; las rutas locales siguen valiendo para la muestra.
- CSP: añadir ese origen exacto a `connect-src` e `img-src` (meta y `vercel.json`). Nada de comodines.
- El panel comprime la foto en el navegador (lado mayor ≤ 1600 px, WebP o JPEG, ≤ 2 MB) antes de subirla.
