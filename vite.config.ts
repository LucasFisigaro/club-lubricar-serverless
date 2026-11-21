import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        nuevo_cliente: resolve(__dirname, 'nuevo_cliente.html'),
        transacciones: resolve(__dirname, 'transacciones.html'),
        consulta_saldo: resolve(__dirname, 'consulta_saldo.html'),
        listado: resolve(__dirname, 'listado.html'),
      },
    },
  },
});
