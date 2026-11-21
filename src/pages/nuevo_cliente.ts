import { requireAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) return;

  const btnVolver = document.getElementById('btn-volver');
  btnVolver?.addEventListener('click', () => {
    window.location.href = '/';
  });

  const formCliente = document.getElementById('form-cliente') as HTMLFormElement | null;
  const dniInput = document.getElementById('dni-cliente') as HTMLInputElement | null;
  const nombreInput = document.getElementById('nombre-cliente') as HTMLInputElement | null;
  const telefonoInput = document.getElementById('telefono-cliente') as HTMLInputElement | null;
  const btnGuardar = document.getElementById('btn-guardar-cliente') as HTMLButtonElement | null;
  const mensajeDiv = document.getElementById('mensaje-cliente') as HTMLDivElement | null;

  if (!formCliente || !dniInput || !nombreInput || !telefonoInput || !btnGuardar || !mensajeDiv) {
    return;
  }

  formCliente.addEventListener('submit', async (evento: SubmitEvent) => {
    evento.preventDefault();

    const dniRaw = dniInput.value.trim();
    const dni = Number.parseInt(dniRaw, 10);
    const nombre = nombreInput.value.trim();
    const telefono = telefonoInput.value.trim();

    // Validación de campos
    if (!dniRaw || Number.isNaN(dni) || dni <= 0 || !/^\d+$/.test(dniRaw)) {
      mensajeDiv.textContent = '❌ Ingresá un DNI numérico válido (solo números positivos).';
      mensajeDiv.style.color = '#dc2626';
      return;
    }

    if (nombre.length < 2) {
      mensajeDiv.textContent = '❌ Ingresá el nombre completo del cliente.';
      mensajeDiv.style.color = '#dc2626';
      return;
    }

    if (telefono.length < 4) {
      mensajeDiv.textContent = '❌ Ingresá un número de teléfono válido.';
      mensajeDiv.style.color = '#dc2626';
      return;
    }

    btnGuardar.disabled = true;
    mensajeDiv.textContent = 'Guardando...';
    mensajeDiv.style.color = '#0f172a';

    try {
      const { error } = await supabase.from('cliente').insert({
        dni,
        nomc: nombre,
        tel: telefono,
        saldo: 0,
      });

      if (error) {
        if (error.code === '23505' || error.message.toLowerCase().includes('unique')) {
          mensajeDiv.textContent = '❌ Ya existe un cliente registrado con ese DNI.';
        } else {
          mensajeDiv.textContent = `❌ Error al registrar cliente: ${error.message}`;
        }
        mensajeDiv.style.color = '#dc2626';
        btnGuardar.disabled = false;
        return;
      }

      mensajeDiv.textContent = `✅ ¡Cliente "${nombre}" (DNI ${dni}) registrado con éxito!`;
      mensajeDiv.style.color = '#16a34a';
      formCliente.reset();
      dniInput.focus();
    } catch {
      mensajeDiv.textContent = '❌ Error de red al conectar con Supabase.';
      mensajeDiv.style.color = '#dc2626';
    } finally {
      btnGuardar.disabled = false;
    }
  });
});
