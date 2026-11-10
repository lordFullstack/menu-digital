# Base de datos (Supabase) del panel de administración

Especificación: `docs/equipo/CONTRATO-ADMIN.md`. Estado: migraciones escritas, **no aplicadas ni verificadas**.
Las aplica el Coordinador después de la revisión de Seguridad. Nunca poner claves secretas en el repo.

## Orden de aplicación
1. `migrations/20261110170000_esquema.sql` — tablas, reglas, límites.
2. `migrations/20261110170100_funciones.sql` — `es_admin`, `es_miembro`, `menu_publico`, `mis_negocios`, `asignar_dueno`, `quitar_dueno`.
3. `migrations/20261110170200_rls.sql` — seguridad por filas y permisos. Aborta si el rol no puede saltarse RLS (ver el comentario al inicio del archivo).
4. `migrations/20261110170300_storage.sql` — bucket `fotos` y sus políticas.
5. `pruebas/permisos.sql` — ejecutar como `postgres`, es UN solo bloque `DO`. Siempre termina con una excepción
   (que deshace todo, no deja datos) cuyo mensaje es el resumen: `PRUEBAS total=N ok=N fallan=N omitidas=N` y la lista de las que fallan.
   Correcto = `fallan=0`. Es normal ver "ERROR" en el cliente: es la forma de devolver el informe.

## Crear el primer administrador (Jorge)
1. En el panel de Supabase: Authentication → Users → "Add user" → "Create new user" (correo y contraseña propios; no se comparten por chat).
   Marcar **"Auto Confirm User"**: `asignar_dueno` solo acepta cuentas con correo confirmado.
2. Copiar el UUID del usuario y ejecutar en el SQL Editor:

```sql
insert into public.administradores (user_id) values ('<UUID_DEL_USUARIO>');
```
3. Recomendado: activar **MFA (TOTP)** para la cuenta de administrador, porque puede crear, borrar y reasignar todos los negocios.

## Desactivar el registro público
Panel de Supabase → Authentication → Sign In / Providers (o "Settings") → desactivar **"Allow new users to sign up"**
y desactivar **"Allow anonymous sign-ins"**. Así solo Jorge crea usuarios.

Cómo comprobar que quedó desactivado (no deja datos si falla; usa la clave publicable, que es pública):
```
curl -s -X POST "https://smiskzilpnvsbqwtmbwz.supabase.co/auth/v1/signup" \
  -H "apikey: <CLAVE_PUBLICABLE>" -H "Content-Type: application/json" \
  -d '{"email":"prueba-registro@ejemplo.invalid","password":"Cambiar-Esto-123!"}'
```
Debe responder un error (p. ej. `signup_disabled`, HTTP 422). Y lo mismo con `POST /auth/v1/signup` con cuerpo `{}` (inicio anónimo): debe rechazarse.
Si responde con un usuario creado, el registro sigue abierto: borrar ese usuario desde el panel.

## Plan de reversión (ejecutar en orden inverso: 4, 3, 2, 1)

**Revertir 4 (storage):**
```sql
drop policy if exists fotos_select_dueno_admin on storage.objects;
drop policy if exists fotos_insert_dueno_admin on storage.objects;
drop policy if exists fotos_update_dueno_admin on storage.objects;
drop policy if exists fotos_delete_dueno_admin on storage.objects;
drop function if exists public.negocio_de_ruta(text);
-- El bucket: vaciarlo desde el panel (Storage) y luego borrarlo desde allí;
-- Supabase no permite borrar objetos/buckets con DELETE directo en SQL.
```

**Revertir 3 (RLS):**
```sql
drop trigger if exists negocios_proteger on public.negocios;
drop function if exists public.proteger_negocio();
drop policy if exists negocios_select_anon on public.negocios;
drop policy if exists negocios_select_auth on public.negocios;
drop policy if exists negocios_insert_admin on public.negocios;
drop policy if exists negocios_update_auth on public.negocios;
drop policy if exists negocios_delete_admin on public.negocios;
drop policy if exists categorias_select_anon on public.categorias;
drop policy if exists categorias_select_auth on public.categorias;
drop policy if exists categorias_insert_auth on public.categorias;
drop policy if exists categorias_update_auth on public.categorias;
drop policy if exists categorias_delete_auth on public.categorias;
drop policy if exists platos_select_anon on public.platos;
drop policy if exists platos_select_auth on public.platos;
drop policy if exists platos_insert_auth on public.platos;
drop policy if exists platos_update_auth on public.platos;
drop policy if exists platos_delete_auth on public.platos;
drop policy if exists miembros_select_auth on public.miembros;
drop policy if exists administradores_select_auth on public.administradores;
alter table public.negocios, public.categorias, public.platos, public.miembros, public.administradores no force row level security;
alter table public.negocios, public.categorias, public.platos, public.miembros, public.administradores disable row level security;
-- (Los permisos de tabla ya quedan restrictivos; si se vuelve a abrir RLS, revisar los grants.)
```
Cuidado: con RLS desactivada y los grants de lectura de `anon`, los negocios NO publicados serían legibles. Mejor dejar RLS activa y revertir solo lo que haga falta.

**Revertir 2 (funciones):**
```sql
drop function if exists public.menu_publico(text);
drop function if exists public.mis_negocios();
drop function if exists public.asignar_dueno(uuid, text);
drop function if exists public.quitar_dueno(uuid, uuid);
drop function if exists public.es_miembro(uuid);
drop function if exists public.es_admin();
```
(Si se revierten antes que 3/4, las políticas que las usan lo impedirán: por eso el orden inverso.)

**Revertir 1 (esquema) — BORRA TODOS LOS DATOS del panel:**
```sql
drop table if exists public.platos cascade;
drop table if exists public.categorias cascade;
drop table if exists public.miembros cascade;
drop table if exists public.administradores cascade;
drop table if exists public.negocios cascade;
drop function if exists public.limitar_platos_mover();
drop function if exists public.limitar_platos();
drop function if exists public.limitar_categorias();
drop function if exists public.tocar_actualizado();
drop function if exists public.ruta_foto_valida(text, uuid);
drop function if exists public.horario_valido(jsonb);
drop function if exists public.lista_textos_valida(text[], int, int);
```
Antes de revertir 1: respaldar (`pg_dump` o exportar tablas desde el panel).
