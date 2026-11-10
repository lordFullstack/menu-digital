// Punto de entrada: fuentes, estilos, carga de datos y montaje de la interfaz.
import '@fontsource-variable/inter';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/sora';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/nunito';
import './estilos/base.css';
import './estilos/componentes.css';
import './estilos/detalle.css';

import { cargarDatos, rutaDePathname } from './datos';
import type { RutaPublica } from './datos';
import type { IdPlantilla } from './datos';
import { PLANTILLAS } from './tema';
import { montarApp, mostrarCarga, mostrarError, mostrarNoEncontrado } from './ui';

/** ?plantilla=cafeteria|elegante|heladeria|rapida (cualquier otro valor se ignora). */
function plantillaDeUrl(): IdPlantilla | null {
  const valor = new URLSearchParams(window.location.search).get('plantilla');
  if (valor !== null && Object.prototype.hasOwnProperty.call(PLANTILLAS, valor)) {
    return valor as IdPlantilla;
  }
  return null;
}

/** Pinta el menú ya validado y avisa a las animaciones; los extras nunca deben tumbar el menú. */
function mostrarMenu(raiz: HTMLElement, datos: Parameters<typeof montarApp>[1]): void {
  montarApp(raiz, datos);
  // Aviso para animaciones (MENU-004) y PWA (MENU-005): la interfaz ya está pintada.
  document.dispatchEvent(new CustomEvent('menu:listo', { detail: { menu: datos.menu, tema: datos.tema } }));
  void import('./animaciones')
    .then((m) => m.iniciarAnimaciones())
    .catch((e) => console.warn('Animaciones no disponibles', e));
}

async function iniciar(raiz: HTMLElement, ruta: RutaPublica): Promise<void> {
  if (ruta.tipo === 'invalida') {
    mostrarNoEncontrado(raiz); // sin tocar la red
    return;
  }
  mostrarCarga(raiz);
  try {
    if (ruta.tipo === 'negocio') {
      // Solo en /<slug>: el código de Supabase no se descarga para el menú de muestra.
      const { cargarMenuNegocio } = await import('./datos/negocio');
      const r = await cargarMenuNegocio(ruta.slug);
      if (r.estado === 'no-encontrado') mostrarNoEncontrado(raiz);
      else mostrarMenu(raiz, { ...r.datos, desdeCopia: r.desdeCopia });
      return;
    }
    const { menu, tema } = await cargarDatos();
    const plantilla = plantillaDeUrl();
    mostrarMenu(raiz, { menu, tema: plantilla ? PLANTILLAS[plantilla] : tema });
  } catch (error) {
    console.error(error);
    mostrarError(raiz, error, () => void iniciar(raiz, ruta));
  }
}

const raiz = document.getElementById('app');
if (raiz) void iniciar(raiz, rutaDePathname(window.location.pathname));

// PWA (uso sin internet): independiente de que el menú haya cargado bien.
void import('./pwa')
  .then((m) => m.iniciarPWA())
  .catch((e) => console.warn('PWA no disponible', e));
