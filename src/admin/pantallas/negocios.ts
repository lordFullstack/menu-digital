// Negocios y dueños (solo administrador): crear negocio, asignar y quitar dueños.
import type { IdPlantilla } from '../../datos/tipos';
import { PLANTILLAS } from '../../tema';
import * as api from '../api';
import { avisarGuardado, guardando, manejarError } from '../avisos';
import type { Ctx } from '../contexto';
import { elegirNegocio, estado, reemplazarNegocio } from '../estado';
import type { NegocioFila } from '../tipos';
import { boton, campo, confirmar, con, el, enlaceVolver, nota, ocupado, seleccion } from '../ui';
import { mensajeAsignacion } from '../puras';
import { slugDesde, validarCorreo, validarNombre, validarSlug } from '../validar';

const NOMBRES: Record<IdPlantilla, string> = {
  cafeteria: 'Cafetería',
  elegante: 'Elegante',
  heladeria: 'Heladería',
  rapida: 'Comida rápida',
};

export function pantallaNegocios(c: Ctx): void {
  if (!estado.esAdmin) return c.ir('#/');

  // ───────── Crear negocio ─────────
  const nombre = campo({ etiqueta: 'Nombre del negocio', requerido: true });
  const slug = campo({ etiqueta: 'Enlace del menú', autocompletar: 'off', ayuda: 'Será tudominio/enlace. Letras minúsculas, números y guiones (3 a 40).' });
  let slugTocado = false;
  slug.input.addEventListener('input', () => (slugTocado = true));
  nombre.input.addEventListener('input', () => {
    if (!slugTocado) slug.poner(slugDesde(nombre.valor()));
  });
  const plantilla = seleccion(
    'Colores iniciales',
    (Object.keys(PLANTILLAS) as IdPlantilla[]).map((id) => ({ valor: id, texto: NOMBRES[id] })),
    'cafeteria',
  );
  const crear = boton('Crear negocio', { variante: 'primario', tipo: 'submit' });
  const formulario = el('form', 'formulario');
  formulario.noValidate = true;
  con(formulario, nombre.raiz, slug.raiz, plantilla.raiz, crear);
  formulario.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const rN = validarNombre(nombre.valor());
    const rS = validarSlug(slug.valor());
    nombre.error(rN.ok ? null : rN.error);
    slug.error(rS.ok ? null : rS.error);
    if (!rN.ok) return nombre.input.focus();
    if (!rS.ok) return slug.input.focus();
    const t = PLANTILLAS[plantilla.select.value as IdPlantilla];
    void ocupado(crear, async () => {
      const r = await guardando(
        () =>
          api.crearNegocio({
            slug: rS.valor,
            nombre: rN.valor,
            color_fondo: t.colores.fondo,
            color_superficie: t.colores.superficie,
            color_acento: t.colores.acento,
            tipografia: t.tipografia,
          }),
        'Creando…',
        'Negocio creado ✓',
      );
      if (r.ok) {
        reemplazarNegocio(r.valor);
        c.repintar();
      } else if (r.error?.tipo === 'duplicado') {
        slug.error('Ese enlace ya está en uso. Pruebe con otro.');
        slug.input.focus();
      }
    });
  });

  // ───────── Lista de negocios ─────────
  const lista = el('ul', 'lista-negocios-admin');
  for (const n of estado.negocios) lista.appendChild(tarjetaNegocio(n, c));

  c.cont.replaceChildren(
    enlaceVolver('#/elegir', 'Mis negocios'),
    el('h1', 'titulo', 'Negocios y dueños'),
    con(el('section', 'tarjeta'), el('h2', 'subtitulo', 'Crear negocio'), formulario),
    el('h2', 'subtitulo', 'Negocios'),
    estado.negocios.length === 0 ? nota('Todavía no hay negocios.', 'vacio') : lista,
  );
}

