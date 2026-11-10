// Fotos: se reducen en el navegador antes de subirlas (lado mayor <= 1600 px, WebP o JPEG, <= 2 MB).
// Se usa createImageBitmap (no una <img> con blob:), así la CSP estricta no necesita permitir blob:.
import { borrarFoto, subirFoto } from './api';

export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_LADO = 1600;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ORIGINAL = 30 * 1024 * 1024;

function aBlob(lienzo: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob | null> {
  return new Promise((resolver) => lienzo.toBlob((b) => resolver(b), tipo, calidad));
}

function webpDisponible(): boolean {
  const l = document.createElement('canvas');
  l.width = 1;
  l.height = 1;
  return l.toDataURL('image/webp').startsWith('data:image/webp');
}

export interface FotoPreparada {
  blob: Blob;
  /** Lienzo ya reducido, para mostrar la vista previa sin crear URLs de blob. */
  lienzo: HTMLCanvasElement;
}

export async function prepararFoto(archivo: File): Promise<FotoPreparada> {
  if (!TIPOS_FOTO.includes(archivo.type)) throw new Error('Use una foto JPG, PNG o WebP.');
  if (archivo.size > MAX_ORIGINAL) throw new Error('La foto es demasiado pesada. Pruebe con otra.');
  if (typeof createImageBitmap !== 'function') throw new Error('Este navegador no puede preparar fotos. Actualícelo e intente de nuevo.');

  let mapa: ImageBitmap;
  try {
    mapa = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('No se pudo leer la foto. Pruebe con otra.');
  }

  try {
    const tipo = webpDisponible() ? 'image/webp' : 'image/jpeg';
    let escala = Math.min(1, MAX_LADO / Math.max(mapa.width, mapa.height));
    for (let intento = 0; intento < 6; intento++) {
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.max(1, Math.round(mapa.width * escala));
      lienzo.height = Math.max(1, Math.round(mapa.height * escala));
      const ctx = lienzo.getContext('2d');
      if (!ctx) throw new Error('Este navegador no puede preparar fotos.');
      // JPEG no tiene transparencia: se pinta fondo blanco (es un dato de imagen, no un color de la interfaz).
      if (tipo === 'image/jpeg') {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      }
      ctx.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
      for (const calidad of [0.85, 0.75, 0.65, 0.55, 0.45]) {
        const blob = await aBlob(lienzo, tipo, calidad);
        if (blob && blob.size <= MAX_BYTES) return { blob, lienzo };
      }
      escala *= 0.8;
    }
    throw new Error('No se pudo reducir la foto a 2 MB. Pruebe con otra.');
  } finally {
    mapa.close();
  }
}

/** Lo que el formulario necesita saber de una foto: sube la nueva y recuerda cuál borrar después. */
interface EntradaFoto {
  actual: string | null;
  blob: Blob | null;
  quitar: boolean;
}

/**
 * Sube las fotos nuevas, ejecuta el guardado con las rutas resultantes y, si todo sale bien, borra las
 * anteriores (si el borrado falla no bloquea). Si el guardado falla, borra las recién subidas.
 */
export async function guardarConFotos<T>(
  negocioId: string,
  entradas: EntradaFoto[],
  guardar: (rutas: (string | null)[]) => Promise<T>,
): Promise<T> {
  const subidas: string[] = [];
  const anteriores: string[] = [];
  const rutas: (string | null)[] = [];
  try {
    for (const e of entradas) {
      if (e.blob) {
        const nueva = await subirFoto(negocioId, e.blob);
        subidas.push(nueva);
        if (e.actual) anteriores.push(e.actual);
        rutas.push(nueva);
      } else if (e.quitar) {
        if (e.actual) anteriores.push(e.actual);
        rutas.push(null);
      } else {
        rutas.push(e.actual);
      }
    }
    const resultado = await guardar(rutas);
    for (const a of anteriores) void borrarFoto(a);
    return resultado;
  } catch (e) {
    for (const s of subidas) void borrarFoto(s);
    throw e;
  }
}
