// Traduce errores de red/Supabase a mensajes en español para personas, sin detalles técnicos.
export type TipoError = 'conexion' | 'sesion' | 'permiso' | 'duplicado' | 'otro';

export interface ErrorPanel {
  tipo: TipoError;
  texto: string;
}

export const TEXTO_SIN_CONEXION = 'Sin conexión: los cambios no se pueden guardar';
export const TEXTO_NO_GUARDADO = 'No se pudo guardar, intente de nuevo';

interface ErrorCrudo {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
}

export function clasificar(e: unknown): ErrorPanel {
  const x = (typeof e === 'object' && e !== null ? e : {}) as ErrorCrudo;
  const mensaje = typeof x.message === 'string' ? x.message : '';
  const codigo = typeof x.code === 'string' ? x.code : '';
  const estado = Number(x.status ?? x.statusCode ?? 0);

  if (typeof navigator !== 'undefined' && !navigator.onLine) return { tipo: 'conexion', texto: TEXTO_SIN_CONEXION };
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(mensaje)) {
    return { tipo: 'conexion', texto: TEXTO_SIN_CONEXION };
  }
  if (estado === 401 || codigo === 'PGRST301' || /jwt|not authenticated/i.test(mensaje)) {
    return { tipo: 'sesion', texto: 'Su sesión expiró. Entre de nuevo.' };
  }
  if (codigo === '23505') return { tipo: 'duplicado', texto: 'Ya existe algo con ese nombre o enlace. Pruebe con otro.' };
  if (codigo === '42501' || estado === 403) {
    return { tipo: 'permiso', texto: 'No tiene permiso para hacer este cambio.' };
  }
  return { tipo: 'otro', texto: TEXTO_NO_GUARDADO };
}

/** Error propio para "la base no cambió ninguna fila" (las reglas por fila la ocultaron). */
export function sinPermiso(): Error {
  return Object.assign(new Error('Sin filas afectadas'), { code: '42501' });
}
