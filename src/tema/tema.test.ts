import { describe, it, expect } from 'vitest';
import { PLANTILLAS, generarPaleta, aplicarTema, contraste } from './index';
import type { Tema } from '../datos/tipos';

type Colores = Tema['colores'];

const HOSTILES: Record<string, Colores> = {
  'tres iguales': { fondo: '#C0A080', superficie: '#C0A080', acento: '#C0A080' },
  'acento casi igual al fondo': { fondo: '#F5EFE6', superficie: '#3B2A20', acento: '#F4EEE5' },
  'todo blanco': { fondo: '#FFFFFF', superficie: '#FFFFFF', acento: '#FFFFFF' },
  'todo negro': { fondo: '#000000', superficie: '#000000', acento: '#000000' },
  'gris medio': { fondo: '#808080', superficie: '#808080', acento: '#808080' },
};

const CASOS: Record<string, Colores> = {
  ...Object.fromEntries(Object.entries(PLANTILLAS).map(([id, t]) => [id, t.colores])),
  ...HOSTILES,
};

/** Mejor contraste que cualquier texto puede lograr sobre un fondo (negro o blanco). */
const mejorPosible = (fondo: string) => Math.max(contraste('#000000', fondo), contraste('#FFFFFF', fondo));
/** Regla del contrato (7:1) limitada a lo matemáticamente alcanzable. */
const minimo7 = (fondo: string) => Math.min(7, mejorPosible(fondo)) - 0.01;

function verificar(c: Colores) {
  const p = generarPaleta(c);
  const f = p['--c-fondo']!;
  const s = p['--c-superficie']!;
  const a = p['--c-acento']!;
  // Los tres elegidos se conservan exactos
  expect(f).toBe(c.fondo.toUpperCase());
  expect(s).toBe(c.superficie.toUpperCase());
  expect(a).toBe(c.acento.toUpperCase());
  // Reglas de contraste
  expect(contraste(p['--c-sobre-fondo']!, f)).toBeGreaterThanOrEqual(minimo7(f));
  expect(contraste(p['--c-sobre-fondo-suave']!, f)).toBeGreaterThanOrEqual(4.5);
  expect(contraste(p['--c-sobre-superficie']!, s)).toBeGreaterThanOrEqual(minimo7(s));
  expect(contraste(p['--c-sobre-superficie-suave']!, s)).toBeGreaterThanOrEqual(4.5);
  expect(contraste(p['--c-sobre-acento']!, a)).toBeGreaterThanOrEqual(4.5);
  expect(contraste(p['--c-acento-en-fondo']!, f)).toBeGreaterThanOrEqual(4.5);
  expect(contraste(p['--c-acento-en-superficie']!, s)).toBeGreaterThanOrEqual(4.5);
  return p;
}

const NOMBRES = [
  '--c-fondo', '--c-fondo-2', '--c-sobre-fondo', '--c-sobre-fondo-suave',
  '--c-superficie', '--c-superficie-2', '--c-sobre-superficie', '--c-sobre-superficie-suave',
  '--c-acento', '--c-sobre-acento', '--c-acento-en-fondo', '--c-acento-en-superficie', '--c-borde',
];

function raizFalsa() {
  const props = new Map<string, string>();
  const raiz = { style: { setProperty: (k: string, v: string) => void props.set(k, v) } };
  return { props, raiz: raiz as unknown as HTMLElement };
}

describe('contraste', () => {
  it('negro sobre blanco es 21', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });
  it('mismo color es 1 y es simétrico', () => {
    expect(contraste('#808080', '#808080')).toBeCloseTo(1, 5);
    expect(contraste('#C8553D', '#F5EFE6')).toBeCloseTo(contraste('#F5EFE6', '#C8553D'), 10);
  });
});

describe('PLANTILLAS', () => {
  it('trae las 4 plantillas con los colores y tipografías del contrato', () => {
    expect(Object.keys(PLANTILLAS).sort()).toEqual(['cafeteria', 'elegante', 'heladeria', 'rapida']);
    expect(PLANTILLAS.cafeteria.colores).toEqual({ fondo: '#F5EFE6', superficie: '#3B2A20', acento: '#C8553D' });
    expect(PLANTILLAS.elegante.colores).toEqual({ fondo: '#141414', superficie: '#2A2622', acento: '#C9A227' });
    expect(PLANTILLAS.heladeria.colores).toEqual({ fondo: '#FBF8F3', superficie: '#2F6F62', acento: '#FF6B5B' });
    expect(PLANTILLAS.rapida.colores).toEqual({ fondo: '#FFFFFF', superficie: '#1B1B1B', acento: '#E63946' });
    expect(PLANTILLAS.cafeteria.tipografia).toBe('clasica');
    expect(PLANTILLAS.elegante.tipografia).toBe('clasica');
    expect(PLANTILLAS.heladeria.tipografia).toBe('calida');
    expect(PLANTILLAS.rapida.tipografia).toBe('moderna');
  });
});

