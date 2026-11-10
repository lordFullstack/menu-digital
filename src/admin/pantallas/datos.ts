// Datos del negocio: nombre, eslogan, logo, portada, contacto, redes y horario.
import type { Franja } from '../../datos/tipos';
import * as api from '../api';
import { guardando } from '../avisos';
import type { Ctx } from '../contexto';
import { estado, negocioActual, reemplazarNegocio } from '../estado';
import { guardarConFotos } from '../fotos';
import { selectorFoto } from '../selectorFoto';
import { LIMITE_FRANJAS, type NegocioFila } from '../tipos';
import { boton, campo, casilla, con, el, enlaceVolver, nota, ocupado } from '../ui';
import {
  erroresHorario, validarEnlace, validarNombre, validarSlug, validarTextoOpcional, validarWhatsapp,
} from '../validar';

/** Lunes a domingo, con el número de día de la base (0 = domingo). */
const DIAS: { n: number; corto: string; largo: string }[] = [
  { n: 1, corto: 'L', largo: 'Lunes' },
  { n: 2, corto: 'M', largo: 'Martes' },
  { n: 3, corto: 'M', largo: 'Miércoles' },
  { n: 4, corto: 'J', largo: 'Jueves' },
  { n: 5, corto: 'V', largo: 'Viernes' },
  { n: 6, corto: 'S', largo: 'Sábado' },
  { n: 0, corto: 'D', largo: 'Domingo' },
];

function editorHorario(inicial: Franja[]): { raiz: HTMLElement; obtener(): Franja[]; validar(): boolean } {
  const franjas: Franja[] = inicial.map((f) => ({ dias: [...f.dias], abre: f.abre, cierra: f.cierra }));
  const raiz = el('fieldset', 'horario');
  raiz.appendChild(el('legend', 'campo-etiqueta', 'Horario de atención'));
  const lista = el('div', 'franjas');
  const errores = new Map<number, HTMLElement>();
  const agregar = boton('+ Agregar franja', { alClic: () => {
    franjas.push({ dias: [1, 2, 3, 4, 5], abre: '08:00', cierra: '18:00' });
    pintar();
  } });
  const vacio = nota('Sin horario: el menú no mostrará si están abiertos. Agregue una franja para indicarlo.', 'nota');

  function pintar(): void {
    errores.clear();
    lista.replaceChildren();
    franjas.forEach((f, i) => {
      const caja = el('div', 'franja');
      caja.appendChild(el('p', 'franja-titulo', `Franja ${i + 1}`));
      const dias = el('div', 'dias');
      dias.setAttribute('role', 'group');
      dias.setAttribute('aria-label', `Días de la franja ${i + 1}`);
      for (const d of DIAS) {
        const k = casilla(d.corto, f.dias.includes(d.n));
        k.raiz.classList.add('casilla--dia');
        k.input.setAttribute('aria-label', d.largo);
        k.input.addEventListener('change', () => {
          f.dias = k.input.checked ? [...f.dias, d.n] : f.dias.filter((x) => x !== d.n);
        });
        dias.appendChild(k.raiz);
      }
      const abre = campo({ etiqueta: 'Abre', tipo: 'time', valor: f.abre });
      const cierra = campo({ etiqueta: 'Cierra', tipo: 'time', valor: f.cierra });
      abre.input.addEventListener('input', () => (f.abre = abre.valor()));
      cierra.input.addEventListener('input', () => (f.cierra = cierra.valor()));
      const err = el('p', 'campo-error');
      err.hidden = true;
      errores.set(i, err);
      const quitar = boton('Quitar franja', {
        variante: 'texto',
        alClic: () => {
          franjas.splice(i, 1);
          pintar();
        },
      });
      quitar.setAttribute('aria-label', `Quitar la franja ${i + 1}`);
      con(caja, dias, con(el('div', 'franja-horas'), abre.raiz, cierra.raiz), err, quitar);
      lista.appendChild(caja);
    });
    vacio.hidden = franjas.length > 0;
    agregar.disabled = franjas.length >= LIMITE_FRANJAS;
  }
  pintar();
  con(raiz, vacio, lista, agregar);
  return {
    raiz,
    obtener: () => franjas.map((f) => ({ dias: [...f.dias].sort((a, b) => a - b), abre: f.abre, cierra: f.cierra })),
    validar: () => {
      const lista = erroresHorario(franjas);
      let bien = true;
      lista.forEach((m, i) => {
        const e = errores.get(i);
        if (!e) return;
        e.textContent = m ?? '';
        e.hidden = m === null;
        if (m !== null) bien = false;
      });
      return bien;
    },
  };
}

