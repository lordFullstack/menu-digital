// Ayudas para construir el DOM con createElement y textContent (sin marcado de texto).
import { rutaLocalSegura, urlSegura } from '../datos';

export function el<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  clase?: string,
  texto?: string,
): HTMLElementTagNameMap[K] {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}

const NS_SVG = 'http://www.w3.org/2000/svg';

/** Icono SVG de trazo (24x24) creado por DOM; decorativo (aria-hidden). */
export function icono(trazos: string[], clase = 'icono'): SVGSVGElement {
  const s = document.createElementNS(NS_SVG, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('focusable', 'false');
  s.setAttribute('class', clase);
  for (const d of trazos) {
    const p = document.createElementNS(NS_SVG, 'path');
    p.setAttribute('d', d);
    s.appendChild(p);
  }
  return s;
}

/** Texto solo para lectores de pantalla. */
export function soloLectores(texto: string): HTMLSpanElement {
  return el('span', 'solo-lectores', texto);
}

/** Bloque de color con la inicial, para imágenes que faltan o fallan. */
export function crearFallback(nombre: string): HTMLElement {
  const limpio = nombre.trim();
  const inicial = limpio ? Array.from(limpio)[0].toLocaleUpperCase('es') : '?';
  const bloque = el('div', 'foto-fallback');
  bloque.setAttribute('role', 'img');
  bloque.setAttribute('aria-label', limpio || 'Sin foto');
  bloque.appendChild(el('span', 'foto-fallback-letra', inicial));
  return bloque;
}

/**
 * Imagen segura: la ruta pasa por rutaLocalSegura() (solo fotos locales); si es inválida o la imagen falla,
 * se reemplaza por un bloque de color con la inicial.
 */
export function crearImagen(
  ruta: string | undefined,
  alt: string,
  nombre: string,
  ancho: number,
  alto: number,
  prioritaria = false,
): HTMLElement {
  const url = rutaLocalSegura(ruta);
  if (!url) return crearFallback(nombre);
  const img = el('img', 'foto');
  img.addEventListener('error', () => img.replaceWith(crearFallback(nombre)), { once: true });
  img.alt = alt;
  img.width = ancho;
  img.height = alto;
  img.decoding = 'async';
  if (prioritaria) {
    img.loading = 'eager';
    img.setAttribute('fetchpriority', 'high');
  } else {
    img.loading = 'lazy';
  }
  img.src = url;
  return img;
}

/** Enlace externo seguro (https) con rel correcto; null si la URL no es válida. */
export function enlaceExterno(texto: string, ruta: string | undefined, clase: string): HTMLAnchorElement | null {
  const url = urlSegura(ruta);
  if (!url) return null;
  const a = el('a', clase, texto);
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}
