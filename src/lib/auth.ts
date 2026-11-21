import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Protects a dashboard page:
 * - Redirects unauthenticated visitors to `/login.html`.
 * - Populates the navbar user email badge & marco header indicator.
 * - Wires up the Logout button (`#btn-logout`).
 */
export async function requireAuth(): Promise<User | null> {
  if (!isSupabaseConfigured) {
    window.location.replace('/login.html');
    return null;
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    window.location.replace('/login.html');
    return null;
  }

  const user = session.user;
  const email = user.email ?? 'Personal autenticado';

  // Reveal protected view
  document.body.classList.remove('auth-checking');
  document.body.classList.add('auth-ready');

  // Populate navbar & frame header user info
  const navEmailEl = document.getElementById('nav-user-email');
  if (navEmailEl) {
    navEmailEl.textContent = `👤 ${email}`;
    navEmailEl.title = `Sesión iniciada como ${email}`;
  }

  const marcoUserEl = document.getElementById('marco-user-info');
  if (marcoUserEl) {
    marcoUserEl.textContent = `Operador: ${email}`;
  }

  // Bind logout button
  const btnLogout = document.getElementById('btn-logout') as HTMLButtonElement | null;
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      btnLogout.disabled = true;
      btnLogout.textContent = 'Saliendo...';
      await supabase.auth.signOut();
      window.location.replace('/login.html');
    });
  }

  // Listen for sign-out events in other tabs
  supabase.auth.onAuthStateChange((event, currentSession) => {
    if (event === 'SIGNED_OUT' || !currentSession) {
      window.location.replace('/login.html');
    }
  });

  return user;
}
