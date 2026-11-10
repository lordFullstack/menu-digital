/**
 * Motor de tema 60-30-10 (MENU-001).
 *
 * Entrada: 3 colores (fondo 60 %, superficie 30 %, acento 10 %) y un par tipográfico.
 * Salida: todas las variables CSS del contrato con contraste WCAG garantizado.
 *
 * Matemática propia, sin dependencias:
 *  - Contraste: sRGB -> luz lineal -> luminancia relativa -> razón WCAG 2.x.
 *  - Tonos derivados: OKLCH (Ottosson). Se mueve la luminosidad L en pasos pequeños
 *    conservando tono y croma, y se reduce el croma si el color sale de sRGB.
 *    Cada candidato se redondea a #RRGGBB y el contraste se mide sobre ese valor final.
 *
 * Nota de límites matemáticos: si la luminancia relativa de un fondo está entre ~0,10 y ~0,30
 * (gris medio, verdes/azules medios), ni el blanco ni el negro llegan a 7:1. En ese caso se usa
 * el mejor texto posible (siempre >= 4,5:1) y se avisa en `ajustes`.
 */
import type { Tema, IdPlantilla, ParTipografico } from '../datos/tipos';

// ───────────────────────── Plantillas ─────────────────────────

export const PLANTILLAS: Record<IdPlantilla, Tema> = {
  cafeteria: {
    version: 1,
    plantilla: 'cafeteria',
    colores: { fondo: '#F5EFE6', superficie: '#3B2A20', acento: '#C8553D' },
    tipografia: 'clasica',
  },
  elegante: {
    version: 1,
    plantilla: 'elegante',
    colores: { fondo: '#141414', superficie: '#2A2622', acento: '#C9A227' },
    tipografia: 'clasica',
  },
  heladeria: {
    version: 1,
    plantilla: 'heladeria',
    colores: { fondo: '#FBF8F3', superficie: '#2F6F62', acento: '#FF6B5B' },
    tipografia: 'calida',
  },
  rapida: {
    version: 1,
    plantilla: 'rapida',
    colores: { fondo: '#FFFFFF', superficie: '#1B1B1B', acento: '#E63946' },
    tipografia: 'moderna',
  },
};

// ───────────────────────── Tipografías ─────────────────────────

const SANS_SISTEMA = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const SERIF_SISTEMA = "Georgia, 'Times New Roman', serif";

const FUENTES: Record<ParTipografico, { titulos: string; texto: string }> = {
  clasica: {
    titulos: `'Playfair Display Variable', ${SERIF_SISTEMA}`,
    texto: `'Inter Variable', ${SANS_SISTEMA}`,
  },
  moderna: {
    titulos: `'Sora Variable', ${SANS_SISTEMA}`,
    texto: `'Inter Variable', ${SANS_SISTEMA}`,
  },
  calida: {
    titulos: `'Fraunces Variable', ${SERIF_SISTEMA}`,
    texto: `'Nunito Variable', ${SANS_SISTEMA}`,
  },
};

// ───────────────────────── Color: base ─────────────────────────

const REGEX_HEX = /^#[0-9a-fA-F]{6}$/;

function validarHex(valor: unknown, nombre: string): string {
  if (typeof valor !== 'string' || !REGEX_HEX.test(valor)) {
    throw new Error(`El color "${nombre}" no es válido: debe tener el formato #RRGGBB.`);
  }
  return valor.toUpperCase();
}

type RGB = [number, number, number]; // 0..255 enteros

