// Lista de platos agrupada por categoría, con interruptor "Agotado" que guarda al instante.
import { formatearPrecio } from '../../datos/utilidades';
import { urlFoto } from '../../supabase/cliente';
import * as api from '../api';
import { guardando } from '../avisos';
import type { Ctx } from '../contexto';
import { negocioActual } from '../estado';
import { LIMITE_CATEGORIAS, LIMITE_PLATOS, type CategoriaFila, type PlatoFila } from '../tipos';
import { cargando, con, el, enlaceInterno, enlaceVolver, errorDeCarga, interruptor, nota } from '../ui';

function miniatura(p: PlatoFila): HTMLElement {
  const caja = el('span', 'miniatura');
  const inicial = Array.from(p.nombre.trim())[0]?.toLocaleUpperCase('es') ?? '?';
  const fallback = (): void => caja.replaceChildren(el('span', 'miniatura-letra', inicial));
  const url = urlFoto(p.foto_ruta);
  if (!url) {
    fallback();
    return caja;
  }
  const img = el('img', 'miniatura-img');
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', fallback, { once: true });
  img.src = url;
  caja.appendChild(img);
  return caja;
}

export async function pantallaPlatos(c: Ctx): Promise<void> {
  const n = negocioActual();
  if (!n) return c.ir('#/elegir');
  c.cont.replaceChildren(cargando());
  let categorias: CategoriaFila[];
  let platos: PlatoFila[];
  try {
    [categorias, platos] = await Promise.all([api.listarCategorias(n.id), api.listarPlatos(n.id)]);
  } catch {
    c.cont.replaceChildren(enlaceVolver('#/'), errorDeCarga(c.repintar));
    return;
  }

  const sinCategorias = categorias.length === 0;
  const llenos = platos.length >= LIMITE_PLATOS;
  const nuevo = sinCategorias
    ? null
    : llenos
      ? nota(`Llegó al máximo de ${LIMITE_PLATOS} platos.`)
      : enlaceInterno('+ Plato', '#/plato/nuevo', 'boton boton--primario');

  const cabecera = con(
    el('div', 'encabezado'),
    el('h1', 'titulo', 'Platos'),
    con(
      el('div', 'acciones'),
      nuevo,
      enlaceInterno(`Categorías (${categorias.length}/${LIMITE_CATEGORIAS})`, '#/categorias', 'boton boton--secundario'),
    ),
  );
  const partes: Node[] = [enlaceVolver('#/'), cabecera];

  if (sinCategorias) {
    partes.push(nota('Para agregar platos, primero cree al menos una categoría (por ejemplo: Entradas, Platos fuertes, Bebidas).', 'vacio'));
  }

  for (const cat of categorias) {
    const propios = platos.filter((p) => p.categoria_id === cat.id);
    const seccion = el('section', 'grupo');
    seccion.appendChild(el('h2', 'grupo-titulo', cat.nombre));
    if (propios.length === 0) {
      seccion.appendChild(nota('Esta categoría todavía no tiene platos.', 'vacio vacio--suave'));
    } else {
      const ul = el('ul', 'lista-platos');
      for (const p of propios) {
        const li = el('li', 'fila-plato');
        const enlace = el('a', 'fila-plato-datos');
        enlace.href = `#/plato/${p.id}`;
        const textos = el('span', 'fila-plato-textos');
        textos.append(
          el('span', 'fila-plato-nombre', p.nombre),
          el('span', 'fila-plato-precio', formatearPrecio(p.precio, 'COP')),
        );
        enlace.append(miniatura(p), textos);
        const agotado = interruptor('Agotado', p.agotado, (activo, input) => {
          void (async () => {
            input.disabled = true;
            const r = await guardando(() => api.actualizarPlato(p.id, { agotado: activo }));
            input.disabled = false;
            if (r.ok) p.agotado = activo;
            else input.checked = !activo;
          })();
        });
        agotado.input.setAttribute('aria-label', `Agotado: ${p.nombre}`);
        li.append(enlace, agotado.raiz);
        ul.appendChild(li);
      }
      seccion.appendChild(ul);
    }
    partes.push(seccion);
  }
  c.cont.replaceChildren(...partes);
}
