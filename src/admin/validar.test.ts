import { describe, expect, it } from 'vitest';
import {
  erroresHorario,
  slugDesde,
  validarEnlace,
  validarLista,
  validarNombre,
  validarPrecio,
  validarSlug,
  validarWhatsapp,
} from './validar';

describe('validaciones del panel', () => {
  it('nombre: obligatorio y máximo 80', () => {
    expect(validarNombre('   ').ok).toBe(false);
    expect(validarNombre('Arepa').ok).toBe(true);
    expect(validarNombre('a'.repeat(81)).ok).toBe(false);
  });
  it('precio: entero 0..10.000.000, con o sin puntos de miles', () => {
    expect(validarPrecio('18000')).toEqual({ ok: true, valor: 18000 });
    expect(validarPrecio('$ 18.000')).toEqual({ ok: true, valor: 18000 });
    expect(validarPrecio('0')).toEqual({ ok: true, valor: 0 });
    expect(validarPrecio('18.5').ok).toBe(false);
    expect(validarPrecio('-1').ok).toBe(false);
    expect(validarPrecio('10000001').ok).toBe(false);
    expect(validarPrecio('').ok).toBe(false);
  });
  it('lista: separa por comas, quita vacíos y repetidos, máx. 30 de 60', () => {
    expect(validarLista(' arroz, ,pollo,arroz ')).toEqual({ ok: true, valor: ['arroz', 'pollo'] });
    expect(validarLista(Array.from({ length: 31 }, (_, i) => `x${i}`).join(',')).ok).toBe(false);
    expect(validarLista('a'.repeat(61)).ok).toBe(false);
  });
  it('whatsapp: 8 a 15 dígitos o vacío', () => {
    expect(validarWhatsapp('')).toEqual({ ok: true, valor: null });
    expect(validarWhatsapp('+57 300 123 4567')).toEqual({ ok: true, valor: '573001234567' });
    expect(validarWhatsapp('123').ok).toBe(false);
  });
  it('enlaces: solo https de la lista blanca', () => {
    expect(validarEnlace('https://instagram.com/cafe', 'instagram').ok).toBe(true);
    expect(validarEnlace('http://instagram.com/cafe', 'instagram').ok).toBe(false);
    expect(validarEnlace('https://instagram.com.evil.com/x', 'instagram').ok).toBe(false);
    expect(validarEnlace('', 'mapa')).toEqual({ ok: true, valor: null });
  });
  it('slug: formato, largo y reservados', () => {
    expect(validarSlug('cafe-central').ok).toBe(true);
    expect(validarSlug('ab').ok).toBe(false);
    expect(validarSlug('Cafe_1').ok).toBe(false);
    expect(validarSlug('-cafe').ok).toBe(false);
    expect(validarSlug('admin').ok).toBe(false);
    expect(slugDesde('Café La Esquina!')).toBe('cafe-la-esquina');
  });
  it('horario: días, horas y apertura distinta de cierre', () => {
    expect(erroresHorario([{ dias: [1, 2], abre: '08:00', cierra: '18:00' }])).toEqual([null]);
    expect(erroresHorario([{ dias: [], abre: '08:00', cierra: '18:00' }])[0]).not.toBeNull();
    expect(erroresHorario([{ dias: [1], abre: '08:00', cierra: '08:00' }])[0]).not.toBeNull();
    expect(erroresHorario([{ dias: [5], abre: '18:00', cierra: '02:00' }])).toEqual([null]);
  });
});
