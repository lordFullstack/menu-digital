// El paquete "qrcode" no trae tipos; se declara solo lo que el panel usa.
declare module 'qrcode' {
  interface OpcionesQR {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  }
  export function toCanvas(lienzo: HTMLCanvasElement, texto: string, opciones?: OpcionesQR): Promise<void>;
  const predeterminado: { toCanvas: typeof toCanvas };
  export default predeterminado;
}
