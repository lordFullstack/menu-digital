// Avisos de estado: "Guardando…", "Guardado ✓", errores y falta de conexión.
// Dos zonas aria-live fijas: una amable (role=status) y una de errores (role=alert).
import { clasificar, TEXTO_SIN_CONEXION, type ErrorPanel } from './errores';
import { el } from './ui';

let zonaEstado: HTMLElement | null = null;
let zonaError: HTMLElement | null = null;
let temporizador: number | undefined;
let alSesionExpirada: () => void = () => undefined;

/** Crea el contenedor de avisos (una sola vez) y lo devuelve para insertarlo en la página. */
export function crearZonaAvisos(): HTMLElement {
  const raiz = el('div', 'avisos');
  zonaEstado = el('p', 'aviso');
  zonaEstado.setAttribute('role', 'status');
  zonaError = el('p', 'aviso aviso--error');
  zonaError.setAttribute('role', 'alert');
  raiz.append(zonaEstado, zonaError);
  return raiz;
}

export function registrarSesionExpirada(fn: () => void): void {
  alSesionExpirada = fn;
}

function limpiar(): void {
  window.clearTimeout(temporizador);
  if (zonaEstado) {
    zonaEstado.textContent = '';
    zonaEstado.className = 'aviso';
  }
  if (zonaError) zonaError.textContent = '';
}

export function avisarGuardando(texto = 'Guardando…'): void {
  limpiar();
  if (zonaEstado) {
    zonaEstado.textContent = texto;
    zonaEstado.className = 'aviso aviso--visible';
  }
}

export function avisarGuardado(texto = 'Guardado ✓'): void {
  limpiar();
  if (zonaEstado) {
    zonaEstado.textContent = texto;
    zonaEstado.className = 'aviso aviso--visible aviso--ok';
  }
  temporizador = window.setTimeout(limpiar, 3500);
}

export function avisarError(texto: string): void {
  limpiar();
  if (zonaError) zonaError.textContent = texto;
  temporizador = window.setTimeout(limpiar, 8000);
}

export function quitarAvisos(): void {
  limpiar();
}

/** Muestra el error adecuado; si la sesión expiró, vuelve a Entrar. */
export function manejarError(e: unknown): ErrorPanel {
  const err = clasificar(e);
  if (err.tipo === 'sesion') {
    limpiar();
    alSesionExpirada();
  } else {
    avisarError(err.texto);
  }
  return err;
}

/**
 * Ejecuta un guardado con los avisos de estado. Devuelve { ok: true, valor } o { ok: false }.
 * Sin conexión no intenta guardar.
 */
export async function guardando<T>(
  accion: () => Promise<T>,
  textoGuardando = 'Guardando…',
  textoGuardado = 'Guardado ✓',
): Promise<{ ok: true; valor: T } | { ok: false; error?: ErrorPanel }> {
  if (!navigator.onLine) {
    avisarError(TEXTO_SIN_CONEXION);
    return { ok: false };
  }
  avisarGuardando(textoGuardando);
  try {
    const valor = await accion();
    avisarGuardado(textoGuardado);
    return { ok: true, valor };
  } catch (e) {
    return { ok: false, error: manejarError(e) };
  }
}