export function pantallaDatos(c: Ctx): void {
  const n = negocioActual();
  if (!n) return c.ir('#/elegir');

  const nombre = campo({ etiqueta: 'Nombre del negocio', valor: n.nombre, requerido: true });
  const eslogan = campo({ etiqueta: 'Eslogan (opcional)', valor: n.eslogan ?? '', ayuda: 'Una frase corta, hasta 120 letras.' });
  const logo = selectorFoto({ etiqueta: 'Logo', rutaActual: n.logo_ruta, nombre: n.nombre, forma: 'redonda' });
  const portada = selectorFoto({ etiqueta: 'Foto de portada', rutaActual: n.portada_ruta, nombre: n.nombre, forma: 'ancha' });
  const whatsapp = campo({ etiqueta: 'WhatsApp (opcional)', valor: n.whatsapp ?? '', tipo: 'tel', modo: 'tel', autocompletar: 'off', ayuda: 'Con indicativo del país, sin signos. Ejemplo: 573001234567.' });
  const direccion = campo({ etiqueta: 'Dirección (opcional)', valor: n.direccion ?? '', autocompletar: 'off' });
  const mapa = campo({ etiqueta: 'Enlace del mapa (opcional)', valor: n.mapa_url ?? '', tipo: 'url', modo: 'url', ayuda: 'Enlace de Google Maps, Waze u OpenStreetMap.' });
  const instagram = campo({ etiqueta: 'Instagram (opcional)', valor: n.instagram ?? '', tipo: 'url', modo: 'url', ayuda: 'https://instagram.com/su-negocio' });
  const facebook = campo({ etiqueta: 'Facebook (opcional)', valor: n.facebook ?? '', tipo: 'url', modo: 'url', ayuda: 'https://facebook.com/su-negocio' });
  const tiktok = campo({ etiqueta: 'TikTok (opcional)', valor: n.tiktok ?? '', tipo: 'url', modo: 'url', ayuda: 'https://tiktok.com/@su-negocio' });
  const horario = editorHorario(n.horario ?? []);
  const slug = estado.esAdmin
    ? campo({ etiqueta: 'Enlace del menú (solo administrador)', valor: n.slug, autocompletar: 'off', ayuda: 'Si lo cambia, el enlace y el QR anteriores dejan de funcionar.' })
    : null;

  const guardar = boton('Guardar', { variante: 'primario', tipo: 'submit' });
  const formulario = el('form', 'formulario');
  formulario.noValidate = true;
  con(
    formulario,
    el('h2', 'subtitulo', 'Identidad'),
    nombre.raiz, eslogan.raiz, logo.raiz, portada.raiz,
    el('h2', 'subtitulo', 'Contacto'),
    whatsapp.raiz, direccion.raiz, mapa.raiz,
    el('h2', 'subtitulo', 'Redes'),
    instagram.raiz, facebook.raiz, tiktok.raiz,
    el('h2', 'subtitulo', 'Horario'),
    horario.raiz,
    slug?.raiz,
    guardar,
  );

  formulario.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const rNombre = validarNombre(nombre.valor());
    const rEslogan = validarTextoOpcional(eslogan.valor(), 120);
    const rWa = validarWhatsapp(whatsapp.valor());
    const rDir = validarTextoOpcional(direccion.valor(), 200);
    const rMapa = validarEnlace(mapa.valor(), 'mapa');
    const rIg = validarEnlace(instagram.valor(), 'instagram');
    const rFb = validarEnlace(facebook.valor(), 'facebook');
    const rTt = validarEnlace(tiktok.valor(), 'tiktok');
    const rSlug = slug ? validarSlug(slug.valor()) : null;
    const pares = [
      [nombre, rNombre], [eslogan, rEslogan], [whatsapp, rWa], [direccion, rDir],
      [mapa, rMapa], [instagram, rIg], [facebook, rFb], [tiktok, rTt],
    ] as const;
    let primero: HTMLElement | null = null;
    for (const [c1, r] of pares) {
      c1.error(r.ok ? null : r.error);
      if (!r.ok && !primero) primero = c1.input;
    }
    if (slug && rSlug) {
      slug.error(rSlug.ok ? null : rSlug.error);
      if (!rSlug.ok && !primero) primero = slug.input;
    }
    const horarioBien = horario.validar();
    if (primero) return primero.focus();
    if (!horarioBien) return;
    // Para TypeScript: ya se comprobó que todo es válido.
    if (!rNombre.ok || !rEslogan.ok || !rWa.ok || !rDir.ok || !rMapa.ok || !rIg.ok || !rFb.ok || !rTt.ok) return;

    void ocupado(guardar, async () => {
      const r = await guardando(() =>
        guardarConFotos(n.id, [logo.entrada(), portada.entrada()], ([rutaLogo, rutaPortada]) => {
          const cambios: Partial<NegocioFila> = {
            nombre: rNombre.valor,
            eslogan: rEslogan.valor,
            logo_ruta: rutaLogo,
            portada_ruta: rutaPortada,
            whatsapp: rWa.valor,
            direccion: rDir.valor,
            mapa_url: rMapa.valor,
            instagram: rIg.valor,
            facebook: rFb.valor,
            tiktok: rTt.valor,
            horario: horario.obtener(),
          };
          if (estado.esAdmin && rSlug && rSlug.ok) cambios.slug = rSlug.valor;
          return api.actualizarNegocio(n.id, cambios, estado.esAdmin);
        }),
      );
      if (r.ok) {
        reemplazarNegocio(r.valor);
        c.repintar();
      } else if (r.error?.tipo === 'duplicado') {
        slug?.error('Ese enlace ya está en uso. Pruebe con otro.');
      }
    });
  });

  c.cont.replaceChildren(enlaceVolver('#/'), el('h1', 'titulo', 'Datos del negocio'), con(el('section', 'tarjeta'), formulario));
}
