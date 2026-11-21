import { supabase, isSupabaseConfigured } from '../lib/supabase';

document.addEventListener('DOMContentLoaded', async () => {
  const alertaConfig = document.getElementById('alerta-config') as HTMLDivElement | null;
  const formLogin = document.getElementById('form-login') as HTMLFormElement | null;
  const emailInput = document.getElementById('email-login') as HTMLInputElement | null;
  const passwordInput = document.getElementById('password-login') as HTMLInputElement | null;
  const btnSubmit = document.getElementById('btn-submit-login') as HTMLButtonElement | null;
  const mensajeDiv = document.getElementById('mensaje-login') as HTMLDivElement | null;

  if (!isSupabaseConfigured) {
    if (alertaConfig) {
      alertaConfig.style.display = 'block';
    }
  } else {
    // If already authenticated, redirect straight to the dashboard
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      window.location.replace('/');
      return;
    }
  }

  if (!formLogin || !emailInput || !passwordInput || !btnSubmit || !mensajeDiv) {
    return;
  }

  formLogin.addEventListener('submit', async (evento: SubmitEvent) => {
    evento.preventDefault();

    if (!isSupabaseConfigured) {
      mensajeDiv.textContent =
        '❌ Configurá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env antes de iniciar sesión.';
      mensajeDiv.style.color = '#dc2626';
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      mensajeDiv.textContent = '❌ Completá tu correo electrónico y contraseña.';
      mensajeDiv.style.color = '#dc2626';
      return;
    }

    btnSubmit.disabled = true;
    mensajeDiv.textContent = 'Verificando credenciales...';
    mensajeDiv.style.color = '#334155';

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.session) {
        const msg =
          error?.message === 'Invalid login credentials'
            ? 'Correo o contraseña incorrectos.'
            : error?.message ?? 'No se pudo iniciar sesión.';
        mensajeDiv.textContent = `❌ ${msg}`;
        mensajeDiv.style.color = '#dc2626';
        btnSubmit.disabled = false;
        return;
      }

      mensajeDiv.textContent = '✅ ¡Acceso concedido! Redirigiendo...';
      mensajeDiv.style.color = '#16a34a';
      window.location.replace('/');
    } catch {
      mensajeDiv.textContent = '❌ Error de red al conectar con Supabase Auth.';
      mensajeDiv.style.color = '#dc2626';
      btnSubmit.disabled = false;
    }
  });
});
