// Trazos de los iconos (propios, 24x24). Se dibujan con icono() de dom.ts.
import type { Etiqueta } from '../datos';

export const TRAZOS: Record<Etiqueta | 'cerrar' | 'whatsapp' | 'pin', string[]> = {
  vegano: ['M5 19c0-8 5-14 14-14 0 9-6 14-14 14z', 'M5 19l8-8'],
  vegetariano: ['M12 21v-9', 'M12 12c0-4-3-6-7-6 0 4 2 6 7 6z', 'M12 14c0-3 2-5 6-5 0 3-2 5-6 5z'],
  picante: ['M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z'],
  'sin-gluten': [
    'M12 21V9',
    'M12 9c-2-1-3-3-3-5 2 0 3 2 3 5z',
    'M12 9c2-1 3-3 3-5-2 0-3 2-3 5z',
    'M12 15c-2-1-4-1-5-3 2 0 4 1 5 3z',
    'M12 15c2-1 4-1 5-3-2 0-4 1-5 3z',
    'M4 4l16 16',
  ],
  nuevo: ['M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z'],
  cerrar: ['M6 6l12 12', 'M18 6L6 18'],
  whatsapp: ['M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.2A8.5 8.5 0 1 1 21 11.5z'],
  pin: ['M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z', 'M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
};

export const ROTULO_ETIQUETA: Record<Etiqueta, string> = {
  vegano: 'Vegano',
  vegetariano: 'Vegetariano',
  picante: 'Picante',
  'sin-gluten': 'Sin gluten',
  nuevo: 'Nuevo',
};
