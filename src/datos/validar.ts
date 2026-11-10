// Validadores escritos a mano para menu.json y tema.json.
// Devuelven TODOS los errores (en español, para el dueño del negocio) y un objeto NUEVO
// con solo los campos conocidos (no pasan propiedades extra ni __proto__).
import type { Categoria, Etiqueta, Franja, IdPlantilla, Menu, Negocio, ParTipografico, Plato, Tema } from './tipos';
import { enlacePermitido, rutaLocalSegura } from './utilidades';
import type { TipoEnlace } from './utilidades';

export const LIMITES = {
  nombre: 80,
  descripcion: 300,
  eslogan: 120,
  direccion: 200,
  id: 60,
  textoCorto: 60,
  listaTextos: 30,
  categorias: 30,
  platosPorCategoria: 200,
  franjas: 14,
  platosTotal: 500,
  precioMax: 10_000_000,
  nombreEnMensaje: 80,
} as const;

const ETIQUETAS: readonly Etiqueta[] = ['vegano', 'vegetariano', 'picante', 'sin-gluten', 'nuevo'];
const TIPOGRAFIAS: readonly ParTipografico[] = ['clasica', 'moderna', 'calida'];
const PLANTILLAS: readonly IdPlantilla[] = ['cafeteria', 'elegante', 'heladeria', 'rapida'];
const COLOR = /^#[0-9a-fA-F]{6}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Recorta un nombre para mostrarlo en un mensaje de error (evita mensajes enormes). */
const recortar = (t: string): string =>
  t.length > LIMITES.nombreEnMensaje ? `${t.slice(0, LIMITES.nombreEnMensaje)}…` : t;

type Registro = Record<string, unknown>;
const esRegistro = (x: unknown): x is Registro => typeof x === 'object' && x !== null && !Array.isArray(x);
const tieneTexto = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;

/** Lee un texto obligatorio con largo máximo. Devuelve undefined si hay error (ya anotado). */
function textoObligatorio(o: Registro, campo: string, max: number, donde: string, errores: string[]): string | undefined {
  const v = o[campo];
  if (!tieneTexto(v)) { errores.push(`${donde} no tiene ${campo} (es obligatorio).`); return undefined; }
  if (v.length > max) { errores.push(`${donde}: "${campo}" es demasiado largo (máximo ${max} letras).`); return undefined; }
  return v;
}

function textoOpcional(o: Registro, campo: string, max: number, donde: string, errores: string[]): string | undefined {
  const v = o[campo];
  if (v === undefined) return undefined;
  if (typeof v !== 'string') { errores.push(`${donde}: "${campo}" debe ser texto.`); return undefined; }
  if (v.length > max) { errores.push(`${donde}: "${campo}" es demasiado largo (máximo ${max} letras).`); return undefined; }
  return v;
}

/** Foto, logo o portada: solo ruta local (carpeta img del menú), nunca un enlace a otra página. */
function fotoOpcional(o: Registro, campo: string, donde: string, errores: string[]): string | undefined {
  const v = o[campo];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || rutaLocalSegura(v) === null) {
    errores.push(`${donde}: "${campo}" no es válida. Las fotos deben estar en la carpeta img del menú, no enlazadas desde otra página (ej. img/foto.svg).`);
    return undefined;
  }
  return v;
}

const NOMBRES_ENLACE: Record<TipoEnlace, string> = {
  instagram: 'instagram.com',
  facebook: 'facebook.com, fb.com o fb.me',
  tiktok: 'tiktok.com',
  mapa: 'Google Maps, Waze u OpenStreetMap',
};

/** Enlace https a un sitio de la lista blanca del tipo. */
function enlaceOpcional(o: Registro, campo: string, tipo: TipoEnlace, donde: string, errores: string[]): string | undefined {
  const v = o[campo];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || enlacePermitido(v, tipo) === null) {
    errores.push(`${donde}: "${campo}" no es un enlace permitido (debe empezar con https:// y ser de ${NOMBRES_ENLACE[tipo]}).`);
    return undefined;
  }
  return v;
}

