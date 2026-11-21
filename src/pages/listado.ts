import { requireAuth } from '../lib/auth';
import { supabase, escapeHtml } from '../lib/supabase';
import type { ClienteRow } from '../types/database';

type ColumnaOrden = 'dni' | 'nomc' | 'saldo';

let clientesOriginales: ClienteRow[] = [];
let columnaActual: ColumnaOrden = 'nomc';
let ordenAscendente = true;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) return;

  // Botón volver al menú principal
  const btnVolver = document.getElementById('btn-volver');
  btnVolver?.addEventListener('click', () => {
    window.location.href = '/';
  });

  // Botón exportar a CSV
  const btnExportar = document.getElementById('btn-exportar');
  btnExportar?.addEventListener('click', exportarACSV);

  // Botón volver arriba (scroll-to-top)
  const btnTop = document.getElementById('btn-top') as HTMLButtonElement | null;
  if (btnTop) {
    btnTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        btnTop.style.display = 'inline-block';
      } else {
        btnTop.style.display = 'none';
      }
    });
  }

  // Cargar datos desde Supabase
  await cargarClientes();

  // Filtrar en tiempo real al escribir
  const inputBusqueda = document.getElementById('input-busqueda') as HTMLInputElement | null;
  inputBusqueda?.addEventListener('input', () => {
    renderizarTabla();
  });

  // Ordenar al hacer clic en los encabezados de columna
  document.querySelectorAll<HTMLTableCellElement>('.col-ord').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-col') as ColumnaOrden | null;
      if (!col) return;

      if (columnaActual === col) {
        ordenAscendente = !ordenAscendente;
      } else {
        columnaActual = col;
        ordenAscendente = true;
      }
      renderizarTabla();
    });
  });
});

async function cargarClientes(): Promise<void> {
  const mensajeCarga = document.getElementById('mensaje-carga');
  const tabla = document.getElementById('tabla-clientes');

  try {
    const { data, error } = await supabase
      .from('cliente')
      .select('idcli, dni, nomc, tel, saldo')
      .order('nomc', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    clientesOriginales = (data ?? []) as ClienteRow[];

    if (mensajeCarga) mensajeCarga.style.display = 'none';
    if (tabla) tabla.style.display = 'table';

    renderizarTabla();
  } catch (err) {
    console.error(err);
    if (mensajeCarga) {
      mensajeCarga.textContent = '❌ Error al cargar el listado de clientes.';
      mensajeCarga.style.color = '#dc2626';
    }
  }
}

function obtenerClientesFiltradosYOrdenados(): ClienteRow[] {
  const inputBusqueda = document.getElementById('input-busqueda') as HTMLInputElement | null;
  const busqueda = inputBusqueda ? inputBusqueda.value.toLowerCase().trim() : '';

  // 1. FILTRAR
  const filtrados = clientesOriginales.filter((c) => {
    const dni = c.dni !== undefined && c.dni !== null ? String(c.dni).toLowerCase() : '';
    const nombre = (c.nomc ?? '').toLowerCase();
    return dni.includes(busqueda) || nombre.includes(busqueda);
  });

  // 2. ORDENAR
  filtrados.sort((a, b) => {
    if (columnaActual === 'nomc') {
      const valA = (a.nomc ?? '').toLowerCase();
      const valB = (b.nomc ?? '').toLowerCase();
      if (valA < valB) return ordenAscendente ? -1 : 1;
      if (valA > valB) return ordenAscendente ? 1 : -1;
      return 0;
    }

    if (columnaActual === 'dni') {
      const valA = Number(a.dni) || 0;
      const valB = Number(b.dni) || 0;
      return ordenAscendente ? valA - valB : valB - valA;
    }

    const valA = Number(a.saldo) || 0;
    const valB = Number(b.saldo) || 0;
    return ordenAscendente ? valA - valB : valB - valA;
  });

  return filtrados;
}

function renderizarTabla(): void {
  const cuerpo = document.getElementById('cuerpo-listado');
  if (!cuerpo) return;

  const filtrados = obtenerClientesFiltradosYOrdenados();
  cuerpo.innerHTML = '';

  if (filtrados.length === 0) {
    cuerpo.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">No se encontraron clientes</td></tr>`;
    actualizarIconosHeader();
    return;
  }

  filtrados.forEach((c) => {
    const tr = document.createElement('tr');
    const dniVal = c.dni ?? '-';
    const nombreVal = c.nomc || '-';
    const telVal = c.tel || '-';
    const saldoVal = c.saldo ?? 0;

    tr.innerHTML = `
      <td>${escapeHtml(dniVal)}</td>
      <td><strong>${escapeHtml(nombreVal)}</strong></td>
      <td>${escapeHtml(telVal)}</td>
      <td class="tx-suma">${escapeHtml(saldoVal)} pts</td>
    `;
    cuerpo.appendChild(tr);
  });

  actualizarIconosHeader();
}

function actualizarIconosHeader(): void {
  const columnas: ColumnaOrden[] = ['dni', 'nomc', 'saldo'];
  columnas.forEach((col) => {
    const el = document.getElementById(`orden-${col}`);
    if (!el) return;

    if (col === columnaActual) {
      el.textContent = ordenAscendente ? ' ▲' : ' ▼';
      el.style.color = '#2563eb';
    } else {
      el.textContent = ' ⇅';
      el.style.color = '#94a3b8';
    }
  });
}

/**
 * Exporta el listado de clientes a un archivo CSV compatible con Microsoft Excel
 * usando UTF-8 BOM (`\uFEFF`) y delimitador punto y coma (`;`).
 */
function exportarACSV(): void {
  if (clientesOriginales.length === 0) {
    alert('No hay clientes para exportar.');
    return;
  }

  let csvContent = '\uFEFFDNI;Nombre;Telefono;Saldo Puntos\n';

  clientesOriginales.forEach((c) => {
    const dni = c.dni ?? '';
    const nombre = `"${(c.nomc ?? '').replace(/"/g, '""')}"`;
    const telefono = c.tel ?? '';
    const saldo = c.saldo ?? 0;

    csvContent += `${dni};${nombre};${telefono};${saldo}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'listado_clientes_club_lubricar.csv');
  document.body.appendChild(link);

  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