describe('generarPaleta', () => {
  for (const [nombre, colores] of Object.entries(CASOS)) {
    it(`cumple todas las reglas: ${nombre}`, () => {
      const p = verificar(colores);
      for (const n of NOMBRES) expect(p[n], n).toMatch(/^#[0-9A-F]{6}$/);
    });
  }

  it('acepta minúsculas y conserva el color (en mayúsculas)', () => {
    const p = generarPaleta({ fondo: '#ffffff', superficie: '#1b1b1b', acento: '#e63946' });
    expect(p['--c-acento']).toBe('#E63946');
  });
});

describe('validación de entrada', () => {
  const malos = ['red', '#FFF', 'url(x)', '#GGGGGG', '#FFFFFF;', ' #FFFFFF', '#FFFFFFFF', 'rgb(0,0,0)', ''];
  for (const m of malos) {
    it(`generarPaleta rechaza "${m}"`, () => {
      expect(() => generarPaleta({ fondo: m, superficie: '#000000', acento: '#000000' })).toThrow(Error);
      expect(() => generarPaleta({ fondo: '#000000', superficie: m, acento: '#000000' })).toThrow(Error);
      expect(() => generarPaleta({ fondo: '#000000', superficie: '#000000', acento: m })).toThrow(Error);
    });
    it(`aplicarTema rechaza "${m}" sin escribir nada en el DOM`, () => {
      const { props, raiz } = raizFalsa();
      const tema: Tema = { version: 1, colores: { fondo: '#FFFFFF', superficie: '#000000', acento: m }, tipografia: 'moderna' };
      expect(() => aplicarTema(tema, raiz)).toThrow(Error);
      expect(props.size).toBe(0);
    });
  }
  it('contraste rechaza entradas inválidas', () => {
    expect(() => contraste('red', '#FFFFFF')).toThrow(Error);
  });
  it('aplicarTema rechaza una tipografía inválida sin escribir nada', () => {
    const { props, raiz } = raizFalsa();
    const tema = { ...PLANTILLAS.rapida, tipografia: 'x;color:red' } as unknown as Tema;
    expect(() => aplicarTema(tema, raiz)).toThrow(Error);
    expect(props.size).toBe(0);
  });
});

describe('aplicarTema', () => {
  it('escribe todas las variables, las fuentes y los 3 colores exactos', () => {
    const { props, raiz } = raizFalsa();
    aplicarTema(PLANTILLAS.cafeteria, raiz);
    for (const n of NOMBRES) expect(props.has(n), n).toBe(true);
    expect(props.get('--c-fondo')).toBe('#F5EFE6');
    expect(props.get('--c-superficie')).toBe('#3B2A20');
    expect(props.get('--c-acento')).toBe('#C8553D');
    expect(props.get('--f-titulos')).toContain('Playfair Display Variable');
    expect(props.get('--f-texto')).toContain('Inter Variable');
  });

  it('usa el par tipográfico de cada plantilla', () => {
    const casos: Array<[keyof typeof PLANTILLAS, string, string]> = [
      ['heladeria', 'Fraunces Variable', 'Nunito Variable'],
      ['rapida', 'Sora Variable', 'Inter Variable'],
    ];
    for (const [id, titulos, texto] of casos) {
      const { props, raiz } = raizFalsa();
      aplicarTema(PLANTILLAS[id], raiz);
      expect(props.get('--f-titulos')).toContain(titulos);
      expect(props.get('--f-texto')).toContain(texto);
      expect(props.get('--f-titulos')).toMatch(/serif|sans-serif/);
    }
  });

  it('reporta en español cuando el acento tuvo que ajustarse', () => {
    const { ajustes } = aplicarTema(
      { version: 1, colores: HOSTILES['acento casi igual al fondo']!, tipografia: 'clasica' },
      raizFalsa().raiz,
    );
    expect(ajustes.length).toBeGreaterThan(0);
    expect(ajustes.some((t) => /acento/i.test(t) && /fondo/i.test(t))).toBe(true);
  });

  it('no reporta ajustes cuando todo cumple (elegante)', () => {
    expect(aplicarTema(PLANTILLAS.elegante, raizFalsa().raiz).ajustes).toEqual([]);
  });

  it('avisa cuando el 7:1 es matemáticamente imposible (gris medio)', () => {
    const { ajustes } = aplicarTema(
      { version: 1, colores: HOSTILES['gris medio']!, tipografia: 'moderna' },
      raizFalsa().raiz,
    );
    expect(ajustes.some((t) => /contraste ideal/.test(t))).toBe(true);
  });
});
