# Estado del equipo

> Bitácora viva. El Coordinador la lee al empezar cada sesión y la actualiza en cada cambio de estado. Sin secretos.

- **Última actualización:** 2026-11-10 10:30 (America/Bogota)
- **Encargo activo:** ENC-MENU-01 — Menú digital con animaciones de scroll y tema 60-30-10 (versión estática)
- **Modo:** Equipo
- **Autonomía:** A1 (construir y probar en local; nada se publica sin el sí de Jorge)
- **Jorge disponible:** sí
- **Fase del método:** 7 Revisar y desplegar

## Tareas

| ID | Título | Dueño | Estado | Rondas de revisión | Nota |
|---|---|---|---|---|---|
| MENU-000 | Repo, andamio Vite y contrato compartido | Coordinador | IN_PROGRESS | 0 | `docs/equipo/CONTRATO.md` |
| MENU-001 | Motor de colores 60-30-10 + contraste + 4 plantillas | frontend | DEPLOYED | 0 | Coordinador verificó: tsc 0 errores, 88 pruebas en verde (junto con 002). Falta QA independiente |
| MENU-002 | Tipos, validación y datos de muestra | backend | DEPLOYED | 0 | Ídem. `cargarDatos` sin prueba automática. "Abierto ahora" usa hora de Colombia (aceptado) |
| MENU-003 | Las 6 pantallas con datos de muestra | frontend | DEPLOYED | 0 | Coordinador verificó: tsc, 88 pruebas, build, greps de seguridad/colores, vista 375 px sin errores. Sin verificar: estado de error, imagen rota, agotado, teclado, 768 px |
| MENU-003b | Arreglo de la pastilla activa de la barra | frontend | DEPLOYED | 0 | Bug hallado por MENU-004. Informe: 20/20. Solo `src/ui/barra.ts` |
| MENU-004 | Animaciones de scroll con GSAP | frontend | DEPLOYED | 0 | Coordinador: tsc, 88 pruebas, build ok (chunk aparte 46 kB gzip). Pin de vitrina NO confirmado por el Coordinador (pestaña en segundo plano): punto obligatorio de QA |
| MENU-005 | PWA sin internet + QR | frontend | DEPLOYED | 0 | Coordinador: build genera sw.js con 32 archivos; QR rechaza javascript: y http:. Offline solo según informe |
| MENU-006 | Pruebas en celular, rendimiento, accesibilidad | qa | DEPLOYED | 1 | REQUEST_CHANGES: 9/11 bloques pasan. Falla: tocar la foto no abre detalle (ALTO), CLS 1.82 por el pin (MEDIO). Vitrina, offline, XSS, teclado y contraste: PASAN |
| MENU-007 | Revisión de seguridad (XSS, enlaces, CSP) | security | DEPLOYED | 1 | REQUEST_CHANGES: sin críticos ni altos; medios y bajos en MENU-009 |
| MENU-009 | Ronda de corrección QA + Seguridad (15 puntos) | fullstack | DEPLOYED | 1 | 15/15 según informe. Coordinador verificó 2026-11-10: tsc 0, 93 pruebas, build, greps, vercel.json válido, CSP estricta en dist. CLS reportado 1.85 → 0 con `pinType: 'transform'` |
| MENU-010 | Re-prueba QA enfocada (8 puntos) | qa | APPROVED | 1 | APPROVE en los 8 puntos (2026-11-10): foto abre detalle, CLS 0.04 / 0.0004, pin, CSP, errores, teclado, offline, 4 plantillas |
| MENU-008 | Publicación en GitHub Pages | devops | DEPLOYED | 0 | Vercel, 2026-11-10. https://menu-digital-blue.vercel.app · repo público github.com/lordFullstack/menu-digital · commit 26df794. Verificado: 200 en todos los archivos, cabeceras de seguridad, SW activo, 30 tarjetas, detalle abre, consola limpia |

Estados: `BACKLOG → READY → IN_PROGRESS → REVIEW → QA → APPROVED → DEPLOYED` · excepción: `BLOCKED`, `REJECTED`, `ROLLED_BACK`, `ESPERA_JORGE`.

## Esperando a Jorge

| Tarea | Pregunta exacta | Opción recomendada | Avisado (push/WhatsApp) |
|---|---|---|---|
| — | Fotos reales de platos y datos de un negocio piloto | Mandarlas cuando haya piloto | no |

## Hallazgos abiertos para la ronda de corrección

- Seguridad MENU-007 (REQUEST_CHANGES, sin críticos ni altos): fotos solo locales + `img-src 'self'` + meta referrer; lista blanca de hosts en redes/mapa; CSP estricta; SW: guardar solo HTML de la raíz, quitar caché de imágenes externas, plan de rescate; `replace` con función en vite.config; precio con tope; tope total de platos; `.gitignore` con `.env*` y `.playwright-mcp/`.
- Jorge (captura 2026-11-09): tarjeta de la vitrina cortada a mitad de pantalla. Causa: `overflow-x: clip` en la pista que se desliza. Corregido por el Coordinador en `src/animaciones/animaciones.css` (el recorte pasó a la sección). Verificado a 900x800: recorte en el borde de la pantalla, última tarjeta completa, sin scroll horizontal. Falta re-prueba de QA en 375.

## Bloqueos

- Ninguno.

## Descripción de UI pendiente de aprobación

- Ninguna. El diseño de las 6 pantallas fue aprobado por Jorge el 2026-11-09.

## Historial resumido

