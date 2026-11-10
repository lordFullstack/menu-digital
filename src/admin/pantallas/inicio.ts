// Elegir negocio e Inicio del negocio (estado, publicar, ver menú, QR y accesos).
import * as api from '../api';
import { guardando, avisarError } from '../avisos';
import type { Ctx } from '../contexto';
import { elegirNegocio, estado, negocioActual, reemplazarNegocio } from '../estado';
import { boton, con, el, enlaceInterno, icono, ICONOS, interruptor, nota } from '../ui';

export function pantallaElegir(c: Ctx): void {
  const lista = el('ul', 'lista-negocios');
  for (const n of estado.negocios) {
    const fila = el('li');
    const b = el('button', 'tarjeta-negocio');
    b.type = 'button';
    const textos = el('span', 'tarjeta-negocio-textos');
    textos.append(el('span', 'tarjeta-negocio-nombre', n.nombre), el('span', 'tarjeta-negocio-slug', `/${n.slug}`));
    b.append(textos, el('span', n.publicado ? 'insignia insignia--ok' : 'insignia', n.publicado ? 'Publicado' : 'Borrador'));
    b.addEventListener('click', () => {
      elegirNegocio(n.id);
      c.ir('#/');
    });
    fila.appendChild(b);
    lista.appendChild(fila);
  }
  const partes: (Node | null)[] = [el('h1', 'titulo', 'Elija su negocio')];
  if (estado.negocios.length === 0) {
    partes.push(
      nota(
        estado.esAdmin
          ? 'Todavía no hay negocios. Cree el primero.'
          : 'Su cuenta todavía no tiene un negocio asignado. Pídale a quien administra el menú que lo asigne.',
        'vacio',
      ),
    );
  } else {
    partes.push(lista);
  }
  if (estado.esAdmin) partes.push(enlaceInterno('Negocios y dueños', '#/negocios', 'boton boton--primario boton--ancho', ICONOS.negocios));
  c.cont.replaceChildren(...(partes.filter(Boolean) as Node[]));
}

export function pantallaInicio(c: Ctx): void {
  const n = negocioActual();
  if (!n) return c.ir('#/elegir');

  const insignia = el('span', n.publicado ? 'insignia insignia--ok' : 'insignia', n.publicado ? 'Publicado' : 'Borrador');
  const ayudaEstado = nota(
    n.publicado ? 'Su menú está visible para sus clientes.' : 'Mientras esté en borrador, sus clientes no pueden verlo.',
    'nota',
  );

  const publicar = interruptor('Publicar menú', n.publicado, (activo, input) => {
    void (async () => {
      input.disabled = true;
      const r = await guardando(() => api.actualizarNegocio(n.id, { publicado: activo }, estado.esAdmin));
      input.disabled = false;
      if (r.ok) {
        reemplazarNegocio(r.valor);
        c.repintar();
      } else {
        input.checked = !activo;
      }
    })();
  });

  const urlMenu = `${window.location.origin}/${n.slug}`;
  const ver = el('a', 'boton boton--secundario');
  ver.href = urlMenu;
  ver.target = '_blank';
  ver.rel = 'noopener noreferrer';
  ver.append(icono(ICONOS.externo), el('span', undefined, 'Ver mi menú'));

  const zonaQR = el('div', 'qr');
  zonaQR.hidden = true;
  const bQR = boton('Descargar QR', {
    icono: ICONOS.descarga,
    alClic: () => void descargarQR(urlMenu, n.slug, zonaQR, bQR),
  });

  const accesos = el('ul', 'accesos');
  const acceso = (texto: string, detalle: string, hash: string, trazos: string[]): HTMLElement => {
    const li = el('li');
    const a = el('a', 'acceso');
    a.href = hash;
    a.append(icono(trazos, 'icono icono--grande'));
    const t = el('span', 'acceso-textos');
    t.append(el('span', 'acceso-titulo', texto), el('span', 'acceso-detalle', detalle));
    a.appendChild(t);
    li.appendChild(a);
    return li;
  };
  con(
    accesos,
    acceso('Platos', 'Agregar, cambiar precios y marcar agotados', '#/platos', ICONOS.platos),
    acceso('Apariencia', 'Colores, plantilla y tipografía', '#/apariencia', ICONOS.paleta),
    acceso('Datos del negocio', 'Nombre, fotos, horario y contacto', '#/datos', ICONOS.tienda),
  );
  if (estado.esAdmin) con(accesos, acceso('Negocios y dueños', 'Crear negocios y asignar dueños', '#/negocios', ICONOS.negocios));

  c.cont.replaceChildren(
    con(el('div', 'encabezado'), el('h1', 'titulo', n.nombre), insignia),
    con(el('section', 'tarjeta'), publicar.raiz, ayudaEstado, con(el('div', 'acciones'), ver, bQR), zonaQR),
    accesos,
  );
}

async function descargarQR(url: string, slug: string, zona: HTMLElement, b: HTMLButtonElement): Promise<void> {
  b.disabled = true;
  try {
    const modulo = await import('qrcode');
    const toCanvas = modulo.toCanvas ?? modulo.default.toCanvas;
    const lienzo = document.createElement('canvas');
    await toCanvas(lienzo, url, { width: 1024, margin: 2, errorCorrectionLevel: 'M' });
    lienzo.className = 'qr-lienzo';
    lienzo.setAttribute('role', 'img');
    lienzo.setAttribute('aria-label', `Código QR del menú: ${url}`);
    zona.replaceChildren(lienzo, nota(`Apunta a ${url}`, 'nota'));
    zona.hidden = false;
    const blob = await new Promise<Blob | null>((r) => lienzo.toBlob((x) => r(x), 'image/png'));
    if (!blob) throw new Error('sin imagen');
    const enlace = document.createElement('a');
    const objeto = URL.createObjectURL(blob);
    enlace.href = objeto;
    enlace.download = `qr-${slug}.png`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(() => URL.revokeObjectURL(objeto), 10_000);
  } catch {
    avisarError('No se pudo crear el código QR. Intente de nuevo.');
  } finally {
    b.disabled = false;
  }
}
