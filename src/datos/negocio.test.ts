import { describe, expect, it } from 'vitest';
import { fotoPermitida, rutaDePathname, slugValido, validarMenu } from './index';
import { PREFIJO_FOTOS_PERMITIDO } from './utilidades';
import {
  borrarCopia, claveCopia, guardarCopia, leerCopia, resolverFotos, validarRespuesta, type Almacen,
} from './negocio';
import { PREFIJO_FOTOS, urlFoto } from '../supabase/cliente';

import menuCrudo from '../../public/datos/menu.json?raw';
import temaCrudo from '../../public/datos/tema.json?raw';

const U1 = '0b9a1c52-3f0e-4b8a-9a55-1d2c3e4f5a6b';
const U2 = '7c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const RUTA = `${U1}/${U2}.webp`;

describe('rutaDePathname', () => {
  it('raíz e index.html = menú de muestra', () => {
    expect(rutaDePathname('/')).toEqual({ tipo: 'muestra' });
    expect(rutaDePathname('/index.html')).toEqual({ tipo: 'muestra' });
  });
  it('acepta slugs válidos', () => {
    expect(rutaDePathname('/mi-negocio')).toEqual({ tipo: 'negocio', slug: 'mi-negocio' });
    expect(rutaDePathname('/abc')).toEqual({ tipo: 'negocio', slug: 'abc' });
    expect(rutaDePathname('/cafe-123-sur')).toEqual({ tipo: 'negocio', slug: 'cafe-123-sur' });
    expect(rutaDePathname('/' + 'a'.repeat(40))).toEqual({ tipo: 'negocio', slug: 'a'.repeat(40) });
  });
  it('rechaza reservados', () => {
    for (const r of ['admin', 'assets', 'datos', 'img', 'iconos', 'api', 'sw', 'manifest', 'index', 'login']) {
      expect(rutaDePathname('/' + r).tipo).toBe('invalida');
      expect(slugValido(r)).toBe(false);
    }
  });
  it('rechaza mayúsculas, largo, guiones mal puestos y caracteres raros', () => {
    for (const p of ['/Admin', '/Mi-Negocio', '/ab', '/' + 'a'.repeat(41), '/-abc', '/abc-', '/a--b', '/mi_negocio', '/mi negocio', '/café', '/abc.html', '/abc?x=1', '/abc#x']) {
      expect(rutaDePathname(p).tipo).toBe('invalida');
    }
  });
  it('rechaza dos segmentos, barra final, "..", barra invertida y vacío', () => {
    for (const p of ['/a/b', '/mi-negocio/', '/mi-negocio/otro', '/../admin', '/..', '/abc/..', '//abc', '/abc\\def', '', 'mi-negocio']) {
      expect(rutaDePathname(p).tipo).toBe('invalida');
    }
  });
  it('rechaza codificados (%2F, %2e, %41)', () => {
    for (const p of ['/a%2Fb', '/abc%2fdef', '/%2e%2e', '/ab%63', '/%41bc']) {
      expect(rutaDePathname(p).tipo).toBe('invalida');
    }
  });
});

describe('fotoPermitida', () => {
  it('el prefijo de la capa de datos es idéntico a PREFIJO_FOTOS de cliente.ts', () => {
    expect(PREFIJO_FOTOS_PERMITIDO).toBe(PREFIJO_FOTOS);
  });
  it('mantiene las rutas locales de siempre', () => {
    expect(fotoPermitida('img/a.svg')).toBe('img/a.svg');
    expect(fotoPermitida('../x.png')).toBeNull();
    expect(fotoPermitida(undefined)).toBeNull();
  });
  it('acepta URLs que empiezan exactamente por PREFIJO_FOTOS', () => {
    const u = PREFIJO_FOTOS + RUTA;
    expect(fotoPermitida(u)).toBe(u);
  });
  it('rechaza parámetros, "..", otro bucket, otro proyecto, http y otras https', () => {
    const malas = [
      PREFIJO_FOTOS + RUTA + '?x',
      PREFIJO_FOTOS + RUTA + '?x=1',
      PREFIJO_FOTOS + RUTA + '#frag',
      PREFIJO_FOTOS + U1 + '/../' + U2 + '.webp',
      PREFIJO_FOTOS + '../otro.webp',
      PREFIJO_FOTOS + U1 + '/%2e%2e/x.webp',
      PREFIJO_FOTOS + U1 + '//x.webp',
      PREFIJO_FOTOS + '/' + RUTA,
      PREFIJO_FOTOS,
      PREFIJO_FOTOS + RUTA + ' ',
      PREFIJO_FOTOS + RUTA + '\n',
      PREFIJO_FOTOS.replace('/public/fotos/', '/public/otro/') + RUTA,
      PREFIJO_FOTOS.replace('smiskzilpnvsbqwtmbwz', 'otroproyecto') + RUTA,
      PREFIJO_FOTOS.replace('https://', 'http://') + RUTA,
      PREFIJO_FOTOS.replace('.supabase.co', '.supabase.co.evil.com') + RUTA,
      'https://smiskzilpnvsbqwtmbwz.supabase.co@evil.com/storage/v1/object/public/fotos/' + RUTA,
      'https://example.com/a.png',
      '//smiskzilpnvsbqwtmbwz.supabase.co/storage/v1/object/public/fotos/' + RUTA,
      'javascript:alert(1)',
    ];
    for (const m of malas) expect(fotoPermitida(m), m).toBeNull();
  });
  it('el validador del menú usa la misma regla', () => {
    const base = JSON.parse(menuCrudo);
    base.categorias[0].platos[0].foto = PREFIJO_FOTOS + RUTA;
    expect(validarMenu(base).ok).toBe(true);
    base.categorias[0].platos[0].foto = PREFIJO_FOTOS + RUTA + '?x';
    expect(validarMenu(base).ok).toBe(false);
    base.categorias[0].platos[0].foto = 'https://example.com/a.png';
    expect(validarMenu(base).ok).toBe(false);
  });
});

