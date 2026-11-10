// Validación en el navegador, con los MISMOS límites que la base (supabase/migrations/…_esquema.sql).
// Sirve para avisar junto al campo antes de enviar; la base sigue siendo quien decide.
import type { Franja } from '../datos/tipos';
import { enlacePermitido, type TipoEnlace } from '../datos/utilidades';

export type Res<T> = { ok: true; valor: T } | { ok: false; error: string };
const ok = <T>(valor: T): Res<T> => ({ ok: true, valor });
const mal = (error: string): Res<never> => ({ ok: false, error });

const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/;
/** Largo en caracteres (como char_length de Postgres), no en unidades UTF-16. */
const largo = (t: string): number => Array.from(t).length;

export const SLUGS_RESERVADOS = ['admin', 'assets', 'datos', 'img', 'iconos', 'api', 'sw', 'manifest', 'index', 'login'];

/** Texto obligatorio de una línea (nombre de plato, categoría o negocio). */
export function validarNombre(texto: string, max = 80): Res<string> {
  const t = texto.trim();
  if (t === '') return mal('Escriba un nombre.');
  if (largo(t) > max) return mal(`Use ${max} letras o menos (ahora tiene ${largo(t)}).`);
  if (CONTROL.test(t)) return mal('El texto tiene caracteres no permitidos.');
  return ok(t);
}

/** Texto opcional: vacío se guarda como null. */
export function validarTextoOpcional(texto: string, max: number): Res<string | null> {
  const t = texto.trim();
  if (t === '') return ok(null);
  if (largo(t) > max) return mal(`Use ${max} letras o menos (ahora tiene ${largo(t)}).`);
  if (CONTROL.test(t)) return mal('El texto tiene caracteres no permitidos.');
  return ok(t);
}

/** Precio en pesos: entero de 0 a 10.000.000. Acepta "18000", "18.000" y "$ 18.000". */
export function validarPrecio(texto: string): Res<number> {
  const t = texto.replace(/[\s$]/g, '');
  if (t === '') return mal('Escriba el precio.');
  if (!/^(\d{1,3}(\.\d{3})+|\d+)$/.test(t)) return mal('Escriba el precio en pesos, solo números (por ejemplo 18000).');
  const n = Number(t.replace(/\./g, ''));
  if (!Number.isSafeInteger(n) || n > 10_000_000) return mal('El precio máximo es 10.000.000.');
  return ok(n);
}

/** "arroz, pollo, sal" -> lista (máx. 30 elementos de 60 letras). */
export function validarLista(texto: string): Res<string[]> {
  const piezas: string[] = [];
  for (const p of texto.split(',')) {
    const t = p.trim();
    if (t !== '' && !piezas.includes(t)) piezas.push(t);
  }
  if (piezas.length > 30) return mal('Máximo 30 elementos, separados por comas.');
  for (const p of piezas) {
    if (largo(p) > 60) return mal(`"${Array.from(p).slice(0, 20).join('')}…" es muy largo (máximo 60 letras cada uno).`);
    if (CONTROL.test(p)) return mal('El texto tiene caracteres no permitidos.');
  }
  return ok(piezas);
}

/** WhatsApp: 8 a 15 dígitos (se ignoran espacios, +, guiones y paréntesis). Vacío = sin WhatsApp. */
export function validarWhatsapp(texto: string): Res<string | null> {
  const t = texto.replace(/[\s+\-()]/g, '');
  if (t === '') return ok(null);
  if (!/^\d{8,15}$/.test(t)) return mal('Escriba solo números, con indicativo del país (por ejemplo 573001234567).');
  return ok(t);
}

const MENSAJE_ENLACE: Record<TipoEnlace, string> = {
  instagram: 'Escriba el enlace completo de Instagram, que empiece por https://instagram.com/',
  facebook: 'Escriba el enlace completo de Facebook, que empiece por https://facebook.com/',
  tiktok: 'Escriba el enlace completo de TikTok, que empiece por https://tiktok.com/',
  mapa: 'Use un enlace de Google Maps, Waze u OpenStreetMap que empiece por https://',
};

/** Enlace de red social o mapa (lista blanca, https, hasta 300 caracteres). Vacío = sin enlace. */
export function validarEnlace(texto: string, tipo: TipoEnlace): Res<string | null> {
  const t = texto.trim();
  if (t === '') return ok(null);
  if (t.length > 300) return mal('El enlace es demasiado largo (máximo 300 caracteres).');
  const valido = enlacePermitido(t, tipo);
  return valido === null ? mal(MENSAJE_ENLACE[tipo]) : ok(valido);
}

export function validarHex(texto: string): Res<string> {
  return /^#[0-9a-fA-F]{6}$/.test(texto) ? ok(texto) : mal('El color debe tener el formato #RRGGBB.');
}

/** Un error (o null) por cada franja: días, horas y que abre y cierra no coincidan. */
export function erroresHorario(franjas: Franja[]): (string | null)[] {
  const hora = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
  return franjas.map((f) => {
    if (f.dias.length < 1) return 'Marque al menos un día.';
    if (!hora.test(f.abre) || !hora.test(f.cierra)) return 'Escriba la hora de apertura y la de cierre.';
    if (f.abre === f.cierra) return 'La hora de apertura y la de cierre no pueden ser iguales.';
    return null;
  });
}

export function validarSlug(texto: string): Res<string> {
  const t = texto.trim().toLowerCase();
  if (t.length < 3 || t.length > 40) return mal('El enlace debe tener entre 3 y 40 caracteres.');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t)) return mal('Use solo letras minúsculas sin tildes, números y guiones (no al inicio ni al final).');
  if (SLUGS_RESERVADOS.includes(t)) return mal('Ese enlace está reservado. Elija otro.');
  return ok(t);
}

/** Sugiere un slug a partir del nombre: "Café La Esquina" -> "cafe-la-esquina". */
export function slugDesde(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export function validarCorreo(texto: string): Res<string> {
  const t = texto.trim();
  if (t === '') return mal('Escriba su correo.');
  if (t.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return mal('Escriba un correo válido, por ejemplo nombre@correo.com.');
  return ok(t);
}

export function validarClaveNueva(texto: string): Res<string> {
  if (texto.length < 8) return mal('Use al menos 8 caracteres.');
  if (texto.length > 72) return mal('Use 72 caracteres o menos.');
  return ok(texto);
}
