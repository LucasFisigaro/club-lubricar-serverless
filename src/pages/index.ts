import { requireAuth } from '../lib/auth';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) return;

  // Tarjeta 1: Registrar Cliente
  document.getElementById('card-nuevo-cliente')?.addEventListener('click', () => {
    window.location.href = '/nuevo_cliente.html';
  });

  // Tarjeta 2: Cargar o Canjear Puntos
  document.getElementById('card-transacciones')?.addEventListener('click', () => {
    window.location.href = '/transacciones.html';
  });

  // Tarjeta 3: Consultar Saldo
  document.getElementById('card-consulta')?.addEventListener('click', () => {
    window.location.href = '/consulta_saldo.html';
  });

  // Tarjeta 4: Listado de Clientes
  document.getElementById('card-listado')?.addEventListener('click', () => {
    window.location.href = '/listado.html';
  });
});
