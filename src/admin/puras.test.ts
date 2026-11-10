import { describe, expect, it } from 'vitest';
import { extensionDe, MENSAJE_ASIGNACION, mensajeAsignacion, parsearHash } from './puras';

describe('parsearHash', () => {
  it('separa ruta y parámetro', () => {
    expect(parsearHash('#/plato/abc')).toEqual({ nombre: 'plato', param: 'abc' });
    expect(parsearHash('#/platos')).toEqual({ nombre: 'platos', param: null });
    expect(parsearHash('')).toEqual({ nombre: '', param: null });
  });
  it('un % mal formado no lanza y deja param en null', () => {
    expect(() => parsearHash('#/plato/%E0%A4%A')).not.toThrow();
    expect(parsearHash('#/plato/%E0%A4%A')).toEqual({ nombre: 'plato', param: null });
  });
});

describe('extensionDe', () => {
  it('deriva la extensión del tipo del blob', () => {
    expect(extensionDe('image/webp')).toBe('webp');
    expect(extensionDe('image/jpeg')).toBe('jpg');
    expect(extensionDe('image/png')).toBe('png');
  });
  it('rechaza otros tipos', () => {
    expect(() => extensionDe('image/svg+xml')).toThrow();
  });
});

describe('mensajeAsignacion', () => {
  it('muestra solo los dos mensajes conocidos', () => {
    expect(mensajeAsignacion('No autorizado.')).toBe('No autorizado.');
    expect(mensajeAsignacion(MENSAJE_ASIGNACION)).toBe(MENSAJE_ASIGNACION);
  });
  it('cualquier otro texto se reemplaza por el genérico', () => {
    expect(mensajeAsignacion('duplicate key value violates unique constraint')).toBe(MENSAJE_ASIGNACION);
    expect(mensajeAsignacion(undefined)).toBe(MENSAJE_ASIGNACION);
  });
});
