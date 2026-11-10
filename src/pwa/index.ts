// MENU-005: registro del service worker (uso sin internet). Se llama una vez al arrancar.
// Lo que se guarda y cuándo se actualiza está explicado en public/sw.js.
export function iniciarPWA(): void {
  // En desarrollo no se registra: la caché confundiría al programar.
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  const registrar = (): void => {
    // Ruta relativa a la página (no a "/"): funciona en una subcarpeta de GitHub Pages.
    const url = new URL('sw.js', document.baseURI).href;
    navigator.serviceWorker.register(url).catch((error: unknown) => {
      console.warn('No se pudo activar el uso sin internet', error);
    });
  };

  // Esperar a "load" para no competir con la carga del menú; si ya pasó, registrar ya.
  if (document.readyState === 'complete') registrar();
  else window.addEventListener('load', registrar, { once: true });
}
