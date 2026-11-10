import { describe, expect, it } from 'vitest';
import {
  validarMenu, validarTema, estaAbierto, formatearPrecio, enlaceWhatsApp, urlSegura, rutaLocalSegura, enlacePermitido,
} from './index';
import type { Franja } from './index';

import menuCrudo from '../../public/datos/menu.json?raw';
import temaCrudo from '../../public/datos/tema.json?raw';

// Los SVG de muestra se leen como texto con Vite (sin depender de módulos de Node).
const svgs = import.meta.glob('../../public/img/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const svgPorRuta = (ruta: string): string | undefined => svgs['../../public/' + ruta];

const menuMuestra = (): any => JSON.parse(menuCrudo);
const temaMuestra = (): any => JSON.parse(temaCrudo);

function erroresMenu(m: unknown): string[] {
  const r = validarMenu(m);
  if (r.ok) throw new Error('Se esperaba que el menú fuera rechazado');
  return r.errores;
}
function erroresTema(t: unknown): string[] {
  const r = validarTema(t);
  if (r.ok) throw new Error('Se esperaba que el tema fuera rechazado');
  return r.errores;
}

describe('datos de muestra', () => {
  it('menu.json pasa la validación', () => {
    const r = validarMenu(menuMuestra());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.menu.categorias).toHaveLength(5);
    const platos = r.menu.categorias.flatMap((c) => c.platos);
    expect(platos.length).toBeGreaterThanOrEqual(22);
    expect(platos.length).toBeLessThanOrEqual(28);
    const rec = platos.filter((p) => p.recomendado).length;
    expect(rec).toBeGreaterThanOrEqual(5);
    expect(rec).toBeLessThanOrEqual(6);
    expect(platos.filter((p) => p.agotado)).toHaveLength(1);
  });
  it('todas las imágenes referenciadas existen y son livianas y limpias', () => {
    const m = menuMuestra();
    const rutas = new Set<string>([m.negocio.logo, m.negocio.portada]);
    for (const c of m.categorias) for (const p of c.platos) rutas.add(p.foto);
    for (const r of rutas) {
      const svg = svgPorRuta(r);
      expect(svg, r).toBeDefined();
      if (svg === undefined) continue;
      expect(svg.length, r).toBeLessThan(4096);
      expect(svg).not.toMatch(/<script|href=|javascript:|<text/i);
    }
  });
  it('el horario de muestra tiene una franja que cruza medianoche', () => {
    const h = menuMuestra().negocio.horario as Franja[];
    expect(h.some((f) => f.abre > f.cierra)).toBe(true);
  });
  it('tema.json pasa la validación', () => {
    const r = validarTema(temaMuestra());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tema.colores.fondo).toBe('#F5EFE6');
  });
});