function listaTextos(o: Registro, campo: string, donde: string, errores: string[]): string[] | undefined {
  const v = o[campo];
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) { errores.push(`${donde}: "${campo}" debe ser una lista de textos.`); return undefined; }
  if (v.length > LIMITES.listaTextos) { errores.push(`${donde}: "${campo}" tiene demasiados elementos (máximo ${LIMITES.listaTextos}).`); return undefined; }
  const salida: string[] = [];
  for (const e of v) {
    if (!tieneTexto(e) || e.length > LIMITES.textoCorto) {
      errores.push(`${donde}: "${campo}" tiene un elemento vacío, que no es texto o es demasiado largo.`);
      return undefined;
    }
    salida.push(e);
  }
  return salida;
}

function validarFranja(x: unknown, n: number, errores: string[]): Franja | undefined {
  const donde = `La franja de horario ${n}`;
  if (!esRegistro(x)) { errores.push(`${donde} no es válida.`); return undefined; }
  let bien = true;
  let dias: number[] = [];
  if (!Array.isArray(x.dias) || x.dias.length === 0 || x.dias.length > 7 ||
      !x.dias.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    errores.push(`${donde}: "dias" debe ser una lista de números del 0 (domingo) al 6 (sábado).`);
    bien = false;
  } else {
    dias = Array.from(new Set(x.dias as number[]));
  }
  if (typeof x.abre !== 'string' || !HORA.test(x.abre)) { errores.push(`${donde}: "abre" debe tener formato HH:MM (ej. 08:30).`); bien = false; }
  if (typeof x.cierra !== 'string' || !HORA.test(x.cierra)) { errores.push(`${donde}: "cierra" debe tener formato HH:MM (ej. 22:00).`); bien = false; }
  if (bien && x.abre === x.cierra) { errores.push(`${donde}: "abre" y "cierra" no pueden ser la misma hora.`); bien = false; }
  return bien ? { dias, abre: x.abre as string, cierra: x.cierra as string } : undefined;
}

function validarPlato(x: unknown, pos: string, idsVistos: Set<string>, errores: string[]): Plato | undefined {
  if (!esRegistro(x)) { errores.push(`${pos} no es un plato válido.`); return undefined; }
  const nombreCrudo = typeof x.nombre === 'string' && x.nombre.trim() ? x.nombre : undefined;
  const donde = nombreCrudo ? `El plato "${recortar(nombreCrudo)}"` : pos;
  const n0 = errores.length;

  const id = textoObligatorio(x, 'id', LIMITES.id, donde, errores);
  if (id !== undefined) {
    if (idsVistos.has(id)) errores.push(`${donde}: el id "${id}" está repetido; cada plato necesita un id distinto.`);
    idsVistos.add(id);
  }
  const nombre = textoObligatorio(x, 'nombre', LIMITES.nombre, donde, errores);
  const descripcion = textoOpcional(x, 'descripcion', LIMITES.descripcion, donde, errores);
  let precio = 0;
  if (typeof x.precio !== 'number' || !Number.isSafeInteger(x.precio) || x.precio < 0 || x.precio > LIMITES.precioMax) {
    errores.push(`${donde} no tiene precio válido (debe ser un número entero, sin decimales, entre 0 y ${LIMITES.precioMax.toLocaleString('es-CO')}).`);
  } else {
    precio = x.precio;
  }
  const foto = fotoOpcional(x, 'foto', donde, errores);

  let etiquetas: Etiqueta[] | undefined;
  if (x.etiquetas !== undefined) {
    if (!Array.isArray(x.etiquetas)) {
      errores.push(`${donde}: "etiquetas" debe ser una lista.`);
    } else {
      const malas = x.etiquetas.filter((e) => !ETIQUETAS.includes(e as Etiqueta));
      if (malas.length > 0) {
        errores.push(`${donde} tiene etiquetas desconocidas (${malas.map((m) => `"${recortar(String(m))}"`).join(', ')}). Permitidas: ${ETIQUETAS.join(', ')}.`);
      } else {
        etiquetas = Array.from(new Set(x.etiquetas as Etiqueta[]));
      }
    }
  }
  const ingredientes = listaTextos(x, 'ingredientes', donde, errores);
  const alergenos = listaTextos(x, 'alergenos', donde, errores);
  for (const c of ['recomendado', 'agotado'] as const) {
    if (x[c] !== undefined && typeof x[c] !== 'boolean') errores.push(`${donde}: "${c}" debe ser verdadero o falso (true/false).`);
  }

  if (errores.length > n0 || id === undefined || nombre === undefined) return undefined;
  const plato: Plato = { id, nombre, precio };
  if (descripcion !== undefined) plato.descripcion = descripcion;
  if (foto !== undefined) plato.foto = foto;
  if (etiquetas !== undefined) plato.etiquetas = etiquetas;
  if (ingredientes !== undefined) plato.ingredientes = ingredientes;
  if (alergenos !== undefined) plato.alergenos = alergenos;
  if (x.recomendado === true) plato.recomendado = true;
  if (x.agotado === true) plato.agotado = true;
  return plato;
}

