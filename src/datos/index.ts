// Capa de datos del menú: tipos, validación, carga y utilidades seguras.
import type { Menu, Tema } from './tipos';
import { ErrorDeDatos } from './errores';
import { validarMenu, validarTema } from './validar';

export type {
  Etiqueta, ParTipografico, IdPlantilla, Tema, Franja, Plato, Categoria, Negocio, Menu,
} from './tipos';
export { validarMenu, validarTema } from './validar';
export type { TipoEnlace } from './utilidades';
export { estaAbierto, formatearPrecio, enlaceWhatsApp, urlSegura, rutaLocalSegura, fotoPermitida, enlacePermitido } from './utilidades';

export { ErrorDeDatos } from './errores';
export { rutaDePathname, slugValido, SLUGS_RESERVADOS } from './ruta';
export type { RutaPublica } from './ruta';

async function leerJson(ruta: string, nombre: string): Promise<unknown> {
  let respuesta: Response;
  try {
    respuesta = await fetch(ruta);
  } catch {
    throw new Error(`No se pudo cargar ${nombre}. Revise su conexión a internet e intente de nuevo.`);
  }
  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar ${nombre} (el servidor respondió ${respuesta.status}).`);
  }
  try {
    return await respuesta.json();
  } catch {
    throw new ErrorDeDatos(`El archivo ${nombre} está mal escrito (no es un JSON válido). Revise comas, comillas y llaves.`);
  }
}

/** Carga y valida menu.json y tema.json. Lanza un Error con mensaje legible si algo falla. */
export async function cargarDatos(): Promise<{ menu: Menu; tema: Tema }> {
  const [crudoMenu, crudoTema] = await Promise.all([
    leerJson('./datos/menu.json', 'el menú (menu.json)'),
    leerJson('./datos/tema.json', 'el tema (tema.json)'),
  ]);
  const m = validarMenu(crudoMenu);
  if (!m.ok) throw new ErrorDeDatos(`El menú tiene errores:\n- ${m.errores.join('\n- ')}`);
  const t = validarTema(crudoTema);
  if (!t.ok) throw new ErrorDeDatos(`El tema tiene errores:\n- ${t.errores.join('\n- ')}`);
  return { menu: m.menu, tema: t.tema };
}
