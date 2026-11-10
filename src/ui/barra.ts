// Pantalla 2: barra de categorías pegajosa, con categoría activa vía IntersectionObserver.
import { el } from './dom';

export interface ItemBarra {
  id: string;
  nombre: string;
}

export function crearBarra(items: ItemBarra[]): HTMLElement {
  const nav = el('nav', 'barra');
  nav.dataset.anim = 'barra';
  nav.setAttribute('aria-label', 'Categorías del menú');
  const lista = el('ul', 'barra-lista');
  for (const item of items) {
    const li = el('li');
    const a = el('a', 'pastilla', item.nombre);
    a.href = `#${item.id}`;
    a.dataset.destino = item.id;
    li.appendChild(a);
    lista.appendChild(li);
  }
  nav.appendChild(lista);
  return nav;
}

/** Conecta la barra con las secciones: clic = scroll suave; scroll = categoría activa. */
export function activarBarra(nav: HTMLElement, items: ItemBarra[]): void {
  const lista = nav.querySelector<HTMLElement>('.barra-lista');
  if (!lista || items.length === 0) return;
  const enlaces = new Map<string, HTMLAnchorElement>();
  nav.querySelectorAll<HTMLAnchorElement>('a[data-destino]').forEach((a) => {
    if (a.dataset.destino) enlaces.set(a.dataset.destino, a);
  });

  let activa = '';
  const marcar = (id: string): void => {
    if (id === activa) return;
    activa = id;
    enlaces.forEach((a, clave) => {
      if (clave === id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    const pastilla = enlaces.get(id);
    if (pastilla) {
      // Desplaza solo la barra (no la página) para dejar la pastilla centrada.
      const izquierda = pastilla.offsetLeft - (lista.clientWidth - pastilla.offsetWidth) / 2;
      lista.scrollTo({ left: Math.max(0, izquierda) });
    }
  };

  // Línea de referencia: borde inferior de la barra + margen que ya usan los títulos (scroll-margin-top).
  let linea = 0;
  let bloqueadoHasta = 0;
  const recalcular = (): void => {
    if (performance.now() < bloqueadoHasta) return;
    const alFinal = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    let id = items[0].id;
    if (alFinal) {
      id = items[items.length - 1].id;
    } else {
      for (const item of items) {
        const seccion = document.getElementById(item.id);
        if (seccion && seccion.getBoundingClientRect().top <= linea + 2) id = item.id;
      }
    }
    marcar(id);
  };

  nav.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-destino]');
    const id = a?.dataset.destino;
    if (!a || !id) return;
    const destino = document.getElementById(id);
    if (!destino) return;
    e.preventDefault();
    marcar(id);
    // Ignora pasos intermedios del scroll suave: se libera cuando la posición deja de cambiar.
    bloqueadoHasta = Infinity;
    const inicio = performance.now();
    let ultima = Number.NaN;
    const vigilar = (): void => {
      const y = window.scrollY;
      if ((y === ultima && performance.now() - inicio > 200) || performance.now() - inicio > 5000) {
        bloqueadoHasta = 0;
        recalcular();
        return;
      }
      ultima = y;
      window.setTimeout(vigilar, 150);
    };
    window.setTimeout(vigilar, 150);
    destino.scrollIntoView();
  });

  let observador: IntersectionObserver | null = null;
  const observar = (): void => {
    observador?.disconnect();
    const alto = Math.round(nav.getBoundingClientRect().height);
    const primera = document.getElementById(items[0].id);
    const margen = primera ? parseFloat(getComputedStyle(primera).scrollMarginTop) : NaN;
    linea = Math.round(Number.isFinite(margen) && margen > 0 ? margen : alto);
    const inferior = Math.max(0, window.innerHeight - linea - 1);
    // El observador solo vigila una franja de 1px en la línea: avisa cuando un borde de sección la cruza.
    observador = new IntersectionObserver(() => recalcular(), { rootMargin: `-${linea}px 0px -${inferior}px 0px` });
    for (const item of items) {
      const seccion = document.getElementById(item.id);
      if (seccion) observador.observe(seccion);
    }
    const vitrina = document.getElementById('recomendados');
    if (vitrina) observador.observe(vitrina);
    const pie = nav.parentElement?.lastElementChild;
    if (pie) observador.observe(pie);
    recalcular();
  };

  marcar(items[0].id);
  observar();
  // Al terminar cualquier desplazamiento (incluido el final del documento) se vuelve a evaluar.
  window.addEventListener('scrollend', () => {
    if (bloqueadoHasta !== Infinity) recalcular();
  });
  let pendiente = 0;
  window.addEventListener('resize', () => {
    window.cancelAnimationFrame(pendiente);
    pendiente = window.requestAnimationFrame(observar);
  });
}