function validarCategoria(x: unknown, n: number, idsCat: Set<string>, idsPlato: Set<string>, errores: string[]): Categoria | undefined {
  const pos = `La categoría ${n}`;
  if (!esRegistro(x)) { errores.push(`${pos} no es válida.`); return undefined; }
  const nombreCrudo = typeof x.nombre === 'string' && x.nombre.trim() ? x.nombre : undefined;
  const donde = nombreCrudo ? `La categoría "${recortar(nombreCrudo)}"` : pos;
  const n0 = errores.length;

  const id = textoObligatorio(x, 'id', LIMITES.id, donde, errores);
  if (id !== undefined) {
    if (idsCat.has(id)) errores.push(`${donde}: el id "${id}" está repetido; cada categoría necesita un id distinto.`);
    idsCat.add(id);
  }
  const nombre = textoObligatorio(x, 'nombre', LIMITES.nombre, donde, errores);

  const platos: Plato[] = [];
  if (!Array.isArray(x.platos)) {
    errores.push(`${donde} no tiene la lista de platos.`);
  } else if (x.platos.length > LIMITES.platosPorCategoria) {
    errores.push(`${donde} tiene demasiados platos (máximo ${LIMITES.platosPorCategoria}).`);
  } else {
    x.platos.forEach((p, i) => {
      const r = validarPlato(p, `El plato ${i + 1} de ${donde.charAt(0).toLowerCase()}${donde.slice(1)}`, idsPlato, errores);
      if (r) platos.push(r);
    });
  }
  if (errores.length > n0 || id === undefined || nombre === undefined) return undefined;
  return { id, nombre, platos };
}

function validarNegocio(x: unknown, errores: string[]): Negocio | undefined {
  const donde = 'El negocio';
  if (!esRegistro(x)) { errores.push('Falta la información del negocio ("negocio").'); return undefined; }
  const n0 = errores.length;

  const nombre = textoObligatorio(x, 'nombre', LIMITES.nombre, donde, errores);
  const eslogan = textoOpcional(x, 'eslogan', LIMITES.eslogan, donde, errores);
  const logo = fotoOpcional(x, 'logo', donde, errores);
  const portada = fotoOpcional(x, 'portada', donde, errores);
  if (x.moneda !== 'COP') errores.push('El negocio: "moneda" debe ser "COP".');
  let whatsapp: string | undefined;
  if (x.whatsapp !== undefined) {
    if (typeof x.whatsapp !== 'string' || !/^\d{8,15}$/.test(x.whatsapp)) {
      errores.push('El negocio: "whatsapp" debe tener solo números (8 a 15 dígitos) con el indicativo, ej. 573001234567.');
    } else {
      whatsapp = x.whatsapp;
    }
  }
  const direccion = textoOpcional(x, 'direccion', LIMITES.direccion, donde, errores);
  const mapaUrl = enlaceOpcional(x, 'mapaUrl', 'mapa', donde, errores);

  let redes: Negocio['redes'];
  if (x.redes !== undefined) {
    if (!esRegistro(x.redes)) {
      errores.push('El negocio: "redes" debe ser un objeto con instagram, facebook o tiktok.');
    } else {
      redes = {};
      for (const r of ['instagram', 'facebook', 'tiktok'] as const) {
        const u = enlaceOpcional(x.redes, r, r, 'La red social', errores);
        if (u !== undefined) redes[r] = u;
      }
    }
  }

  const horario: Franja[] = [];
  if (!Array.isArray(x.horario)) {
    errores.push('El negocio no tiene "horario" (puede ser una lista vacía si prefiere no mostrarlo).');
  } else if (x.horario.length > LIMITES.franjas) {
    errores.push(`El horario tiene demasiadas franjas (máximo ${LIMITES.franjas}).`);
  } else {
    x.horario.forEach((f, i) => { const r = validarFranja(f, i + 1, errores); if (r) horario.push(r); });
  }

  if (errores.length > n0 || nombre === undefined) return undefined;
  const negocio: Negocio = { nombre, moneda: 'COP', horario };
  if (eslogan !== undefined) negocio.eslogan = eslogan;
  if (logo !== undefined) negocio.logo = logo;
  if (portada !== undefined) negocio.portada = portada;
  if (whatsapp !== undefined) negocio.whatsapp = whatsapp;
  if (direccion !== undefined) negocio.direccion = direccion;
  if (mapaUrl !== undefined) negocio.mapaUrl = mapaUrl;
  if (redes !== undefined) negocio.redes = redes;
  return negocio;
}