function hexARgb(hex: string): RGB {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbAHex(rgb: RGB): string {
  return (
    '#' +
    rgb
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

const aLineal = (c8: number): number => {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const deLineal = (c: number): number => {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return v * 255;
};

function luminancia(hex: string): number {
  const [r, g, b] = hexARgb(hex).map(aLineal) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste WCAG 2.x entre dos colores #RRGGBB (1 a 21). */
export function contraste(a: string, b: string): number {
  const la = luminancia(validarHex(a, 'a'));
  const lb = luminancia(validarHex(b, 'b'));
  const [alto, bajo] = la >= lb ? [la, lb] : [lb, la];
  return (alto + 0.05) / (bajo + 0.05);
}

// ───────────────────────── Color: OKLCH ─────────────────────────

interface Lch {
  L: number;
  C: number;
  h: number; // radianes
}

function hexALch(hex: string): Lch {
  const [r, g, b] = hexARgb(hex).map(aLineal) as RGB;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), h: Math.atan2(B, A) };
}

function lchALinealRgb({ L, C, h }: Lch): RGB {
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
  const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
  const s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const dentroDeGama = (rgb: RGB): boolean => rgb.every((v) => v >= -0.0005 && v <= 1.0005);

/** Convierte OKLCH a #RRGGBB; si se sale de sRGB reduce el croma hasta que quepa. */
function lchAHex(lch: Lch): string {
  const L = Math.max(0, Math.min(1, lch.L));
  let C = Math.max(0, lch.C);
  let rgb = lchALinealRgb({ L, C, h: lch.h });
  if (!dentroDeGama(rgb)) {
    let bajo = 0;
    let alto = C;
    for (let i = 0; i < 24; i++) {
      const medio = (bajo + alto) / 2;
      if (dentroDeGama(lchALinealRgb({ L, C: medio, h: lch.h }))) bajo = medio;
      else alto = medio;
    }
    C = bajo;
    rgb = lchALinealRgb({ L, C, h: lch.h });
  }
  return rgbAHex(rgb.map((v) => deLineal(Math.max(0, Math.min(1, v)))) as RGB);
}

/** Mezcla `a` hacia `b` en OKLab (t=0 -> a, t=1 -> b). */
function mezclar(a: string, b: string, t: number): string {
  const pa = hexALch(a);
  const pb = hexALch(b);
  const Aa = pa.C * Math.cos(pa.h);
  const Ba = pa.C * Math.sin(pa.h);
  const Ab = pb.C * Math.cos(pb.h);
  const Bb = pb.C * Math.sin(pb.h);
  const A = Aa + (Ab - Aa) * t;
  const B = Ba + (Bb - Ba) * t;
  return lchAHex({ L: pa.L + (pb.L - pa.L) * t, C: Math.hypot(A, B), h: Math.atan2(B, A) });
}

// ───────────────────────── Derivación con contraste ─────────────────────────

const PASO_L = 0.004;
const BLANCO = '#FFFFFF';
const NEGRO = '#000000';

const mejorBlancoNegro = (fondo: string): string =>
  contraste(BLANCO, fondo) >= contraste(NEGRO, fondo) ? BLANCO : NEGRO;

/**
 * Mueve la luminosidad de `base` en la dirección `dir` (+1 más claro, -1 más oscuro)
 * hasta cumplir `minimo` sobre `fondo`. Devuelve null si no lo logra antes del extremo.
 */
function empujar(base: Lch, fondo: string, minimo: number, dir: 1 | -1): { hex: string; pasos: number } | null {
  const maxPasos = Math.ceil(1 / PASO_L);
  for (let k = 0; k <= maxPasos; k++) {
    const L = base.L + dir * k * PASO_L;
    if (L < 0 - PASO_L || L > 1 + PASO_L) break;
    const hex = lchAHex({ ...base, L });
    if (contraste(hex, fondo) >= minimo) return { hex, pasos: k };
  }
  return null;
}

interface ResultadoTexto {
  hex: string;
  cumple: boolean; // true si alcanzó `ideal`
}

/**
 * Texto principal sobre `fondo`: color con el tono del fondo, casi neutro, tan cercano al
 * extremo (negro/blanco) como haga falta. Si `ideal` es inalcanzable usa el mejor posible
 * (siempre >= 4,5:1) y devuelve cumple=false.
 */
function textoSobre(fondo: string, ideal: number): ResultadoTexto {
  const tono = hexALch(fondo);
  const base = { C: Math.min(tono.C, 0.03), h: tono.h };
  const oscuro = mejorBlancoNegro(fondo) === NEGRO;
  const intento = oscuro
    ? empujar({ ...base, L: 0.24 }, fondo, ideal, -1)
    : empujar({ ...base, L: 0.96 }, fondo, ideal, 1);
  if (intento) return { hex: intento.hex, cumple: true };
  return { hex: oscuro ? NEGRO : BLANCO, cumple: contraste(oscuro ? NEGRO : BLANCO, fondo) >= ideal };
}

/** Texto secundario: del texto principal hacia el fondo, lo más suave que aún cumple `minimo`. */
function textoSuave(principal: string, fondo: string, minimo: number): string {
  const objetivo = minimo + 0.1; // pequeño margen frente al redondeo
  if (contraste(principal, fondo) < objetivo) return principal;
  let bajo = 0; // t con contraste suficiente
  let alto = 1;
  for (let i = 0; i < 20; i++) {
    const medio = (bajo + alto) / 2;
    if (contraste(mezclar(principal, fondo, medio), fondo) >= objetivo) bajo = medio;
    else alto = medio;
  }
  return mezclar(principal, fondo, bajo);
}

/** Acento usado como texto: se conserva si ya cumple; si no, se oscurece/aclara lo mínimo. */
function acentoComoTexto(acento: string, fondo: string, minimo: number): { hex: string; ajustado: boolean } {
  if (contraste(acento, fondo) >= minimo) return { hex: acento, ajustado: false };
  const base = hexALch(acento);
  const mas = empujar(base, fondo, minimo, 1);
  const menos = empujar(base, fondo, minimo, -1);
  const elegido = [mas, menos]
    .filter((x): x is { hex: string; pasos: number } => x !== null)
    .sort((x, y) => x.pasos - y.pasos)[0];
  return { hex: elegido ? elegido.hex : mejorBlancoNegro(fondo), ajustado: true };
}

/** Texto sobre el color de acento (botones): blanco o casi negro, el que mejor contraste dé. */
function textoSobreAcento(acento: string, minimo: number): string {
  const casiNegro = '#111111';
  const candidato = contraste(BLANCO, acento) >= contraste(casiNegro, acento) ? BLANCO : casiNegro;
  if (contraste(candidato, acento) >= minimo) return candidato;
  return mejorBlancoNegro(acento);
}

/** Variante cercana: se mueve la luminosidad hacia donde apunta el texto (más claro u oscuro). */
function variante(color: string, haciaClaro: boolean, delta: number): string {
  const lch = hexALch(color);
  const sentido = haciaClaro ? 1 : -1;
  // Si no hay espacio en ese sentido (blanco/negro puros), se invierte.
  const espacio = haciaClaro ? 1 - lch.L : lch.L;
  const signo = espacio < delta ? -sentido : sentido;
  return lchAHex({ ...lch, L: lch.L + signo * delta });
}

// ───────────────────────── Paleta ─────────────────────────

interface Construccion {
  paleta: Record<string, string>;
  ajustes: string[];
}

function construir(colores: Tema['colores']): Construccion {
  const fondo = validarHex(colores?.fondo, 'fondo');
  const superficie = validarHex(colores?.superficie, 'superficie');
  const acento = validarHex(colores?.acento, 'acento');
  const ajustes: string[] = [];

  // Texto principal y secundario sobre fondo y sobre superficie (reglas 7:1 y 4,5:1).
  const tFondo = textoSobre(fondo, 7);
  const tSuper = textoSobre(superficie, 7);
  if (!tFondo.cumple) {
    ajustes.push(
      'Con el color de fondo elegido el texto no puede tener el contraste ideal (ni el blanco ni el negro lo logran). Se usó el mejor posible; para que se lea mejor, elige un fondo más claro o más oscuro.',
    );
  }
  if (!tSuper.cumple) {
    ajustes.push(
      'Con el color de las tarjetas elegido el texto no puede tener el contraste ideal (ni el blanco ni el negro lo logran). Se usó el mejor posible; para que se lea mejor, elige un color de tarjetas más claro o más oscuro.',
    );
  }
  const sobreFondo = tFondo.hex;
  const sobreSuperficie = tSuper.hex;
  const sobreFondoSuave = textoSuave(sobreFondo, fondo, 4.5);
  const sobreSuperficieSuave = textoSuave(sobreSuperficie, superficie, 4.5);

  // Acento como texto (precios, enlaces) sobre fondo y sobre superficie.
  const enFondo = acentoComoTexto(acento, fondo, 4.5);
  const enSuperficie = acentoComoTexto(acento, superficie, 4.5);
  if (enFondo.ajustado) {
    ajustes.push(
      'El color de acento se ve poco como texto sobre el fondo, así que en los textos de acento (enlaces, precios sobre el fondo) se usa una versión más clara u oscura. Los botones conservan tu color exacto.',
    );
  }
  if (enSuperficie.ajustado) {
    ajustes.push(
      'El color de acento se ve poco como texto sobre las tarjetas, así que en los precios y textos de acento sobre ellas se usa una versión más clara u oscura. Los botones conservan tu color exacto.',
    );
  }

  const paleta: Record<string, string> = {
    '--c-fondo': fondo,
    '--c-fondo-2': variante(fondo, mejorBlancoNegro(fondo) === BLANCO, 0.04),
    '--c-sobre-fondo': sobreFondo,
    '--c-sobre-fondo-suave': sobreFondoSuave,
    '--c-superficie': superficie,
    '--c-superficie-2': variante(superficie, mejorBlancoNegro(superficie) === BLANCO, 0.05),
    '--c-sobre-superficie': sobreSuperficie,
    '--c-sobre-superficie-suave': sobreSuperficieSuave,
    '--c-acento': acento,
    '--c-sobre-acento': textoSobreAcento(acento, 4.5),
    '--c-acento-en-fondo': enFondo.hex,
    '--c-acento-en-superficie': enSuperficie.hex,
    '--c-borde': mezclar(fondo, sobreFondo, 0.16),
  };
  return { paleta, ajustes };
}

/** Variables CSS (nombre -> valor) para 3 colores #RRGGBB. Lanza Error si algún color es inválido. */
export function generarPaleta(colores: Tema['colores']): Record<string, string> {
  return construir(colores).paleta;
}

/**
 * Escribe las variables del tema en `raiz` (por defecto <html>) con style.setProperty.
 * Todo valor que llega al DOM sale de generarPaleta (hex validado) o de FUENTES (constantes).
 */
export function aplicarTema(tema: Tema, raiz?: HTMLElement): { ajustes: string[] } {
  const fuentes = FUENTES[tema?.tipografia];
  if (!fuentes || !Object.prototype.hasOwnProperty.call(FUENTES, tema.tipografia)) {
    throw new Error('La tipografía elegida no es válida: usa clasica, moderna o calida.');
  }
  const { paleta, ajustes } = construir(tema.colores); // valida antes de tocar el DOM

  const destino = raiz ?? (typeof document !== 'undefined' ? document.documentElement : undefined);
  if (!destino) throw new Error('No hay documento donde aplicar el tema.');

  for (const [nombre, valor] of Object.entries(paleta)) destino.style.setProperty(nombre, valor);
  destino.style.setProperty('--f-titulos', fuentes.titulos);
  destino.style.setProperty('--f-texto', fuentes.texto);
  return { ajustes };
}
