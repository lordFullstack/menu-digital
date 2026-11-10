// Marco del panel (barra, avisos, pie), sesión y ruteo por hash (#/platos, #/plato/<id>, …).
import { supabase, supabaseConfigurado } from '../supabase/cliente';
import * as api from './api';
import { crearZonaAvisos, manejarError, quitarAvisos, registrarSesionExpirada } from './avisos';
import { clasificar } from './errores';
import type { Ctx } from './contexto';
import { elegirNegocio, estado, limpiarEstado, negocioActual, resolverNegocioInicial } from './estado';
import { parsearHash } from './puras';
import { pantallaApariencia } from './pantallas/apariencia';
import { pantallaCategorias } from './pantallas/categorias';
import { pantallaDatos } from './pantallas/datos';
import { pantallaEntrar, pantallaNuevaClave } from './pantallas/entrar';
import { pantallaElegir, pantallaInicio } from './pantallas/inicio';
import { pantallaNegocios } from './pantallas/negocios';
import { pantallaPlato } from './pantallas/plato';
import { pantallaPlatos } from './pantallas/platos';
import { boton, cargando, con, el, errorDeCarga, icono, ICONOS } from './ui';

const FIRMA = 'Synaptix AI Labs · Programando con Sistemas Inteligentes';

export async function iniciarApp(raiz: HTMLElement): Promise<void> {
  // ───────── Marco ─────────
  const bannerOffline = el('p', 'sin-conexion', 'Sin conexión: los cambios no se pueden guardar');
  bannerOffline.setAttribute('role', 'status');
  const marca = el('span', 'barra-marca', 'Panel del menú');
  const nombreNegocio = el('span', 'barra-negocio');
  const cambiar = el('a', 'boton boton--texto boton--chico');
  cambiar.href = '#/elegir';
  cambiar.append(icono(ICONOS.cambiar), el('span', undefined, 'Cambiar'));
  const salir = boton('Salir', { variante: 'texto', icono: ICONOS.salir, clase: 'boton--chico' });
  const barra = el('header', 'barra');
  con(barra, con(el('div', 'barra-in'), marca, nombreNegocio, cambiar, salir));
  const principal = el('main', 'contenido');
  principal.id = 'contenido';
  const pie = con(el('footer', 'pie'), el('p', undefined, FIRMA));
  const saltar = el('a', 'saltar', 'Saltar al contenido');
  saltar.href = '#contenido';
  saltar.addEventListener('click', (e) => {
    e.preventDefault();
    principal.focus();
  });
  principal.tabIndex = -1;
  const app = con(el('div', 'app'), saltar, bannerOffline, barra, principal, pie, crearZonaAvisos());
  raiz.replaceChildren(app);

  const actualizarRed = (): void => {
    bannerOffline.hidden = navigator.onLine;
  };
  window.addEventListener('online', actualizarRed);
  window.addEventListener('offline', actualizarRed);
  actualizarRed();

  function ponerBarra(conSesion: boolean): void {
    salir.hidden = !conSesion;
    const n = negocioActual();
    nombreNegocio.textContent = conSesion && n ? n.nombre : '';
    cambiar.hidden = !(conSesion && n && (estado.esAdmin || estado.negocios.length > 1));
  }

  if (!supabaseConfigurado) {
    ponerBarra(false);
    principal.replaceChildren(
      el('p', 'vacio vacio--error', 'El panel no está configurado todavía (falta la conexión con la base de datos). Avise a quien lo instaló.'),
    );
    return;
  }

  // ───────── Sesión ─────────
  let generacion = 0;

  // Un solo repintado por cierre de sesión: mientras se cierra, el evento SIGNED_OUT no repinta.
  let cerrando = false;
  async function cerrarSesionLocal(): Promise<void> {
    cerrando = true;
    try {
      await supabase().auth.signOut({ scope: 'local' });
    } catch {
      /* si falla, igual se limpia lo local */
    }
    limpiarEstado();
    cerrando = false;
    void pintar();
  }

  registrarSesionExpirada(() => {
    estado.avisoEntrar = 'Su sesión expiró. Entre de nuevo.';
    void cerrarSesionLocal();
  });

  salir.addEventListener('click', () => {
    quitarAvisos();
    void cerrarSesionLocal();
  });

  supabase().auth.onAuthStateChange((evento) => {
    // Sin llamar a Supabase dentro del callback: se difiere para evitar bloqueos.
    if (evento === 'PASSWORD_RECOVERY') {
      estado.recuperando = true;
      window.setTimeout(() => void pintar(), 0);
    } else if (evento === 'SIGNED_OUT' && !cerrando) {
      limpiarEstado();
      window.setTimeout(() => void pintar(), 0);
    }
  });

  window.addEventListener('hashchange', () => void pintar());

  // ───────── Ruteo ─────────
  function ruta(): { nombre: string; param: string | null } {
    return parsearHash(window.location.hash);
  }

  function ir(hash: string): void {
    if (window.location.hash === hash) void pintar();
    else window.location.hash = hash;
  }

  async function pintar(): Promise<void> {
    const mia = ++generacion;
    const cont = el('div', 'pantalla');
    principal.replaceChildren(cont);
    const ctx: Ctx = { cont, param: null, ir, repintar: () => void pintar() };
    cont.appendChild(cargando());

    if (estado.recuperando) {
      ponerBarra(false);
      pantallaNuevaClave(cont, () => {
        window.location.hash = '#/';
        void pintar();
      });
      return;
    }

    let sesion = null;
    try {
      sesion = (await supabase().auth.getSession()).data.session;
    } catch {
      sesion = null;
    }
    if (mia !== generacion) return;
    if (!sesion) {
      limpiarEstado();
      ponerBarra(false);
      pantallaEntrar(cont, () => {
        window.location.hash = '#/';
        void pintar();
      });
      return;
    }

    if (!estado.cargado) {
      try {
        const [admin, negocios] = await Promise.all([api.esAdmin(), api.misNegocios()]);
        if (mia !== generacion) return;
        estado.esAdmin = admin;
        estado.negocios = negocios;
        estado.cargado = true;
        resolverNegocioInicial();
      } catch (e) {
        if (mia !== generacion) return;
        // Sesión vencida: se vuelve a Entrar con el aviso (en vez de dejar un error de carga).
        if (clasificar(e).tipo === 'sesion') return void manejarError(e);
        ponerBarra(true);
        cont.replaceChildren(errorDeCarga(() => void pintar()));
        return;
      }
    }
    ponerBarra(true);

    const r = ruta();
    ctx.param = r.param;
    const hayNegocio = negocioActual() !== null;
    const necesitaNegocio = ['platos', 'plato', 'categorias', 'apariencia', 'datos'].includes(r.nombre);
    if (r.nombre === 'elegir' || ((r.nombre === '' || necesitaNegocio) && !hayNegocio && r.nombre !== 'negocios')) {
      elegirNegocio(null);
      ponerBarra(true);
      return pantallaElegir(ctx);
    }
    switch (r.nombre) {
      case 'platos':
        return pantallaPlatos(ctx);
      case 'plato':
        return pantallaPlato(ctx);
      case 'categorias':
        return pantallaCategorias(ctx);
      case 'apariencia':
        return pantallaApariencia(ctx);
      case 'datos':
        return pantallaDatos(ctx);
      case 'negocios':
        return pantallaNegocios(ctx);
      default:
        return pantallaInicio(ctx);
    }
  }

  await pintar();
}
