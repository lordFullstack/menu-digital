# Contrato compartido — Menú Digital (v1 estática)

> Lo decide el Coordinador. Ningún agente lo cambia por su cuenta: si hace falta un cambio, se reporta en el informe.

## Stack
- Vite + TypeScript, sin framework. `gsap` (con ScrollTrigger) instalado por npm y empaquetado, para que funcione sin internet.
- Fuentes empaquetadas con `@fontsource*` (nada de Google Fonts por red).
- Sin backend. Datos en `public/datos/menu.json` y `public/datos/tema.json`.
- Publicación futura en GitHub Pages: `base: './'` en Vite, todas las rutas relativas.

## Dueños de carpetas (nadie edita fuera de la suya)
| Carpeta / archivo | Tarea |
|---|---|
| `src/tema/**` | MENU-001 |
| `src/datos/**`, `public/datos/**`, `public/img/**` | MENU-002 |
| `src/ui/**`, `src/estilos/**`, `src/main.ts`, `index.html` | MENU-003 |
| `src/animaciones/**` | MENU-004 |
| `public/sw.js`, `public/manifest.webmanifest`, `public/iconos/**`, `src/pwa/**` | MENU-005 |

## Datos (`src/datos/tipos.ts`)
```ts
export type Etiqueta = 'vegano' | 'vegetariano' | 'picante' | 'sin-gluten' | 'nuevo';
export type ParTipografico = 'clasica' | 'moderna' | 'calida';
export type IdPlantilla = 'cafeteria' | 'elegante' | 'heladeria' | 'rapida';

export interface Tema {
  version: 1;
  plantilla?: IdPlantilla;
  colores: { fondo: string; superficie: string; acento: string }; // #RRGGBB
  tipografia: ParTipografico;
}

export interface Franja { dias: number[]; abre: string; cierra: string } // dias 0=domingo..6; 'HH:MM' 24h

export interface Plato {
  id: string; nombre: string; descripcion?: string;
  precio: number;            // entero, en la moneda del negocio
  foto?: string;             // ruta relativa (img/...) o https://
  etiquetas?: Etiqueta[];
  ingredientes?: string[]; alergenos?: string[];
  recomendado?: boolean; agotado?: boolean;
}
export interface Categoria { id: string; nombre: string; platos: Plato[] }

export interface Negocio {
  nombre: string; eslogan?: string;
  logo?: string; portada?: string;       // ruta relativa o https://
  moneda: 'COP';
  whatsapp?: string;                      // solo dígitos con indicativo, ej. 573001234567
  direccion?: string; mapaUrl?: string;   // https://
  redes?: { instagram?: string; facebook?: string; tiktok?: string }; // https://
  horario: Franja[];
}
export interface Menu { version: 1; negocio: Negocio; categorias: Categoria[] }
```

API de `src/datos/index.ts`:
```ts
export function validarMenu(x: unknown): { ok: true; menu: Menu } | { ok: false; errores: string[] };
export function validarTema(x: unknown): { ok: true; tema: Tema } | { ok: false; errores: string[] };
export async function cargarDatos(): Promise<{ menu: Menu; tema: Tema }>; // fetch de ./datos/*.json + validación; lanza Error legible si falla
export function estaAbierto(horario: Franja[], ahora?: Date): boolean;
export function formatearPrecio(n: number, moneda: 'COP'): string;        // "$ 18.000"
export function enlaceWhatsApp(numero: string, texto: string): string | null; // https://wa.me/<dígitos>?text=<codificado>
export function urlSegura(u: string | undefined): string | null;          // solo https:// o ruta relativa sin "..", sin esquema
```

## Tema (`src/tema/index.ts`)
```ts
export const PLANTILLAS: Record<IdPlantilla, Tema>;
export function generarPaleta(colores: Tema['colores']): Record<string, string>; // nombre de variable CSS -> valor
export function aplicarTema(tema: Tema, raiz?: HTMLElement): { ajustes: string[] }; // escribe las variables; 'ajustes' = avisos de contraste corregido
export function contraste(a: string, b: string): number; // razón WCAG 2.x
```