describe('validarMenu: rechazos', () => {
  it('rechaza lo que no es objeto', () => {
    for (const x of [null, undefined, 5, 'hola', [], true]) expect(validarMenu(x).ok).toBe(false);
  });
  it('rechaza tipos incorrectos', () => {
    const m = menuMuestra();
    m.negocio.nombre = 42;
    m.categorias[0].platos[0].precio = '9500';
    m.categorias[1].platos = 'nada';
    const e = erroresMenu(m);
    expect(e.length).toBeGreaterThanOrEqual(3);
  });
  it('rechaza campos faltantes', () => {
    const m = menuMuestra();
    delete m.negocio.nombre;
    delete m.categorias[0].platos[0].nombre;
    delete m.categorias[1].id;
    delete m.negocio.horario;
    const e = erroresMenu(m);
    expect(e.some((x) => x.includes('negocio') && x.includes('nombre'))).toBe(true);
    expect(e.length).toBeGreaterThanOrEqual(4);
  });
  it('rechaza ids duplicados (platos y categorías)', () => {
    const m = menuMuestra();
    m.categorias[1].platos[0].id = m.categorias[0].platos[0].id;
    m.categorias[2].id = m.categorias[0].id;
    const e = erroresMenu(m);
    expect(e.filter((x) => x.includes('repetido'))).toHaveLength(2);
  });
  it('rechaza precio no entero o negativo, con mensaje legible', () => {
    for (const mal of [18000.5, -1, NaN, Infinity, null, undefined]) {
      const m = menuMuestra();
      m.categorias[4].platos[0].precio = mal;
      const e = erroresMenu(m);
      expect(e[0]).toBe('El plato "Limonada de coco" no tiene precio válido (debe ser un número entero, sin decimales, entre 0 y 10.000.000).');
    }
  });
  it('rechaza precios fuera de rango (1e21, 10.000.001) y acepta el tope', () => {
    for (const mal of [1e21, 10_000_001, Number.MAX_SAFE_INTEGER + 2]) {
      const m = menuMuestra();
      m.categorias[4].platos[0].precio = mal;
      expect(erroresMenu(m)[0], String(mal)).toContain('no tiene precio válido');
    }
    for (const bien of [0, 10_000_000]) {
      const m = menuMuestra();
      m.categorias[4].platos[0].precio = bien;
      expect(validarMenu(m).ok, String(bien)).toBe(true);
    }
  });
  it('rechaza más de 500 platos en total y acepta 500', () => {
    const plato = (i: number) => ({ id: `p${i}`, nombre: `P${i}`, precio: 1000 });
    const m = menuMuestra();
    m.categorias = [0, 1, 2].map((c) => ({ id: `c${c}`, nombre: `C${c}`, platos: Array.from({ length: c === 2 ? 101 : 200 }, (_, i) => plato(c * 1000 + i)) }));
    expect(erroresMenu(m).some((x) => x.includes('demasiados platos en total'))).toBe(true);
    m.categorias[2].platos.pop();
    expect(validarMenu(m).ok).toBe(true);
  });
  it('recorta a 80 letras el nombre del plato y de la categoría en los mensajes', () => {
    const largo = 'a'.repeat(200);
    let m = menuMuestra();
    m.categorias[0].platos[0].nombre = largo;
    m.categorias[0].platos[0].precio = -1;
    let e = erroresMenu(m);
    expect(e.every((x) => !x.includes('a'.repeat(81)))).toBe(true);
    expect(e[0]).toContain('a'.repeat(80));
    m = menuMuestra();
    m.categorias[0].nombre = largo;
    m.categorias[0].id = '';
    e = erroresMenu(m);
    expect(e.length).toBeGreaterThan(0);
    expect(e.every((x) => !x.includes('a'.repeat(81)))).toBe(true);
  });
  it('rechaza etiquetas desconocidas', () => {
    const m = menuMuestra();
    m.categorias[0].platos[0].etiquetas = ['vegano', 'mágico'];
    expect(erroresMenu(m)[0]).toContain('etiquetas desconocidas');
  });
  it('rechaza horas mal escritas y días fuera de 0..6', () => {
    for (const hora of ['9:00', '24:00', '12:60', 'abc', 900, '']) {
      const m = menuMuestra();
      m.negocio.horario[0].abre = hora;
      expect(validarMenu(m).ok, String(hora)).toBe(false);
    }
    for (const dias of [[7], [-1], [1.5], [], 'lunes', ['1']]) {
      const m = menuMuestra();
      m.negocio.horario[0].dias = dias;
      expect(validarMenu(m).ok, JSON.stringify(dias)).toBe(false);
    }
  });
  it('impone límites de longitud y de cantidad', () => {
    let m = menuMuestra();
    m.categorias[0].platos[0].nombre = 'x'.repeat(81);
    expect(validarMenu(m).ok).toBe(false);
    m = menuMuestra();
    m.categorias[0].platos[0].nombre = 'x'.repeat(80);
    expect(validarMenu(m).ok).toBe(true);
    m = menuMuestra();
    m.categorias[0].platos[0].descripcion = 'x'.repeat(301);
    expect(validarMenu(m).ok).toBe(false);
    m = menuMuestra();
    m.categorias[0].platos[0].descripcion = 'x'.repeat(300);
    expect(validarMenu(m).ok).toBe(true);
    m = menuMuestra();
    m.categorias = Array.from({ length: 31 }, (_, i) => ({ id: `c${i}`, nombre: `C${i}`, platos: [] }));
    expect(erroresMenu(m).some((x) => x.includes('demasiadas categorías'))).toBe(true);
    m.categorias = m.categorias.slice(0, 30);
    expect(validarMenu(m).ok).toBe(true);
    const plato = (i: number) => ({ id: `p${i}`, nombre: `P${i}`, precio: 1000 });
    m = menuMuestra();
    m.categorias[0].platos = Array.from({ length: 201 }, (_, i) => plato(i));
    expect(erroresMenu(m).some((x) => x.includes('demasiados platos'))).toBe(true);
    m.categorias[0].platos = Array.from({ length: 200 }, (_, i) => plato(i));
    expect(validarMenu(m).ok).toBe(true);
  });
  it('rechaza URLs inseguras en foto, logo, portada, mapaUrl y redes', () => {
    const malas = ['javascript:alert(1)', 'http://x.com/a.png', '//evil.com/a.png', '../secreto', 'data:text/html,hola'];
    for (const mala of malas) {
      let m = menuMuestra(); m.categorias[0].platos[0].foto = mala;
      expect(erroresMenu(m).some((x) => x.includes('"foto"')), `foto ${mala}`).toBe(true);
      m = menuMuestra(); m.negocio.logo = mala;
      expect(erroresMenu(m).some((x) => x.includes('"logo"')), `logo ${mala}`).toBe(true);
      m = menuMuestra(); m.negocio.portada = mala;
      expect(erroresMenu(m).some((x) => x.includes('"portada"')), `portada ${mala}`).toBe(true);
      m = menuMuestra(); m.negocio.mapaUrl = mala;
      expect(erroresMenu(m).some((x) => x.includes('"mapaUrl"')), `mapa ${mala}`).toBe(true);
      m = menuMuestra(); m.negocio.redes = { instagram: mala };
      expect(erroresMenu(m).some((x) => x.includes('"instagram"')), `ig ${mala}`).toBe(true);
    }
    const ok = menuMuestra();
    ok.negocio.mapaUrl = 'https://maps.google.com/?q=ejemplo';
    ok.negocio.redes = { instagram: 'https://instagram.com/ejemplo' };
    expect(validarMenu(ok).ok).toBe(true);
  });
  it('fotos, logo y portada: solo rutas locales (también rechaza https://)', () => {
    const msg = 'Las fotos deben estar en la carpeta img del menú, no enlazadas desde otra página';
    let m = menuMuestra(); m.categorias[0].platos[0].foto = 'https://example.com/a.png';
    expect(erroresMenu(m).some((x) => x.includes('"foto"') && x.includes(msg))).toBe(true);
    m = menuMuestra(); m.negocio.logo = 'https://example.com/logo.png';
    expect(erroresMenu(m).some((x) => x.includes('"logo"') && x.includes(msg))).toBe(true);
    m = menuMuestra(); m.negocio.portada = 'https://example.com/p.png';
    expect(erroresMenu(m).some((x) => x.includes('"portada"') && x.includes(msg))).toBe(true);
    m = menuMuestra(); m.categorias[0].platos[0].foto = 'img/nueva.svg';
    expect(validarMenu(m).ok).toBe(true);
    expect(rutaLocalSegura('img/a.svg')).toBe('img/a.svg');
    expect(rutaLocalSegura('https://example.com/a.png')).toBeNull();
    expect(rutaLocalSegura('javascript:alert(1)')).toBeNull();
    expect(rutaLocalSegura(undefined)).toBeNull();
    // urlSegura no cambia: sigue aceptando https para enlaces.
    expect(urlSegura('https://example.com/a.png')).toBe('https://example.com/a.png');
  });
  it('redes y mapa: lista blanca de sitios (nombre exacto o subdominio, siempre https)', () => {
    type Tipo = Parameters<typeof enlacePermitido>[1];
    const buenas: [Tipo, string][] = [
      ['instagram', 'https://www.instagram.com/x'],
      ['instagram', 'https://instagram.com/x'],
      ['facebook', 'https://m.facebook.com/x'],
      ['facebook', 'https://fb.com/x'],
      ['facebook', 'https://fb.me/x'],
      ['tiktok', 'https://vm.tiktok.com/x'],
      ['tiktok', 'https://www.tiktok.com/@x'],
      ['mapa', 'https://www.google.com/maps/place/x'],
      ['mapa', 'https://maps.google.com/?q=x'],
      ['mapa', 'https://maps.app.goo.gl/abc'],
      ['mapa', 'https://goo.gl/maps/abc'],
      ['mapa', 'https://waze.com/ul?q=x'],
      ['mapa', 'https://www.openstreetmap.org/#map=1/2/3'],
    ];
    for (const [tipo, u] of buenas) expect(enlacePermitido(u, tipo), u).toBe(u);
    const malas: [Tipo, string][] = [
      ['instagram', 'https://instagram.com.evil.com/x'],
      ['instagram', 'https://evilinstagram.com/x'],
      ['instagram', 'http://instagram.com/x'],
      ['instagram', 'https://facebook.com/x'],
      ['instagram', 'https://user@instagram.com/x'],
      ['instagram', 'https://instagram.com:8443/x'],
      ['facebook', 'https://notfb.me/x'],
      ['tiktok', 'https://tiktok.com.evil.com/x'],
      ['mapa', 'https://www.google.com/search?q=x'],
      ['mapa', 'https://goo.gl/otra/abc'],
      ['mapa', 'https://evilgoogle.com/maps/x'],
      ['mapa', 'https://google.com.evil.com/maps/x'],
      ['mapa', 'https://example.com/mapa'],
    ];
    for (const [tipo, u] of malas) expect(enlacePermitido(u, tipo), u).toBeNull();
    // A través de la validación del menú:
    let m = menuMuestra(); m.negocio.redes = { instagram: 'https://instagram.com.evil.com/x' };
    expect(erroresMenu(m).some((x) => x.includes('"instagram"') && x.includes('instagram.com'))).toBe(true);
    m = menuMuestra(); m.negocio.redes = { instagram: 'https://evilinstagram.com/x' };
    expect(erroresMenu(m).some((x) => x.includes('"instagram"'))).toBe(true);
    m = menuMuestra(); m.negocio.redes = { instagram: 'https://www.instagram.com/x', facebook: 'https://fb.me/x', tiktok: 'https://vm.tiktok.com/x' };
    m.negocio.mapaUrl = 'https://maps.app.goo.gl/abc';
    expect(validarMenu(m).ok).toBe(true);
    m = menuMuestra(); m.negocio.mapaUrl = 'https://example.com/mapa';
    expect(erroresMenu(m).some((x) => x.includes('"mapaUrl"'))).toBe(true);
  });
  it('devuelve TODOS los errores, no solo el primero', () => {
    const m = menuMuestra();
    m.categorias[0].platos[0].precio = -5;
    m.categorias[0].platos[1].etiquetas = ['x'];
    m.categorias[1].platos[0].foto = 'javascript:alert(1)';
    m.negocio.whatsapp = '12';
    expect(erroresMenu(m).length).toBeGreaterThanOrEqual(4);
  });
  it('devuelve un objeto nuevo solo con campos conocidos (sin __proto__ ni extras)', () => {
    const crudo = JSON.parse(JSON.stringify(menuMuestra()));
    crudo.extra = 'x';
    crudo.negocio.secreto = 'y';
    crudo.categorias[0].platos[0].hack = 'z';
    const conProto = JSON.parse('{"__proto__": {"admin": true}, "polluted": 1}');
    crudo.categorias[0].platos[1] = { ...crudo.categorias[0].platos[1], ...conProto };
    Object.defineProperty(crudo.categorias[0].platos[1], '__proto__', { value: { admin: true }, enumerable: true, configurable: true });
    const r = validarMenu(crudo);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.menu).not.toBe(crudo);
    expect(r.menu.categorias[0].platos[0]).not.toBe(crudo.categorias[0].platos[0]);
    expect('extra' in r.menu).toBe(false);
    expect('secreto' in r.menu.negocio).toBe(false);
    expect('hack' in r.menu.categorias[0].platos[0]).toBe(false);
    const p1 = r.menu.categorias[0].platos[1] as unknown as Record<string, unknown>;
    expect(Object.keys(p1)).not.toContain('polluted');
    expect(Object.keys(p1)).not.toContain('__proto__');
    expect(Object.getPrototypeOf(p1)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });
});

