-- =============================================================================
-- CLUB LUBRICAR - SISTEMA DE PUNTOS (SERVERLESS / SUPABASE)
-- Complete, Idempotent Database Schema, Atomic RPCs & Row-Level Security (RLS)
-- =============================================================================
-- Instructions:
-- 1. Open your Supabase project dashboard -> SQL Editor -> New Query.
-- 2. Paste this entire script and click "Run".
-- 3. It is 100% idempotent: safe to run on a brand-new project OR an existing
--    database from the legacy Python/FastAPI app.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. TABLES: public.cliente & public.transacpuntos
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cliente (
    idcli SERIAL PRIMARY KEY,
    dni BIGINT NOT NULL UNIQUE,
    nomc TEXT NOT NULL,
    tel TEXT NOT NULL,
    saldo INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If migrating from the legacy schema where `saldo` or `created_at` did not exist:
ALTER TABLE public.cliente
    ADD COLUMN IF NOT EXISTS saldo INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.cliente
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Ensure unique constraint on dni exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.cliente'::regclass
          AND contype = 'u'
          AND conkey @> ARRAY[(
              SELECT attnum FROM pg_attribute
              WHERE attrelid = 'public.cliente'::regclass AND attname = 'dni'
          )]
    ) THEN
        ALTER TABLE public.cliente ADD CONSTRAINT cliente_dni_unique UNIQUE (dni);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.transacpuntos (
    idtrans SERIAL PRIMARY KEY,
    idcli INTEGER NOT NULL REFERENCES public.cliente(idcli) ON DELETE CASCADE,
    montop INTEGER NOT NULL CHECK (montop > 0),
    tipo TEXT NOT NULL CHECK (tipo IN ('suma', 'resta')),
    motivo TEXT NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    staff_email TEXT DEFAULT (auth.jwt() ->> 'email')
);

-- Audit columns for existing installations
ALTER TABLE public.transacpuntos
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid();

ALTER TABLE public.transacpuntos
    ADD COLUMN IF NOT EXISTS staff_email TEXT DEFAULT (auth.jwt() ->> 'email');

-- Helpful indexes for fast DNI lookups and transaction history sorting
CREATE INDEX IF NOT EXISTS idx_cliente_dni ON public.cliente(dni);
CREATE INDEX IF NOT EXISTS idx_cliente_nomc ON public.cliente(nomc);
CREATE INDEX IF NOT EXISTS idx_transacpuntos_idcli_fecha ON public.transacpuntos(idcli, fecha DESC);

-- Backfill `cliente.saldo` from `transacpuntos` in case legacy rows exist
UPDATE public.cliente c
SET saldo = GREATEST(
    0,
    COALESCE((
        SELECT SUM(
            CASE
                WHEN t.tipo = 'suma' THEN COALESCE(t.montop, 0)
                WHEN t.tipo = 'resta' THEN -COALESCE(t.montop, 0)
                ELSE 0
            END
        )
        FROM public.transacpuntos t
        WHERE t.idcli = c.idcli
    ), 0)
);

