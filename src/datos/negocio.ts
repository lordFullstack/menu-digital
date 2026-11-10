// Menú de un negocio: lectura desde Supabase (RPC menu_publico), validación y copia local para uso sin internet.
// Regla de oro: NADA de lo que llega de la red ni de localStorage se pinta sin pasar por validarMenu/validarTema.
// Este módulo se carga bajo demanda (solo en /<slug>), así supabase-js no pesa en el menú de muestra.
import { supabase, urlFoto } from '../supabase/cliente';
import { ErrorDeDatos } from './errores';
import type { Menu, Tema } from './tipos';
import { validarMenu, validarTema } from './validar';

export type DatosMenu = { menu: Menu; tema: Tema };

const esRegistro = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Ruta de storage -> URL pública. Si la ruta no tiene la forma esperada, la foto se descarta (se verá la inicial del plato). */
function resolverFoto(registro: Record<string, unknown>, campo: string): Record<string, unknown> {
  if (!(campo in registro)) return registro;
  const url = typeof registro[campo] === 'string' ? urlFoto(registro[campo] as string) : null;
  const resto: Record<string, unknown> = { ...registro };
  delete resto[campo];
  if (url !== null) resto[campo] = url;
  return resto;
}

/** Copia del menú crudo con las fotos (logo, portada, plato) convertidas de ruta de storage a URL. No muta la entrada. */
export function resolverFotos(menu: unknown): unknown {
  if (!esRegistro(menu)) return menu;
  const salida: Record<string, unknown> = { ...menu };
  if (esRegistro(menu.negocio)) {
    salida.negocio = resolverFoto(resolverFoto(menu.negocio, 'logo'), 'portada');
  }
  if (Array.isArray(menu.categorias)) {
    salida.categorias = menu.categorias.map((c) => {
      if (!esRegistro(c) || !Array.isArray(c.platos)) return c;
      return { ...c, platos: c.platos.map((p) => (esRegistro(p) ? resolverFoto(p, 'foto') : p)) };
    });
  }
  return salida;
}

/** Valida la respuesta cruda { menu, tema } (de la red o de la copia local). Lanza ErrorDeDatos si no es válida. */
export function validarRespuesta(crudo: unknown, conRutasDeStorage: boolean): DatosMenu {
  if (!esRegistro(crudo)) throw new ErrorDeDatos('La respuesta del menú no tiene el formato esperado.');
  const m = validarMenu(conRutasDeStorage ? resolverFotos(crudo.menu) : crudo.menu, { permitirVacio: true });
  if (!m.ok) throw new ErrorDeDatos(`El menú tiene errores:\n- ${m.errores.join('\n- ')}`);
  const t = validarTema(crudo.tema);
  if (!t.ok) throw new ErrorDeDatos(`El tema tiene errores:\n- ${t.errores.join('\n- ')}`);
  return { menu: m.menu, tema: t.tema };
}

// ───────── Copia local (último menú válido por negocio) ─────────

const MAX_COPIA = 2_000_000; // caracteres; un menú real pesa una fracción de esto
export const claveCopia = (slug: string): string => `menu-digital:menu:${slug}`;

export type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function almacenLocal(): Almacen | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // modo privado o almacenamiento bloqueado
  }
}

export function guardarCopia(slug: string, datos: DatosMenu, almacen: Almacen | null = almacenLocal()): void {
  if (!almacen) return;
  try {
    almacen.setItem(claveCopia(slug), JSON.stringify(datos));
  } catch {
    /* sin espacio o bloqueado: la copia es un extra, no debe romper el menú */
  }
}

export function borrarCopia(slug: string, almacen: Almacen | null = almacenLocal()): void {
  try {
    almacen?.removeItem(claveCopia(slug));
  } catch {
    /* nada */
  }
}

/** Lee y vuelve a validar la copia. Devuelve null si no hay, está corrupta o ya no es válida (y la borra). */
export function leerCopia(slug: string, almacen: Almacen | null = almacenLocal()): DatosMenu | null {
  if (!almacen) return null;
  let texto: string | null;
  try {
    texto = almacen.getItem(claveCopia(slug));
  } catch {
    return null;
  }
  if (texto === null) return null;
  try {
    if (texto.length > MAX_COPIA) throw new Error('demasiado grande');
    return validarRespuesta(JSON.parse(texto), false); // la copia guarda las URLs ya resueltas
  } catch {
    borrarCopia(slug, almacen);
    return null;
  }
}

// ───────── Carga ─────────

export type ResultadoNegocio =
  | { estado: 'ok'; datos: DatosMenu; desdeCopia: boolean }
  | { estado: 'no-encontrado' };

/**
 * Carga el menú de un negocio (el slug ya debe estar validado con slugValido).
 * - Hay respuesta: se valida, se guarda como copia local y se devuelve.
 * - La base responde null (no existe o no está publicado; no se distingue): se borra la copia y 'no-encontrado'.
 * - Falla la red: si hay copia válida se devuelve con desdeCopia=true; si no, se lanza un Error de conexión.
 */
export async function cargarMenuNegocio(slug: string): Promise<ResultadoNegocio> {
  let data: unknown;
  let falloRed = false;
  try {
    const r = await supabase().rpc('menu_publico', { p_slug: slug });
    if (r.error) falloRed = true;
    else data = r.data;
  } catch {
    falloRed = true;
  }
  if (falloRed) {
    const copia = leerCopia(slug);
    if (copia) return { estado: 'ok', datos: copia, desdeCopia: true };
    throw new Error('No se pudo cargar el menú. Revise su conexión a internet e intente de nuevo.');
  }
  if (data === null || data === undefined) {
    borrarCopia(slug);
    return { estado: 'no-encontrado' };
  }
  const datos = validarRespuesta(data, true);
  guardarCopia(slug, datos);
  return { estado: 'ok', datos, desdeCopia: false };
}
