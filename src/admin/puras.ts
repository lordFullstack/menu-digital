// Funciones puras del panel (sin DOM ni red), para poder probarlas con vitest.

/** "#/plato/abc" -> { nombre: 'plato', param: 'abc' }. Un % mal formado deja param en null (no lanza). */
export function parsearHash(hash: string): { nombre: string; param: string | null } {
  const partes = hash.replace(/^#\/?/, '').split('/');
  let param: string | null = null;
  if (partes[1]) {
    try {
      param = decodeURIComponent(partes[1]);
    } catch {
      param = null;
    }
  }
  return { nombre: partes[0] ?? '', param };
}

/** Extensión del archivo en el bucket según el tipo real del blob (debe coincidir con el contentType). */
export function extensionDe(tipo: string): 'webp' | 'jpg' | 'png' {
  if (tipo === 'image/webp') return 'webp';
  if (tipo === 'image/jpeg') return 'jpg';
  if (tipo === 'image/png') return 'png';
  throw new Error('Tipo de imagen no permitido.');
}

export const MENSAJE_ASIGNACION = 'No se pudo completar la asignación. Revise los datos.';

/** Solo se muestran tal cual los dos mensajes conocidos de la base; cualquier otro se reemplaza por el genérico. */
export function mensajeAsignacion(mensajeBase: unknown): string {
  return mensajeBase === 'No autorizado.' || mensajeBase === MENSAJE_ASIGNACION ? mensajeBase : MENSAJE_ASIGNACION;
}
