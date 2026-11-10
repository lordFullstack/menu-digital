// Error de contenido (datos mal escritos o inválidos); los fallos de red usan Error normal.
export class ErrorDeDatos extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDeDatos';
  }
}
