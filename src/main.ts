// Punto de entrada: fuentes, estilos, carga de datos y montaje de la interfaz.
import '@fontsource-variable/inter';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/sora';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/nunito';
import './estilos/base.css';
import './estilos/componentes.css';
import './estilos/detalle.css';

import { cargarDatos } from './datos';
import type { IdPlantilla } from './datos';
import { PLANTILLAS } from './tema';
import { montarApp, mostrarCarga, mostrarError } from './ui';

/** ?plantilla=cafeteria|elegante|heladeria|rapida (cualquier otro valor se ignora). */
function plantillaDeUrl(): IdPlantilla | null {
  const valor = new URLSearchParams(window.location.search).get('plantilla');
  if (valor !== null && Object.prototype.hasOwnProperty.call(PLANTILLAS, valor)) {
    return valor as IdPlantilla;
  }
  return null;
}

async function iniciar(raiz: HTMLElement): Promise<void> {
  mostrarCarga(raiz);
  try {
    const { menu, tema } = await cargarDatos();
    const plantilla = plantillaDeUrl();
    const temaFinal = plantilla ? PLANTILLAS[plantilla] : tema;
    montarApp(raiz, { menu, tema: temaFinal });
    // Aviso para animaciones (MENU-004) y PWA (MENU-005): la interfaz ya está pintada.
    document.dispatchEvent(new CustomEvent('menu:listo', { detail: { menu, tema: temaFinal } }));
    // Extras que nunca deben tumbar el menú: si fallan, el contenido ya está visible.
    void import('./animaciones')
      .then((m) => m.iniciarAnimaciones())
      .catch((e) => console.warn('Animaciones no disponibles', e));
  } catch (error) {
    console.error(error);
    mostrarError(raiz, error, () => void iniciar(raiz));
  }
}

const raiz = document.getElementById('app');
if (raiz) void iniciar(raiz);

// PWA (uso sin internet): independiente de que el menú haya cargado bien.
void import('./pwa')
  .then((m) => m.iniciarPWA())
  .catch((e) => console.warn('PWA no disponible', e));
