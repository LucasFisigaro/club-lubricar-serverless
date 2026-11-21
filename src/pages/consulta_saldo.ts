import { requireAuth } from '../lib/auth';
import { supabase, formatearFechaHora, escapeHtml } from '../lib/supabase';
import type { ClienteRow, TransacPuntosRow } from '../types/database';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) return;

  const btnVolver = document.getElementById('btn-volver');
  btnVolver?.addEventListener('click', () => {
    window.location.href = '/';
  });

  const formSaldo = document.getElementById('form-saldo') as HTMLFormElement | null;
  const dniInput = document.getElementById('dni-busqueda') as HTMLInputElement | null;
  const btnBuscar = document.getElementById('btn-buscar-saldo') as HTMLButtonElement | null;
  const cajaResultado = document.getElementById('caja-resultado') as HTMLDivElement | null;
  const mensajeError = document.getElementById('mensaje-error') as HTMLDivElement | null;
  const nombreClienteEl = document.getElementById('nombre-cliente') as HTMLHeadingElement | null;
  const saldoClienteEl = document.getElementById('saldo-cliente') as HTMLDivElement | null;
  const cuerpoHistorial = document.getElementById('cuerpo-historial') as HTMLTableSectionElement | null;
  const contenedorHistorial = document.getElementById('contenedor-historial') as HTMLDivElement | null;

  if (
    !formSaldo ||
    !dniInput ||
    !btnBuscar ||
    !cajaResultado ||
    !mensajeError ||
    !nombreClienteEl ||
    !saldoClienteEl ||
    !cuerpoHistorial ||
    !contenedorHistorial
  ) {
    return;
  }

  formSaldo.addEventListener('submit', async (evento: SubmitEvent) => {
    evento.preventDefault();

    const dni = Number.parseInt(dniInput.value.trim(), 10);
    if (Number.isNaN(dni) || dni <= 0) {
      mensajeError.textContent = '❌ Ingresá un DNI numérico válido.';
      mensajeError.style.color = '#dc2626';
      return;
    }

    cajaResultado.style.display = 'none';
    contenedorHistorial.style.display = 'none';
    mensajeError.textContent = 'Buscando...';
    mensajeError.style.color = '#0f172a';
    btnBuscar.disabled = true;

    try {
      // 1. Buscar cliente por DNI
      const { data: clienteData, error: clienteErr } = await supabase
        .from('cliente')
        .select('idcli, dni, nomc, tel, saldo')
        .eq('dni', dni)
        .maybeSingle();

      if (clienteErr) {
        mensajeError.textContent = `❌ Error al consultar cliente: ${clienteErr.message}`;
        mensajeError.style.color = '#dc2626';
        return;
      }

      if (!clienteData) {
        mensajeError.textContent = '❌ Cliente no encontrado';
        mensajeError.style.color = '#dc2626';
        return;
      }

      const cliente = clienteData as ClienteRow;

      // 2. Buscar historial de movimientos ordenado del más reciente al más antiguo
      const { data: historialData, error: historialErr } = await supabase
        .from('transacpuntos')
        .select('idtrans, idcli, montop, tipo, motivo, fecha, staff_email')
        .eq('idcli', cliente.idcli)
        .order('fecha', { ascending: false })
        .order('idtrans', { ascending: false });

      if (historialErr) {
        mensajeError.textContent = `❌ Error al cargar el historial: ${historialErr.message}`;
        mensajeError.style.color = '#dc2626';
        return;
      }

      const historial = (historialData ?? []) as TransacPuntosRow[];

      mensajeError.textContent = '';
      nombreClienteEl.textContent = cliente.nomc;
      saldoClienteEl.textContent = String(cliente.saldo ?? 0);
      cuerpoHistorial.innerHTML = '';

      if (historial.length > 0) {
        historial.forEach((tx) => {
          const fila = document.createElement('tr');
          const esSuma = tx.tipo === 'suma';
          const claseColor = esSuma ? 'tx-suma' : 'tx-resta';
          const signo = esSuma ? '+' : '-';
          const fechaFormateada = formatearFechaHora(tx.fecha);
          const staffTitle = tx.staff_email
            ? ` title="Registrado por: ${escapeHtml(tx.staff_email)}"`
            : '';

          fila.innerHTML = `
            <td>${escapeHtml(fechaFormateada)}</td>
            <td${staffTitle}>${escapeHtml(tx.motivo)}</td>
            <td class="${claseColor}">${signo}${escapeHtml(tx.montop)}</td>
          `;
          cuerpoHistorial.appendChild(fila);
        });

        contenedorHistorial.style.display = 'block';
      }

      cajaResultado.style.display = 'block';
    } catch {
      mensajeError.textContent = '❌ Error de red al conectar con Supabase.';
      mensajeError.style.color = '#dc2626';
    } finally {
      btnBuscar.disabled = false;
    }
  });
});
