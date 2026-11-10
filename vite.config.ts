import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

/** Recorre una carpeta y devuelve todas las rutas de archivo (absolutas). */
function listarArchivos(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    return statSync(ruta).isDirectory() ? listarArchivos(ruta) : [ruta];
  });
}

/**
 * Plugin "precache-sw" (MENU-005). Corre al terminar el build: recorre dist/,
 * arma la lista real de archivos (con sus nombres con hash) y la escribe dentro de
 * dist/sw.js, reemplazando los marcadores VERSION y PRECACHE de public/sw.js.
 * La versión es un hash del contenido de todos esos archivos: si algo cambia,
 * el SW cambia y los celulares descargan la copia nueva.
 */
function precacheSW(): Plugin {
  let salida = 'dist';
  return {
    name: 'precache-sw',
    apply: 'build',
    configResolved(config) {
      salida = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const rutaSW = join(salida, 'sw.js');
      const todos = listarArchivos(salida)
        .map((f) => relative(salida, f).split('\\').join('/'))
        .filter((f) => f !== 'sw.js')
        .sort();
      // Las fuentes de alfabetos que el menú no usa no se precargan: pesan y no hacen falta.
      // Si algún día se piden, el service worker las guarda al vuelo.
      // Solo se precargan los .woff2 del subconjunto "latin" (no latin-ext ni otros alfabetos).
      const esFuente = (f: string): boolean => /\.woff2?$/.test(f);
      // El panel (/admin) no va al cascarón: los comensales no lo usan y el panel siempre va a la red.
      const esPanel = (f: string): boolean => f === 'admin.html' || /^assets\/admin-[^/]*$/.test(f);
      const lista = todos.filter((f) => !esPanel(f) && (!esFuente(f) || /-latin-wght-(normal|italic)-[^/]*\.woff2$/.test(f)));
      const hash = createHash('sha256');
      for (const f of lista) hash.update(f).update(readFileSync(join(salida, f)));
      const version = hash.digest('hex').slice(0, 12);

      const fuente = readFileSync(rutaSW, 'utf8');
      const sustituido = fuente
        .replace(/\/\*@@VERSION@@\*\/\s*'dev'/, () => JSON.stringify(version))
        .replace(/\/\*@@PRECACHE@@\*\/\s*\[\]/, () => JSON.stringify(lista, null, 2));
      if (sustituido === fuente) throw new Error('precache-sw: no se encontraron los marcadores en sw.js');
      writeFileSync(rutaSW, sustituido, 'utf8');
      console.log(`precache-sw: versión ${version}, ${lista.length} archivos en el cascarón`);
    },
  };
}

/**
 * Plugin "csp-desarrollo": SOLO con `vite` (serve). El index.html fuente lleva la CSP estricta de
 * producción; en desarrollo Vite inyecta <style>, abre un websocket y usa un SharedWorker blob,
 * así que se relaja lo mínimo. `vite build` y `vite preview` usan la versión estricta.
 */
function cspDesarrollo(): Plugin {
  return {
    name: 'csp-desarrollo',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(/(http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/, (_m, a: string, csp: string, c: string) => {
        const relajada = csp
          .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
          .replace("connect-src 'self'", "connect-src 'self' ws: wss:")
          .replace("worker-src 'self'", "worker-src 'self' blob:")
          .replace(/;\s*upgrade-insecure-requests/, '');
        return a + relajada + c;
      });
    },
  };
}

// base relativa: el menú funciona en la raíz de un dominio (Vercel) o en una subcarpeta, y en local.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    // Dos entradas: el menú público (index.html) y el panel de administración (admin.html).
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
  plugins: [precacheSW(), cspDesarrollo()],
});
