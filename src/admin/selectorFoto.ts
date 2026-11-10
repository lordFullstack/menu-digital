// Selector de foto: vista previa, "Tomar foto" (cámara), "Elegir foto" (galería) y "Quitar foto".
// La foto se reduce al elegirla; se sube recién al guardar el formulario (ver guardarConFotos).
import { urlFoto } from '../supabase/cliente';
import { prepararFoto, TIPOS_FOTO } from './fotos';
import { boton, con, el, ICONOS, nuevoId } from './ui';

export interface SelectorFoto {
  raiz: HTMLElement;
  /** Estado para guardarConFotos. */
  entrada(): { actual: string | null; blob: Blob | null; quitar: boolean };
}

export interface OpcionesSelectorFoto {
  etiqueta: string;
  rutaActual: string | null;
  nombre: string;
  forma?: 'cuadrada' | 'ancha' | 'redonda';
}

export function selectorFoto(o: OpcionesSelectorFoto): SelectorFoto {
  let blob: Blob | null = null;
  let quitar = false;
  const raiz = el('div', `selector-foto selector-foto--${o.forma ?? 'cuadrada'}`);
  const idEtiqueta = nuevoId('foto');
  const titulo = el('p', 'campo-etiqueta', o.etiqueta);
  titulo.id = idEtiqueta;
  raiz.setAttribute('role', 'group');
  raiz.setAttribute('aria-labelledby', idEtiqueta);

  const previa = el('div', 'foto-previa');
  const estado = el('p', 'campo-ayuda');
  estado.setAttribute('aria-live', 'polite');
  const error = el('p', 'campo-error');
  error.hidden = true;

  const inicial = Array.from(o.nombre.trim())[0]?.toLocaleUpperCase('es') ?? '?';
  function mostrarVacio(): void {
    const v = el('div', 'foto-vacia');
    v.setAttribute('role', 'img');
    v.setAttribute('aria-label', 'Sin foto');
    v.appendChild(el('span', undefined, inicial));
    previa.replaceChildren(v);
  }
  function mostrarActual(): void {
    const url = urlFoto(o.rutaActual);
    if (!url) return mostrarVacio();
    const img = el('img', 'foto-img');
    img.alt = `Foto actual de ${o.nombre || 'este elemento'}`;
    img.decoding = 'async';
    img.addEventListener('error', mostrarVacio, { once: true });
    img.src = url;
    previa.replaceChildren(img);
  }
  mostrarActual();

  function ponerError(m: string | null): void {
    error.textContent = m ?? '';
    error.hidden = m === null;
  }

  async function alElegir(entrada: HTMLInputElement): Promise<void> {
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    ponerError(null);
    estado.textContent = 'Preparando la foto…';
    try {
      const preparada = await prepararFoto(archivo);
      blob = preparada.blob;
      quitar = false;
      preparada.lienzo.className = 'foto-img';
      preparada.lienzo.setAttribute('role', 'img');
      preparada.lienzo.setAttribute('aria-label', 'Foto nueva, sin guardar todavía');
      previa.replaceChildren(preparada.lienzo);
      estado.textContent = 'Foto lista. Se guardará al pulsar Guardar.';
      actualizarBotones();
    } catch (e) {
      estado.textContent = '';
      ponerError(e instanceof Error ? e.message : 'No se pudo preparar la foto.');
    }
  }

  function archivo(capture: boolean): HTMLInputElement {
    const i = el('input');
    i.type = 'file';
    i.accept = TIPOS_FOTO.join(',');
    if (capture) i.setAttribute('capture', 'environment');
    i.hidden = true;
    i.tabIndex = -1;
    i.addEventListener('change', () => void alElegir(i));
    return i;
  }
  const inCamara = archivo(true);
  const inGaleria = archivo(false);

  const bCamara = boton('Tomar foto', { icono: ICONOS.camara, alClic: () => inCamara.click() });
  const bGaleria = boton('Elegir foto', { alClic: () => inGaleria.click() });
  const bQuitar = boton('Quitar foto', {
    variante: 'texto',
    alClic: () => {
      blob = null;
      quitar = true;
      mostrarVacio();
      estado.textContent = 'La foto se quitará al pulsar Guardar.';
      actualizarBotones();
    },
  });
  function actualizarBotones(): void {
    bQuitar.hidden = !(blob || (o.rutaActual && !quitar));
  }
  actualizarBotones();

  con(raiz, titulo, previa, con(el('div', 'foto-acciones'), bCamara, bGaleria, bQuitar), estado, error, inCamara, inGaleria);
  return {
    raiz,
    entrada: () => ({ actual: o.rutaActual, blob, quitar }),
  };
}
