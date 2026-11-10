// Estados de la aplicación: carga (esqueleto) y error amable.
import { ErrorDeDatos } from '../datos';
import { el, soloLectores } from './dom';

const MAX_ERRORES_VISIBLES = 5;
const MAX_CARACTERES_DETALLE = 600;

/** Detalle para el dueño: primeras 5 líneas y 600 caracteres como máximo. */
function limitarDetalle(texto: string): string {
  const lineas = texto.split('\n');
  // La primera línea es el encabezado; después van los errores, uno por línea ("- ...").
  let salida = lineas.slice(0, 1 + MAX_ERRORES_VISIBLES).join('\n');
  const omitidas = lineas.length - 1 - MAX_ERRORES_VISIBLES;
  if (omitidas > 0) salida += `\n… y ${omitidas} más.`;
  if (salida.length > MAX_CARACTERES_DETALLE) salida = `${salida.slice(0, MAX_CARACTERES_DETALLE - 1)}…`;
  return salida;
}

export function mostrarCarga(raiz: HTMLElement): void {
  const esqueleto = el('div', 'esqueleto');
  esqueleto.setAttribute('role', 'status');
  esqueleto.setAttribute('aria-busy', 'true');
  esqueleto.appendChild(soloLectores('Cargando el menú…'));
  esqueleto.appendChild(el('div', 'esqueleto-portada'));
  const barra = el('div', 'esqueleto-barra');
  for (let i = 0; i < 4; i++) barra.appendChild(el('span', 'esqueleto-pastilla'));
  esqueleto.appendChild(barra);
  const cuerpo = el('div', 'esqueleto-cuerpo');
  for (let i = 0; i < 3; i++) cuerpo.appendChild(el('div', 'esqueleto-tarjeta'));
  esqueleto.appendChild(cuerpo);
  raiz.replaceChildren(esqueleto);
}

export function mostrarError(raiz: HTMLElement, error: unknown, reintentar: () => void): void {
  const detalle = limitarDetalle(error instanceof Error ? error.message : String(error));
  const esDeDatos = error instanceof ErrorDeDatos;
  const pantalla = el('main', 'estado-error');
  const caja = el('div', 'estado-error-caja');
  caja.setAttribute('role', 'alert');
  caja.appendChild(el('h1', 'estado-error-titulo', esDeDatos ? 'El menú tiene un dato por corregir' : 'No pudimos cargar el menú'));
  caja.appendChild(
    el(
      'p',
      'estado-error-texto',
      esDeDatos
        ? 'El menú tiene un dato por corregir. Avísele al personal del local.'
        : 'No pudimos cargar el menú. Revise su conexión e intente de nuevo.',
    ),
  );
  const boton = el('button', 'boton', 'Reintentar');
  boton.type = 'button';
  boton.addEventListener('click', reintentar);
  caja.appendChild(boton);
  if (detalle) {
    const d = el('details', 'estado-error-detalle');
    d.appendChild(el('summary', undefined, 'Detalles técnicos'));
    d.appendChild(el('pre', undefined, detalle));
    caja.appendChild(d);
  }
  pantalla.appendChild(caja);
  raiz.replaceChildren(pantalla);
}
