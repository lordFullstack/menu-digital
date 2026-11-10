// Piezas de interfaz del panel, todas con createElement y textContent (sin marcado de texto).
let contador = 0;
export const nuevoId = (prefijo = 'c'): string => `${prefijo}-${++contador}`;

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

/** Agrega hijos ignorando los vacíos (null, undefined, false). */
export function con<T extends HTMLElement>(padre: T, ...hijos: (Node | null | undefined | false)[]): T {
  for (const h of hijos) if (h) padre.appendChild(h);
  return padre;
}

// ───────── Iconos (trazos SVG decorativos) ─────────

const NS_SVG = 'http://www.w3.org/2000/svg';

export const ICONOS = {
  atras: ['M15 18l-6-6 6-6'],
  mas: ['M12 5v14', 'M5 12h14'],
  arriba: ['M18 15l-6-6-6 6'],
  abajo: ['M6 9l6 6 6-6'],
  descarga: ['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14'],
  externo: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  salir: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  camara: ['M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  platos: ['M4 3v8a3 3 0 0 0 3 3v7', 'M7 3v6', 'M10 3v8a3 3 0 0 1-3 3', 'M18 3c-2 2-3 5-3 8h3v10'],
  paleta: ['M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.6-.3-1-.6-1.4-.3-.4-.4-.8-.4-1.2 0-1.1.9-2 2-2h2.3A3.7 3.7 0 0 0 21 11c0-4-4-8-9-8z'],
  tienda: ['M4 9l1-5h14l1 5', 'M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0', 'M5 12v8h14v-8', 'M10 20v-5h4v5'],
  negocios: ['M3 21h18', 'M5 21V7l7-4 7 4v14', 'M9 21v-6h6v6'],
  cambiar: ['M7 7h13l-3-3', 'M17 17H4l3 3'],
} satisfies Record<string, string[]>;

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

// ───────── Botones y enlaces ─────────

export interface OpcionesBoton {
  variante?: 'primario' | 'secundario' | 'peligro' | 'texto';
  icono?: string[];
  tipo?: 'button' | 'submit';
  alClic?: (e: MouseEvent) => void;
  clase?: string;
}

export function boton(texto: string, o: OpcionesBoton = {}): HTMLButtonElement {
  const b = el('button', `boton boton--${o.variante ?? 'secundario'}${o.clase ? ' ' + o.clase : ''}`);
  b.type = o.tipo ?? 'button';
  if (o.icono) b.appendChild(icono(o.icono));
  b.appendChild(el('span', undefined, texto));
  if (o.alClic) b.addEventListener('click', o.alClic);
  return b;
}

/** Enlace interno (hash) con aspecto de botón o de enlace. */
export function enlaceInterno(texto: string, hash: string, clase = 'boton boton--secundario', trazos?: string[]): HTMLAnchorElement {
  const a = el('a', clase);
  a.href = hash;
  if (trazos) a.appendChild(icono(trazos));
  a.appendChild(el('span', undefined, texto));
  return a;
}

export function enlaceVolver(hash: string, texto = 'Volver'): HTMLAnchorElement {
  return enlaceInterno(texto, hash, 'enlace-volver', ICONOS.atras);
}

/** Deshabilita un botón mientras corre una acción y lo vuelve a habilitar al terminar. */
export async function ocupado<T>(b: HTMLButtonElement, accion: () => Promise<T>): Promise<T> {
  b.disabled = true;
  b.setAttribute('aria-busy', 'true');
  try {
    return await accion();
  } finally {
    b.disabled = false;
    b.removeAttribute('aria-busy');
  }
}

// ───────── Campos de formulario ─────────

export interface Campo {
  raiz: HTMLElement;
  input: HTMLInputElement | HTMLTextAreaElement;
  valor(): string;
  poner(v: string): void;
  error(mensaje: string | null): void;
}

export interface OpcionesCampo {
  etiqueta: string;
  valor?: string;
  tipo?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'time';
  ayuda?: string;
  autocompletar?: string;
  modo?: 'text' | 'numeric' | 'tel' | 'email' | 'url';
  multilinea?: boolean;
  filas?: number;
  requerido?: boolean;
}

export function campo(o: OpcionesCampo): Campo {
  const id = nuevoId('campo');
  const raiz = el('div', 'campo');
  const etiqueta = el('label', 'campo-etiqueta', o.etiqueta);
  etiqueta.htmlFor = id;
  const entrada = o.multilinea ? el('textarea', 'campo-entrada') : el('input', 'campo-entrada');
  entrada.id = id;
  if (entrada instanceof HTMLInputElement) {
    entrada.type = o.tipo ?? 'text';
    if (o.modo) entrada.inputMode = o.modo;
  } else {
    entrada.rows = o.filas ?? 3;
  }
  if (o.autocompletar) entrada.autocomplete = o.autocompletar as AutoFill;
  if (o.requerido) entrada.required = true;
  entrada.spellcheck = o.tipo === 'email' || o.tipo === 'password' || o.tipo === 'url' ? false : true;
  entrada.value = o.valor ?? '';
  const describe: string[] = [];
  raiz.appendChild(etiqueta);
  if (o.ayuda) {
    const a = el('p', 'campo-ayuda', o.ayuda);
    a.id = `${id}-ayuda`;
    describe.push(a.id);
    raiz.appendChild(a);
  }
  raiz.appendChild(entrada);
  const err = el('p', 'campo-error');
  err.id = `${id}-error`;
  err.hidden = true;
  raiz.appendChild(err);
  if (describe.length) entrada.setAttribute('aria-describedby', describe.join(' '));
  return {
    raiz,
    input: entrada,
    valor: () => entrada.value,
    poner: (v) => {
      entrada.value = v;
    },
    error: (m) => {
      err.textContent = m ?? '';
      err.hidden = m === null;
      if (m === null) {
        entrada.removeAttribute('aria-invalid');
        if (describe.length) entrada.setAttribute('aria-describedby', describe.join(' '));
        else entrada.removeAttribute('aria-describedby');
      } else {
        entrada.setAttribute('aria-invalid', 'true');
        entrada.setAttribute('aria-describedby', [...describe, err.id].join(' '));
      }
    },
  };
}

export interface OpcionSeleccion {
  valor: string;
  texto: string;
}

export function seleccion(
  etiqueta: string,
  opciones: OpcionSeleccion[],
  valor: string,
): { raiz: HTMLElement; select: HTMLSelectElement; error(m: string | null): void } {
  const id = nuevoId('campo');
  const raiz = el('div', 'campo');
  const lab = el('label', 'campo-etiqueta', etiqueta);
  lab.htmlFor = id;
  const select = el('select', 'campo-entrada');
  select.id = id;
  for (const op of opciones) {
    const o = el('option', undefined, op.texto);
    o.value = op.valor;
    select.appendChild(o);
  }
  select.value = valor;
  const err = el('p', 'campo-error');
  err.hidden = true;
  err.id = `${id}-error`;
  raiz.append(lab, select, err);
  return {
    raiz,
    select,
    error: (m) => {
      err.textContent = m ?? '';
      err.hidden = m === null;
      if (m === null) {
        select.removeAttribute('aria-invalid');
        select.removeAttribute('aria-describedby');
      } else {
        select.setAttribute('aria-invalid', 'true');
        select.setAttribute('aria-describedby', err.id);
      }
    },
  };
}

/** Interruptor accesible (checkbox con role="switch"). */
export function interruptor(
  texto: string,
  valor: boolean,
  alCambiar?: (activo: boolean, input: HTMLInputElement) => void,
): { raiz: HTMLLabelElement; input: HTMLInputElement } {
  const raiz = el('label', 'interruptor');
  const input = el('input', 'interruptor-entrada');
  input.type = 'checkbox';
  input.setAttribute('role', 'switch');
  input.checked = valor;
  const pista = el('span', 'interruptor-pista');
  pista.setAttribute('aria-hidden', 'true');
  pista.appendChild(el('span', 'interruptor-bola'));
  raiz.append(input, pista, el('span', 'interruptor-texto', texto));
  if (alCambiar) input.addEventListener('change', () => alCambiar(input.checked, input));
  return { raiz, input };
}

/** Casilla simple con etiqueta visible. */
export function casilla(texto: string, valor: boolean): { raiz: HTMLLabelElement; input: HTMLInputElement } {
  const raiz = el('label', 'casilla');
  const input = el('input', 'casilla-entrada');
  input.type = 'checkbox';
  input.checked = valor;
  raiz.append(input, el('span', 'casilla-texto', texto));
  return { raiz, input };
}

/** Texto informativo tranquilo (no es una alerta). */
export function nota(texto: string, clase = 'nota'): HTMLParagraphElement {
  return el('p', clase, texto);
}

// ───────── Confirmaciones con <dialog> ─────────

export interface OpcionesConfirmar {
  titulo: string;
  mensaje: string;
  aceptar: string;
  peligro?: boolean;
}

export function confirmar(o: OpcionesConfirmar): Promise<boolean> {
  return new Promise((resolver) => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const d = el('dialog', 'dialogo');
    const idTitulo = nuevoId('dialogo');
    d.setAttribute('aria-labelledby', idTitulo);
    const titulo = el('h2', 'dialogo-titulo', o.titulo);
    titulo.id = idTitulo;
    const cancelar = boton('Cancelar', { variante: 'secundario', alClic: () => d.close('no') });
    const aceptar = boton(o.aceptar, { variante: o.peligro ? 'peligro' : 'primario', alClic: () => d.close('si') });
    d.append(titulo, el('p', 'dialogo-texto', o.mensaje), con(el('div', 'dialogo-acciones'), cancelar, aceptar));
    d.addEventListener('close', () => {
      const respuesta = d.returnValue === 'si';
      d.remove();
      previo?.focus();
      resolver(respuesta);
    });
    document.body.appendChild(d);
    d.showModal();
    cancelar.focus();
  });
}

/** Pantalla de "Cargando…" dentro de un contenedor. */
export function cargando(texto = 'Cargando…'): HTMLElement {
  const p = el('p', 'cargando', texto);
  p.setAttribute('role', 'status');
  return p;
}

/** Bloque de error de carga con botón para reintentar. */
export function errorDeCarga(reintentar: () => void, texto = 'No se pudo cargar la información. Revise su conexión e intente de nuevo.'): HTMLElement {
  const b = el('div', 'vacio vacio--error');
  b.append(el('p', undefined, texto), boton('Reintentar', { variante: 'primario', alClic: reintentar }));
  return b;
}