describe('validarTema: rechazos', () => {
  it('rechaza colores inválidos', () => {
    for (const c of ['#FFF', 'F5EFE6', '#GGGGGG', '#F5EFE6F', 'rojo', 123, null]) {
      const t = temaMuestra(); t.colores.acento = c;
      expect(erroresTema(t).some((x) => x.includes('acento')), String(c)).toBe(true);
    }
  });
  it('rechaza tipografía, plantilla y versión desconocidas, y reporta todo junto', () => {
    const t = temaMuestra();
    t.tipografia = 'comic'; t.plantilla = 'otra'; t.version = 2; delete t.colores.fondo;
    expect(erroresTema(t).length).toBeGreaterThanOrEqual(4);
  });
  it('rechaza lo que no es objeto y no pasa propiedades extra', () => {
    for (const x of [null, 1, 'a', []]) expect(validarTema(x).ok).toBe(false);
    const t = temaMuestra(); t.extra = 1;
    const r = validarTema(t);
    expect(r.ok).toBe(true);
    if (r.ok) expect('extra' in r.tema).toBe(false);
  });
});

describe('urlSegura', () => {
  const nulos = [
    'javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>',
    'http://x.com', '//evil.com/a.png', '../secreto', 'vbscript:x', 'java\tscript:x',
    'img/../../x', 'img\\x.svg', '/img/x.svg', 'img//x.svg', 'https://', 'https:// x.com', '', 'file:///etc/passwd',
    'img/%2e%2e/x', 'https://user:pass@x.com/', 'img/a\u0000.svg',
  ];
  for (const n of nulos) {
    it(`rechaza ${JSON.stringify(n)}`, () => expect(urlSegura(n)).toBeNull());
  }
  it('rechaza undefined', () => expect(urlSegura(undefined)).toBeNull());
  it('acepta https válida y rutas relativas simples', () => {
    expect(urlSegura('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(urlSegura('HTTPS://example.com/')).toBe('HTTPS://example.com/');
    expect(urlSegura('img/plato.svg')).toBe('img/plato.svg');
    expect(urlSegura('plato.svg')).toBe('plato.svg');
  });
});

describe('enlaceWhatsApp', () => {
  it('arma el enlace con el texto codificado', () => {
    expect(enlaceWhatsApp('573001234567', 'Hola & gracias')).toBe('https://wa.me/573001234567?text=Hola%20%26%20gracias');
  });
  it('limpia espacios, + y guiones', () => {
    expect(enlaceWhatsApp('+57 300-123-4567', 'x')).toBe('https://wa.me/573001234567?text=x');
  });
  it('acepta 8 y 15 dígitos; rechaza 7 y 16', () => {
    expect(enlaceWhatsApp('12345678', 'x')).not.toBeNull();
    expect(enlaceWhatsApp('123456789012345', 'x')).not.toBeNull();
    expect(enlaceWhatsApp('1234567', 'x')).toBeNull();
    expect(enlaceWhatsApp('1234567890123456', 'x')).toBeNull();
  });
  it('rechaza letras y otros caracteres', () => {
    for (const n of ['abc12345678', '57300123456a', '57(300)1234567', '../573001234567', '', 'javascript:1']) {
      expect(enlaceWhatsApp(n, 'x'), n).toBeNull();
    }
  });
});

describe('formatearPrecio', () => {
  it('formatea en pesos colombianos sin depender del locale', () => {
    expect(formatearPrecio(18000, 'COP')).toBe('$ 18.000');
    expect(formatearPrecio(0, 'COP')).toBe('$ 0');
    expect(formatearPrecio(950, 'COP')).toBe('$ 950');
    expect(formatearPrecio(1234567, 'COP')).toBe('$ 1.234.567');
  });
});

describe('estaAbierto (hora de Colombia, UTC-5)', () => {
  // Fecha en hora de Bogotá: 2026-11-06 es viernes.
  const bog = (dia: number, h: number, m = 0) => new Date(Date.UTC(2026, 10, dia, h + 5, m));
  const noche: Franja[] = [{ dias: [5], abre: '18:00', cierra: '02:00' }];

  it('franja simple', () => {
    const h: Franja[] = [{ dias: [1, 2, 3, 4, 5], abre: '08:00', cierra: '17:00' }];
    expect(estaAbierto(h, bog(6, 8, 0))).toBe(true);   // viernes 08:00
    expect(estaAbierto(h, bog(6, 16, 59))).toBe(true);
    expect(estaAbierto(h, bog(6, 17, 0))).toBe(false); // cierra exacto
    expect(estaAbierto(h, bog(6, 7, 59))).toBe(false);
    expect(estaAbierto(h, bog(7, 10, 0))).toBe(false); // sábado cerrado
  });
  it('cruce de medianoche: viernes 18:00-02:00 sigue abierto el sábado 01:00', () => {
    expect(estaAbierto(noche, bog(6, 17, 59))).toBe(false);
    expect(estaAbierto(noche, bog(6, 18, 0))).toBe(true);
    expect(estaAbierto(noche, bog(6, 23, 30))).toBe(true);
    expect(estaAbierto(noche, bog(7, 1, 0))).toBe(true);
    expect(estaAbierto(noche, bog(7, 2, 0))).toBe(false);
    expect(estaAbierto(noche, bog(7, 18, 0))).toBe(false); // sábado noche: no abre ese día
    expect(estaAbierto(noche, bog(6, 1, 0))).toBe(false);  // viernes 01:00 viene del jueves: cerrado
  });
  it('cruce de medianoche de sábado a domingo y de domingo a lunes', () => {
    const h: Franja[] = [{ dias: [6, 0], abre: '20:00', cierra: '03:00' }];
    expect(estaAbierto(h, bog(8, 2, 0))).toBe(true);  // domingo 02:00 (viene del sábado)
    expect(estaAbierto(h, bog(9, 2, 0))).toBe(true);  // lunes 02:00 (viene del domingo)
    expect(estaAbierto(h, bog(10, 2, 0))).toBe(false); // martes 02:00
  });
  it('varias franjas en el mismo día', () => {
    const h: Franja[] = [
      { dias: [5], abre: '07:00', cierra: '11:00' },
      { dias: [5], abre: '13:00', cierra: '20:00' },
    ];
    expect(estaAbierto(h, bog(6, 9, 0))).toBe(true);
    expect(estaAbierto(h, bog(6, 12, 0))).toBe(false);
    expect(estaAbierto(h, bog(6, 14, 0))).toBe(true);
    expect(estaAbierto(h, bog(6, 20, 0))).toBe(false);
  });
  it('horario vacío = cerrado; usa la hora de Colombia aunque el Date esté en UTC', () => {
    expect(estaAbierto([], bog(6, 12))).toBe(false);
    // 2026-11-07 00:30 UTC = viernes 19:30 en Bogotá
    expect(estaAbierto(noche, new Date(Date.UTC(2026, 10, 7, 0, 30)))).toBe(true);
  });
  it('el horario de muestra funciona con el viernes de madrugada', () => {
    const h = (menuMuestra().negocio.horario) as Franja[];
    expect(estaAbierto(h, bog(7, 1, 0))).toBe(true);  // sábado 01:00 (viene del viernes)
    expect(estaAbierto(h, bog(7, 12, 0))).toBe(true);
    expect(estaAbierto(h, bog(2, 3, 0))).toBe(false); // lunes 03:00
  });
});
