// Genera el código QR del menú.
// Uso: npm run qr -- https://ejemplo.com/menu
// Crea salida/qr-menu.svg y salida/qr-menu.png (PNG de 1280 px, corrección de errores Q, margen de silencio de 4 módulos).
// Seguridad: el argumento solo se lee como texto; nunca se pasa a un shell.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import QRCode from 'qrcode';

function fallar(mensaje) {
  console.error(`Error: ${mensaje}`);
  console.error('Uso: npm run qr -- https://su-sitio.com/menu');
  process.exit(1);
}

const entrada = process.argv[2];
if (process.argv.length !== 3 || !entrada) fallar('indique una sola dirección web (URL), por ejemplo https://ejemplo.com/menu');
if (entrada.length > 2000) fallar('la dirección es demasiado larga (máximo 2000 caracteres).');
if (/\s/.test(entrada)) fallar('la dirección no puede tener espacios.');

let url;
try {
  url = new URL(entrada);
} catch {
  fallar(`"${entrada}" no es una dirección web válida.`);
}
if (url.protocol !== 'https:') fallar('la dirección debe empezar por https:// (por seguridad no se aceptan otros esquemas).');
if (!url.hostname) fallar('la dirección no tiene un nombre de sitio.');
if (url.username || url.password) fallar('la dirección no debe incluir usuario ni contraseña.');

const opciones = { errorCorrectionLevel: 'Q', margin: 4 };
const carpeta = fileURLToPath(new URL('../salida/', import.meta.url));
await mkdir(carpeta, { recursive: true });
await writeFile(path.join(carpeta, 'qr-menu.svg'), await QRCode.toString(url.href, { ...opciones, type: 'svg' }), 'utf8');
await QRCode.toFile(path.join(carpeta, 'qr-menu.png'), url.href, { ...opciones, type: 'png', width: 1280 });
console.log(`QR creado para ${url.href}`);
console.log('  salida/qr-menu.svg  (vectorial, para imprimir en grande)');
console.log('  salida/qr-menu.png  (1280 px)');
