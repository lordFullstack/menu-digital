// Aviso discreto cuando se muestra la copia guardada en el dispositivo (sin conexión).
import './aviso.css';
import { el } from './dom';

export function crearAvisoCopia(): HTMLElement {
  const p = el('p', 'aviso-copia', 'Mostrando la última versión guardada');
  p.setAttribute('role', 'status');
  return p;
}
