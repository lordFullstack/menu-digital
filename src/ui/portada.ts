// Pantalla 1: portada a sangre con logo, nombre, eslogan, estado de apertura y botón "Ver menú".
import { estaAbierto } from '../datos';
import type { Negocio } from '../datos';
import { crearFallback, crearImagen, el } from './dom';

export function crearPortada(negocio: Negocio, idPrimeraSeccion: string | null): HTMLElement {
  const cabecera = el('header', 'portada');
  const tieneFoto = Boolean(negocio.portada);
  if (!tieneFoto) cabecera.classList.add('portada--sin-foto');

  const foto = el('div', 'portada-foto');
  foto.dataset.anim = 'portada-foto';
  foto.setAttribute('aria-hidden', 'true');
  if (tieneFoto) {
    foto.appendChild(crearImagen(negocio.portada, '', negocio.nombre, 1200, 800, true));
  }
  const velo = el('div', 'portada-velo');
  velo.setAttribute('aria-hidden', 'true');

  const contenido = el('div', 'portada-contenido');
  contenido.dataset.anim = 'portada-texto';

  if (negocio.logo) {
    const marco = el('div', 'logo');
    const img = crearImagen(negocio.logo, `Logo de ${negocio.nombre}`, negocio.nombre, 96, 96, true);
    marco.appendChild(img);
    contenido.appendChild(marco);
  } else {
    const marco = el('div', 'logo');
    marco.appendChild(crearFallback(negocio.nombre));
    contenido.appendChild(marco);
  }

  if (negocio.horario.length > 0) {
    const insignia = el('p', 'insignia-estado');
    const punto = el('span', 'insignia-punto');
    punto.setAttribute('aria-hidden', 'true');
    const texto = el('span');
    insignia.append(punto, texto);
    const actualizar = (): void => {
      const abierto = estaAbierto(negocio.horario);
      texto.textContent = abierto ? 'Abierto ahora' : 'Cerrado';
      insignia.classList.toggle('insignia-estado--abierto', abierto);
    };
    actualizar();
    window.setInterval(actualizar, 60_000);
    contenido.appendChild(insignia);
  }

  contenido.appendChild(el('h1', 'portada-titulo', negocio.nombre));
  if (negocio.eslogan) contenido.appendChild(el('p', 'portada-eslogan', negocio.eslogan));

  if (idPrimeraSeccion) {
    const boton = el('a', 'boton', 'Ver menú');
    boton.href = `#${idPrimeraSeccion}`;
    boton.addEventListener('click', (e) => {
      const destino = document.getElementById(idPrimeraSeccion);
      if (!destino) return;
      e.preventDefault();
      destino.scrollIntoView();
    });
    contenido.appendChild(boton);
  }

  cabecera.append(foto, velo, contenido);
  return cabecera;
}
