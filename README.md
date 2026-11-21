# Club Lubricar - Sistema de Puntos (Serverless Edition)

Aplicación web **100% serverless y zero-cold-start** para la gestión de clientes y puntos de fidelidad de **Club Lubricar**, construida con **Vite + TypeScript + Modular CSS** y respaldada directamente por **Supabase (PostgreSQL + Supabase Auth + Row-Level Security)**.

Diseñada para desplegarse de forma gratuita como activos estáticos (`dist/`) en **Cloudflare Pages** (o Vercel / Netlify) sin depender de servidores backend en ejecución (Python/FastAPI).

---

## Arquitectura y Características Principales

- **Frontend Multi-Página (Vite + TypeScript):**
  - `login.html`: Acceso exclusivo para personal mediante **Supabase Auth** (Email + Contraseña), con persistencia de sesión y registro público deshabilitado.
  - `index.html`: Panel de control con las 4 tarjetas de operación e información del operador autenticado en la barra superior.
  - `nuevo_cliente.html`: Registro de clientes con validación de formulario y control de DNI duplicado (`UNIQUE`).
  - `transacciones.html`: Carga (`suma`) y canje (`resta`) de puntos con **vista previa en vivo** del cliente y su saldo al tipear el DNI, ejecutando la función RPC atómica `registrar_transaccion`.
  - `consulta_saldo.html`: Consulta de saldo actual e historial completo de movimientos ordenados del más reciente al más antiguo.
  - `listado.html`: Listado general con búsqueda en tiempo real por DNI o Nombre, ordenamiento interactivo ASC/DESC por columna (`DNI`, `Nombre`, `Saldo Puntos`), botón *"Volver arriba"* y exportación a CSV compatible con Microsoft Excel (UTF-8 BOM `\uFEFF` y separador `;`).
- **Seguridad y Atomicidad en Base de Datos (`supabase/schema_and_rls.sql`):**
  - **Row-Level Security (RLS)** habilitado en `public.cliente` y `public.transacpuntos`.
  - Bloqueo total de acceso anónimo (`anon`): solo usuarios autenticados (`authenticated`) pueden ejecutar `SELECT`, `INSERT`, `UPDATE` y la función RPC.
  - **RPC Atómica (`registrar_transaccion`):** Bloquea la fila del cliente con `FOR UPDATE`, impide saldos negativos en canjes (`resta`), registra auditoría del empleado (`created_by` y `staff_email`) y actualiza `cliente.saldo` en una única transacción PostgreSQL.

---

## 1. Ejecutar la Migración SQL en Supabase

1. Ingresá a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard).
2. En el menú lateral izquierdo, abrí **SQL Editor** y hacé clic en **New query**.
3. Copiá y pegá todo el contenido del archivo [`supabase/schema_and_rls.sql`](./supabase/schema_and_rls.sql).
4. Hacé clic en **Run** (o presioná `Ctrl + Enter`).
   - El script es **100% idempotente**: puede ejecutarse tanto en un proyecto nuevo como sobre la base de datos existente de la versión FastAPI (agrega la columna `saldo` en `cliente`, recalcula los saldos históricos desde `transacpuntos`, añade las columnas de auditoría `created_by` y `staff_email`, crea la función RPC `registrar_transaccion` y activa las políticas RLS).

---

## 2. Crear el Primer Usuario de Personal en Supabase Auth

1. En el panel de Supabase, dirigite a **Authentication** → **Providers** → **Email**:
   - Desactivá **"Enable Sign Ups"** (o mantenelo restringido) para que ningún visitante externo pueda auto-registrarse.
   - *(Opcional)* Desactivá **"Confirm email"** si querés que las cuentas creadas manualmente estén activas de inmediato.
2. Andá a **Authentication** → **Users** y hacé clic en **Add user** → **Create new user**.
3. Completá:
   - **Email:** por ejemplo, `mostrador@clublubricar.com`
   - **Password:** una contraseña segura para el personal
   - Marcá la casilla **Auto Confirm User**.
4. Hacé clic en **Create user**. Ya podés usar esas credenciales en `/login.html`.

---

## 3. Configuración y Prueba Local (`npm install && npm run dev`)

1. Abrí una terminal dentro de la carpeta `club-lubricar-serverless`:
   ```bash
   cd club-lubricar-serverless
   ```
2. Copiá el archivo de variables de entorno de ejemplo:
   ```bash
   cp .env.example .env
   ```
   *(En Windows PowerShell: `Copy-Item .env.example .env`)*
3. Editá `.env` con las credenciales públicas de tu proyecto (disponibles en **Supabase Dashboard** → **Project Settings** → **API**):
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-public-key
   ```
4. Instalá las dependencias e iniciá el servidor de desarrollo de Vite:
   ```bash
   npm install
   npm run dev
   ```
5. Abrí `http://localhost:5173` en tu navegador. Si no iniciaste sesión, serás redirigido automáticamente a `http://localhost:5173/login.html`.

---

## 4. Despliegue en Cloudflare Pages (`npm run build` → `dist`)

### Opción A: Conectando tu repositorio Git (Recomendado)
1. Subí este proyecto a GitHub o GitLab.
2. En el panel de **Cloudflare Dashboard**, andá a **Workers & Pages** → **Create** → pestaña **Pages** → **Connect to Git**.
3. Seleccioná tu repositorio y configurá los ajustes de compilación:
   - **Root directory:** `club-lubricar-serverless`
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. En **Environment variables**, agregá:
   - `VITE_SUPABASE_URL` = `https://tu-proyecto.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `tu-anon-public-key`
5. Hacé clic en **Save and Deploy**.

### Opción B: Subida directa o Wrangler CLI
1. Compilá los activos estáticos localmente:
   ```bash
   npm run build
   ```
2. Verificá que la carpeta `dist/` contiene todos los archivos HTML, CSS, JS e imágenes optimizadas.
3. Desplegá la carpeta `dist/` con Wrangler:
   ```bash
   npx wrangler pages deploy dist --project-name club-lubricar
   ```