- 2026-11-10 (noche): Registro libre apagado y direcciones permitidas puestas por Jorge en Supabase (verificado desde afuera). Fase 2 publicada en https://menu-digital-blue.vercel.app (panel en /admin). Pendiente: prueba guiada con la cuenta real, SMTP propio (Olvidé mi contraseña), primer negocio piloto con fotos reales, MFA para el admin (mejora futura), 4 avisos intencionales del Advisor.
- 2026-11-10: Jorge creó su usuario (lord.fullstack@gmail.com, confirmado) en el proyecto nuevo y pidió explícitamente el rol de administrador; se insertó en public.administradores (id 377a70e7-…). Verificado con sesión simulada. Pendiente: P0 de Supabase (registro libre sigue abierto), variables en Vercel, subir a GitHub, prueba guiada.
- 2026-11-10 (tarde): Jorge no pudo entrar a la cuenta de Supabase de bebidas (correo sin acceso). Se migró a la cuenta jgc.labsagentics: proyecto nuevo menu-digital (smiskzilpnvsbqwtmbwz), 4 migraciones aplicadas y pruebas de permisos 180/180 en la base nueva; dirección actualizada en código, CSP y docs. Pendiente: P0 en Supabase (cuenta nueva), crear admin, publicar.
- 2026-11-10: Ronda de corrección (15 puntos) + re-prueba QA APPROVE. Jorge pidió push y despliegue y eligió repo público. Publicado en Vercel. Pendiente: fotos y datos reales de un negocio piloto; prueba en celular real; Fase 2 (panel con Supabase).
- 2026-11-09: Jorge aprueba el diseño y el arranque de la versión estática. Se crea el repo `menu-digital` (aparte de `cuadrao`). Fase 2 (panel con Supabase) queda fuera de este encargo.

---

# Fase 2 — Panel de administración (encargo ENC-MENU-02)

- **Aprobado por Jorge:** 2026-11-10 ("Sí, constrúyelo"), incluido crear el proyecto de Supabase a $0/mes.
- **Modo:** Equipo · **Autonomía:** A1 · **Fase del método:** 5 Construir
- **Supabase:** proyecto `menu-digital` (ref `euidxtsjtstukvrwcgwm`), creado 2026-11-10. El proyecto `bebidas-caribena` NO se toca.
- **Contrato:** `docs/equipo/CONTRATO-ADMIN.md`

| ID | Título | Dueño | Estado | Rondas | Nota |
|---|---|---|---|---|---|
| ADM-000 | Proyecto Supabase + contrato de datos y permisos | Coordinador | APPROVED | 0 | |
| ADM-001 | Migraciones: tablas, RLS, funciones, storage | backend | APPROVED | 1 | Aplicadas 2026-11-10 (4 migraciones). Pruebas de permisos en la base real: 180/180 (la 004 era un error del guion, corregida) |
| ADM-002 | Seguridad revisa permisos antes de aplicar | security | APPROVED | 1 | REQUEST_CHANGES (0 críticos/altos) → corregido en ronda 1. Avisos del revisor de Supabase: 4 funciones definer ejecutables por usuarios con sesión, INTENCIONAL y probado |
| ADM-003 | Login y pantallas del panel `/admin` | frontend | APPROVED | 1 | Ronda 1 (6 puntos QA+Seguridad) corregida 2026-11-10. Coordinador: tsc 0, 127 pruebas, build, greps limpios. Aviso de sesión expirada verificado en navegador por el implementador (401 simulado). Pantallas con sesión REAL sin probar: prueba guiada con Jorge |
| ADM-004 | Menú público por negocio leyendo de Supabase | frontend | APPROVED | 0 | Entregado 2026-11-10: 121 pruebas, rutas /<slug> probadas contra Supabase real (base vacía). Build completo pendiente de ADM-003. Incidente: el agente hizo git stash/pop unos segundos con ADM-003 activo; stash vacío, archivos del panel presentes, se avisó a ADM-003 para revisar |
| ADM-005 | QA (incluye "dueño A no toca a dueño B") | qa | APPROVED | 1 | REQUEST_CHANGES 2026-11-10: ~110 comprobaciones con Supabase simulado; 1 MEDIO (aviso de sesión expirada desaparece), bajos de rutas en preview (no aplican en Vercel). SW activado en Chromium con CSP estricta. Corrección en ronda 1 de ADM-003 |
| ADM-006 | Seguridad final | security | APPROVED | 0 | APPROVE 2026-11-10 condicionado a P0 de docs/CHECKLIST-SUPABASE.md. 0 críticos/altos. MEDIO aceptado: sin MFA en el panel. 4 BAJOS a corregir con la ronda de QA |
| ADM-007 | Publicación | devops | DEPLOYED | 0 | 2026-11-10: Jorge aprobó ("Sí, publica"). Variables VITE_SUPABASE_* en Vercel (Production), push de 4 commits, despliegue dpl_GFierpsp READY (commit 84330a0). Verificado en vivo: 200 en /, /admin, /<slug>, sw, manifest; CSP con la base nueva; /admin noindex; panel fuera del precache; consola limpia. Rollback: dpl_5yuYhByR (v1) |

## Esperando a Jorge (Fase 2)
- Hacer los P0 de docs/CHECKLIST-SUPABASE.md (registro apagado, anónimos apagados, Site URL/Redirect, SMTP) y crear su usuario administrador.
- Visto bueno para publicar (ADM-007): poner variables en Vercel y subir a GitHub (publica solo).
- Prueba guiada del panel con su cuenta real.
