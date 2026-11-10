// Lo que cada pantalla recibe de la aplicación.
export interface Ctx {
  /** Contenedor propio de esta pantalla (si la persona navega antes de terminar, se descarta solo). */
  cont: HTMLElement;
  /** Parte variable de la ruta (por ejemplo el id del plato en #/plato/<id>). */
  param: string | null;
  /** Cambia de pantalla. */
  ir(hash: string): void;
  /** Vuelve a pintar la pantalla actual (después de cambiar datos). */
  repintar(): void;
}
