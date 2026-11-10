// Interfaz del menú: monta las 6 pantallas a partir de menu.json + tema.json.
import type { Menu, Plato, Tema } from '../datos';
import { aplicarTema } from '../tema';
import { crearAvisoCopia } from './aviso';
import { activarBarra, crearBarra } from './barra';
import { crearDetalle } from './detalle';
import { el } from './dom';
import { crearPie } from './pie';
import { crearPortada } from './portada';
import { crearSeccion, crearVitrina } from './secciones';

export { mostrarCarga, mostrarError, mostrarNoEncontrado } from './estados';

function actualizarColorNavegador(): void {
  const fondo = getComputedStyle(document.documentElement).getPropertyValue('--c-fondo').trim();
  if (!fondo) return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = fondo;
}

export function montarApp(raiz: HTMLElement, datos: { menu: Menu; tema: Tema; desdeCopia?: boolean }): void {
  const { menu, tema } = datos;
  const { negocio } = menu;

  // Los ajustes de contraste son para el dueño: nunca se muestran al cliente final.
  const { ajustes } = aplicarTema(tema);
  if (ajustes.length > 0) console.info('[Menú] Ajustes de color aplicados (para el dueño):', ajustes);
  actualizarColorNavegador();
  document.title = negocio.nombre;

  // Las categorías sin platos no se pintan.
  const categorias = menu.categorias.filter((c) => c.platos.length > 0);
  const items = categorias.map((c, i) => ({ id: `cat-${i}`, nombre: c.nombre }));

  const detalle = crearDetalle(negocio);
  const alAbrir = (plato: Plato, categoria: string, disparador: HTMLElement): void =>
    detalle.abrir(plato, categoria, disparador);

  const portada = crearPortada(negocio, items.length > 0 ? items[0].id : null);
  const barra = crearBarra(items);
  const principal = el('main', 'principal');
  principal.id = 'contenido';

  const recomendados = categorias.flatMap((c) =>
    c.platos.filter((p) => p.recomendado).map((plato) => ({ plato, categoria: c.nombre })),
  );

  categorias.forEach((categoria, i) => {
    principal.appendChild(crearSeccion(categoria, items[i].id, negocio, alAbrir));
    if (i === 0 && recomendados.length > 0) principal.appendChild(crearVitrina(recomendados, negocio, alAbrir));
  });
  if (categorias.length === 0) {
    const vacio = el('div', 'contenedor');
    vacio.appendChild(el('p', 'estado-vacio', 'Este menú todavía no tiene platos.'));
    principal.appendChild(vacio);
  }

  // Primer elemento enfocable: salta la portada y la barra y lleva directo al contenido.
  const saltar = el('a', 'saltar-contenido', 'Saltar al contenido');
  saltar.href = '#contenido';
  saltar.addEventListener('click', (e) => {
    e.preventDefault(); // sin cambiar la URL (evita romper rutas relativas y el historial)
    principal.tabIndex = -1;
    principal.focus();
    principal.scrollIntoView({ block: 'start' });
  });

  raiz.replaceChildren(saltar);
  if (datos.desdeCopia) raiz.appendChild(crearAvisoCopia());
  raiz.appendChild(portada);
  if (items.length > 0) raiz.appendChild(barra);
  raiz.append(principal, crearPie(negocio), detalle.elemento);
  activarBarra(barra, items);
}
