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
| ADM-001 | Migraciones: tablas, RLS, funciones, storage | backend | IN_PROGRESS | 0 | Solo escribe archivos; las aplica el Coordinador tras ADM-002 |
| ADM-002 | Seguridad revisa permisos antes de aplicar | security | BACKLOG | 0 | puede bloquear |
| ADM-003 | Login y pantallas del panel `/admin` | frontend | BACKLOG | 0 | |
| ADM-004 | Menú público por negocio leyendo de Supabase | frontend | BACKLOG | 0 | |
| ADM-005 | QA (incluye "dueño A no toca a dueño B") | qa | BACKLOG | 0 | |
| ADM-006 | Seguridad final | security | BACKLOG | 0 | |
| ADM-007 | Publicación | devops | ESPERA_JORGE | 0 | requiere visto bueno explícito |

## Esperando a Jorge (Fase 2)
- Desactivar el registro público en el panel de Supabase (Authentication → Sign In / Providers) y crear su propio usuario administrador. Se le darán los pasos cuando las tablas estén aplicadas.
