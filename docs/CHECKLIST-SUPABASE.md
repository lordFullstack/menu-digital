# Lista de ajustes en Supabase y Vercel (antes de publicar el panel)

> Para Jorge. Sale de la revisión de Seguridad final (ADM-006, 2026-11-10). Proyecto de Supabase: **menu-digital**.
> Los **P0** son obligatorios antes de publicar. Marca cada casilla cuando lo hagas.

## P0 — Antes de publicar

- [ ] **Apagar el registro libre.** Supabase → *Authentication* → *Sign In / Providers* → apaga **"Allow new users to sign up"**.
  Por qué: aunque el panel no tiene botón de registro, cualquiera podría crear una cuenta llamando directo a Supabase.
- [ ] **Apagar los inicios anónimos.** Misma pantalla → apaga **"Allow anonymous sign-ins"**. Deja solo **Email**; Phone y los demás proveedores, apagados.
- [ ] **Confirmar correo encendido.** Dentro de **Email** → deja **"Confirm email"** encendido.
- [ ] **Direcciones permitidas.** *Authentication* → *URL Configuration*:
  - **Site URL:** la dirección exacta del menú en Vercel (por ejemplo `https://menu-digital-blue.vercel.app`).
  - **Redirect URLs:** solo `https://menu-digital-blue.vercel.app/admin`.
  - **No** pongas `https://*.vercel.app`: dejaría que la página de cualquier otro usuario de Vercel reciba tu enlace de recuperar contraseña.
- [ ] **Correo propio para "Olvidé mi contraseña".** *Authentication* → *Emails* → *SMTP Settings*: conecta un servicio de correo (Resend, Brevo…). Sin esto, el correo de Supabase solo llega a miembros de tu equipo y con muy pocos envíos por hora.
- [ ] **Variables en Vercel.** (Esto lo puedo hacer yo con tu visto bueno.) Vercel → proyecto *menu-digital* → *Settings* → *Environment Variables*, para Production:
  - `VITE_SUPABASE_URL` = `https://smiskzilpnvsbqwtmbwz.supabase.co`
  - `VITE_SUPABASE_CLAVE` = la clave **publicable** (`sb_publishable_…`). **Nunca** la `service_role` / secreta.

## P1 — El mismo día

- [ ] **Contraseñas más largas.** *Sign In / Providers* → *Email* → **Minimum password length**: 10 a 12.
- [ ] **Tu cuenta de administrador.** *Authentication* → *Users* → *Add user* → *Create new user*: tu correo, contraseña larga y única, marca **"Auto Confirm User"**. Después avísame y te doy la línea exacta para el *SQL Editor* que te vuelve administrador (necesito el id del usuario, no tu contraseña).
- [ ] **Revisar límites de intentos.** *Authentication* → *Rate Limits*: los valores por defecto sirven; no los subas.
- [ ] **Carpeta de fotos.** *Storage* → *Buckets* → **fotos**: Public = sí, 2 MB, tipos `image/jpeg, image/png, image/webp`. En *Storage* → *Policies* solo deben estar las 4 reglas `fotos_*_dueno_admin`.
- [ ] **Revisor de seguridad.** *Database* → *Advisors* → *Security Advisor*: no debe salir nada en rojo. Los 4 avisos amarillos de funciones "SECURITY DEFINER" son intencionales y están probados.

## P2 — Cuando puedas

- [ ] **Tiempo de sesión.** *Authentication* → *Sessions*: límite por inactividad (según tu plan).
- [ ] **Llaves viejas.** *Project Settings* → *API Keys*: si todo usa la clave publicable, desactiva las llaves *legacy* `anon` y `service_role`. Si la `service_role` alguna vez se pegó en un chat o un archivo, rótala.

## No hacer (todavía)

- **No actives CAPTCHA** (*Authentication* → *Attack Protection*): el panel no lo soporta y nadie podría entrar.
- **No cuentes con verificación en dos pasos (MFA):** el panel aún no tiene la pantalla para pedir el código. Mientras tanto, contraseña larga y única para tu cuenta de administrador. Queda como mejora futura.

## Privacidad (para contarle a cada dueño)
WhatsApp, dirección y redes del negocio son **públicos** en su menú. Si el negocio está a nombre de una persona natural, que lo sepa (Ley 1581 de protección de datos). Los correos de los dueños no aparecen ni en el menú ni en el panel.
