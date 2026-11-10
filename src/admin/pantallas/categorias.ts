// Categorías: crear, renombrar, subir/bajar y eliminar (avisando que borra sus platos).
import * as api from '../api';
import { guardando } from '../avisos';
import type { Ctx } from '../contexto';
import { negocioActual } from '../estado';
import { LIMITE_CATEGORIAS, type CategoriaFila, type PlatoFila } from '../tipos';
import { boton, campo, cargando, confirmar, con, el, enlaceVolver, errorDeCarga, ICONOS, nota, ocupado } from '../ui';
import { validarNombre } from '../validar';

export async function pantallaCategorias(c: Ctx): Promise<void> {
  const n = negocioActual();
  if (!n) return c.ir('#/elegir');
  c.cont.replaceChildren(cargando());
  let categorias: CategoriaFila[];
  let platos: PlatoFila[];
  try {
    [categorias, platos] = await Promise.all([api.listarCategorias(n.id), api.listarPlatos(n.id)]);
  } catch {
    c.cont.replaceChildren(enlaceVolver('#/platos', 'Platos'), errorDeCarga(c.repintar));
    return;
  }

  // Alta
  const nueva = campo({ etiqueta: 'Nueva categoría', ayuda: 'Por ejemplo: Entradas, Bebidas, Postres.' });
  const agregar = boton('Agregar', { variante: 'primario', tipo: 'submit' });
  const formAlta = el('form', 'formulario formulario--fila');
  formAlta.noValidate = true;
  const lleno = categorias.length >= LIMITE_CATEGORIAS;
  con(formAlta, nueva.raiz, agregar);
  if (lleno) {
    nueva.input.disabled = true;
    agregar.disabled = true;
  }
  formAlta.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const r = validarNombre(nueva.valor());
    nueva.error(r.ok ? null : r.error);
    if (!r.ok) return nueva.input.focus();
    void ocupado(agregar, async () => {
      const orden = categorias.reduce((m, k) => Math.max(m, k.orden), -1) + 1;
      const res = await guardando(() => api.crearCategoria(n.id, r.valor, orden));
      if (res.ok) c.repintar();
    });
  });

  // Lista
  const lista = el('ul', 'lista-categorias');
  categorias.forEach((cat, i) => {
    const li = el('li', 'fila-categoria');
    const form = el('form', 'fila-categoria-form');
    form.noValidate = true;
    const nombre = campo({ etiqueta: `Nombre de la categoría ${i + 1}`, valor: cat.nombre });
    const guardar = boton('Guardar', { variante: 'secundario', tipo: 'submit' });
    guardar.disabled = true;
    nombre.input.addEventListener('input', () => {
      guardar.disabled = nombre.valor().trim() === cat.nombre;
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const r = validarNombre(nombre.valor());
      nombre.error(r.ok ? null : r.error);
      if (!r.ok) return nombre.input.focus();
      void ocupado(guardar, async () => {
        const res = await guardando(() => api.actualizarCategoria(cat.id, { nombre: r.valor }));
        if (res.ok) c.repintar();
      });
    });
    con(form, nombre.raiz, guardar);

    const mover = (delta: -1 | 1): void => {
      void (async () => {
        const j = i + delta;
        const otra = categorias[j];
        const res = await guardando(async () => {
          if (otra.orden !== cat.orden) {
            // Caso normal: solo dos PATCH, cada uno con únicamente "orden".
            await api.actualizarCategoria(cat.id, { orden: otra.orden });
            await api.actualizarCategoria(otra.id, { orden: cat.orden });
            return;
          }
          // Órdenes repetidos: se renumera la lista completa.
          const nuevoOrden = categorias.slice();
          [nuevoOrden[i], nuevoOrden[j]] = [nuevoOrden[j], nuevoOrden[i]];
          for (let k = 0; k < nuevoOrden.length; k++) {
            if (nuevoOrden[k].orden !== k) await api.actualizarCategoria(nuevoOrden[k].id, { orden: k });
          }
        });
        if (res.ok) c.repintar();
      })();
    };
    const subir = boton('Subir', { icono: ICONOS.arriba, clase: 'boton--icono', alClic: () => mover(-1) });
    subir.setAttribute('aria-label', `Subir ${cat.nombre}`);
    subir.disabled = i === 0;
    const bajar = boton('Bajar', { icono: ICONOS.abajo, clase: 'boton--icono', alClic: () => mover(1) });
    bajar.setAttribute('aria-label', `Bajar ${cat.nombre}`);
    bajar.disabled = i === categorias.length - 1;

    const propios = platos.filter((p) => p.categoria_id === cat.id);
    const eliminar = boton('Eliminar', {
      variante: 'peligro',
      alClic: () =>
        void (async () => {
          const aviso =
            propios.length === 0
              ? 'La categoría está vacía. Se borrará para siempre.'
              : `Se borrarán también sus ${propios.length} ${propios.length === 1 ? 'plato' : 'platos'}. Esta acción no se puede deshacer.`;
          const si = await confirmar({ titulo: `¿Eliminar "${cat.nombre}"?`, mensaje: aviso, aceptar: 'Sí, eliminar', peligro: true });
          if (!si) return;
          const res = await guardando(() => api.eliminarCategoria(cat.id), 'Eliminando…', 'Categoría eliminada ✓');
          if (res.ok) {
            for (const p of propios) void api.borrarFoto(p.foto_ruta);
            c.repintar();
          }
        })(),
    });
    eliminar.setAttribute('aria-label', `Eliminar ${cat.nombre}`);
    li.append(form, con(el('div', 'fila-categoria-acciones'), subir, bajar, eliminar));
    lista.appendChild(li);
  });

  c.cont.replaceChildren(
    enlaceVolver('#/platos', 'Platos'),
    el('h1', 'titulo', 'Categorías'),
    con(el('section', 'tarjeta'), formAlta, lleno ? nota(`Llegó al máximo de ${LIMITE_CATEGORIAS} categorías.`) : null),
    categorias.length === 0 ? nota('Todavía no hay categorías.', 'vacio') : lista,
  );
}
