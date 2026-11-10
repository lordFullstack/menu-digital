// Crear o editar un plato (#/plato/nuevo o #/plato/<id>).
import * as api from '../api';
import { avisarGuardado, guardando } from '../avisos';
import type { Ctx } from '../contexto';
import { negocioActual } from '../estado';
import { guardarConFotos } from '../fotos';
import { selectorFoto } from '../selectorFoto';
import { ETIQUETAS, type CategoriaFila, type PlatoFila } from '../tipos';
import {
  boton, campo, casilla, cargando, confirmar, con, el, enlaceVolver, errorDeCarga, interruptor, ocupado, seleccion,
} from '../ui';
import { validarLista, validarNombre, validarPrecio, validarTextoOpcional } from '../validar';
import type { Etiqueta } from '../../datos/tipos';

export async function pantallaPlato(c: Ctx): Promise<void> {
  const n = negocioActual();
  if (!n) return c.ir('#/elegir');
  const esNuevo = c.param === 'nuevo';
  c.cont.replaceChildren(cargando());

  let categorias: CategoriaFila[];
  let plato: PlatoFila | null = null;
  let existentes: PlatoFila[] = [];
  try {
    [categorias, existentes] = await Promise.all([api.listarCategorias(n.id), api.listarPlatos(n.id)]);
    if (!esNuevo && c.param) plato = existentes.find((p) => p.id === c.param) ?? (await api.obtenerPlato(c.param, n.id));
  } catch {
    c.cont.replaceChildren(enlaceVolver('#/platos'), errorDeCarga(c.repintar));
    return;
  }
  if (!esNuevo && !plato) {
    c.cont.replaceChildren(enlaceVolver('#/platos'), el('p', 'vacio', 'No encontramos ese plato. Puede que ya se haya eliminado.'));
    return;
  }
  if (categorias.length === 0) {
    c.cont.replaceChildren(enlaceVolver('#/platos'), el('p', 'vacio', 'Primero cree una categoría para poder agregar platos.'));
    return;
  }

  const nombre = campo({ etiqueta: 'Nombre', valor: plato?.nombre ?? '', requerido: true, ayuda: 'Hasta 80 letras.' });
  const descripcion = campo({ etiqueta: 'Descripción (opcional)', valor: plato?.descripcion ?? '', multilinea: true, filas: 3, ayuda: 'Hasta 300 letras.' });
  const precio = campo({
    etiqueta: 'Precio en pesos',
    valor: plato ? String(plato.precio) : '',
    modo: 'numeric',
    autocompletar: 'off',
    requerido: true,
    ayuda: 'Solo números, por ejemplo 18000.',
  });
  const categoria = seleccion(
    'Categoría',
    categorias.map((k) => ({ valor: k.id, texto: k.nombre })),
    plato?.categoria_id ?? categorias[0].id,
  );
  const foto = selectorFoto({ etiqueta: 'Foto del plato', rutaActual: plato?.foto_ruta ?? null, nombre: plato?.nombre ?? 'Plato', forma: 'cuadrada' });

  const etiquetas = el('fieldset', 'grupo-casillas');
  etiquetas.appendChild(el('legend', 'campo-etiqueta', 'Etiquetas'));
  const casillas = new Map<Etiqueta, HTMLInputElement>();
  for (const e of ETIQUETAS) {
    const k = casilla(e.texto, plato?.etiquetas.includes(e.id) ?? false);
    casillas.set(e.id, k.input);
    etiquetas.appendChild(k.raiz);
  }
  const recomendado = interruptor('Recomendado de la casa', plato?.recomendado ?? false);
  const ingredientes = campo({
    etiqueta: 'Ingredientes (opcional)',
    valor: (plato?.ingredientes ?? []).join(', '),
    ayuda: 'Separe con comas: arroz, pollo, cilantro. Máximo 30.',
  });
  const alergenos = campo({
    etiqueta: 'Alérgenos (opcional)',
    valor: (plato?.alergenos ?? []).join(', '),
    ayuda: 'Separe con comas: maní, lácteos, gluten. Máximo 30.',
  });

  const guardar = boton('Guardar', { variante: 'primario', tipo: 'submit' });
  const acciones = con(el('div', 'acciones acciones--fin'), guardar);
  if (plato) {
    const p = plato;
    const eliminar = boton('Eliminar', {
      variante: 'peligro',
      alClic: () =>
        void (async () => {
          const si = await confirmar({
            titulo: `¿Eliminar "${p.nombre}"?`,
            mensaje: 'El plato se borra para siempre y desaparece del menú. Esta acción no se puede deshacer.',
            aceptar: 'Sí, eliminar',
            peligro: true,
          });
          if (!si) return;
          const r = await guardando(() => api.eliminarPlato(p.id), 'Eliminando…', 'Plato eliminado ✓');
          if (r.ok) {
            void api.borrarFoto(p.foto_ruta);
            c.ir('#/platos');
          }
        })(),
    });
    acciones.appendChild(eliminar);
  }

  const formulario = el('form', 'formulario');
  formulario.noValidate = true;
  con(formulario, foto.raiz, nombre.raiz, descripcion.raiz, precio.raiz, categoria.raiz, etiquetas, recomendado.raiz, ingredientes.raiz, alergenos.raiz, acciones);

  formulario.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const rNombre = validarNombre(nombre.valor());
    const rDesc = validarTextoOpcional(descripcion.valor(), 300);
    const rPrecio = validarPrecio(precio.valor());
    const rIng = validarLista(ingredientes.valor());
    const rAle = validarLista(alergenos.valor());
    nombre.error(rNombre.ok ? null : rNombre.error);
    descripcion.error(rDesc.ok ? null : rDesc.error);
    precio.error(rPrecio.ok ? null : rPrecio.error);
    ingredientes.error(rIng.ok ? null : rIng.error);
    alergenos.error(rAle.ok ? null : rAle.error);
    if (!rNombre.ok) return nombre.input.focus();
    if (!rDesc.ok) return descripcion.input.focus();
    if (!rPrecio.ok) return precio.input.focus();
    if (!rIng.ok) return ingredientes.input.focus();
    if (!rAle.ok) return alergenos.input.focus();

    const catId = categoria.select.value;
    const etiquetasSel = ETIQUETAS.filter((e) => casillas.get(e.id)?.checked).map((e) => e.id);
    void ocupado(guardar, async () => {
      const r = await guardando(() =>
        guardarConFotos(n.id, [foto.entrada()], async ([ruta]) => {
          const datos = {
            categoria_id: catId,
            nombre: rNombre.valor,
            descripcion: rDesc.valor,
            precio: rPrecio.valor,
            foto_ruta: ruta,
            etiquetas: etiquetasSel,
            ingredientes: rIng.valor,
            alergenos: rAle.valor,
            recomendado: recomendado.input.checked,
          };
          if (plato) {
            await api.actualizarPlato(plato.id, datos);
          } else {
            const orden = existentes.filter((p) => p.categoria_id === catId).reduce((m, p) => Math.max(m, p.orden), -1) + 1;
            await api.crearPlato(n.id, { ...datos, agotado: false, orden });
          }
        }),
      );
      if (r.ok) {
        avisarGuardado();
        c.ir('#/platos');
      }
    });
  });

  c.cont.replaceChildren(enlaceVolver('#/platos', 'Platos'), el('h1', 'titulo', plato ? 'Editar plato' : 'Nuevo plato'), formulario);
}