### Variables CSS (única fuente de color de toda la UI)
| Variable | Uso | Regla |
|---|---|---|
| `--c-fondo` | 60 %: fondo de página | color elegido |
| `--c-fondo-2` | bandas alternas, hover | derivado |
| `--c-sobre-fondo` | texto principal sobre fondo | ≥ 7:1 |
| `--c-sobre-fondo-suave` | texto secundario sobre fondo | ≥ 4.5:1 |
| `--c-superficie` | 30 %: tarjetas, barra de categorías, pie | color elegido |
| `--c-superficie-2` | variante de superficie | derivado |
| `--c-sobre-superficie` | texto sobre superficie | ≥ 7:1 |
| `--c-sobre-superficie-suave` | texto secundario sobre superficie | ≥ 4.5:1 |
| `--c-acento` | 10 %: relleno de botón principal, categoría activa | color elegido |
| `--c-sobre-acento` | texto sobre acento | ≥ 4.5:1 |
| `--c-acento-en-fondo` | acento usado como texto sobre fondo | ajustado hasta ≥ 4.5:1 |
| `--c-acento-en-superficie` | acento como texto (precios) sobre superficie | ajustado hasta ≥ 4.5:1 |
| `--c-borde` | líneas divisorias | derivado |
| `--f-titulos`, `--f-texto` | familias tipográficas | según par elegido |

**Decisión 2026-11-09 (Coordinador, a raíz de MENU-001):** donde la tabla dice "≥ 7:1" se entiende "7:1 o el máximo alcanzable con blanco/negro, nunca menos de 4.5:1 (WCAG AA)". Con fondos de luminancia media (p. ej. superficie `#2F6F62` de heladería → 5.88:1) el 7:1 es matemáticamente imposible. Los colores elegidos por el dueño no se alteran; el caso se reporta en `ajustes`.

La UI muestra los `ajustes` como nota informativa tranquila, no como error.

La UI **no** usa colores literales (ni `#hex` ni `rgb()`), salvo transparencias sobre estas variables con `color-mix()`.

## Reglas de seguridad (aplican a todos)
- Todo texto que venga de los JSON se pinta con `textContent` / `createElement`. Prohibido `innerHTML`, `insertAdjacentHTML`, `document.write` y `eval` con datos.
- Fotos (`foto`, `logo`, `portada`) solo locales en v1: ruta relativa dentro de `img/` (`rutaLocalSegura()`; rechaza también `https://`). La UI usa la misma función al crear la imagen.
- Enlaces (`redes.*`, `mapaUrl`): siempre `https`, con lista blanca de sitios (`enlacePermitido()`): instagram.com; facebook.com / fb.com / fb.me; tiktok.com; mapas: google.com (ruta `/maps`), maps.google.com, maps.app.goo.gl, goo.gl (ruta `/maps`), waze.com, openstreetmap.org. Se acepta `www.`/subdominios (nombre exacto o sufijo con punto). `urlSegura()` no cambia. Enlaces externos con `rel="noopener noreferrer"`.
- Límites: precio entero seguro entre 0 y 10.000.000; máximo 500 platos en total; nombres recortados a 80 letras en los mensajes de error.
- WhatsApp solo vía `enlaceWhatsApp()`.
- CSP de producción (meta en `index.html` y cabecera en `vercel.json`, que añade `frame-ancestors 'none'`): `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; upgrade-insecure-requests`. Solo en `vite` (desarrollo) el plugin `csp-desarrollo` de `vite.config.ts` la relaja (style inline, ws:, worker blob:). Además `<meta name="referrer" content="no-referrer">`.
- Destino de publicación: Vercel, en la raíz de un dominio propio (`vercel.json`: cabeceras de seguridad y caché). Las rutas siguen siendo relativas.
- Service worker: no intercepta otros orígenes; el index solo se guarda si es la raíz o `index.html` y la respuesta es HTML; sin `skipWaiting`. Rescate si se publica uno dañado: `docs/RESCATE-SW.md`.
- Sin secretos, sin analítica, sin llamadas a terceros.

## Accesibilidad y rendimiento
- Mobile-first (360 px). Objetivos táctiles ≥ 44 px. HTML semántico, foco visible, navegable por teclado.
- `prefers-reduced-motion: reduce` → cero animaciones de movimiento; todo el contenido visible.
- Animar solo `transform` y `opacity`. El contenido es visible aunque el JS de animación falle.