-- Enforce non-negative balance constraint at the table level
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.cliente'::regclass
          AND conname = 'cliente_saldo_non_negative'
    ) THEN
        ALTER TABLE public.cliente
            ADD CONSTRAINT cliente_saldo_non_negative CHECK (saldo >= 0);
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. ATOMIC RPC: public.registrar_transaccion
-- -----------------------------------------------------------------------------
-- Locks the customer row (`FOR UPDATE`), validates positive points and prevents
-- negative balances on redemptions (`resta`), records the audit fields
-- (`created_by` and `staff_email`), inserts the transaction, and updates
-- `cliente.saldo` in a single atomic transaction.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.registrar_transaccion(
    p_dni BIGINT,
    p_monto INTEGER,
    p_tipo TEXT,
    p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_idcli INTEGER;
    v_nomc TEXT;
    v_saldo_actual INTEGER;
    v_nuevo_saldo INTEGER;
    v_idtrans INTEGER;
    v_fecha TIMESTAMPTZ;
    v_user_id UUID;
    v_staff_email TEXT;
    v_motivo_limpio TEXT;
BEGIN
    -- 1. Verify authenticated session
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No autorizado: debe iniciar sesión como personal del club.';
    END IF;

    v_staff_email := COALESCE(auth.jwt() ->> 'email', 'staff@clublubricar.local');

    -- 2. Validate parameters
    IF p_dni IS NULL OR p_dni <= 0 THEN
        RAISE EXCEPTION 'El DNI ingresado no es válido.';
    END IF;

    IF p_monto IS NULL OR p_monto <= 0 THEN
        RAISE EXCEPTION 'La cantidad de puntos debe ser mayor a 0.';
    END IF;

    IF p_tipo IS NULL OR p_tipo NOT IN ('suma', 'resta') THEN
        RAISE EXCEPTION 'Tipo de operación inválido. Debe ser "suma" o "resta".';
    END IF;

    v_motivo_limpio := TRIM(COALESCE(p_motivo, ''));
    IF v_motivo_limpio = '' THEN
        RAISE EXCEPTION 'Debe ingresar un motivo para la transacción.';
    END IF;

    -- 3. Lock the customer record to prevent race conditions
    SELECT c.idcli, c.nomc, c.saldo
    INTO v_idcli, v_nomc, v_saldo_actual
    FROM public.cliente c
    WHERE c.dni = p_dni
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El DNI ingresado no pertenece a ningún cliente.';
    END IF;

    -- 4. Compute new balance & prevent negative balance on redemptions
    IF p_tipo = 'suma' THEN
        v_nuevo_saldo := v_saldo_actual + p_monto;
    ELSE
        IF v_saldo_actual < p_monto THEN
            RAISE EXCEPTION 'Saldo insuficiente: el cliente % tiene % pts disponibles y se intentó canjear % pts.',
                v_nomc, v_saldo_actual, p_monto;
        END IF;
        v_nuevo_saldo := v_saldo_actual - p_monto;
    END IF;

    -- 5. Insert transaction with staff audit fields
    INSERT INTO public.transacpuntos (
        idcli,
        montop,
        tipo,
        motivo,
        created_by,
        staff_email
    )
    VALUES (
        v_idcli,
        p_monto,
        p_tipo,
        v_motivo_limpio,
        v_user_id,
        v_staff_email
    )
    RETURNING idtrans, fecha
    INTO v_idtrans, v_fecha;

    -- 6. Atomically update customer balance
    UPDATE public.cliente
    SET saldo = v_nuevo_saldo
    WHERE idcli = v_idcli;

    -- 7. Return summary payload
    RETURN jsonb_build_object(
        'mensaje', '¡Transacción registrada con éxito!',
        'id_transaccion', v_idtrans,
        'fecha_registro', v_fecha,
        'cliente', v_nomc,
        'dni', p_dni,
        'saldo_anterior', v_saldo_actual,
        'nuevo_saldo', v_nuevo_saldo,
        'staff_email', v_staff_email
    );
END;
$$;

-- Restrict function execution exclusively to authenticated users
REVOKE ALL ON FUNCTION public.registrar_transaccion(BIGINT, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_transaccion(BIGINT, INTEGER, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_transaccion(BIGINT, INTEGER, TEXT, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. ROW-LEVEL SECURITY (RLS) & POLICIES
-- -----------------------------------------------------------------------------
-- Strictly blocks all anonymous (`anon`) access and permits `SELECT`, `INSERT`,
-- and `UPDATE` only to `authenticated` staff members.
-- -----------------------------------------------------------------------------

ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacpuntos ENABLE ROW LEVEL SECURITY;

-- Revoke table privileges from `anon` role at the privilege layer as defense-in-depth
REVOKE ALL ON TABLE public.cliente FROM anon;
REVOKE ALL ON TABLE public.transacpuntos FROM anon;

GRANT SELECT, INSERT, UPDATE ON TABLE public.cliente TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.transacpuntos TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Drop existing policies first so script is idempotent
DROP POLICY IF EXISTS "cliente_select_authenticated" ON public.cliente;
DROP POLICY IF EXISTS "cliente_insert_authenticated" ON public.cliente;
DROP POLICY IF EXISTS "cliente_update_authenticated" ON public.cliente;

DROP POLICY IF EXISTS "transacpuntos_select_authenticated" ON public.transacpuntos;
DROP POLICY IF EXISTS "transacpuntos_insert_authenticated" ON public.transacpuntos;
DROP POLICY IF EXISTS "transacpuntos_update_authenticated" ON public.transacpuntos;

-- Policies for public.cliente (Authenticated staff only)
CREATE POLICY "cliente_select_authenticated"
    ON public.cliente
    FOR SELECT
    TO authenticated
    USING (auth.role() = 'authenticated');

CREATE POLICY "cliente_insert_authenticated"
    ON public.cliente
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "cliente_update_authenticated"
    ON public.cliente
    FOR UPDATE
    TO authenticated
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- Policies for public.transacpuntos (Authenticated staff only)
CREATE POLICY "transacpuntos_select_authenticated"
    ON public.transacpuntos
    FOR SELECT
    TO authenticated
    USING (auth.role() = 'authenticated');

CREATE POLICY "transacpuntos_insert_authenticated"
    ON public.transacpuntos
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "transacpuntos_update_authenticated"
    ON public.transacpuntos
    FOR UPDATE
    TO authenticated
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

COMMIT;