function tarjetaNegocio(n: NegocioFila, c: Ctx): HTMLElement {
  const li = el('li', 'tarjeta tarjeta--negocio');
  const cab = con(
    el('div', 'encabezado'),
    con(el('div'), el('h3', 'subtitulo', n.nombre), el('p', 'tarjeta-negocio-slug', `/${n.slug}`)),
    el('span', n.publicado ? 'insignia insignia--ok' : 'insignia', n.publicado ? 'Publicado' : 'Borrador'),
  );
  const abrir = boton('Abrir este negocio', {
    alClic: () => {
      elegirNegocio(n.id);
      c.ir('#/');
    },
  });

  const detalles = el('details', 'duenos');
  detalles.appendChild(el('summary', undefined, 'Dueños'));
  const contenido = el('div', 'duenos-contenido');
  detalles.appendChild(contenido);
  let cargado = false;

  async function cargarMiembros(): Promise<void> {
    contenido.replaceChildren(nota('Cargando…', 'cargando'));
    let ids: string[];
    try {
      ids = await api.listarMiembros(n.id);
    } catch (e) {
      manejarError(e);
      contenido.replaceChildren(nota('No se pudo cargar la lista de dueños.', 'vacio vacio--error'));
      cargado = false;
      return;
    }
    const ul = el('ul', 'miembros');
    ids.forEach((id, i) => {
      const fila = el('li', 'miembro');
      fila.appendChild(el('span', undefined, `Dueño ${i + 1}`));
      const quitar = boton('Quitar', {
        variante: 'peligro',
        alClic: () =>
          void (async () => {
            const si = await confirmar({
              titulo: `¿Quitar al Dueño ${i + 1}?`,
              mensaje: `Esa persona ya no podrá editar "${n.nombre}". Su cuenta no se borra.`,
              aceptar: 'Sí, quitar',
              peligro: true,
            });
            if (!si) return;
            const r = await guardando(() => api.quitarDueno(n.id, id), 'Quitando…', 'Dueño quitado ✓');
            if (r.ok) void cargarMiembros();
          })(),
      });
      quitar.setAttribute('aria-label', `Quitar al Dueño ${i + 1} de ${n.nombre}`);
      fila.appendChild(quitar);
      ul.appendChild(fila);
    });

    const correo = campo({ etiqueta: 'Asignar dueño por correo', tipo: 'email', modo: 'email', autocompletar: 'off', ayuda: 'La persona ya debe tener cuenta creada.' });
    const asignar = boton('Asignar dueño', { variante: 'primario', tipo: 'submit' });
    const resultado = el('p', 'campo-error campo-error--general');
    resultado.hidden = true;
    resultado.setAttribute('role', 'alert');
    const form = el('form', 'formulario');
    form.noValidate = true;
    con(form, correo.raiz, resultado, asignar);
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      resultado.hidden = true;
      const r = validarCorreo(correo.valor());
      correo.error(r.ok ? null : r.error);
      if (!r.ok) return correo.input.focus();
      void ocupado(asignar, async () => {
        if (!navigator.onLine) {
          resultado.textContent = 'Sin conexión: los cambios no se pueden guardar';
          resultado.hidden = false;
          return;
        }
        try {
          await api.asignarDueno(n.id, r.valor);
          avisarGuardado('Dueño asignado ✓');
          void cargarMiembros();
        } catch (e) {
          // Solo se muestran tal cual los dos mensajes conocidos de la base; cualquier otro se reemplaza por el genérico.
          resultado.textContent = mensajeAsignacion((e as { message?: unknown } | null)?.message);
          resultado.hidden = false;
        }
      });
    });
    contenido.replaceChildren(
      ids.length === 0 ? nota('Este negocio todavía no tiene dueños.', 'vacio vacio--suave') : ul,
      form,
    );
  }
  detalles.addEventListener('toggle', () => {
    if (detalles.open && !cargado) {
      cargado = true;
      void cargarMiembros();
    }
  });

  con(li, cab, con(el('div', 'acciones'), abrir), detalles);
  return li;
}
