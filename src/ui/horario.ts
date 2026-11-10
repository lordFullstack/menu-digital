// Horario legible por días: agrupa días seguidos con las mismas horas.
import type { Franja } from '../datos';

const NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const ORDEN = [1, 2, 3, 4, 5, 6, 0];

function hora12(valor: string): string {
  const [h, m] = valor.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return valor;
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

function mayuscula(t: string): string {
  return t.charAt(0).toLocaleUpperCase('es') + t.slice(1);
}

export function resumirHorario(horario: Franja[]): { dias: string; horas: string }[] {
  const porDia = ORDEN.map((dia) => {
    const franjas = horario
      .filter((f) => f.dias.includes(dia))
      .sort((a, b) => a.abre.localeCompare(b.abre))
      .map((f) => `${hora12(f.abre)} – ${hora12(f.cierra)}`);
    return { dia, texto: franjas.length ? franjas.join(' y ') : 'Cerrado' };
  });

  const grupos: { dias: number[]; texto: string }[] = [];
  for (const d of porDia) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.texto === d.texto) ultimo.dias.push(d.dia);
    else grupos.push({ dias: [d.dia], texto: d.texto });
  }

  return grupos.map((g) => {
    const nombres = g.dias.map((d) => NOMBRES[d]);
    let etiqueta: string;
    if (nombres.length === 1) etiqueta = nombres[0];
    else if (nombres.length === 2) etiqueta = `${nombres[0]} y ${nombres[1]}`;
    else etiqueta = `${nombres[0]} a ${nombres[nombres.length - 1]}`;
    return { dias: mayuscula(etiqueta), horas: g.texto };
  });
}
