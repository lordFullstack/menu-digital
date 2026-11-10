// Estado en memoria del panel: quién entró, qué negocios puede ver y cuál tiene abierto.
import type { NegocioFila } from './tipos';

const CLAVE_NEGOCIO = 'panel.negocio';

export const estado = {
  cargado: false,
  esAdmin: false,
  negocios: [] as NegocioFila[],
  negocioId: null as string | null,
  /** true cuando la persona volvió del correo de "Olvidé mi contraseña". */
  recuperando: false,
  /** Mensaje para mostrar en Entrar (por ejemplo, sesión expirada). */
  avisoEntrar: null as string | null,
};

export function limpiarEstado(): void {
  estado.cargado = false;
  estado.esAdmin = false;
  estado.negocios = [];
  estado.negocioId = null;
  try {
    sessionStorage.removeItem(CLAVE_NEGOCIO);
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

export function negocioActual(): NegocioFila | null {
  return estado.negocios.find((n) => n.id === estado.negocioId) ?? null;
}

export function elegirNegocio(id: string | null): void {
  estado.negocioId = id;
  try {
    if (id) sessionStorage.setItem(CLAVE_NEGOCIO, id);
    else sessionStorage.removeItem(CLAVE_NEGOCIO);
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

/** Después de cargar la lista: restaura el negocio de la sesión o elige el único que existe (si no es admin). */
export function resolverNegocioInicial(): void {
  let guardado: string | null = null;
  try {
    guardado = sessionStorage.getItem(CLAVE_NEGOCIO);
  } catch {
    guardado = null;
  }
  if (guardado && estado.negocios.some((n) => n.id === guardado)) {
    estado.negocioId = guardado;
    return;
  }
  estado.negocioId = !estado.esAdmin && estado.negocios.length === 1 ? estado.negocios[0].id : null;
}

export function reemplazarNegocio(n: NegocioFila): void {
  const i = estado.negocios.findIndex((x) => x.id === n.id);
  if (i >= 0) estado.negocios[i] = n;
  else estado.negocios.push(n);
  estado.negocios.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
