// Conexión única a Supabase para el panel (/admin) y el menú por negocio (/<slug>).
// Usa SOLO la clave publicable: lo que cada quien puede leer o escribir lo deciden
// las reglas por fila de la base (ver supabase/migrations y docs/equipo/CONTRATO-ADMIN.md).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CLAVE = import.meta.env.VITE_SUPABASE_CLAVE as string | undefined;

/** Origen exacto del proyecto. Las fotos públicas solo se aceptan si empiezan por PREFIJO_FOTOS. */
export const ORIGEN_SUPABASE = 'https://smiskzilpnvsbqwtmbwz.supabase.co';
export const PREFIJO_FOTOS = `${ORIGEN_SUPABASE}/storage/v1/object/public/fotos/`;

/** true si la app se compiló con la conexión configurada (en local: archivo .env; en Vercel: variables). */
export const supabaseConfigurado = URL_SUPABASE === ORIGEN_SUPABASE && typeof CLAVE === 'string' && CLAVE.length > 20;

let cliente: SupabaseClient | null = null;

/** Devuelve el cliente (lo crea la primera vez). Lanza un Error legible si falta la configuración. */
export function supabase(): SupabaseClient {
  if (!supabaseConfigurado) {
    throw new Error('Falta configurar la conexión con Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_CLAVE).');
  }
  if (!cliente) {
    cliente = createClient(ORIGEN_SUPABASE, CLAVE as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    });
  }
  return cliente;
}

/** Convierte una ruta del bucket ('<negocio>/<uuid>.webp') en su URL pública, o null si la ruta no es válida. */
export function urlFoto(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  const forma = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|jpeg|png)$/;
  return forma.test(ruta) ? PREFIJO_FOTOS + ruta : null;
}
