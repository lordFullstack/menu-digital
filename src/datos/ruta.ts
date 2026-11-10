// Rutas públicas: '/' = menú de muestra, '/<slug>' = menú de un negocio, cualquier otra cosa = no encontrado.
// El slug sale de la URL (dato no confiable): se valida con una lista cerrada de caracteres ANTES de usarlo.

export const SLUGS_RESERVADOS: readonly string[] = [
  'admin', 'assets', 'datos', 'img', 'iconos', 'api', 'sw', 'manifest', 'index', 'login',
];

const FORMA_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** true si es un slug permitido: minúsculas, números y guiones, 3 a 40 letras, no reservado. */
export function slugValido(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 40 && FORMA_SLUG.test(slug) && !SLUGS_RESERVADOS.includes(slug);
}

export type RutaPublica =
  | { tipo: 'muestra' }
  | { tipo: 'negocio'; slug: string }
  | { tipo: 'invalida' };

/**
 * Interpreta location.pathname. Estricto a propósito: sin '%' (nada de %2F ni %2e), sin mayúsculas,
 * sin barra final y un solo segmento. Todo lo que no encaje es 'invalida' (y no se toca la red).
 */
export function rutaDePathname(pathname: string): RutaPublica {
  if (pathname === '/' || pathname === '/index.html') return { tipo: 'muestra' };
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.length > 60) return { tipo: 'invalida' };
  const segmento = pathname.slice(1);
  if (segmento.includes('/') || segmento.includes('%') || segmento.includes('\\')) return { tipo: 'invalida' };
  return slugValido(segmento) ? { tipo: 'negocio', slug: segmento } : { tipo: 'invalida' };
}
