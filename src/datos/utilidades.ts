// Utilidades seguras del menú: horario, precios, enlaces.
import type { Franja } from './tipos';

/** Caracteres de control (incluye tabulador, salto de línea, NUL y DEL). */
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

/**
 * Devuelve la URL solo si es segura; si no, null.
 * Segura = https:// válida, o una ruta relativa simple (ej. "img/plato.svg").
 * Todo lo demás (javascript:, data:, http://, //otro-sitio, ../, \) se rechaza.
 */
export function urlSegura(u: string | undefined): string | null {
  if (typeof u !== 'string' || u.length === 0 || u.length > 2000) return null;
  // Sin espacios ni caracteres de control en ningún lugar (frena "java\tscript:" y " javascript:").
  if (CONTROL.test(u) || /\s/.test(u)) return null;
  if (u.includes('\\')) return null;

  if (/^https:\/\//i.test(u)) {
    try {
      const url = new URL(u);
      if (url.protocol !== 'https:' || !url.hostname) return null;
      if (url.username || url.password) return null;
      return u;
    } catch {
      return null;
    }
  }

  // Ruta relativa: sin esquema (sin ':'), sin '/' inicial ni '//', sin segmentos '..'.
  if (u.includes(':')) return null;
  if (u.startsWith('/') || u.includes('//')) return null;
  for (const s of u.split('/')) {
    const limpio = s.toLowerCase();
    if (limpio === '..' || limpio.includes('%2e') || limpio.includes('%2f') || limpio.includes('%5c')) return null;
  }
  return u;
}

/**
 * Ruta local segura para fotos (v1: las imágenes viven en la carpeta img del menú).
 * Igual que urlSegura pero rechaza también https://: devuelve null si no es una ruta relativa simple.
 */
export function rutaLocalSegura(u: string | undefined): string | null {
  const segura = urlSegura(u);
  if (segura === null || /^https:\/\//i.test(segura)) return null;
  return segura;
}

/**
 * Copia de PREFIJO_FOTOS (src/supabase/cliente.ts). Se repite aquí a propósito: importar cliente.ts desde
 * la capa de datos metería todo supabase-js (~190 kB) en la carga del menú de muestra. Una prueba
 * (negocio.test.ts) comprueba que ambas constantes sigan idénticas.
 */
export const PREFIJO_FOTOS_PERMITIDO = 'https://euidxtsjtstukvrwcgwm.supabase.co/storage/v1/object/public/fotos/';

/**
 * Foto permitida: ruta local segura O una URL que empieza EXACTAMENTE por PREFIJO_FOTOS (ver abajo)
 * (el bucket público de fotos del proyecto). El resto del texto solo puede llevar letras, números,
 * '.', '_', '-' y '/', sin '..', '//', '?' ni '#'. Cualquier otra https se rechaza.
 */
export function fotoPermitida(u: string | undefined): string | null {
  const local = rutaLocalSegura(u);
  if (local !== null) return local;
  if (typeof u !== 'string' || u.length > 2000 || !u.startsWith(PREFIJO_FOTOS_PERMITIDO)) return null;
  const resto = u.slice(PREFIJO_FOTOS_PERMITIDO.length);
  if (resto.length === 0 || !/^[A-Za-z0-9._/-]+$/.test(resto)) return null;
  if (resto.includes('..') || resto.includes('//') || resto.startsWith('/') || resto.endsWith('/')) return null;
  return u;
}

export type TipoEnlace = 'instagram' | 'facebook' | 'tiktok' | 'mapa';

/** Cada regla: dominio permitido y, opcionalmente, el comienzo obligatorio de la ruta. */
const HOSTS_PERMITIDOS: Record<TipoEnlace, { dominio: string; ruta?: string }[]> = {
  instagram: [{ dominio: 'instagram.com' }],
  facebook: [{ dominio: 'facebook.com' }, { dominio: 'fb.com' }, { dominio: 'fb.me' }],
  tiktok: [{ dominio: 'tiktok.com' }],
  mapa: [
    { dominio: 'google.com', ruta: '/maps' },
    { dominio: 'maps.google.com' },
    { dominio: 'maps.app.goo.gl' },
    { dominio: 'goo.gl', ruta: '/maps' },
    { dominio: 'waze.com' },
    { dominio: 'openstreetmap.org' },
  ],
};

/**
 * Enlace https cuyo sitio está en la lista blanca del tipo (red social o mapa); si no, null.
 * El sitio se compara por nombre exacto o por sufijo con punto (www., m., vm. valen;
 * "instagram.com.evil.com" y "evilinstagram.com" no).
 */
export function enlacePermitido(u: string | undefined, tipo: TipoEnlace): string | null {
  const segura = urlSegura(u);
  if (segura === null || !/^https:\/\//i.test(segura)) return null;
  let url: URL;
  try {
    url = new URL(segura);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const ok = HOSTS_PERMITIDOS[tipo].some(
    (r) => (host === r.dominio || host.endsWith('.' + r.dominio)) && (!r.ruta || url.pathname.startsWith(r.ruta)),
  );
  return ok ? segura : null;
}

/** Formatea un precio sin depender del idioma del dispositivo: "$ 18.000". */
export function formatearPrecio(n: number, moneda: 'COP'): string {
  void moneda; // por ahora solo existe COP (sin decimales)
  if (!Number.isFinite(n)) return '$ 0';
  const negativo = n < 0;
  const entero = String(Math.round(Math.abs(n)));
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-' : ''}$ ${conPuntos}`;
}

/** Arma el enlace de WhatsApp. Acepta 8 a 15 dígitos (ignora espacios, + y guiones). */
export function enlaceWhatsApp(numero: string, texto: string): string | null {
  if (typeof numero !== 'string') return null;
  const limpio = numero.replace(/[\s+-]/g, '');
  if (!/^\d{8,15}$/.test(limpio)) return null;
  return `https://wa.me/${limpio}?text=${encodeURIComponent(typeof texto === 'string' ? texto : '')}`;
}

function aMinutos(hora: string): number {
  const [h, m] = hora.split(':');
  return Number(h) * 60 + Number(m);
}

/**
 * ¿Está abierto el negocio en este momento?
 * Usa la hora de Colombia (UTC-5, sin horario de verano), sin importar la zona del dispositivo.
 * Soporta varias franjas por día y franjas que cruzan la medianoche
 * (18:00–02:00 del viernes sigue abierto el sábado a la 01:00).
 */
export function estaAbierto(horario: Franja[], ahora: Date = new Date()): boolean {
  const bogota = new Date(ahora.getTime() - 5 * 60 * 60 * 1000);
  const dia = bogota.getUTCDay();
  const diaAnterior = (dia + 6) % 7;
  const minuto = bogota.getUTCHours() * 60 + bogota.getUTCMinutes();

  for (const f of horario) {
    const abre = aMinutos(f.abre);
    const cierra = aMinutos(f.cierra);
    if (Number.isNaN(abre) || Number.isNaN(cierra) || abre === cierra) continue;
    if (abre < cierra) {
      if (f.dias.includes(dia) && minuto >= abre && minuto < cierra) return true;
    } else {
      // Cruza medianoche: la parte de la noche cuenta para el día de apertura,
      // la parte de la madrugada para el día siguiente.
      if (f.dias.includes(dia) && minuto >= abre) return true;
      if (f.dias.includes(diaAnterior) && minuto < cierra) return true;
    }
  }
  return false;
}
