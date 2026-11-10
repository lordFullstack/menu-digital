// Todas las llamadas a Supabase del panel. La autorización real la hace la base (RLS y privilegios
// por columna); aquí solo se envían las columnas que el rol puede actualizar y se usa insert/update
// por separado (nunca upsert: la base niega update sobre id y negocio_id).
import { supabase } from '../supabase/cliente';
import { sinPermiso } from './errores';
import { extensionDe } from './puras';
import type { CategoriaFila, NegocioFila, PlatoFila } from './tipos';

function ver<T>(r: { data: T | null; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

// ───────── Sesión ─────────

export async function esAdmin(): Promise<boolean> {
  return ver(await supabase().rpc('es_admin')) === true;
}

export async function misNegocios(): Promise<NegocioFila[]> {
  return (ver(await supabase().rpc('mis_negocios')) ?? []) as NegocioFila[];
}

// ───────── Negocios ─────────

/** Columnas que el dueño puede actualizar. El slug solo lo envía el administrador. */
const COLUMNAS_NEGOCIO = [
  'nombre', 'eslogan', 'logo_ruta', 'portada_ruta', 'whatsapp', 'direccion', 'mapa_url',
  'instagram', 'facebook', 'tiktok', 'horario', 'color_fondo', 'color_superficie', 'color_acento',
  'tipografia', 'publicado',
];

export async function actualizarNegocio(id: string, cambios: Partial<NegocioFila>, admin: boolean): Promise<NegocioFila> {
  const permitidas = admin ? [...COLUMNAS_NEGOCIO, 'slug'] : COLUMNAS_NEGOCIO;
  const limpio: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cambios)) if (permitidas.includes(k)) limpio[k] = v;
  const filas = ver(await supabase().from('negocios').update(limpio).eq('id', id).select('*')) as NegocioFila[];
  if (!filas || filas.length === 0) throw sinPermiso();
  return filas[0];
}

export interface NegocioNuevo {
  slug: string;
  nombre: string;
  color_fondo: string;
  color_superficie: string;
  color_acento: string;
  tipografia: NegocioFila['tipografia'];
}

export async function crearNegocio(datos: NegocioNuevo): Promise<NegocioFila> {
  const filas = ver(
    await supabase().from('negocios').insert({ ...datos, horario: [], publicado: false }).select('*'),
  ) as NegocioFila[];
  if (!filas || filas.length === 0) throw sinPermiso();
  return filas[0];
}

export async function asignarDueno(negocioId: string, correo: string): Promise<void> {
  ver(await supabase().rpc('asignar_dueno', { p_negocio: negocioId, p_correo: correo }));
}

export async function quitarDueno(negocioId: string, usuarioId: string): Promise<void> {
  ver(await supabase().rpc('quitar_dueno', { p_negocio: negocioId, p_usuario: usuarioId }));
}

/** Solo ids de usuario (la base no expone correos a propósito). */
export async function listarMiembros(negocioId: string): Promise<string[]> {
  const filas = ver(
    await supabase().from('miembros').select('user_id, creado').eq('negocio_id', negocioId).order('creado'),
  ) as { user_id: string }[];
  return (filas ?? []).map((f) => f.user_id);
}

// ───────── Categorías ─────────

export async function listarCategorias(negocioId: string): Promise<CategoriaFila[]> {
  return (ver(
    await supabase().from('categorias').select('id, negocio_id, nombre, orden').eq('negocio_id', negocioId).order('orden').order('nombre'),
  ) ?? []) as CategoriaFila[];
}

export async function crearCategoria(negocioId: string, nombre: string, orden: number): Promise<CategoriaFila> {
  const filas = ver(
    await supabase().from('categorias').insert({ negocio_id: negocioId, nombre, orden }).select('id, negocio_id, nombre, orden'),
  ) as CategoriaFila[];
  if (!filas || filas.length === 0) throw sinPermiso();
  return filas[0];
}

export async function actualizarCategoria(id: string, cambios: { nombre?: string; orden?: number }): Promise<void> {
  const filas = ver(await supabase().from('categorias').update(cambios).eq('id', id).select('id')) as unknown[];
  if (!filas || filas.length === 0) throw sinPermiso();
}

export async function eliminarCategoria(id: string): Promise<void> {
  const filas = ver(await supabase().from('categorias').delete().eq('id', id).select('id')) as unknown[];
  if (!filas || filas.length === 0) throw sinPermiso();
}

// ───────── Platos ─────────

const COLUMNAS_PLATO =
  'id, negocio_id, categoria_id, nombre, descripcion, precio, foto_ruta, etiquetas, ingredientes, alergenos, recomendado, agotado, orden';

export async function listarPlatos(negocioId: string): Promise<PlatoFila[]> {
  return (ver(
    await supabase().from('platos').select(COLUMNAS_PLATO).eq('negocio_id', negocioId).order('orden').order('nombre'),
  ) ?? []) as PlatoFila[];
}

/** Solo devuelve el plato si pertenece al negocio indicado (evita abrir platos de otros negocios por la URL). */
export async function obtenerPlato(id: string, negocioId: string): Promise<PlatoFila | null> {
  const filas = ver(
    await supabase().from('platos').select(COLUMNAS_PLATO).eq('id', id).eq('negocio_id', negocioId).limit(1),
  ) as PlatoFila[];
  return filas && filas.length > 0 ? filas[0] : null;
}

export type DatosPlato = Omit<PlatoFila, 'id' | 'negocio_id'>;

export async function crearPlato(negocioId: string, datos: DatosPlato): Promise<void> {
  const filas = ver(await supabase().from('platos').insert({ ...datos, negocio_id: negocioId }).select('id')) as unknown[];
  if (!filas || filas.length === 0) throw sinPermiso();
}

export async function actualizarPlato(id: string, cambios: Partial<DatosPlato>): Promise<void> {
  const filas = ver(await supabase().from('platos').update(cambios).eq('id', id).select('id')) as unknown[];
  if (!filas || filas.length === 0) throw sinPermiso();
}

export async function eliminarPlato(id: string): Promise<void> {
  const filas = ver(await supabase().from('platos').delete().eq('id', id).select('id')) as unknown[];
  if (!filas || filas.length === 0) throw sinPermiso();
}

// ───────── Fotos (bucket "fotos") ─────────

/** Sube la foto a '<negocio_id>/<uuid>.<ext>' y devuelve solo la RUTA (nunca una URL). */
export async function subirFoto(negocioId: string, blob: Blob): Promise<string> {
  const ext = extensionDe(blob.type);
  const ruta = `${negocioId}/${crypto.randomUUID()}.${ext}`.toLowerCase();
  const { error } = await supabase().storage.from('fotos').upload(ruta, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  return ruta;
}

/** Borra una foto del bucket. Si falla, no bloquea nada (solo queda un archivo huérfano). */
export async function borrarFoto(ruta: string | null | undefined): Promise<void> {
  if (!ruta) return;
  try {
    await supabase().storage.from('fotos').remove([ruta]);
  } catch {
    /* no bloquea */
  }
}
