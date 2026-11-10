// Apariencia: plantillas, 3 colores (60-30-10), tipografía y vista previa en vivo.
import type { IdPlantilla, ParTipografico, Tema } from '../../datos/tipos';
import { formatearPrecio } from '../../datos/utilidades';
import { aplicarTema, PLANTILLAS } from '../../tema';
import * as api from '../api';
import { guardando } from '../avisos';
import type { Ctx } from '../contexto';
import { estado, negocioActual, reemplazarNegocio } from '../estado';
import { boton, con, el, enlaceVolver, nuevoId, nota, ocupado, seleccion } from '../ui';
import { validarHex } from '../validar';

const NOMBRES_PLANTILLA: Record<IdPlantilla, { nombre: string; detalle: string }> = {
  cafeteria: { nombre: 'Cafetería', detalle: 'Cálida y acogedora' },
  elegante: { nombre: 'Elegante', detalle: 'Oscura y sofisticada' },
  heladeria: { nombre: 'Heladería', detalle: 'Fresca y alegre' },
  rapida: { nombre: 'Comida rápida', detalle: 'Directa y llamativa' },
};

const TIPOGRAFIAS: { valor: ParTipografico; texto: string }[] = [
  { valor: 'clasica', texto: 'Clásica (títulos con serifa)' },
  { valor: 'moderna', texto: 'Moderna (limpia y geométrica)' },
  { valor: 'calida', texto: 'Cálida (redondeada y amable)' },
];

function colorEntrada(etiqueta: string, valor: string): { raiz: HTMLElement; input: HTMLInputElement } {
  const id = nuevoId('color');
  const raiz = el('div', 'campo campo--color');
  const lab = el('label', 'campo-etiqueta', etiqueta);
  lab.htmlFor = id;
  const input = el('input', 'entrada-color');
  input.type = 'color';
  input.id = id;
  input.value = valor.toLowerCase();
  const codigo = el('span', 'codigo-color', valor.toUpperCase());
  input.addEventListener('input', () => {
    codigo.textContent = input.value.toUpperCase();
  });
  raiz.append(lab, con(el('div', 'campo-color-fila'), input, codigo));
  return { raiz, input };
}

