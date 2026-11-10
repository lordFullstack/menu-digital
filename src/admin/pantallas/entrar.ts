// Entrar (sin registro), "Olvidé mi contraseña" y "Nueva contraseña".
import { supabase } from '../../supabase/cliente';
import { estado } from '../estado';
import { boton, campo, casilla, con, el, nota, ocupado } from '../ui';
import { validarClaveNueva, validarCorreo } from '../validar';

const GENERICO = 'Correo o contraseña incorrectos';

function tarjeta(titulo: string, intro?: string): { raiz: HTMLElement; formulario: HTMLFormElement } {
  const raiz = el('section', 'tarjeta tarjeta--entrada');
  raiz.appendChild(el('h1', 'titulo', titulo));
  if (intro) raiz.appendChild(el('p', 'intro', intro));
  const formulario = el('form', 'formulario');
  formulario.noValidate = true;
  raiz.appendChild(formulario);
  return { raiz, formulario };
}

export function pantallaEntrar(cont: HTMLElement, alEntrar: () => void): void {
  const raiz = el('div', 'entrar');
  cont.replaceChildren(raiz);
  mostrarEntrar();

  function mostrarEntrar(): void {
    const { raiz: t, formulario } = tarjeta('Entrar', 'Administre el menú de su negocio.');
    if (estado.avisoEntrar) {
      // El aviso se conserva hasta que la persona escribe o envía el formulario.
      const aviso = nota(estado.avisoEntrar, 'nota nota--aviso');
      aviso.setAttribute('role', 'status');
      t.insertBefore(aviso, formulario);
      const olvidar = (): void => {
        estado.avisoEntrar = null;
        aviso.remove();
      };
      formulario.addEventListener('input', olvidar, { once: true });
      formulario.addEventListener('submit', olvidar, { once: true });
    }
    const correo = campo({ etiqueta: 'Correo', tipo: 'email', autocompletar: 'username', modo: 'email', requerido: true });
    const clave = campo({ etiqueta: 'Contraseña', tipo: 'password', autocompletar: 'current-password', requerido: true });
    const ver = casilla('Mostrar contraseña', false);
    ver.input.addEventListener('change', () => {
      (clave.input as HTMLInputElement).type = ver.input.checked ? 'text' : 'password';
    });
    const alerta = el('p', 'campo-error campo-error--general');
    alerta.hidden = true;
    alerta.setAttribute('role', 'alert');
    const enviar = boton('Entrar', { variante: 'primario', tipo: 'submit', clase: 'boton--ancho' });
    const olvide = boton('Olvidé mi contraseña', { variante: 'texto', alClic: mostrarOlvide });
    con(formulario, correo.raiz, clave.raiz, ver.raiz, alerta, enviar, olvide);

    formulario.addEventListener('submit', (ev) => {
      ev.preventDefault();
      alerta.hidden = true;
      correo.error(null);
      clave.error(null);
      const c = validarCorreo(correo.valor());
      if (!c.ok) return void (correo.error(c.error), correo.input.focus());
      if (clave.valor() === '') return void (clave.error('Escriba su contraseña.'), clave.input.focus());
      void ocupado(enviar, async () => {
        if (!navigator.onLine) {
          alerta.textContent = 'Sin conexión: revise su internet e intente de nuevo.';
          alerta.hidden = false;
          return;
        }
        try {
          const { error } = await supabase().auth.signInWithPassword({ email: c.valor, password: clave.valor() });
          if (error) {
            const limite = Number((error as { status?: number }).status) === 429;
            alerta.textContent = limite ? 'Demasiados intentos. Espere unos minutos e intente de nuevo.' : GENERICO;
            if (/failed to fetch|network/i.test(error.message)) alerta.textContent = 'No se pudo conectar. Intente de nuevo.';
            alerta.hidden = false;
            return;
          }
          alEntrar();
        } catch {
          alerta.textContent = 'No se pudo conectar. Intente de nuevo.';
          alerta.hidden = false;
        }
      });
    });
    raiz.replaceChildren(t);
    correo.input.focus();
  }

  function mostrarOlvide(): void {
    const { raiz: t, formulario } = tarjeta('Recuperar contraseña', 'Escriba su correo y le enviaremos un enlace para crear una contraseña nueva.');
    const correo = campo({ etiqueta: 'Correo', tipo: 'email', autocompletar: 'username', modo: 'email', requerido: true });
    const resultado = el('p', 'nota');
    resultado.setAttribute('role', 'status');
    const enviar = boton('Enviar enlace', { variante: 'primario', tipo: 'submit', clase: 'boton--ancho' });
    const volver = boton('Volver a Entrar', { variante: 'texto', alClic: mostrarEntrar });
    con(formulario, correo.raiz, enviar, resultado, volver);
    formulario.addEventListener('submit', (ev) => {
      ev.preventDefault();
      correo.error(null);
      const c = validarCorreo(correo.valor());
      if (!c.ok) return void (correo.error(c.error), correo.input.focus());
      void ocupado(enviar, async () => {
        if (!navigator.onLine) {
          resultado.textContent = 'Sin conexión: revise su internet e intente de nuevo.';
          return;
        }
        try {
          await supabase().auth.resetPasswordForEmail(c.valor, { redirectTo: `${window.location.origin}/admin` });
        } catch {
          /* la respuesta es la misma: no se revela si el correo existe */
        }
        resultado.textContent = 'Si el correo está registrado, le enviamos un enlace para crear una nueva contraseña. Ábralo en este mismo navegador.';
      });
    });
    raiz.replaceChildren(t);
    correo.input.focus();
  }
}

/** Formulario "Nueva contraseña" (al volver del enlace del correo). */
export function pantallaNuevaClave(cont: HTMLElement, alTerminar: () => void): void {
  const { raiz, formulario } = tarjeta('Nueva contraseña', 'Elija una contraseña de al menos 8 caracteres.');
  const nueva = campo({ etiqueta: 'Nueva contraseña', tipo: 'password', autocompletar: 'new-password', requerido: true });
  const repetir = campo({ etiqueta: 'Repita la contraseña', tipo: 'password', autocompletar: 'new-password', requerido: true });
  const alerta = el('p', 'campo-error campo-error--general');
  alerta.hidden = true;
  alerta.setAttribute('role', 'alert');
  const enviar = boton('Guardar contraseña', { variante: 'primario', tipo: 'submit', clase: 'boton--ancho' });
  con(formulario, nueva.raiz, repetir.raiz, alerta, enviar);
  formulario.addEventListener('submit', (ev) => {
    ev.preventDefault();
    alerta.hidden = true;
    nueva.error(null);
    repetir.error(null);
    const v = validarClaveNueva(nueva.valor());
    if (!v.ok) return void (nueva.error(v.error), nueva.input.focus());
    if (nueva.valor() !== repetir.valor()) return void (repetir.error('Las dos contraseñas no coinciden.'), repetir.input.focus());
    void ocupado(enviar, async () => {
      try {
        const { error } = await supabase().auth.updateUser({ password: v.valor });
        if (error) {
          alerta.textContent = 'No se pudo cambiar la contraseña. Pida un enlace nuevo e intente de nuevo.';
          alerta.hidden = false;
          return;
        }
        estado.recuperando = false;
        alTerminar();
      } catch {
        alerta.textContent = 'No se pudo conectar. Intente de nuevo.';
        alerta.hidden = false;
      }
    });
  });
  cont.replaceChildren(el('div', 'entrar'));
  cont.firstElementChild?.appendChild(raiz);
  nueva.input.focus();
}
