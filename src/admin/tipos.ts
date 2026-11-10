// Formas de las filas que el panel lee y escribe (ver supabase/migrations).
import type { Etiqueta, Franja, ParTipografico } from '../datos/tipos';

export interface NegocioFila {
  id: string;
  slug: string;
  nombre: string;
  eslogan: string | null;
  logo_ruta: string | null;
  portada_ruta: string | null;
  moneda: 'COP';
  whatsapp: string | null;
  direccion: string | null;
  mapa_url: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  horario: Franja[];
  color_fondo: string;
  color_superficie: string;
  color_acento: string;
  tipografia: ParTipografico;
  publicado: boolean;
}

export interface CategoriaFila {
  id: string;
  negocio_id: string;
  nombre: string;
  orden: number;
}

export interface PlatoFila {
  id: string;
  negocio_id: string;
  categoria_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  foto_ruta: string | null;
  etiquetas: Etiqueta[];
  ingredientes: string[];
  alergenos: string[];
  recomendado: boolean;
  agotado: boolean;
  orden: number;
}

export const ETIQUETAS: { id: Etiqueta; texto: string }[] = [
  { id: 'vegano', texto: 'Vegano' },
  { id: 'vegetariano', texto: 'Vegetariano' },
  { id: 'picante', texto: 'Picante' },
  { id: 'sin-gluten', texto: 'Sin gluten' },
  { id: 'nuevo', texto: 'Nuevo' },
];

export const LIMITE_CATEGORIAS = 30;
export const LIMITE_PLATOS = 500;
export const LIMITE_FRANJAS = 14;