export function validarMenu(x: unknown): { ok: true; menu: Menu } | { ok: false; errores: string[] } {
  const errores: string[] = [];
  if (!esRegistro(x)) return { ok: false, errores: ['El archivo del menú no tiene el formato esperado (debe ser un objeto).'] };
  if (x.version !== 1) errores.push('El menú debe tener "version": 1.');
  const negocio = validarNegocio(x.negocio, errores);

  const categorias: Categoria[] = [];
  if (!Array.isArray(x.categorias)) {
    errores.push('El menú no tiene la lista de "categorias".');
  } else if (x.categorias.length === 0) {
    errores.push('El menú necesita al menos una categoría.');
  } else if (x.categorias.length > LIMITES.categorias) {
    errores.push(`El menú tiene demasiadas categorías (máximo ${LIMITES.categorias}).`);
  } else if (
    x.categorias.reduce<number>((suma, c) => suma + (esRegistro(c) && Array.isArray(c.platos) ? c.platos.length : 0), 0) > LIMITES.platosTotal
  ) {
    errores.push(`El menú tiene demasiados platos en total (máximo ${LIMITES.platosTotal}).`);
  } else {
    const idsCat = new Set<string>();
    const idsPlato = new Set<string>();
    x.categorias.forEach((c, i) => { const r = validarCategoria(c, i + 1, idsCat, idsPlato, errores); if (r) categorias.push(r); });
  }

  if (errores.length > 0 || !negocio) return { ok: false, errores };
  return { ok: true, menu: { version: 1, negocio, categorias } };
}

export function validarTema(x: unknown): { ok: true; tema: Tema } | { ok: false; errores: string[] } {
  const errores: string[] = [];
  if (!esRegistro(x)) return { ok: false, errores: ['El archivo del tema no tiene el formato esperado (debe ser un objeto).'] };
  if (x.version !== 1) errores.push('El tema debe tener "version": 1.');

  let plantilla: IdPlantilla | undefined;
  if (x.plantilla !== undefined) {
    if (!PLANTILLAS.includes(x.plantilla as IdPlantilla)) errores.push(`La plantilla "${String(x.plantilla)}" no existe. Opciones: ${PLANTILLAS.join(', ')}.`);
    else plantilla = x.plantilla as IdPlantilla;
  }

  const colores = { fondo: '', superficie: '', acento: '' };
  if (!esRegistro(x.colores)) {
    errores.push('El tema no tiene "colores" (fondo, superficie y acento).');
  } else {
    for (const c of ['fondo', 'superficie', 'acento'] as const) {
      const v = x.colores[c];
      if (typeof v !== 'string' || !COLOR.test(v)) errores.push(`El color "${c}" no es válido (debe verse así: #F5EFE6).`);
      else colores[c] = v;
    }
  }

  if (!TIPOGRAFIAS.includes(x.tipografia as ParTipografico)) errores.push(`La tipografía debe ser una de: ${TIPOGRAFIAS.join(', ')}.`);

  if (errores.length > 0) return { ok: false, errores };
  const tema: Tema = { version: 1, colores, tipografia: x.tipografia as ParTipografico };
  if (plantilla !== undefined) tema.plantilla = plantilla;
  return { ok: true, tema };
}
