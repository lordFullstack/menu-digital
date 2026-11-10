// Pantallas 3 y 4: secciones por categoría, tarjetas de plato y vitrina de recomendados.
import { formatearPrecio } from '../datos';
import type { Categoria, Etiqueta, Negocio, Plato } from '../datos';
import { crearImagen, el, icono, soloLectores } from './dom';
import { ROTULO_ETIQUETA, TRAZOS } from './iconos';

export type AlAbrir = (plato: Plato, categoria: string, disparador: HTMLElement) => void;

export function crearEtiquetas(etiquetas: Etiqueta[] | undefined): HTMLUListElement | null {
  const validas = (etiquetas ?? []).filter((e) => Object.prototype.hasOwnProperty.call(ROTULO_ETIQUETA, e));
  if (validas.length === 0) return null;
  const ul = el('ul', 'etiquetas');
  for (const e of validas) {
    const li = el('li', e === 'nuevo' ? 'etiqueta etiqueta--nuevo' : 'etiqueta');
    li.append(icono(TRAZOS[e]), el('span', undefined, ROTULO_ETIQUETA[e]));
    ul.appendChild(li);
  }
  return ul;
}

export function crearTarjeta(
  plato: Plato,
  categoria: string,
  negocio: Negocio,
  alAbrir: AlAbrir,
  enVitrina: boolean,
): HTMLLIElement {
  const li = el('li');
  const tarjeta = el('article', enVitrina ? 'tarjeta tarjeta--vitrina' : 'tarjeta');
  if (!enVitrina) tarjeta.dataset.anim = 'tarjeta';
  if (plato.agotado) tarjeta.classList.add('tarjeta--agotada');

  const cuerpo = el('div', 'tarjeta-cuerpo');
  const titulo = el('h3', 'tarjeta-nombre');
  const boton = el('button', 'tarjeta-abrir');
  boton.type = 'button';
  boton.setAttribute('aria-haspopup', 'dialog');
  boton.appendChild(document.createTextNode(plato.nombre));
  if (plato.agotado) boton.appendChild(soloLectores(' (agotado)'));
  boton.addEventListener('click', () => alAbrir(plato, categoria, boton));
  titulo.appendChild(boton);
  cuerpo.appendChild(titulo);
  if (plato.descripcion) cuerpo.appendChild(el('p', 'tarjeta-descripcion', plato.descripcion));
  const etiquetas = crearEtiquetas(plato.etiquetas);
  if (etiquetas) cuerpo.appendChild(etiquetas);
  cuerpo.appendChild(el('p', 'tarjeta-precio', formatearPrecio(plato.precio, negocio.moneda)));

  const foto = el('div', 'tarjeta-foto');
  foto.appendChild(crearImagen(plato.foto, plato.nombre, plato.nombre, 800, 600));
  if (plato.agotado) foto.appendChild(el('span', 'insignia-agotado', 'Agotado'));

  tarjeta.append(cuerpo, foto);
  li.appendChild(tarjeta);
  return li;
}

function cabecera(idTitulo: string, titulo: string, apoyo: string): HTMLElement {
  const bloque = el('div', 'seccion-cabecera');
  const h2 = el('h2', 'seccion-titulo', titulo);
  h2.id = idTitulo;
  h2.dataset.anim = 'titulo-seccion';
  bloque.append(h2, el('p', 'seccion-apoyo', apoyo));
  return bloque;
}

export function crearSeccion(
  categoria: Categoria,
  idSeccion: string,
  negocio: Negocio,
  alAbrir: AlAbrir,
): HTMLElement {
  const seccion = el('section', 'seccion');
  seccion.id = idSeccion;
  const idTitulo = `${idSeccion}-titulo`;
  seccion.setAttribute('aria-labelledby', idTitulo);
  const n = categoria.platos.length;
  const contenedor = el('div', 'contenedor');
  contenedor.appendChild(cabecera(idTitulo, categoria.nombre, `${n} ${n === 1 ? 'plato' : 'platos'}`));
  const rejilla = el('ul', 'rejilla');
  for (const plato of categoria.platos) {
    rejilla.appendChild(crearTarjeta(plato, categoria.nombre, negocio, alAbrir, false));
  }
  contenedor.appendChild(rejilla);
  seccion.appendChild(contenedor);
  return seccion;
}

export function crearVitrina(
  recomendados: { plato: Plato; categoria: string }[],
  negocio: Negocio,
  alAbrir: AlAbrir,
): HTMLElement {
  const seccion = el('section', 'vitrina');
  seccion.id = 'recomendados';
  seccion.dataset.anim = 'vitrina';
  seccion.setAttribute('aria-labelledby', 'recomendados-titulo');
  const contenedor = el('div', 'contenedor');
  contenedor.appendChild(cabecera('recomendados-titulo', 'Recomendados de la casa', 'Los favoritos de quienes nos visitan'));
  const pista = el('ul', 'vitrina-pista');
  pista.dataset.anim = 'vitrina-pista';
  for (const { plato, categoria } of recomendados) {
    pista.appendChild(crearTarjeta(plato, categoria, negocio, alAbrir, true));
  }
  contenedor.appendChild(pista);
  seccion.appendChild(contenedor);
  return seccion;
}
