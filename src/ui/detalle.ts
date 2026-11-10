// Pantalla 5: detalle del plato en un <dialog> modal (panel inferior en móvil).
import { enlaceWhatsApp, formatearPrecio } from '../datos';
import type { Negocio, Plato } from '../datos';
import { crearImagen, el, icono } from './dom';
import { TRAZOS } from './iconos';
import { crearEtiquetas } from './secciones';

export interface Detalle {
  abrir(plato: Plato, categoria: string, disparador: HTMLElement): void;
  elemento: HTMLDialogElement;
}

export function crearDetalle(negocio: Negocio): Detalle {
  const dialogo = el('dialog', 'detalle');
  dialogo.setAttribute('aria-labelledby', 'detalle-titulo');

  const cerrar = el('button', 'detalle-cerrar');
  cerrar.type = 'button';
  cerrar.setAttribute('aria-label', 'Cerrar detalle del plato');
  cerrar.appendChild(icono(TRAZOS.cerrar));
  cerrar.addEventListener('click', () => dialogo.close());

  const cuerpo = el('div', 'detalle-cuerpo');
  const accion = el('div', 'detalle-accion');
  dialogo.append(cerrar, cuerpo, accion);

  let disparadorActual: HTMLElement | null = null;

  // Toque fuera: solo si el gesto empezó y terminó sobre el fondo oscuro.
  let empezoFuera = false;
  dialogo.addEventListener('pointerdown', (e) => {
    empezoFuera = e.target === dialogo;
  });
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo && empezoFuera) dialogo.close();
    empezoFuera = false;
  });

  dialogo.addEventListener('close', () => {
    document.documentElement.classList.remove('detalle-abierto');
    disparadorActual?.focus({ preventScroll: true });
    disparadorActual = null;
  });

  function llenar(plato: Plato, categoria: string): void {
    const precio = formatearPrecio(plato.precio, negocio.moneda);

    const foto = el('div', 'detalle-foto');
    foto.appendChild(crearImagen(plato.foto, plato.nombre, plato.nombre, 800, 600, true));

    const info = el('div', 'detalle-info');
    info.appendChild(el('p', 'detalle-categoria', categoria));
    const titulo = el('h2', 'detalle-titulo', plato.nombre);
    titulo.id = 'detalle-titulo';
    info.append(titulo, el('p', 'detalle-precio', precio));
    const etiquetas = crearEtiquetas(plato.etiquetas);
    if (etiquetas) info.appendChild(etiquetas);
    if (plato.agotado) info.appendChild(el('p', 'detalle-aviso', 'Este plato está agotado por ahora.'));
    if (plato.descripcion) info.appendChild(el('p', 'detalle-descripcion', plato.descripcion));

    if (plato.ingredientes && plato.ingredientes.length > 0) {
      const bloque = el('section', 'detalle-bloque');
      bloque.setAttribute('aria-labelledby', 'detalle-ingredientes');
      const h = el('h3', 'detalle-subtitulo', 'Ingredientes');
      h.id = 'detalle-ingredientes';
      const lista = el('ul', 'chips');
      for (const i of plato.ingredientes) lista.appendChild(el('li', 'chip', i));
      bloque.append(h, lista);
      info.appendChild(bloque);
    }
    if (plato.alergenos && plato.alergenos.length > 0) {
      const bloque = el('section', 'detalle-bloque');
      bloque.setAttribute('aria-labelledby', 'detalle-alergenos');
      const h = el('h3', 'detalle-subtitulo', 'Alérgenos');
      h.id = 'detalle-alergenos';
      bloque.append(h, el('p', 'detalle-alergenos', `Contiene: ${plato.alergenos.join(', ')}.`));
      info.appendChild(bloque);
    }
    cuerpo.replaceChildren(foto, info);
    cuerpo.scrollTop = 0;

    accion.replaceChildren();
    const enlace =
      negocio.whatsapp && !plato.agotado
        ? enlaceWhatsApp(negocio.whatsapp, `Hola, quiero pedir: ${plato.nombre} (${precio})`)
        : null;
    if (enlace) {
      const a = el('a', 'boton boton--completo');
      a.href = enlace;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.append(icono(TRAZOS.whatsapp), el('span', undefined, 'Pedir por WhatsApp'));
      accion.appendChild(a);
      accion.hidden = false;
    } else {
      accion.hidden = true;
    }
  }

  return {
    elemento: dialogo,
    abrir(plato, categoria, disparador) {
      disparadorActual = disparador;
      llenar(plato, categoria);
      document.documentElement.classList.add('detalle-abierto');
      dialogo.showModal();
    },
  };
}
