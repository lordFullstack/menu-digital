// Genera los iconos de la app (SVG + PNG) de forma reproducible.
// Uso: npm run iconos
// Escribe en public/iconos/: icono.svg, icono-192.png, icono-512.png, icono-maskable-512.png
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const CAFE = '#3B2A20';
const CREMA = '#F5EFE6';
const destino = fileURLToPath(new URL('../public/iconos/', import.meta.url));

// Campana de servir ("cloche"): cúpula, perilla y bandeja. Sin texto.
const campana = `
  <circle cx="256" cy="150" r="20" fill="${CREMA}"/>
  <path d="M96 336a160 160 0 0 1 320 0z" fill="${CREMA}"/>
  <path d="M148 322a108 108 0 0 1 70-92" fill="none" stroke="${CAFE}" stroke-width="14" stroke-linecap="round" opacity=".35"/>
  <rect x="72" y="352" width="368" height="30" rx="15" fill="${CREMA}"/>`;

const svg = (contenido, redondeado) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <title>Menú digital</title>
  <rect width="512" height="512" ${redondeado ? 'rx="112" ' : ''}fill="${CAFE}"/>${contenido}
</svg>
`;

const normal = svg(campana, true);
// Maskable: fondo a sangre y el dibujo al 66 % para quedar dentro de la zona segura (círculo central de 80 %).
const maskable = svg(`\n  <g transform="translate(256 256) scale(.66) translate(-256 -266)">${campana}\n  </g>`, false);

async function png(origen, lado, archivo) {
  await sharp(Buffer.from(origen), { density: 384 }).resize(lado, lado).png({ compressionLevel: 9 }).toFile(path.join(destino, archivo));
  console.log('  creado', archivo);
}

await mkdir(destino, { recursive: true });
await writeFile(path.join(destino, 'icono.svg'), normal, 'utf8');
console.log('  creado icono.svg');
await png(normal, 192, 'icono-192.png');
await png(normal, 512, 'icono-512.png');
await png(maskable, 512, 'icono-maskable-512.png');
