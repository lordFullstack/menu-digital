# Rescate: qué hacer si se publica un service worker dañado

El service worker (`sw.js`) es el archivo que guarda una copia del menú en el celular para que funcione sin internet. Si se publica uno dañado, algunos celulares pueden quedarse viendo una versión rota. Esta guía lo arregla sin saber programar.

## Pasos

1. En la carpeta `public/` del proyecto, reemplace TODO el contenido de `sw.js` por el código de abajo.
2. Publique el proyecto como siempre (suba los cambios; Vercel lo despliega solo).
3. Espere unos minutos. Cuando un cliente abra el menú con internet, el archivo de emergencia se instala solo, borra las copias guardadas de este menú, se desregistra y recarga la página.
4. Cuando todo funcione, vuelva a poner el `sw.js` bueno (en Git: restaure la versión anterior del archivo) y publique de nuevo.

## Código de emergencia (`public/sw.js`)

```js
/* SW de emergencia: se instala ya, borra SOLO las cachés de este menú,
 * se desregistra y recarga las pestañas abiertas. */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      // Solo las cachés con el prefijo de esta app ("menu-digital|"); no toca las de otras apps.
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((n) => n.startsWith('menu-digital|')).map((n) => caches.delete(n)));
      await self.registration.unregister();
      const clientes = await self.clients.matchAll({ type: 'window' });
      for (const c of clientes) c.navigate(c.url);
    })(),
  );
});
```

(No lleva `fetch`: así el navegador deja de usar copias guardadas y pide todo a internet.)

## Cómo comprobar que funcionó

1. Abra el menú en el celular o computador con internet y recárguelo dos veces.
2. En Chrome del computador: tecla F12, pestaña **Application** (Aplicación), **Service Workers**. No debe quedar ninguno activo para esta página (o debe decir "deleted").
3. En esa misma pestaña, **Cache Storage**: no debe quedar ninguna entrada que empiece por `menu-digital|`.
4. El menú debe verse con la última versión. Después de restaurar el `sw.js` bueno (paso 4), vuelva a abrirlo con internet para que se instale de nuevo.