describe('rutas de storage -> URL', () => {
  it('urlFoto convierte rutas válidas y rechaza el resto', () => {
    expect(urlFoto(RUTA)).toBe(PREFIJO_FOTOS + RUTA);
    expect(urlFoto(`${U1}/${U2}.png`)).toBe(PREFIJO_FOTOS + `${U1}/${U2}.png`);
    for (const m of [null, undefined, '', 'img/a.svg', `${U1}/../${U2}.webp`, RUTA + '?x', `${U1}/${U2}.svg`, PREFIJO_FOTOS + RUTA]) {
      expect(urlFoto(m as string | null | undefined), String(m)).toBeNull();
    }
  });
  it('resolverFotos convierte logo, portada y fotos sin mutar la entrada y descarta rutas malas', () => {
    const crudo = {
      version: 1,
      negocio: { nombre: 'X', moneda: 'COP', horario: [], logo: RUTA, portada: 'https://example.com/p.png' },
      categorias: [{ id: 'c', nombre: 'C', platos: [{ id: 'p1', nombre: 'A', precio: 1, foto: RUTA }, { id: 'p2', nombre: 'B', precio: 2, foto: '../x' }] }],
    };
    const copia = JSON.stringify(crudo);
    const r = resolverFotos(crudo) as typeof crudo;
    expect(JSON.stringify(crudo)).toBe(copia);
    expect(r.negocio.logo).toBe(PREFIJO_FOTOS + RUTA);
    expect('portada' in r.negocio).toBe(false);
    expect(r.categorias[0].platos[0].foto).toBe(PREFIJO_FOTOS + RUTA);
    expect('foto' in r.categorias[0].platos[1]).toBe(false);
  });
});

describe('validarRespuesta (menú de Supabase)', () => {
  const menu = () => JSON.parse(menuCrudo);
  const tema = () => JSON.parse(temaCrudo);

  it('acepta un menú sin categorías (estado vacío) solo con permitirVacio', () => {
    const vacio = { ...menu(), categorias: [] };
    expect(validarMenu(vacio).ok).toBe(false);
    const r = validarRespuesta({ menu: vacio, tema: tema() }, true);
    expect(r.menu.categorias).toEqual([]);
  });
  it('convierte las fotos de storage antes de validar', () => {
    const m = menu();
    m.categorias[0].platos[0].foto = RUTA;
    const r = validarRespuesta({ menu: m, tema: tema() }, true);
    expect(r.menu.categorias[0].platos[0].foto).toBe(PREFIJO_FOTOS + RUTA);
  });
  it('rechaza datos inválidos y formas raras', () => {
    expect(() => validarRespuesta(null, true)).toThrow();
    expect(() => validarRespuesta('x', true)).toThrow();
    expect(() => validarRespuesta({ menu: menu() }, true)).toThrow();
    const m = menu();
    m.negocio.moneda = 'USD';
    expect(() => validarRespuesta({ menu: m, tema: tema() }, true)).toThrow();
  });
});

function almacenFalso(inicial: Record<string, string> = {}): Almacen & { datos: Record<string, string> } {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => { datos[k] = v; },
    removeItem: (k) => { delete datos[k]; },
  };
}

describe('copia local', () => {
  const buenos = () => validarRespuesta({ menu: JSON.parse(menuCrudo), tema: JSON.parse(temaCrudo) }, true);

  it('guarda y lee (ida y vuelta, validando al leer)', () => {
    const a = almacenFalso();
    guardarCopia('mi-negocio', buenos(), a);
    expect(Object.keys(a.datos)).toEqual(['menu-digital:menu:mi-negocio']);
    const r = leerCopia('mi-negocio', a);
    expect(r?.menu.negocio.nombre).toBe(buenos().menu.negocio.nombre);
  });
  it('copia corrupta (no es JSON) -> null y se borra', () => {
    const a = almacenFalso({ [claveCopia('abc')]: '{no es json' });
    expect(leerCopia('abc', a)).toBeNull();
    expect(a.datos[claveCopia('abc')]).toBeUndefined();
  });
  it('copia con forma inválida o contenido manipulado -> null', () => {
    for (const malo of ['null', '[]', '"x"', '{}', JSON.stringify({ menu: {}, tema: {} })]) {
      const a = almacenFalso({ [claveCopia('abc')]: malo });
      expect(leerCopia('abc', a), malo).toBeNull();
    }
    const d = buenos();
    const manipulada = JSON.parse(JSON.stringify(d));
    manipulada.menu.categorias[0].platos[0].foto = 'https://evil.example/x.png';
    const a = almacenFalso({ [claveCopia('abc')]: JSON.stringify(manipulada) });
    expect(leerCopia('abc', a)).toBeNull();
  });
  it('copia demasiado grande -> null', () => {
    const a = almacenFalso({ [claveCopia('abc')]: ' '.repeat(2_000_001) });
    expect(leerCopia('abc', a)).toBeNull();
  });
  it('sin almacenamiento o con almacenamiento que lanza errores: no rompe', () => {
    expect(leerCopia('abc', null)).toBeNull();
    expect(() => guardarCopia('abc', buenos(), null)).not.toThrow();
    const roto: Almacen = {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('lleno'); },
      removeItem: () => { throw new Error('bloqueado'); },
    };
    expect(leerCopia('abc', roto)).toBeNull();
    expect(() => guardarCopia('abc', buenos(), roto)).not.toThrow();
    expect(() => borrarCopia('abc', roto)).not.toThrow();
  });
});
