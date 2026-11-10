// MENU-004: animaciones de scroll (GSAP + ScrollTrigger). Se llama una vez, después de 'menu:listo'.
// Mejora progresiva: los estados ocultos se ponen desde JS; si algo falla, se limpian y todo queda visible.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './animaciones.css';

gsap.registerPlugin(ScrollTrigger);

const SUAVE = 'power3.out';
const LIMPIAR = 'transform,opacity,transition,willChange';

function uno<T extends HTMLElement = HTMLElement>(ancla: string): T | null {
  return document.querySelector<T>(`[data-anim="${ancla}"]`);
}

function todos(ancla: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-anim="${ancla}"]`));
}

/** Las tarjetas y botones tienen transition CSS en transform: se apaga mientras GSAP las mueve. */
function prepararAnimado(els: HTMLElement[]): void {
  for (const e of els) e.style.transition = 'none';
}

function ponerWillChange(els: Element[], valor: string): void {
  for (const e of els) (e as HTMLElement).style.willChange = valor;
}

/** Deja todo visible y sin estilos en línea de animación (red de seguridad). */
function dejarVisible(): void {
  document.querySelectorAll<HTMLElement>('[data-anim]').forEach((e) => {
    gsap.killTweensOf(e);
    gsap.set(e, { clearProps: LIMPIAR });
    e.querySelectorAll<HTMLElement>(':scope > *').forEach((h) => gsap.set(h, { clearProps: LIMPIAR }));
  });
}

function crearAnimaciones(): () => void {
  const pendientes = new Set<HTMLElement>(); // ocultos por JS y aún sin revelar
  const limpiezas: Array<() => void> = [];
  const cabecera = document.querySelector<HTMLElement>('.portada');
  const barra = uno('barra');
  const principal = document.getElementById('contenido');

  // ───────── Portada: entrada escalonada + parallax con scrub ─────────
  const foto = uno('portada-foto');
  const texto = uno('portada-texto');

  if (texto && window.scrollY < 40) {
    const hijos = Array.from(texto.children) as HTMLElement[];
    prepararAnimado(hijos);
    gsap.from(hijos, {
      opacity: 0,
      y: 18,
      duration: 0.55,
      stagger: 0.07,
      ease: SUAVE,
      clearProps: LIMPIAR,
      onStart: () => ponerWillChange(hijos, 'transform, opacity'),
    });
  }

  if (cabecera && foto) {
    // Origen abajo + escala >= 1 + 15 %: el borde superior nunca queda al descubierto.
    gsap.set(foto, { transformOrigin: '50% 100%' });
    gsap.fromTo(
      foto,
      { yPercent: 0, scale: 1.18 },
      {
        yPercent: 15,
        scale: 1.15,
        ease: 'none',
        scrollTrigger: {
          trigger: cabecera,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.5,
          onToggle: (st) => ponerWillChange([foto], st.isActive ? 'transform' : ''),
        },
      },
    );
  }
  if (cabecera && texto) {
    gsap.to(texto, {
      y: -56,
      opacity: 0,
      ease: 'power1.in',
      scrollTrigger: {
        trigger: cabecera,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.5,
        onToggle: (st) => ponerWillChange([texto], st.isActive ? 'transform, opacity' : ''),
      },
    });
  }

  // ───────── Vitrina: pin + desplazamiento horizontal con scrub ─────────
  // refreshPriority menor que el resto: el espacio del pin ya existe cuando ScrollTrigger mide lo de abajo.
  const vitrina = uno('vitrina');
  const pista = uno('vitrina-pista');
  let desmontarPin: (() => void) | null = null;

  // Distancia a recorrer; si hay hueco final (padding derecho) lo respeta para que la última tarjeta no quede pegada al borde.
  const recorrido = (): number => {
    if (!pista) return 0;
    const base = pista.scrollWidth - pista.clientWidth;
    if (base <= 0) return 0;
    return base + (parseFloat(getComputedStyle(pista).paddingRight) || 0);
  };
  const altoBarra = (): number => (barra ? Math.round(barra.getBoundingClientRect().height) : 0);

  const puedeFijar = (): boolean => {
    if (!vitrina || !pista) return false;
    const contenedor = vitrina.firstElementChild as HTMLElement | null;
    if (!contenedor) return false;
    const css = getComputedStyle(vitrina);
    const altoNatural = contenedor.offsetHeight + parseFloat(css.paddingTop) + parseFloat(css.paddingBottom);
    // Solo si la pista no cabe y la sección entera cabe en lo que queda de pantalla bajo la barra.
    return recorrido() > 1 && altoNatural <= window.innerHeight - altoBarra();
  };

  const montarPin = (): (() => void) => {
    const seccion = vitrina as HTMLElement;
    const carril = pista as HTMLElement;
    seccion.classList.add('vitrina--fijada');
    carril.scrollLeft = 0;

    const tween = gsap.to(carril, {
      x: () => -recorrido(),
      ease: 'none',
      scrollTrigger: {
        id: 'vitrina',
        trigger: seccion,
        start: () => `top top+=${altoBarra()}`,
        end: () => `+=${Math.round(recorrido())}`,
        pin: true,
        pinType: 'transform',
        anticipatePin: 1,
        scrub: 0.5,
        invalidateOnRefresh: true,
        refreshPriority: -1,
      },
    });
    const st = tween.scrollTrigger as ScrollTrigger;

    // Teclado: si una tarjeta recibe foco fuera de vista, se lleva el scroll al punto del pin que la muestra.
    // Se decide un frame después (cuando el navegador ya hizo su scroll vertical por el foco) y con la x
    // que corresponde al scroll actual, no con la x en pantalla (el scrub va con retraso).
    const alFoco = (e: FocusEvent): void => {
      const li = (e.target as HTMLElement).closest('li');
      if (!li || !carril.contains(li)) return;
      window.requestAnimationFrame(() => {
        const total = recorrido();
        const largo = st.end - st.start;
        if (total <= 0 || largo <= 0) return;
        const progreso = Math.min(1, Math.max(0, (window.scrollY - st.start) / largo));
        const ventana = (carril.parentElement as HTMLElement).getBoundingClientRect();
        const r = li.getBoundingClientRect();
        const desdeInicio = r.left - carril.getBoundingClientRect().left; // independiente de la x actual
        const izquierda = desdeInicio - progreso * total;
        if (izquierda >= 0 && izquierda + r.width <= ventana.width) return; // ya se ve
        const margen = parseFloat(getComputedStyle(carril).paddingLeft) || 0;
        const destino = Math.min(total, Math.max(0, desdeInicio - margen));
        window.scrollTo({ top: st.start + (destino / total) * largo, behavior: 'instant' as ScrollBehavior });
      });
    };
    carril.addEventListener('focusin', alFoco);

    return () => {
      carril.removeEventListener('focusin', alFoco);
      st.kill(true); // revierte el pin y quita el espaciador
      tween.kill();
      gsap.set(carril, { clearProps: 'transform' });
      seccion.classList.remove('vitrina--fijada');
    };
  };

  if (puedeFijar()) desmontarPin = montarPin();

  // Si cambia el ancho (giro de pantalla, ventana) la vitrina puede pasar a caber o a no caber.
  let tResize = 0;
  const alRedimensionar = (): void => {
    window.clearTimeout(tResize);
    tResize = window.setTimeout(() => {
      const debe = puedeFijar();
      if (debe && !desmontarPin) {
        desmontarPin = montarPin();
        ScrollTrigger.refresh();
      } else if (!debe && desmontarPin) {
        desmontarPin();
        desmontarPin = null;
        ScrollTrigger.refresh();
      }
    }, 250);
  };
  window.addEventListener('resize', alRedimensionar);
  limpiezas.push(() => {
    window.clearTimeout(tResize);
    window.removeEventListener('resize', alRedimensionar);
    desmontarPin?.();
    desmontarPin = null;
  });

  // ───────── Títulos de sección: entran una sola vez ─────────
  for (const titulo of todos('titulo-seccion')) {
    prepararAnimado([titulo]);
    pendientes.add(titulo);
    gsap.from(titulo, {
      y: 24,
      opacity: 0,
      duration: 0.6,
      ease: SUAVE,
      clearProps: LIMPIAR,
      onStart: () => {
        pendientes.delete(titulo);
        ponerWillChange([titulo], 'transform, opacity');
      },
      scrollTrigger: { trigger: titulo, start: 'top 85%', once: true },
    });
  }

  // ───────── Tarjetas: aparición escalonada ("fichas de dominó") ─────────
  const tarjetas = todos('tarjeta');
  if (tarjetas.length > 0) {
    prepararAnimado(tarjetas);
    gsap.set(tarjetas, { opacity: 0, y: 28 });
    tarjetas.forEach((t) => pendientes.add(t));
    const revelar = (lote: Element[]): void => {
      const nuevas = (lote as HTMLElement[]).filter((t) => pendientes.has(t));
      if (nuevas.length === 0) return;
      nuevas.forEach((t) => pendientes.delete(t));
      ponerWillChange(nuevas, 'transform, opacity');
      gsap.to(nuevas, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.07,
        ease: 'power2.out',
        clearProps: LIMPIAR, // devuelve el control del transform al :hover de CSS
      });
    };
    ScrollTrigger.batch(tarjetas, {
      start: 'top 92%',
      once: true,
      onEnter: revelar,
      onLeave: revelar, // por si un salto largo (barra de categorías) pasa de largo
    });
  }

  // Red de seguridad: al llegar al pie, todo lo que nunca llegó a dispararse se muestra.
  const final = ScrollTrigger.create({
    trigger: document.body,
    start: 'bottom bottom+=2',
    end: 'bottom top',
    onEnter: () => {
      pendientes.forEach((e) => {
        gsap.killTweensOf(e);
        gsap.set(e, { clearProps: LIMPIAR });
      });
      pendientes.clear();
    },
  });

  // ───────── Refrescos: imágenes perezosas, fuentes y cambios de altura ─────────
  let alturaConocida = document.documentElement.scrollHeight;
  const alRefrescar = (): void => {
    alturaConocida = document.documentElement.scrollHeight;
  };
  ScrollTrigger.addEventListener('refresh', alRefrescar);

  let tRefresco = 0;
  const refrescarSiCambio = (): void => {
    window.clearTimeout(tRefresco);
    tRefresco = window.setTimeout(() => {
      if (Math.abs(document.documentElement.scrollHeight - alturaConocida) > 1) ScrollTrigger.refresh();
    }, 200);
  };
  const alCargarImagen = (e: Event): void => {
    if (e.target instanceof HTMLImageElement) refrescarSiCambio();
  };
  document.addEventListener('load', alCargarImagen, true); // 'load' no burbujea: se escucha en captura
  window.addEventListener('load', refrescarSiCambio);
  void document.fonts?.ready.then(refrescarSiCambio);
  const observador = typeof ResizeObserver === 'function' && principal ? new ResizeObserver(refrescarSiCambio) : null;
  if (observador && principal) observador.observe(principal);

  limpiezas.push(() => {
    window.clearTimeout(tRefresco);
    document.removeEventListener('load', alCargarImagen, true);
    window.removeEventListener('load', refrescarSiCambio);
    ScrollTrigger.removeEventListener('refresh', alRefrescar);
    observador?.disconnect();
    final.kill();
  });

  return () => {
    limpiezas.forEach((l) => l());
    dejarVisible();
  };
}

export function iniciarAnimaciones(): void {
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    try {
      return crearAnimaciones();
    } catch (error) {
      console.warn('Animaciones desactivadas por un error', error);
      ScrollTrigger.getAll().forEach((t) => t.kill(true));
      dejarVisible();
      return undefined;
    }
  });
}