export function pantallaApariencia(c: Ctx): void {
  const n = negocioActual();
  if (!n) return c.ir('#/elegir');

  const actual: Tema = {
    version: 1,
    colores: { fondo: n.color_fondo, superficie: n.color_superficie, acento: n.color_acento },
    tipografia: n.tipografia,
  };

  // Vista previa en un contenedor propio (no toca el :root del panel).
  const vista = el('div', 'vista-previa');
  vista.setAttribute('role', 'group');
  vista.setAttribute('aria-label', 'Vista previa del menú');
  const barra = el('div', 'vp-barra');
  barra.append(el('span', 'vp-marca', n.nombre), el('span', 'vp-menu', 'Menú'));
  const cuerpo = el('div', 'vp-cuerpo');
  const tarjeta = el('div', 'vp-tarjeta');
  const foto = el('span', 'vp-foto');
  foto.setAttribute('aria-hidden', 'true');
  const textos = el('div', 'vp-textos');
  textos.append(
    el('p', 'vp-nombre', 'Plato de ejemplo'),
    el('p', 'vp-detalle', 'Así se verán la descripción y los precios.'),
    el('p', 'vp-precio', formatearPrecio(18000, 'COP')),
  );
  tarjeta.append(foto, textos);
  const botonEjemplo = el('span', 'vp-boton', 'Pedir por WhatsApp');
  con(cuerpo, el('p', 'vp-seccion', 'Entradas'), tarjeta, botonEjemplo);
  con(vista, barra, cuerpo);
  const avisoAjustes = el('div', 'ajustes');

  function pintarVista(): void {
    avisoAjustes.replaceChildren();
    try {
      const { ajustes } = aplicarTema(
        { version: 1, colores: { fondo: fondo.input.value, superficie: superficie.input.value, acento: acento.input.value }, tipografia: tipografia.select.value as ParTipografico },
        vista,
      );
      for (const a of ajustes) avisoAjustes.appendChild(nota(a, 'nota nota--info'));
    } catch {
      avisoAjustes.appendChild(nota('No se pudo mostrar la vista previa con esos colores.', 'nota nota--info'));
    }
  }

  // Plantillas
  const plantillas = el('fieldset', 'plantillas');
  plantillas.appendChild(el('legend', 'campo-etiqueta', 'Plantilla'));
  const nombreGrupo = nuevoId('plantilla');
  const radios: HTMLInputElement[] = [];
  (Object.keys(PLANTILLAS) as IdPlantilla[]).forEach((id) => {
    const t = PLANTILLAS[id];
    const lab = el('label', 'plantilla');
    const r = el('input', 'plantilla-radio');
    r.type = 'radio';
    r.name = nombreGrupo;
    r.value = id;
    const muestra = el('span', 'plantilla-muestra');
    muestra.setAttribute('aria-hidden', 'true');
    for (const [clave, color] of [['fondo', t.colores.fondo], ['superficie', t.colores.superficie], ['acento', t.colores.acento]] as const) {
      const punto = el('span', `punto punto--${clave}`);
      punto.style.setProperty('--muestra', color);
      muestra.appendChild(punto);
    }
    const info = el('span', 'plantilla-textos');
    info.append(el('span', 'plantilla-nombre', NOMBRES_PLANTILLA[id].nombre), el('span', 'plantilla-detalle', NOMBRES_PLANTILLA[id].detalle));
    lab.append(r, muestra, info);
    r.addEventListener('change', () => {
      fondo.input.value = t.colores.fondo.toLowerCase();
      superficie.input.value = t.colores.superficie.toLowerCase();
      acento.input.value = t.colores.acento.toLowerCase();
      for (const k of [fondo, superficie, acento]) k.input.dispatchEvent(new Event('input'));
      tipografia.select.value = t.tipografia;
      pintarVista();
    });
    radios.push(r);
    plantillas.appendChild(lab);
  });

  const fondo = colorEntrada('Fondo (60 %)', actual.colores.fondo);
  const superficie = colorEntrada('Superficie (30 %)', actual.colores.superficie);
  const acento = colorEntrada('Acento (10 %)', actual.colores.acento);
  const tipografia = seleccion('Tipografía', TIPOGRAFIAS, actual.tipografia);
  const alCambiar = (): void => {
    for (const r of radios) r.checked = false; // ya no coincide con una plantilla
    pintarVista();
  };
  for (const k of [fondo, superficie, acento]) k.input.addEventListener('input', alCambiar);
  tipografia.select.addEventListener('change', alCambiar);

  const guardar = boton('Guardar apariencia', { variante: 'primario', tipo: 'submit' });
  const error = el('p', 'campo-error campo-error--general');
  error.hidden = true;
  const formulario = el('form', 'formulario');
  formulario.noValidate = true;
  con(
    formulario,
    plantillas,
    el('p', 'intro', 'O elija los colores usted mismo. El fondo ocupa la mayor parte de la pantalla, la superficie son las tarjetas y el acento se usa en botones y detalles.'),
    con(el('div', 'colores'), fondo.raiz, superficie.raiz, acento.raiz),
    tipografia.raiz,
    error,
    guardar,
  );
  formulario.addEventListener('submit', (ev) => {
    ev.preventDefault();
    error.hidden = true;
    const valores = [fondo.input.value, superficie.input.value, acento.input.value].map(validarHex);
    if (valores.some((v) => !v.ok)) {
      error.textContent = 'Alguno de los colores no es válido. Elíjalo de nuevo.';
      error.hidden = false;
      return;
    }
    void ocupado(guardar, async () => {
      const r = await guardando(() =>
        api.actualizarNegocio(
          n.id,
          {
            color_fondo: fondo.input.value.toUpperCase(),
            color_superficie: superficie.input.value.toUpperCase(),
            color_acento: acento.input.value.toUpperCase(),
            tipografia: tipografia.select.value as ParTipografico,
          },
          estado.esAdmin,
        ),
      );
      if (r.ok) reemplazarNegocio(r.valor);
    });
  });

  pintarVista();
  c.cont.replaceChildren(
    enlaceVolver('#/'),
    el('h1', 'titulo', 'Apariencia'),
    con(el('section', 'tarjeta'), el('h2', 'subtitulo', 'Vista previa'), vista, avisoAjustes),
    con(el('section', 'tarjeta'), formulario),
  );
}
