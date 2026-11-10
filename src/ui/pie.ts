// Pantalla 6: pie con dirección, cómo llegar, redes, horario y firma.
import type { Negocio } from '../datos';
import { el, enlaceExterno, icono } from './dom';
import { TRAZOS } from './iconos';
import { resumirHorario } from './horario';

export const FIRMA = 'Hecho por Synaptix AI Labs · Programando con Sistemas Inteligentes';

export function crearPie(negocio: Negocio): HTMLElement {
  const pie = el('footer', 'pie');
  pie.setAttribute('aria-labelledby', 'pie-titulo');
  const contenedor = el('div', 'contenedor');

  const titulo = el('h2', 'pie-titulo', 'Visítanos');
  titulo.id = 'pie-titulo';
  contenedor.appendChild(el('p', 'pie-nombre', negocio.nombre));
  contenedor.appendChild(titulo);

  const columnas = el('div', 'pie-columnas');

  const lugar = el('div', 'pie-bloque');
  if (negocio.direccion) {
    const direccion = el('address', 'pie-direccion', negocio.direccion);
    lugar.appendChild(direccion);
  }
  const como = enlaceExterno('Cómo llegar', negocio.mapaUrl, 'boton boton--secundario');
  if (como) {
    como.prepend(icono(TRAZOS.pin));
    lugar.appendChild(como);
  }
  const redes: [string, string | undefined][] = [
    ['Instagram', negocio.redes?.instagram],
    ['Facebook', negocio.redes?.facebook],
    ['TikTok', negocio.redes?.tiktok],
  ];
  const listaRedes = el('ul', 'pie-redes');
  for (const [nombre, url] of redes) {
    const a = enlaceExterno(nombre, url, 'enlace-red');
    if (a) {
      const li = el('li');
      li.appendChild(a);
      listaRedes.appendChild(li);
    }
  }
  if (listaRedes.children.length > 0) lugar.appendChild(listaRedes);
  if (lugar.children.length > 0) columnas.appendChild(lugar);

  if (negocio.horario.length > 0) {
    const bloque = el('div', 'pie-bloque');
    bloque.appendChild(el('h3', 'pie-subtitulo', 'Horario'));
    const dl = el('dl', 'horario');
    for (const fila of resumirHorario(negocio.horario)) {
      dl.append(el('dt', undefined, fila.dias), el('dd', undefined, fila.horas));
    }
    bloque.appendChild(dl);
    columnas.appendChild(bloque);
  }

  if (columnas.children.length > 0) contenedor.appendChild(columnas);
  contenedor.appendChild(el('p', 'firma', FIRMA));
  pie.appendChild(contenedor);
  return pie;
}
