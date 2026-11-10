// Tipos de los datos del menú. Copia exacta del contrato compartido (docs/equipo/CONTRATO.md).
export type Etiqueta = 'vegano' | 'vegetariano' | 'picante' | 'sin-gluten' | 'nuevo';
export type ParTipografico = 'clasica' | 'moderna' | 'calida';
export type IdPlantilla = 'cafeteria' | 'elegante' | 'heladeria' | 'rapida';

export interface Tema {
  version: 1;
  plantilla?: IdPlantilla;
  colores: { fondo: string; superficie: string; acento: string }; // #RRGGBB
  tipografia: ParTipografico;
}

export interface Franja { dias: number[]; abre: string; cierra: string } // dias 0=domingo..6; 'HH:MM' 24h

export interface Plato {
  id: string; nombre: string; descripcion?: string;
  precio: number;            // entero, en la moneda del negocio
  foto?: string;             // ruta relativa (img/...) o https://
  etiquetas?: Etiqueta[];
  ingredientes?: string[]; alergenos?: string[];
  recomendado?: boolean; agotado?: boolean;
}
export interface Categoria { id: string; nombre: string; platos: Plato[] }

export interface Negocio {
  nombre: string; eslogan?: string;
  logo?: string; portada?: string;       // ruta relativa o https://
  moneda: 'COP';
  whatsapp?: string;                      // solo dígitos con indicativo, ej. 573001234567
  direccion?: string; mapaUrl?: string;   // https://
  redes?: { instagram?: string; facebook?: string; tiktok?: string }; // https://
  horario: Franja[];
}
export interface Menu { version: 1; negocio: Negocio; categorias: Categoria[] }
