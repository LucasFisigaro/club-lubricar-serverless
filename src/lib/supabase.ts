import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const isSupabaseConfigured: boolean =
  Boolean(rawUrl && rawAnonKey) &&
  !rawUrl.includes('your-project-ref') &&
  !rawAnonKey.includes('your-public-anon-key-here');

// Fallback placeholder URL so createClient doesn't crash on initial bundle load
// before the user populates `.env`
const effectiveUrl = isSupabaseConfigured
  ? rawUrl
  : 'https://placeholder-project.supabase.co';
const effectiveAnonKey = isSupabaseConfigured
  ? rawAnonKey
  : 'placeholder-anon-key';

export const supabase: SupabaseClient = createClient(
  effectiveUrl,
  effectiveAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'club_lubricar_auth_session',
    },
  }
);

/**
 * Formats an ISO or PostgreSQL timestamp string into `DD/MM/YYYY HH:mm` (local time).
 */
export function formatearFechaHora(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const anio = date.getFullYear();
  const horas = String(date.getHours()).padStart(2, '0');
  const minutos = String(date.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
}

/**
 * Escapes HTML special characters to prevent XSS when rendering user content.
 */
export function escapeHtml(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
