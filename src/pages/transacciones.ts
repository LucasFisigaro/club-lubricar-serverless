import { requireAuth } from '../lib/auth';
import { supabase, escapeHtml } from '../lib/supabase';
import type { ClienteRow, RegistrarTransaccionResult } from '../types/database';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) return;

  const btnVolver = document.getElementById('btn-volver');
  btnVolver?.addEventListener('click', () => {
    window.location.href = '/';
  });

  const formPuntos = document.getElementById('form-puntos') as HTMLFormElement | null;
  const dniInput = document.getElementById('dni') as HTMLInputElement | null;
  const montoInput = document.getElementById('monto') as HTMLInputElement | null;
  const tipoSelect = document.getElementById('tipo') as HTMLSelectElement | null;
  const motivoInput = document.getElementById('motivo') as HTMLInputElement | null;
  const previewDiv = document.getElementById('preview-cliente') as HTMLDivElement | null;
  const btnProcesar = document.getElementById('btn-procesar-tx') as HTMLButtonElement | null;
  const mensajeP = document.getElementById('mensaje') as HTMLParagraphElement | null;

  if (
    !formPuntos ||
    !dniInput ||
    !montoInput ||
    !tipoSelect ||
    !motivoInput ||
    !previewDiv ||
    !btnProcesar ||
    !mensajeP
  ) {
    return;
  }

  let clienteActual: Pick<ClienteRow, 'idcli' | 'dni' | 'nomc' | 'saldo'> | null = null;
  let debounceTimer: number | undefined;
  let lookupSeq = 0;

  function renderPreview(): void {
    if (!previewDiv || !dniInput || !montoInput || !tipoSelect) return;

    const dniRaw = dniInput.value.trim();
    if (!dniRaw) {
      previewDiv.style.display = 'none';
      previewDiv.innerHTML = '';
      return;
    }

    if (!clienteActual) {
      return;
    }

    const monto = Number.parseInt(montoInput.value.trim(), 10);
    const tipo = tipoSelect.value === 'resta' ? 'resta' : 'suma';
    const tieneMontoValido = !Number.isNaN(monto) && monto > 0;

    let detalleHtml = `Saldo actual: <strong>${clienteActual.saldo} pts</strong>`;
    let claseEstado = 'encontrado';

    if (tieneMontoValido) {
      if (tipo === 'resta' && monto > clienteActual.saldo) {
        claseEstado = 'advertencia';
        detalleHtml += ` &bull; ⚠️ <strong>Saldo insuficiente</strong> para canjear ${monto} pts`;
      } else {
        const saldoProyectado =
          tipo === 'suma' ? clienteActual.saldo + monto : clienteActual.saldo - monto;
        detalleHtml += ` &bull; Nuevo saldo estimado: <strong>${saldoProyectado} pts</strong>`;
      }
    }

    previewDiv.className = `preview-cliente ${claseEstado}`;
    previewDiv.style.display = 'block';
    previewDiv.innerHTML = `
      <div class="preview-cliente-header">
        <span>👤 ${escapeHtml(clienteActual.nomc)}</span>
        <span>DNI ${escapeHtml(clienteActual.dni)}</span>
      </div>
      <div class="preview-cliente-detalle">${detalleHtml}</div>
    `;
  }

  async function buscarClientePreview(dniTexto: string): Promise<void> {
    if (!previewDiv) return;

    const limpio = dniTexto.trim();
    const dniNum = Number.parseInt(limpio, 10);

    if (!limpio || Number.isNaN(dniNum) || dniNum <= 0) {
      clienteActual = null;
      previewDiv.style.display = 'none';
      previewDiv.innerHTML = '';
      return;
    }

    const reqId = ++lookupSeq;
    previewDiv.className = 'preview-cliente';
    previewDiv.style.display = 'block';
    previewDiv.textContent = '🔎 Buscando cliente...';

    const { data, error } = await supabase
      .from('cliente')
      .select('idcli, dni, nomc, saldo')
      .eq('dni', dniNum)
      .maybeSingle();

    if (reqId !== lookupSeq) return; // Ignore stale response

    if (error) {
      clienteActual = null;
      previewDiv.className = 'preview-cliente no-encontrado';
      previewDiv.textContent = `⚠️ No se pudo verificar el DNI (${error.message})`;
      return;
    }

    if (!data) {
      clienteActual = null;
      previewDiv.className = 'preview-cliente no-encontrado';
      previewDiv.innerHTML = `
        <div class="preview-cliente-header">
          <span>❌ Cliente no encontrado</span>
          <span>DNI ${escapeHtml(dniNum)}</span>
        </div>
        <div class="preview-cliente-detalle">
          Verificá el número o <a href="/nuevo_cliente.html" style="color: #991b1b; font-weight: bold;">registrá al cliente</a> primero.
        </div>
      `;
      return;
    }

    clienteActual = data as Pick<ClienteRow, 'idcli' | 'dni' | 'nomc' | 'saldo'>;
    renderPreview();
  }

  dniInput.addEventListener('input', () => {
    if (debounceTimer !== undefined) {
      window.clearTimeout(debounceTimer);
    }
    const valor = dniInput.value;
    if (!valor.trim()) {
      clienteActual = null;
      previewDiv.style.display = 'none';
      return;
    }
    debounceTimer = window.setTimeout(() => {
      void buscarClientePreview(valor);
    }, 250);
  });

  montoInput.addEventListener('input', renderPreview);
  tipoSelect.addEventListener('change', renderPreview);

  formPuntos.addEventListener('submit', async (evento: SubmitEvent) => {
    evento.preventDefault();

    const dni = Number.parseInt(dniInput.value.trim(), 10);
    const monto = Number.parseInt(montoInput.value.trim(), 10);
    const tipo = tipoSelect.value === 'resta' ? 'resta' : 'suma';
    const motivo = motivoInput.value.trim();

    if (Number.isNaN(dni) || dni <= 0) {
      mensajeP.textContent = '❌ Ingresá un DNI válido.';
      mensajeP.style.color = '#dc2626';
      return;
    }

    if (Number.isNaN(monto) || monto <= 0) {
      mensajeP.textContent = '❌ La cantidad de puntos debe ser un número entero mayor a 0.';
      mensajeP.style.color = '#dc2626';
      return;
    }

    if (!motivo) {
      mensajeP.textContent = '❌ Ingresá un motivo para la transacción.';
      mensajeP.style.color = '#dc2626';
      return;
    }

    if (clienteActual && clienteActual.dni === dni && tipo === 'resta' && monto > clienteActual.saldo) {
      mensajeP.textContent = `❌ Saldo insuficiente: ${clienteActual.nomc} tiene ${clienteActual.saldo} pts disponibles.`;
      mensajeP.style.color = '#dc2626';
      return;
    }

    btnProcesar.disabled = true;
    mensajeP.textContent = 'Procesando transacción atómica...';
    mensajeP.style.color = '#0f172a';

    try {
      const { data, error } = await supabase.rpc('registrar_transaccion', {
        p_dni: dni,
        p_monto: monto,
        p_tipo: tipo,
        p_motivo: motivo,
      });

      if (error) {
        mensajeP.textContent = `❌ ${error.message}`;
        mensajeP.style.color = '#dc2626';
        btnProcesar.disabled = false;
        return;
      }

      const resultado = data as RegistrarTransaccionResult | null;
      const detalleSaldo =
        resultado?.nuevo_saldo !== undefined
          ? ` (${resultado.cliente}: nuevo saldo ${resultado.nuevo_saldo} pts)`
          : '';

      mensajeP.textContent = `✅ ${resultado?.mensaje ?? '¡Transacción registrada con éxito!'}${detalleSaldo}`;
      mensajeP.style.color = '#16a34a';

      formPuntos.reset();
      clienteActual = null;
      previewDiv.style.display = 'none';
      previewDiv.innerHTML = '';
      dniInput.focus();
    } catch {
      mensajeP.textContent = '❌ Error de red al conectar con Supabase.';
      mensajeP.style.color = '#dc2626';
    } finally {
      btnProcesar.disabled = false;
    }
  });
});
