/* Service worker del menú digital (MENU-005).
 *
 * Idea en sencillo: la primera vez que se abre el menú con internet, este
 * archivo guarda una copia de todo lo necesario (el "cascarón"). Después, si
 * no hay señal, el menú se sirve desde esa copia.
 *
 * Los dos marcadores de abajo (VERSION y PRECACHE) los rellena el build
 * (plugin "precache-sw" en vite.config.ts) con la lista real de archivos y un
 * hash de su contenido. En desarrollo el SW no se registra, así que estos
 * valores por defecto no se usan.
 */
const VERSION = /*@@VERSION@@*/ 'dev';
const PRECACHE = /*@@PRECACHE@@*/ [];

// Todo se resuelve contra el scope donde vive la app (p. ej. /menu-digital/),
// nunca contra "/", porque en GitHub Pages hay varias apps en el mismo origen.
const BASE = self.registration.scope;
const RUTA_BASE = new URL(BASE).pathname;

// Los nombres de caché llevan el scope: así solo borramos las de ESTA app.
const PREFIJO = `menu-digital|${RUTA_BASE}|`;
const CACHE_CASCARON = `${PREFIJO}cascaron-${VERSION}`;
const ESPERA_RED_MS = 4000; // con señal mala, mejor la copia guardada que una pantalla en blanco

const URL_INDEX = new URL('index.html', BASE).href;
const URL_DATOS = new URL('datos/', BASE).href;

self.addEventListener('install', (evento) => {
  // Sin skipWaiting a propósito: una versión nueva espera a que se cierren las
  // pestañas abiertas, para no cambiar los archivos a mitad de una sesión
  // (por ejemplo, mientras el cliente aún está cargando fuentes o imágenes).
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_CASCARON);
      // addAll es atómico: si un archivo falla, la instalación falla y se reintenta luego.
      await cache.addAll(PRECACHE.map((ruta) => new Request(new URL(ruta, BASE).href, { cache: 'reload' })));
    })(),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      // Borra cachés viejas de esta app (mismo prefijo; incluye la antigua "externas"); no toca las de otras apps.
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter((n) => n.startsWith(PREFIJO) && n !== CACHE_CASCARON)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Solo guardamos respuestas completas y correctas (200) de nuestro propio origen. */
function esGuardable(respuesta) {
  return respuesta && respuesta.status === 200 && respuesta.type === 'basic';
}

// Assets con hash, fuentes, imágenes e iconos propios: primero la copia, si no hay, la red.
async function cacheFirst(peticion) {
  const cache = await caches.open(CACHE_CASCARON);
  const guardada = await cache.match(peticion);
  if (guardada) return guardada;
  const respuesta = await fetch(peticion);
  if (esGuardable(respuesta)) await cache.put(peticion, respuesta.clone());
  return respuesta;
}

// Datos del menú: responde ya con la copia y la refresca por detrás,
// así los precios nuevos aparecen en la siguiente visita.
async function staleWhileRevalidate(evento, peticion) {
  const cache = await caches.open(CACHE_CASCARON);
  const guardada = await cache.match(peticion);
  const actualizar = fetch(peticion)
    .then(async (respuesta) => {
      if (esGuardable(respuesta)) await cache.put(peticion, respuesta.clone());
      return respuesta;
    })
    .catch(() => undefined);
  if (guardada) {
    evento.waitUntil(actualizar);
    return guardada;
  }
  return (await actualizar) || Response.error();
}

// Navegación: red primero (para ver siempre la versión nueva) con respaldo al index guardado.
async function navegacion(peticion) {
  const cache = await caches.open(CACHE_CASCARON);
  const respaldo = async () => (await cache.match(URL_INDEX)) || (await cache.match(BASE));
  // Solo se guarda como "index" si la petición es la raíz del scope o index.html Y la respuesta es HTML
  // (si no, un menu.json abierto en una pestaña pasaría por index y dañaría el modo sin internet).
  const ruta = new URL(peticion.url).pathname; // sin ?consulta: "?plantilla=elegante" sigue siendo el index
  const esIndex = ruta === RUTA_BASE || ruta === RUTA_BASE + 'index.html';
  const red = fetch(peticion).then(async (respuesta) => {
    const tipo = respuesta.headers.get('content-type') || '';
    if (esIndex && esGuardable(respuesta) && tipo.includes('text/html')) await cache.put(URL_INDEX, respuesta.clone());
    return respuesta;
  });
  try {
    const espera = new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('lento')), ESPERA_RED_MS));
    return await Promise.race([red, espera]);
  } catch {
    red.catch(() => undefined); // evita aviso de promesa sin atender
    return (await respaldo()) || Response.error();
  }
}

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;
  if (peticion.headers.has('Authorization')) return; // nada con credenciales
  if (peticion.headers.has('Range')) return; // descargas parciales: que las maneje el navegador

  const url = new URL(peticion.url);

  // Peticiones de otro origen: no se interceptan (las fotos son solo locales; no hay nada externo que guardar).
  if (url.origin !== self.location.origin) return;

  // Otras apps del mismo origen (otras subcarpetas de GitHub Pages): no nos tocan.
  if (!url.href.startsWith(BASE)) return;

  if (peticion.mode === 'navigate') {
    evento.respondWith(navegacion(peticion));
  } else if (url.href.startsWith(URL_DATOS) && url.pathname.endsWith('.json')) {
    evento.respondWith(staleWhileRevalidate(evento, peticion));
  } else {
    evento.respondWith(cacheFirst(peticion));
  }
});
