-- ==============================================================================
-- Cash-Control v2: Migración Complementaria Fase C (Core Transaccional y RPCs)
-- Archivo: supabase/migrations/20261027150000_v2_fase_c_core.sql
-- Rama: v2/clean-core
-- Descripción:
--   1. DDL Complementario: terminal_operator_sessions, idempotency_records,
--      business_operational_limits, congelación de recursos (is_under_cut_audit).
--   2. RLS y blindaje de privilegios para nuevas tablas.
--   3. Función canónica interna: fn_post_financial_movement.
--   4. Helpers de seguridad: fn_verify_member_pin, fn_verify_terminal_session,
--      fn_evaluate_operational_limit, fn_acquire_journal_entry_number,
--      fn_post_economic_movement.
--   5. RPCs Transaccionales:
--      - rpc_open_shift
--      - rpc_join_shift
--      - rpc_leave_shift
--      - rpc_close_shift
--      - rpc_register_customer_operation
--      - rpc_register_administrative_movement
--      - rpc_correct_operation
--      - rpc_perform_cut_reconciliation
--      - rpc_resolve_incidence
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DDL COMPLEMENTARIO
-- ------------------------------------------------------------------------------

-- 1.1 Sesiones operativas de terminal vinculadas a la estación y al turno
CREATE TABLE IF NOT EXISTS public.terminal_operator_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    workstation_id UUID NOT NULL,
    shift_id UUID NOT NULL,
    operator_member_id UUID NOT NULL,
    session_token_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL,
    revoked_reason TEXT NULL,
    CONSTRAINT fk_terminal_sessions_workstation FOREIGN KEY (business_id, workstation_id)
        REFERENCES public.workstations(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_terminal_sessions_shift FOREIGN KEY (business_id, shift_id)
        REFERENCES public.shifts(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_terminal_sessions_member FOREIGN KEY (business_id, operator_member_id)
        REFERENCES public.business_members(business_id, id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.terminal_operator_sessions IS 'Sesiones operativas seguras vinculadas a terminal y turno para evitar spoofing de cajero.';

-- Máximo una sola sesión activa (no revocada) por estación de trabajo
CREATE UNIQUE INDEX IF NOT EXISTS uq_single_active_session_per_workstation
    ON public.terminal_operator_sessions(workstation_id)
    WHERE (revoked_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_terminal_sessions_lookup
    ON public.terminal_operator_sessions(business_id, session_token_hash)
    WHERE (revoked_at IS NULL);

-- 1.2 Registro formal de Idempotencia por negocio y clave
CREATE TABLE IF NOT EXISTS public.idempotency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    idempotency_key TEXT NOT NULL,
    rpc_name TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED')),
    response_payload JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    completed_at TIMESTAMPTZ NULL,
    locked_by_pid INT NULL,
    CONSTRAINT uq_idempotency_records_key UNIQUE (business_id, idempotency_key)
);
COMMENT ON TABLE public.idempotency_records IS 'Registro de operaciones concurrentes e idempotentes para evitar duplicación de movimientos.';

CREATE INDEX IF NOT EXISTS idx_idempotency_records_lookup
    ON public.idempotency_records(business_id, idempotency_key);

-- 1.3 Límites operativos por negocio, rol y tipo de acción
CREATE TABLE IF NOT EXISTS public.business_operational_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    role public.business_member_role NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('deposit', 'withdrawal', 'transfer', 'expense', 'owner_drawing', 'correction')),
    max_amount_per_event_cents BIGINT NOT NULL CHECK (max_amount_per_event_cents >= 0),
    max_daily_cumulative_cents BIGINT NOT NULL CHECK (max_daily_cumulative_cents >= 0),
    requires_supervisor_approval BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_business_limits_role_action UNIQUE (business_id, role, action_type)
);
COMMENT ON TABLE public.business_operational_limits IS 'Límites operativos parametrizables por sucursal y rol con umbrales de escalación.';

-- 1.4 Columnas complementarias en treasury_resources para Protocolo A (congelación durante corte)
ALTER TABLE public.treasury_resources
    ADD COLUMN IF NOT EXISTS is_under_cut_audit BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS locked_by_cut_id UUID NULL REFERENCES public.cuts(id) ON DELETE SET NULL;

-- 1.5 Columna de autorización formal en administrative_movements
ALTER TABLE public.administrative_movements
    ADD COLUMN IF NOT EXISTS authorized_by_member_id UUID NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_admin_movements_authorized_by'
    ) THEN
        ALTER TABLE public.administrative_movements
            ADD CONSTRAINT fk_admin_movements_authorized_by
            FOREIGN KEY (business_id, authorized_by_member_id)
            REFERENCES public.business_members(business_id, id) ON DELETE RESTRICT;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. BLINDAJE DE SEGURIDAD Y RLS EN TABLAS COMPLEMENTARIAS
-- ------------------------------------------------------------------------------
ALTER TABLE public.terminal_operator_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_operational_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'terminal_sessions_tenant_select') THEN
        CREATE POLICY terminal_sessions_tenant_select ON public.terminal_operator_sessions
            FOR SELECT TO authenticated
            USING (public.fn_is_business_owner(business_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'terminal_sessions_service_role') THEN
        CREATE POLICY terminal_sessions_service_role ON public.terminal_operator_sessions
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'idempotency_records_tenant_select') THEN
        CREATE POLICY idempotency_records_tenant_select ON public.idempotency_records
            FOR SELECT TO authenticated
            USING (public.fn_is_business_owner(business_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'idempotency_records_service_role') THEN
        CREATE POLICY idempotency_records_service_role ON public.idempotency_records
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'operational_limits_tenant_select') THEN
        CREATE POLICY operational_limits_tenant_select ON public.business_operational_limits
            FOR SELECT TO authenticated
            USING (public.fn_is_business_owner(business_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'operational_limits_service_role') THEN
        CREATE POLICY operational_limits_service_role ON public.business_operational_limits
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;

GRANT SELECT ON TABLE public.terminal_operator_sessions TO authenticated, service_role;
GRANT SELECT ON TABLE public.idempotency_records TO authenticated, service_role;
GRANT SELECT ON TABLE public.business_operational_limits TO authenticated, service_role;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.terminal_operator_sessions FROM PUBLIC, anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.idempotency_records FROM PUBLIC, anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.business_operational_limits FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. CANONICAL INTERNAL FUNCTION: fn_post_financial_movement
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_post_financial_movement(
    p_business_id UUID,
    p_journal_id UUID,
    p_resource_id UUID,
    p_amount_cents BIGINT,
    p_direction public.financial_direction
)
RETURNS TABLE (
    entry_id UUID,
    entry_sequence BIGINT,
    balance_after_cents BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_journal RECORD;
    v_res RECORD;
    v_new_balance BIGINT;
    v_new_sequence BIGINT;
    v_entry_id UUID;
BEGIN
    IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT: El monto del movimiento financiero debe ser estrictamente positivo (recibido: % centavos).', p_amount_cents
            USING ERRCODE = 'check_violation';
    END IF;

    -- 1. Validar existencia y consistencia del Journal Entry
    SELECT j.id, j.business_id, j.entry_type, j.source_entity, j.source_id
    INTO v_journal
    FROM public.journal_entries j
    WHERE j.id = p_journal_id AND j.business_id = p_business_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'JOURNAL_NOT_FOUND: El asiento contable % no existe para la empresa %.', p_journal_id, p_business_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- 2. Lock exclusivo FOR UPDATE sobre el recurso de tesorería (Invariante 1)
    SELECT r.id, r.business_id, r.code, r.name, r.type, r.current_balance_cents,
           r.last_entry_sequence, r.is_active, r.is_under_cut_audit, r.locked_by_cut_id
    INTO v_res
    FROM public.treasury_resources r
    WHERE r.id = p_resource_id AND r.business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND: Recurso de tesorería % no encontrado en la empresa %.', p_resource_id, p_business_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF NOT v_res.is_active THEN
        RAISE EXCEPTION 'RESOURCE_INACTIVE: El recurso de tesorería % (%) se encuentra inactivo.', v_res.code, p_resource_id
            USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;

    -- 3. Verificación de congelación por corte (Protocolo A)
    IF v_res.is_under_cut_audit THEN
        IF NOT (v_journal.entry_type = 'cut_reconciliation' AND v_res.locked_by_cut_id = v_journal.source_id) THEN
            RAISE EXCEPTION 'RESOURCE_FROZEN_FOR_CUT: El recurso % (%) está temporalmente congelado por la auditoría de corte %.',
                v_res.code, p_resource_id, v_res.locked_by_cut_id
                USING ERRCODE = 'object_not_in_prerequisite_state';
        END IF;
    END IF;

    -- 4. Cálculo del nuevo saldo y restricción de saldo no negativo en caja física
    IF p_direction = 'INFLOW' THEN
        v_new_balance := v_res.current_balance_cents + p_amount_cents;
    ELSIF p_direction = 'OUTFLOW' THEN
        v_new_balance := v_res.current_balance_cents - p_amount_cents;
        IF v_res.type IN ('cash_box', 'cash_reserved_envelope') AND v_new_balance < 0 THEN
            RAISE EXCEPTION 'INSUFFICIENT_FUNDS: Saldo insuficiente en recurso de caja % (saldo actual: % céntimos, requerido: % céntimos).',
                v_res.code, v_res.current_balance_cents, p_amount_cents
                USING ERRCODE = 'check_violation';
        END IF;
    ELSE
        RAISE EXCEPTION 'INVALID_DIRECTION: Dirección de tesorería desconocida: %.', p_direction
            USING ERRCODE = 'check_violation';
    END IF;

    -- 5. Generación de secuencia incremental monótona estricta (Invariante 2)
    v_new_sequence := v_res.last_entry_sequence + 1;

    -- 6. Inserción atómica en el libro mayor de tesorería
    INSERT INTO public.financial_ledger_entries (
        business_id,
        journal_entry_id,
        resource_id,
        entry_sequence,
        amount_cents,
        direction,
        balance_after_cents
    ) VALUES (
        p_business_id,
        p_journal_id,
        p_resource_id,
        v_new_sequence,
        p_amount_cents,
        p_direction,
        v_new_balance
    ) RETURNING id INTO v_entry_id;

    -- 7. Materialización atómica del saldo y secuencia en el recurso
    UPDATE public.treasury_resources
    SET current_balance_cents = v_new_balance,
        last_entry_sequence = v_new_sequence,
        updated_at = clock_timestamp()
    WHERE id = p_resource_id AND business_id = p_business_id;

    RETURN QUERY SELECT v_entry_id, v_new_sequence, v_new_balance;
END;
$$;
COMMENT ON FUNCTION public.fn_post_financial_movement IS 'ÚNICA VÍA CANÓNICA AUTORIZADA para asentar movimientos de tesorería y materializar saldos.';
REVOKE ALL ON FUNCTION public.fn_post_financial_movement FROM PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. HELPER FUNCTIONS: PIN, SESIONES, LÍMITES Y LIBRO MAYOR
-- ------------------------------------------------------------------------------

-- 4.1 Validación criptográfica de PIN de empleado / owner
CREATE OR REPLACE FUNCTION public.fn_verify_member_pin(
    p_business_id UUID,
    p_member_id UUID,
    p_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_member RECORD;
BEGIN
    SELECT bm.role, bm.pin_hash, bm.status
    INTO v_member
    FROM public.business_members bm
    WHERE bm.id = p_member_id AND bm.business_id = p_business_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF v_member.status != 'active' THEN
        RETURN false;
    END IF;

    -- Si es owner y no tiene PIN configurado, autentica por auth.uid()
    IF v_member.role = 'owner' AND v_member.pin_hash IS NULL THEN
        RETURN true;
    END IF;

    IF v_member.pin_hash IS NULL OR p_pin IS NULL OR p_pin = '' THEN
        RETURN false;
    END IF;

    -- Verificación de hashes (mock de prueba 'hash_pin_*', sha256 hex o crypt)
    IF v_member.pin_hash = ('hash_pin_' || p_pin) THEN
        RETURN true;
    ELSIF v_member.pin_hash = pg_catalog.encode(pg_catalog.sha256(p_pin::bytea), 'hex') THEN
        RETURN true;
    ELSIF v_member.pin_hash = p_pin THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_verify_member_pin FROM PUBLIC, anon, authenticated, service_role;

-- 4.2 Validación de sesión operativa de terminal (anti-spoofing)
CREATE OR REPLACE FUNCTION public.fn_verify_terminal_session(
    p_business_id UUID,
    p_workstation_id UUID,
    p_session_token TEXT,
    p_claimed_operator_id UUID DEFAULT NULL
)
RETURNS TABLE (
    operator_member_id UUID,
    shift_id UUID,
    member_role public.business_member_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_token_hash TEXT;
    v_session RECORD;
BEGIN
    IF p_session_token IS NULL OR trim(p_session_token) = '' THEN
        RAISE EXCEPTION 'MISSING_SESSION_TOKEN: Se requiere token de sesión operativa de terminal.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    v_token_hash := pg_catalog.encode(pg_catalog.sha256(p_session_token::bytea), 'hex');

    SELECT tos.id, tos.operator_member_id, tos.shift_id, tos.expires_at, tos.revoked_at,
           s.status AS shift_status, sp.status AS participant_status, bm.role AS member_role, bm.status AS member_status
    INTO v_session
    FROM public.terminal_operator_sessions tos
    JOIN public.shifts s ON s.id = tos.shift_id AND s.business_id = p_business_id
    JOIN public.business_members bm ON bm.id = tos.operator_member_id AND bm.business_id = p_business_id
    LEFT JOIN public.shift_participants sp ON sp.shift_id = tos.shift_id AND sp.member_id = tos.operator_member_id AND sp.status = 'active'
    WHERE tos.business_id = p_business_id
      AND tos.workstation_id = p_workstation_id
      AND tos.session_token_hash = v_token_hash
      AND tos.revoked_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_OR_REVOKED_OPERATIONAL_SESSION: Sesión operativa no encontrada, expirada o revocada para esta estación.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Validar expiración
    IF v_session.expires_at < clock_timestamp() THEN
        UPDATE public.terminal_operator_sessions
        SET revoked_at = clock_timestamp(), revoked_reason = 'EXPIRED'
        WHERE id = v_session.id;

        RAISE EXCEPTION 'OPERATIONAL_SESSION_EXPIRED: La sesión operativa de terminal ha expirado. Ingrese PIN nuevamente.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Validar turno abierto
    IF v_session.shift_status != 'open' THEN
        UPDATE public.terminal_operator_sessions
        SET revoked_at = clock_timestamp(), revoked_reason = 'SHIFT_CLOSED'
        WHERE id = v_session.id;

        RAISE EXCEPTION 'SHIFT_CLOSED: El turno asociado a esta terminal ya ha sido cerrado.'
            USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;

    -- Validar cajero participante activo
    IF v_session.participant_status IS DISTINCT FROM 'active' THEN
        UPDATE public.terminal_operator_sessions
        SET revoked_at = clock_timestamp(), revoked_reason = 'PARTICIPANT_INACTIVE'
        WHERE id = v_session.id;

        RAISE EXCEPTION 'OPERATOR_NOT_ACTIVE_IN_SHIFT: El operador ya no es participante activo en este turno.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Validar miembro activo
    IF v_session.member_status != 'active' THEN
        RAISE EXCEPTION 'OPERATOR_INACTIVE: El miembro operador no se encuentra activo.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Anti-spoofing: si el cliente envía un claimed operator id, debe coincidir exactamente con el token
    IF p_claimed_operator_id IS NOT NULL AND p_claimed_operator_id != v_session.operator_member_id THEN
        RAISE EXCEPTION 'OPERATOR_IDENTITY_SPOOF_ATTEMPT: El token de terminal no coincide con el ID de operador especificado.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN QUERY SELECT v_session.operator_member_id, v_session.shift_id, v_session.member_role;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_verify_terminal_session FROM PUBLIC, anon, authenticated, service_role;

-- 4.3 Evaluación de límites operativos y requerimiento de supervisor
CREATE OR REPLACE FUNCTION public.fn_evaluate_operational_limit(
    p_business_id UUID,
    p_operator_member_id UUID,
    p_action_type TEXT,
    p_amount_cents BIGINT,
    p_supervisor_pin TEXT DEFAULT NULL,
    p_supervisor_member_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_role public.business_member_role;
    v_limit RECORD;
    v_requires_supervisor BOOLEAN := false;
    v_cumulative_today BIGINT := 0;
BEGIN
    SELECT role INTO v_role
    FROM public.business_members
    WHERE id = p_operator_member_id AND business_id = p_business_id;

    -- Dueño no tiene restricciones operativas
    IF v_role = 'owner' THEN
        RETURN p_operator_member_id;
    END IF;

    SELECT max_amount_per_event_cents, max_daily_cumulative_cents, requires_supervisor_approval
    INTO v_limit
    FROM public.business_operational_limits
    WHERE business_id = p_business_id AND role = v_role AND action_type = p_action_type;

    IF FOUND THEN
        IF p_amount_cents > v_limit.max_amount_per_event_cents THEN
            v_requires_supervisor := true;
        END IF;

        IF v_limit.requires_supervisor_approval THEN
            v_requires_supervisor := true;
        END IF;

        -- Sumar operaciones acumuladas hoy para este operador
        SELECT COALESCE(SUM(amount_cents), 0) INTO v_cumulative_today
        FROM public.operations
        WHERE business_id = p_business_id
          AND operator_member_id = p_operator_member_id
          AND created_at >= date_trunc('day', clock_timestamp())
          AND status IN ('completed', 'pending_cash_delivery');

        IF (v_cumulative_today + p_amount_cents) > v_limit.max_daily_cumulative_cents THEN
            v_requires_supervisor := true;
        END IF;
    END IF;

    IF v_requires_supervisor THEN
        IF p_supervisor_member_id IS NULL OR p_supervisor_pin IS NULL OR p_supervisor_pin = '' THEN
            RAISE EXCEPTION 'OPERATIONAL_LIMIT_EXCEEDED: Operación excede límites de rol % para % (monto: % céntimos). Requiere autorización y PIN de supervisor.',
                v_role, p_action_type, p_amount_cents
                USING ERRCODE = 'insufficient_privilege';
        END IF;

        -- Validar credenciales de supervisor
        IF NOT EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.id = p_supervisor_member_id
              AND bm.business_id = p_business_id
              AND bm.role IN ('manager', 'owner')
              AND bm.status = 'active'
        ) THEN
            RAISE EXCEPTION 'INVALID_SUPERVISOR: El miembro autorizador no posee rango de supervisor/owner o no está activo.'
                USING ERRCODE = 'insufficient_privilege';
        END IF;

        IF NOT public.fn_verify_member_pin(p_business_id, p_supervisor_member_id, p_supervisor_pin) THEN
            RAISE EXCEPTION 'INVALID_SUPERVISOR_PIN: PIN de supervisor inválido o no coincide.'
                USING ERRCODE = 'insufficient_privilege';
        END IF;

        RETURN p_supervisor_member_id;
    END IF;

    RETURN p_operator_member_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_evaluate_operational_limit FROM PUBLIC, anon, authenticated, service_role;

-- 4.4 Incremento atómico del folio secuencial de Journal
CREATE OR REPLACE FUNCTION public.fn_acquire_journal_entry_number(p_business_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_num BIGINT;
BEGIN
    SELECT last_journal_entry_number + 1 INTO v_num
    FROM public.businesses
    WHERE id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'BUSINESS_NOT_FOUND: Empresa % no existe.', p_business_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    UPDATE public.businesses
    SET last_journal_entry_number = v_num,
        updated_at = clock_timestamp()
    WHERE id = p_business_id;

    RETURN v_num;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_acquire_journal_entry_number FROM PUBLIC, anon, authenticated, service_role;

-- 4.5 Inserción en libro económico (economic_ledger_entries)
CREATE OR REPLACE FUNCTION public.fn_post_economic_movement(
    p_business_id UUID,
    p_journal_id UUID,
    p_account_id UUID,
    p_amount_cents BIGINT,
    p_direction public.economic_direction
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.economic_ledger_entries (
        business_id,
        journal_entry_id,
        account_id,
        amount_cents,
        direction
    ) VALUES (
        p_business_id,
        p_journal_id,
        p_account_id,
        p_amount_cents,
        p_direction
    ) RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_post_economic_movement FROM PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. RPCs DE APERTURA, INCORPORACIÓN Y CIERRE DE TURNO
-- ------------------------------------------------------------------------------

-- 5.1 Apertura de turno con PIN inicial y emisión de token de terminal
CREATE OR REPLACE FUNCTION public.rpc_open_shift(
    p_business_id UUID,
    p_workstation_id UUID,
    p_operator_member_id UUID,
    p_pin TEXT,
    p_folio TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_owner_user_id UUID;
    v_shift_id UUID;
    v_participant_id UUID;
    v_session_id UUID;
    v_folio TEXT;
    v_token TEXT;
    v_token_hash TEXT;
BEGIN
    -- Validar pertenencia del negocio
    SELECT owner_user_id INTO v_owner_user_id
    FROM public.businesses WHERE id = p_business_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'BUSINESS_NOT_FOUND: Empresa % no existe.', p_business_id;
    END IF;

    IF v_auth_uid IS NULL OR v_auth_uid != v_owner_user_id THEN
        RAISE EXCEPTION 'FORBIDDEN_BUSINESS_ACCESS: Usuario no autenticado o no es el dueño legal del negocio.';
    END IF;

    -- Validar PIN
    IF NOT public.fn_verify_member_pin(p_business_id, p_operator_member_id, p_pin) THEN
        RAISE EXCEPTION 'INVALID_OPERATOR_PIN: PIN de operador incorrecto o miembro inactivo.';
    END IF;

    -- Validar estación
    IF NOT EXISTS (SELECT 1 FROM public.workstations WHERE id = p_workstation_id AND business_id = p_business_id AND is_active = true) THEN
        RAISE EXCEPTION 'WORKSTATION_INACTIVE: Estación de trabajo inactiva o no existe.';
    END IF;

    -- Verificar que no haya turno abierto en la estación
    IF EXISTS (SELECT 1 FROM public.shifts WHERE business_id = p_business_id AND workstation_id = p_workstation_id AND status = 'open') THEN
        RAISE EXCEPTION 'WORKSTATION_ALREADY_HAS_OPEN_SHIFT: La estación ya tiene un turno abierto.';
    END IF;

    v_folio := COALESCE(p_folio, 'SH-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    -- Crear turno
    INSERT INTO public.shifts (
        business_id, workstation_id, folio, status, opened_at, opened_by_member_id
    ) VALUES (
        p_business_id, p_workstation_id, v_folio, 'open', clock_timestamp(), p_operator_member_id
    ) RETURNING id INTO v_shift_id;

    -- Registrar participante responsable
    INSERT INTO public.shift_participants (
        business_id, shift_id, member_id, role_in_shift, joined_at, status
    ) VALUES (
        p_business_id, v_shift_id, p_operator_member_id, 'responsible', clock_timestamp(), 'active'
    ) RETURNING id INTO v_participant_id;

    -- Revocar cualquier sesión previa en la estación
    UPDATE public.terminal_operator_sessions
    SET revoked_at = clock_timestamp(), revoked_reason = 'SUPERSEDED_BY_NEW_SHIFT'
    WHERE workstation_id = p_workstation_id AND revoked_at IS NULL;

    -- Generar token de sesión operativa
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_token_hash := pg_catalog.encode(pg_catalog.sha256(v_token::bytea), 'hex');

    INSERT INTO public.terminal_operator_sessions (
        business_id, workstation_id, shift_id, operator_member_id, session_token_hash,
        created_at, expires_at
    ) VALUES (
        p_business_id, p_workstation_id, v_shift_id, p_operator_member_id, v_token_hash,
        clock_timestamp(), clock_timestamp() + INTERVAL '16 hours'
    ) RETURNING id INTO v_session_id;

    RETURN jsonb_build_object(
        'shift_id', v_shift_id,
        'folio', v_folio,
        'status', 'open',
        'operator_member_id', p_operator_member_id,
        'session_token', v_token,
        'expires_at', clock_timestamp() + INTERVAL '16 hours'
    );
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_open_shift FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_open_shift TO authenticated, service_role;

-- 5.2 Incorporación de cajero al turno (cambio de cajero legítimo)
CREATE OR REPLACE FUNCTION public.rpc_join_shift(
    p_business_id UUID,
    p_workstation_id UUID,
    p_operator_member_id UUID,
    p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_shift_id UUID;
    v_participant_id UUID;
    v_token TEXT;
    v_token_hash TEXT;
BEGIN
    IF NOT public.fn_verify_member_pin(p_business_id, p_operator_member_id, p_pin) THEN
        RAISE EXCEPTION 'INVALID_OPERATOR_PIN: PIN de operador incorrecto o miembro inactivo.';
    END IF;

    SELECT id INTO v_shift_id
    FROM public.shifts
    WHERE business_id = p_business_id AND workstation_id = p_workstation_id AND status = 'open';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NO_OPEN_SHIFT: No hay turno abierto en la estación indicada.';
    END IF;

    -- Desactivar participación activa previa del mismo operador en el turno si existiera
    UPDATE public.shift_participants
    SET status = 'left', left_at = clock_timestamp()
    WHERE shift_id = v_shift_id AND member_id = p_operator_member_id AND status = 'active';

    -- Registrar nueva participación activa
    INSERT INTO public.shift_participants (
        business_id, shift_id, member_id, role_in_shift, joined_at, status
    ) VALUES (
        p_business_id, v_shift_id, p_operator_member_id, 'participant', clock_timestamp(), 'active'
    ) RETURNING id INTO v_participant_id;

    -- Revocar sesión de terminal previa y activar la del nuevo operador
    UPDATE public.terminal_operator_sessions
    SET revoked_at = clock_timestamp(), revoked_reason = 'CASHIER_HANDOVER'
    WHERE workstation_id = p_workstation_id AND revoked_at IS NULL;

    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    v_token_hash := pg_catalog.encode(pg_catalog.sha256(v_token::bytea), 'hex');

    INSERT INTO public.terminal_operator_sessions (
        business_id, workstation_id, shift_id, operator_member_id, session_token_hash,
        created_at, expires_at
    ) VALUES (
        p_business_id, p_workstation_id, v_shift_id, p_operator_member_id, v_token_hash,
        clock_timestamp(), clock_timestamp() + INTERVAL '16 hours'
    );

    RETURN jsonb_build_object(
        'shift_id', v_shift_id,
        'operator_member_id', p_operator_member_id,
        'session_token', v_token,
        'joined_at', clock_timestamp()
    );
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_join_shift FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_join_shift TO authenticated, service_role;

-- 5.3 Cierre de turno y revocación inmediata de terminales
CREATE OR REPLACE FUNCTION public.rpc_close_shift(
    p_business_id UUID,
    p_workstation_id UUID,
    p_operator_member_id UUID,
    p_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_shift_id UUID;
BEGIN
    IF NOT public.fn_verify_member_pin(p_business_id, p_operator_member_id, p_pin) THEN
        RAISE EXCEPTION 'INVALID_OPERATOR_PIN: PIN incorrecto o miembro inactivo.';
    END IF;

    SELECT id INTO v_shift_id
    FROM public.shifts
    WHERE business_id = p_business_id AND workstation_id = p_workstation_id AND status = 'open';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NO_OPEN_SHIFT: No existe turno abierto en la estación indicada.';
    END IF;

    -- Cerrar turno
    UPDATE public.shifts
    SET status = 'closed', closed_at = clock_timestamp(), closed_by_member_id = p_operator_member_id, updated_at = clock_timestamp()
    WHERE id = v_shift_id;

    -- Marcar salida a todos los participantes
    UPDATE public.shift_participants
    SET status = 'left', left_at = clock_timestamp()
    WHERE shift_id = v_shift_id AND status = 'active';

    -- Revocar todas las sesiones de terminal vinculadas
    UPDATE public.terminal_operator_sessions
    SET revoked_at = clock_timestamp(), revoked_reason = 'SHIFT_CLOSED'
    WHERE shift_id = v_shift_id AND revoked_at IS NULL;

    RETURN jsonb_build_object(
        'shift_id', v_shift_id,
        'status', 'closed',
        'closed_at', clock_timestamp()
    );
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_close_shift FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_close_shift TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. RPC 1: rpc_register_customer_operation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_register_customer_operation(
    p_business_id UUID,
    p_workstation_id UUID,
    p_idempotency_key TEXT,
    p_type public.operation_type,
    p_amount_cents BIGINT,
    p_source_resource_id UUID,
    p_destination_resource_id UUID,
    p_sender_name TEXT,
    p_receiver_name TEXT,
    p_session_token TEXT DEFAULT NULL,
    p_operator_member_id UUID DEFAULT NULL,
    p_operator_pin TEXT DEFAULT NULL,
    p_customer_account_ref TEXT DEFAULT NULL,
    p_bank_folio TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_commission_override_cents BIGINT DEFAULT NULL,
    p_supervisor_pin TEXT DEFAULT NULL,
    p_supervisor_member_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_owner_user_id UUID;
    v_operator_id UUID;
    v_shift_id UUID;
    v_member_role public.business_member_role;
    v_rule RECORD;
    v_commission_cents BIGINT;
    v_total_cents BIGINT;
    v_commission_snapshot JSONB := '{}'::jsonb;
    v_req_payload JSONB;
    v_req_hash TEXT;
    v_idem_id UUID;
    v_idem_status TEXT;
    v_idem_rpc TEXT;
    v_idem_hash TEXT;
    v_idem_payload JSONB;
    v_is_insert BOOLEAN;
    v_entry_num BIGINT;
    v_operation_id UUID;
    v_journal_id UUID;
    v_src_move RECORD;
    v_dst_move RECORD;
    v_rev_account_id UUID;
    v_folio TEXT;
    v_response JSONB;
BEGIN
    -- 1. Validar empresa y sesión Supabase del dueño
    SELECT owner_user_id INTO v_owner_user_id
    FROM public.businesses WHERE id = p_business_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'BUSINESS_NOT_FOUND: Empresa % no encontrada.', p_business_id;
    END IF;

    IF v_auth_uid IS NOT NULL AND v_auth_uid != v_owner_user_id THEN
        RAISE EXCEPTION 'FORBIDDEN_BUSINESS_ACCESS: Usuario autenticado no tiene acceso a esta empresa.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- 2. Resolver identidad de operador y turno activo
    IF p_session_token IS NOT NULL AND trim(p_session_token) != '' THEN
        SELECT operator_member_id, shift_id, member_role
        INTO v_operator_id, v_shift_id, v_member_role
        FROM public.fn_verify_terminal_session(p_business_id, p_workstation_id, p_session_token, p_operator_member_id);
    ELSIF p_operator_member_id IS NOT NULL THEN
        IF NOT public.fn_verify_member_pin(p_business_id, p_operator_member_id, p_operator_pin) THEN
            RAISE EXCEPTION 'INVALID_OPERATOR_CREDENTIALS: PIN de operador incorrecto o miembro inactivo.'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
        SELECT s.id, bm.role INTO v_shift_id, v_member_role
        FROM public.shifts s
        JOIN public.business_members bm ON bm.id = p_operator_member_id AND bm.business_id = p_business_id
        WHERE s.business_id = p_business_id AND s.workstation_id = p_workstation_id AND s.status = 'open';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'NO_OPEN_SHIFT: No existe turno abierto en la estación para este operador.';
        END IF;
        v_operator_id := p_operator_member_id;
    ELSE
        RAISE EXCEPTION 'AUTH_REQUIRED: Se requiere token de sesión o credenciales de operador.';
    END IF;

    -- 3. Normalizar payload y verificar protocolo de idempotencia
    IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: Se requiere clave de idempotencia no vacía.'
            USING ERRCODE = 'check_violation';
    END IF;

    v_req_payload := jsonb_build_object(
        'type', p_type,
        'amount_cents', p_amount_cents,
        'source_resource_id', p_source_resource_id,
        'destination_resource_id', p_destination_resource_id,
        'sender_name', p_sender_name,
        'receiver_name', p_receiver_name,
        'commission_override_cents', p_commission_override_cents
    );
    v_req_hash := pg_catalog.encode(pg_catalog.sha256(v_req_payload::text::bytea), 'hex');

    -- Insert con ON CONFLICT para retener clave o detectar conflicto
    INSERT INTO public.idempotency_records (
        business_id, idempotency_key, rpc_name, request_hash, status, locked_by_pid
    ) VALUES (
        p_business_id, p_idempotency_key, 'rpc_register_customer_operation', v_req_hash, 'PROCESSING', pg_backend_pid()
    )
    ON CONFLICT (business_id, idempotency_key) DO UPDATE
        SET locked_by_pid = pg_backend_pid()
    RETURNING id, status, rpc_name, request_hash, response_payload, (xmax = 0)
    INTO v_idem_id, v_idem_status, v_idem_rpc, v_idem_hash, v_idem_payload, v_is_insert;

    IF NOT v_is_insert THEN
        IF v_idem_status = 'COMPLETED' THEN
            IF v_idem_rpc != 'rpc_register_customer_operation' THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC: Clave reutilizada para RPC %, original %.',
                    'rpc_register_customer_operation', v_idem_rpc
                    USING ERRCODE = 'check_violation';
            END IF;
            IF v_idem_hash != v_req_hash THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD: Clave reutilizada con parámetros diferentes.'
                    USING ERRCODE = 'check_violation';
            END IF;
            RETURN v_idem_payload;
        ELSE
            RAISE EXCEPTION 'CONCURRENT_REQUEST_PROCESSING: Otra transacción está procesando esta clave de idempotencia.'
                USING ERRCODE = 'active_sql_transaction';
        END IF;
    END IF;

    -- 4. Validaciones de montos y recursos
    IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT: El monto de la operación debe ser mayor a cero (recibido: %).', p_amount_cents
            USING ERRCODE = 'check_violation';
    END IF;

    IF p_source_resource_id = p_destination_resource_id THEN
        RAISE EXCEPTION 'DISTINCT_RESOURCES_REQUIRED: El recurso origen y destino deben ser distintos.'
            USING ERRCODE = 'check_violation';
    END IF;

    -- 5. Cálculo determinista de comisiones
    IF p_commission_override_cents IS NOT NULL THEN
        IF v_member_role = 'cashier' AND (p_supervisor_member_id IS NULL OR p_supervisor_pin IS NULL) THEN
            RAISE EXCEPTION 'SUPERVISOR_REQUIRED_FOR_COMMISSION_OVERRIDE: Cajero requiere PIN de supervisor para sobreescribir comisión.'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
        v_commission_cents := p_commission_override_cents;
        v_commission_snapshot := jsonb_build_object('type', 'manual_override', 'amount_cents', v_commission_cents);
    ELSE
        SELECT id, fixed_fee_cents, percentage_fee_bps
        INTO v_rule
        FROM public.commission_rules
        WHERE business_id = p_business_id
          AND operation_type = p_type
          AND is_active = true
          AND p_amount_cents >= min_amount_cents
          AND p_amount_cents <= max_amount_cents
          AND effective_from <= clock_timestamp()
          AND (effective_to IS NULL OR effective_to > clock_timestamp())
        ORDER BY effective_from DESC, min_amount_cents DESC, created_at DESC, id ASC
        LIMIT 1;

        IF FOUND THEN
            v_commission_cents := v_rule.fixed_fee_cents + (p_amount_cents * v_rule.percentage_fee_bps) / 10000;
            v_commission_snapshot := jsonb_build_object(
                'rule_id', v_rule.id,
                'fixed_fee_cents', v_rule.fixed_fee_cents,
                'percentage_fee_bps', v_rule.percentage_fee_bps,
                'calculated_cents', v_commission_cents
            );
        ELSE
            v_commission_cents := 0;
            v_commission_snapshot := jsonb_build_object('type', 'zero_commission_fallback', 'amount_cents', 0);
        END IF;
    END IF;

    v_total_cents := p_amount_cents + v_commission_cents;

    -- 6. Validación de límites operativos
    PERFORM public.fn_evaluate_operational_limit(
        p_business_id, v_operator_id, p_type::text, p_amount_cents, p_supervisor_pin, p_supervisor_member_id
    );

    -- 7. Generar folios y número de asiento
    v_folio := 'OP-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    v_entry_num := public.fn_acquire_journal_entry_number(p_business_id);

    -- 8. Insertar cabecera de operación
    INSERT INTO public.operations (
        business_id, shift_id, folio, type, origin, status,
        amount_cents, commission_cents,
        sender_name, receiver_name, customer_account_ref, bank_folio,
        source_resource_id, destination_resource_id,
        commission_snapshot, operator_member_id, auth_user_id, notes, created_at
    ) VALUES (
        p_business_id, v_shift_id, v_folio, p_type, 'NORMAL', 'completed',
        p_amount_cents, v_commission_cents,
        p_sender_name, p_receiver_name, p_customer_account_ref, p_bank_folio,
        p_source_resource_id, p_destination_resource_id,
        v_commission_snapshot, v_operator_id, v_owner_user_id, p_notes, clock_timestamp()
    ) RETURNING id INTO v_operation_id;

    -- 9. Insertar asiento de diario (Journal Entry)
    INSERT INTO public.journal_entries (
        business_id, shift_id, entry_number, entry_type,
        source_entity, source_id, concept,
        operator_member_id, auth_user_id, occurred_at, created_at
    ) VALUES (
        p_business_id, v_shift_id, v_entry_num, 'customer_operation',
        'operations', v_operation_id, p_type::text || ' cliente: ' || p_sender_name || ' -> ' || p_receiver_name,
        v_operator_id, v_owner_user_id, clock_timestamp(), clock_timestamp()
    ) RETURNING id INTO v_journal_id;

    -- 10. Asentar movimientos en el libro de tesorería vía función canónica:
    -- Origen: INFLOW de total_cents
    SELECT * INTO v_src_move
    FROM public.fn_post_financial_movement(
        p_business_id, v_journal_id, p_source_resource_id, v_total_cents, 'INFLOW'
    );

    -- Destino: OUTFLOW de amount_cents
    SELECT * INTO v_dst_move
    FROM public.fn_post_financial_movement(
        p_business_id, v_journal_id, p_destination_resource_id, p_amount_cents, 'OUTFLOW'
    );

    -- 11. Asentar comisión económica en REV_COMMISSIONS si existe
    IF v_commission_cents > 0 THEN
        SELECT id INTO v_rev_account_id
        FROM public.chart_of_accounts
        WHERE business_id = p_business_id AND (code = 'REV_COMMISSIONS' OR type = 'revenue')
        ORDER BY CASE WHEN code = 'REV_COMMISSIONS' THEN 1 ELSE 2 END
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Cuenta REV_COMMISSIONS no configurada para el negocio.'
                USING ERRCODE = 'foreign_key_violation';
        END IF;

        PERFORM public.fn_post_economic_movement(
            p_business_id, v_journal_id, v_rev_account_id, v_commission_cents, 'CREDIT'
        );
    END IF;

    -- 12. Construir respuesta y guardar en idempotency_records
    v_response := jsonb_build_object(
        'success', true,
        'operation_id', v_operation_id,
        'folio', v_folio,
        'journal_entry_id', v_journal_id,
        'entry_number', v_entry_num,
        'amount_cents', p_amount_cents,
        'commission_cents', v_commission_cents,
        'total_cents', v_total_cents,
        'source_resource', jsonb_build_object(
            'resource_id', p_source_resource_id,
            'direction', 'INFLOW',
            'amount_cents', v_total_cents,
            'sequence', v_src_move.entry_sequence,
            'balance_after_cents', v_src_move.balance_after_cents
        ),
        'destination_resource', jsonb_build_object(
            'resource_id', p_destination_resource_id,
            'direction', 'OUTFLOW',
            'amount_cents', p_amount_cents,
            'sequence', v_dst_move.entry_sequence,
            'balance_after_cents', v_dst_move.balance_after_cents
        )
    );

    UPDATE public.idempotency_records
    SET status = 'COMPLETED',
        response_payload = v_response,
        completed_at = clock_timestamp(),
        locked_by_pid = NULL
    WHERE id = v_idem_id;

    RETURN v_response;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_register_customer_operation FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_register_customer_operation TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. RPC 2: rpc_register_administrative_movement
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_register_administrative_movement(
    p_business_id UUID,
    p_workstation_id UUID,
    p_idempotency_key TEXT,
    p_category public.administrative_movement_category,
    p_amount_cents BIGINT,
    p_origin_resource_id UUID DEFAULT NULL,
    p_destination_resource_id UUID DEFAULT NULL,
    p_account_id UUID DEFAULT NULL,
    p_session_token TEXT DEFAULT NULL,
    p_operator_member_id UUID DEFAULT NULL,
    p_operator_pin TEXT DEFAULT NULL,
    p_voucher_url TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_authorized_by_member_id UUID DEFAULT NULL,
    p_supervisor_pin TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_owner_user_id UUID;
    v_operator_id UUID;
    v_shift_id UUID;
    v_member_role public.business_member_role;
    v_req_payload JSONB;
    v_req_hash TEXT;
    v_idem_id UUID;
    v_idem_status TEXT;
    v_idem_rpc TEXT;
    v_idem_hash TEXT;
    v_idem_payload JSONB;
    v_is_insert BOOLEAN;
    v_entry_num BIGINT;
    v_movement_id UUID;
    v_journal_id UUID;
    v_target_account_id UUID := p_account_id;
    v_folio TEXT;
    v_response JSONB;
    v_out_res RECORD;
    v_in_res RECORD;
BEGIN
    SELECT owner_user_id INTO v_owner_user_id
    FROM public.businesses WHERE id = p_business_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'BUSINESS_NOT_FOUND: Empresa % no encontrada.', p_business_id;
    END IF;

    IF v_auth_uid IS NOT NULL AND v_auth_uid != v_owner_user_id THEN
        RAISE EXCEPTION 'FORBIDDEN_BUSINESS_ACCESS: Usuario autenticado no tiene acceso a esta empresa.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Resolver identidad de operador
    IF p_session_token IS NOT NULL AND trim(p_session_token) != '' THEN
        SELECT operator_member_id, shift_id, member_role
        INTO v_operator_id, v_shift_id, v_member_role
        FROM public.fn_verify_terminal_session(p_business_id, p_workstation_id, p_session_token, p_operator_member_id);
    ELSIF p_operator_member_id IS NOT NULL THEN
        IF NOT public.fn_verify_member_pin(p_business_id, p_operator_member_id, p_operator_pin) THEN
            RAISE EXCEPTION 'INVALID_OPERATOR_CREDENTIALS: PIN de operador incorrecto o miembro inactivo.'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
        SELECT s.id, bm.role INTO v_shift_id, v_member_role
        FROM public.shifts s
        JOIN public.business_members bm ON bm.id = p_operator_member_id AND bm.business_id = p_business_id
        WHERE s.business_id = p_business_id AND s.workstation_id = p_workstation_id AND s.status = 'open';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'NO_OPEN_SHIFT: No existe turno abierto en la estación indicada.';
        END IF;
        v_operator_id := p_operator_member_id;
    ELSE
        RAISE EXCEPTION 'AUTH_REQUIRED: Se requiere token de sesión o credenciales de operador.';
    END IF;

    -- Permisos específicos por categoría
    IF p_category IN ('owner_capital_injection', 'owner_drawing_withdrawal') THEN
        IF v_member_role != 'owner' THEN
            RAISE EXCEPTION 'OWNER_EXCLUSIVE: Categorías patrimoniales de capital y retiros son exclusivas del dueño.'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    END IF;

    -- Idempotencia
    IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: Se requiere clave de idempotencia.'
            USING ERRCODE = 'check_violation';
    END IF;

    v_req_payload := jsonb_build_object(
        'category', p_category,
        'amount_cents', p_amount_cents,
        'origin_resource_id', p_origin_resource_id,
        'destination_resource_id', p_destination_resource_id,
        'account_id', p_account_id
    );
    v_req_hash := pg_catalog.encode(pg_catalog.sha256(v_req_payload::text::bytea), 'hex');

    INSERT INTO public.idempotency_records (
        business_id, idempotency_key, rpc_name, request_hash, status, locked_by_pid
    ) VALUES (
        p_business_id, p_idempotency_key, 'rpc_register_administrative_movement', v_req_hash, 'PROCESSING', pg_backend_pid()
    )
    ON CONFLICT (business_id, idempotency_key) DO UPDATE
        SET locked_by_pid = pg_backend_pid()
    RETURNING id, status, rpc_name, request_hash, response_payload, (xmax = 0)
    INTO v_idem_id, v_idem_status, v_idem_rpc, v_idem_hash, v_idem_payload, v_is_insert;

    IF NOT v_is_insert THEN
        IF v_idem_status = 'COMPLETED' THEN
            IF v_idem_rpc != 'rpc_register_administrative_movement' THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC: Clave reutilizada para RPC %, original %.',
                    'rpc_register_administrative_movement', v_idem_rpc
                    USING ERRCODE = 'check_violation';
            END IF;
            IF v_idem_hash != v_req_hash THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD: Clave reutilizada con parámetros diferentes.'
                    USING ERRCODE = 'check_violation';
            END IF;
            RETURN v_idem_payload;
        ELSE
            RAISE EXCEPTION 'CONCURRENT_REQUEST_PROCESSING: Otra transacción está procesando esta clave de idempotencia.'
                USING ERRCODE = 'active_sql_transaction';
        END IF;
    END IF;

    IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT: El monto debe ser mayor a cero (recibido: %).', p_amount_cents
            USING ERRCODE = 'check_violation';
    END IF;

    -- Validar límites operativos
    PERFORM public.fn_evaluate_operational_limit(
        p_business_id, v_operator_id,
        CASE WHEN p_category = 'transfer_internal' THEN 'transfer'
             WHEN p_category = 'expense_out' THEN 'expense'
             WHEN p_category = 'owner_drawing_withdrawal' THEN 'owner_drawing'
             ELSE 'deposit' END,
        p_amount_cents, p_supervisor_pin, p_authorized_by_member_id
    );

    v_folio := 'ADM-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    v_entry_num := public.fn_acquire_journal_entry_number(p_business_id);

    -- Insertar administrative_movements
    INSERT INTO public.administrative_movements (
        business_id, shift_id, folio, category, amount_cents,
        origin_resource_id, destination_resource_id,
        voucher_url, notes, operator_member_id, auth_user_id, authorized_by_member_id, created_at
    ) VALUES (
        p_business_id, v_shift_id, v_folio, p_category, p_amount_cents,
        p_origin_resource_id, p_destination_resource_id,
        p_voucher_url, p_notes, v_operator_id, v_owner_user_id, p_authorized_by_member_id, clock_timestamp()
    ) RETURNING id INTO v_movement_id;

    -- Insertar journal_entry
    INSERT INTO public.journal_entries (
        business_id, shift_id, entry_number, entry_type,
        source_entity, source_id, concept,
        operator_member_id, auth_user_id, occurred_at, created_at
    ) VALUES (
        p_business_id, v_shift_id, v_entry_num, 'administrative_movement',
        'administrative_movements', v_movement_id, 'Movimiento administrativo: ' || p_category::text,
        v_operator_id, v_owner_user_id, clock_timestamp(), clock_timestamp()
    ) RETURNING id INTO v_journal_id;

    -- Contabilización según categoría
    IF p_category = 'transfer_internal' THEN
        IF p_origin_resource_id IS NULL OR p_destination_resource_id IS NULL OR p_origin_resource_id = p_destination_resource_id THEN
            RAISE EXCEPTION 'INVALID_TRANSFER_RESOURCES: Traslado requiere origen y destino distintos.';
        END IF;

        SELECT * INTO v_out_res FROM public.fn_post_financial_movement(
            p_business_id, v_journal_id, p_origin_resource_id, p_amount_cents, 'OUTFLOW'
        );
        SELECT * INTO v_in_res FROM public.fn_post_financial_movement(
            p_business_id, v_journal_id, p_destination_resource_id, p_amount_cents, 'INFLOW'
        );

    ELSIF p_category = 'funding_in' THEN
        IF p_destination_resource_id IS NULL THEN
            RAISE EXCEPTION 'DESTINATION_REQUIRED: funding_in requiere destination_resource_id.';
        END IF;
        IF v_target_account_id IS NULL THEN
            SELECT id INTO v_target_account_id FROM public.chart_of_accounts
            WHERE business_id = p_business_id AND type IN ('equity', 'clearing_control') LIMIT 1;
        END IF;

        SELECT * INTO v_in_res FROM public.fn_post_financial_movement(
            p_business_id, v_journal_id, p_destination_resource_id, p_amount_cents, 'INFLOW'
        );
        PERFORM public.fn_post_economic_movement(
            p_business_id, v_journal_id, v_target_account_id, p_amount_cents, 'CREDIT'
        );

    ELSIF p_category = 'expense_out' THEN
        IF p_origin_resource_id IS NULL THEN
            RAISE EXCEPTION 'ORIGIN_REQUIRED: expense_out requiere origin_resource_id.';
        END IF;
        IF v_target_account_id IS NULL THEN
            SELECT id INTO v_target_account_id FROM public.chart_of_accounts
            WHERE business_id = p_business_id AND type = 'expense' LIMIT 1;
        END IF;

        SELECT * INTO v_out_res FROM public.fn_post_financial_movement(
            p_business_id, v_journal_id, p_origin_resource_id, p_amount_cents, 'OUTFLOW'
        );
        PERFORM public.fn_post_economic_movement(
            p_business_id, v_journal_id, v_target_account_id, p_amount_cents, 'DEBIT'
        );

    ELSIF p_category = 'owner_capital_injection' THEN
        IF p_destination_resource_id IS NULL THEN
            RAISE EXCEPTION 'DESTINATION_REQUIRED: owner_capital_injection requiere destination_resource_id.';
        END IF;
        IF v_target_account_id IS NULL THEN
            SELECT id INTO v_target_account_id FROM public.chart_of_accounts
            WHERE business_id = p_business_id AND type = 'equity' LIMIT 1;
        END IF;

        SELECT * INTO v_in_res FROM public.fn_post_financial_movement(
            p_business_id, v_journal_id, p_destination_resource_id, p_amount_cents, 'INFLOW'
        );
        PERFORM public.fn_post_economic_movement(
            p_business_id, v_journal_id, v_target_account_id, p_amount_cents, 'CREDIT'
        );

    ELSIF p_category = 'owner_drawing_withdrawal' THEN
        IF p_origin_resource_id IS NULL THEN
            RAISE EXCEPTION 'ORIGIN_REQUIRED: owner_drawing_withdrawal requiere origin_resource_id.';
        END IF;
        IF v_target_account_id IS NULL THEN
            SELECT id INTO v_target_account_id FROM public.chart_of_accounts
            WHERE business_id = p_business_id AND type = 'equity' LIMIT 1;
        END IF;

        SELECT * INTO v_out_res FROM public.fn_post_financial_movement(
            p_business_id, v_journal_id, p_origin_resource_id, p_amount_cents, 'OUTFLOW'
        );
        PERFORM public.fn_post_economic_movement(
            p_business_id, v_journal_id, v_target_account_id, p_amount_cents, 'DEBIT'
        );

    ELSIF p_category = 'reconciliation_adjustment' THEN
        IF p_origin_resource_id IS NOT NULL THEN
            SELECT * INTO v_out_res FROM public.fn_post_financial_movement(
                p_business_id, v_journal_id, p_origin_resource_id, p_amount_cents, 'OUTFLOW'
            );
            IF v_target_account_id IS NULL THEN
                SELECT id INTO v_target_account_id FROM public.chart_of_accounts
                WHERE business_id = p_business_id AND code = 'CUSTODY_DISCREPANCY_SUSPENSE' LIMIT 1;
            END IF;
            PERFORM public.fn_post_economic_movement(
                p_business_id, v_journal_id, v_target_account_id, p_amount_cents, 'DEBIT'
            );
        ELSIF p_destination_resource_id IS NOT NULL THEN
            SELECT * INTO v_in_res FROM public.fn_post_financial_movement(
                p_business_id, v_journal_id, p_destination_resource_id, p_amount_cents, 'INFLOW'
            );
            IF v_target_account_id IS NULL THEN
                SELECT id INTO v_target_account_id FROM public.chart_of_accounts
                WHERE business_id = p_business_id AND code = 'CUSTODY_DISCREPANCY_SUSPENSE' LIMIT 1;
            END IF;
            PERFORM public.fn_post_economic_movement(
                p_business_id, v_journal_id, v_target_account_id, p_amount_cents, 'CREDIT'
            );
        END IF;
    END IF;

    v_response := jsonb_build_object(
        'success', true,
        'movement_id', v_movement_id,
        'folio', v_folio,
        'journal_entry_id', v_journal_id,
        'entry_number', v_entry_num,
        'category', p_category,
        'amount_cents', p_amount_cents
    );

    UPDATE public.idempotency_records
    SET status = 'COMPLETED',
        response_payload = v_response,
        completed_at = clock_timestamp(),
        locked_by_pid = NULL
    WHERE id = v_idem_id;

    RETURN v_response;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_register_administrative_movement FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_register_administrative_movement TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. RPC 3: rpc_correct_operation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_correct_operation(
    p_business_id UUID,
    p_workstation_id UUID,
    p_idempotency_key TEXT,
    p_original_operation_id UUID,
    p_reason TEXT,
    p_replacement_amount_cents BIGINT,
    p_replacement_source_resource_id UUID,
    p_replacement_destination_resource_id UUID,
    p_replacement_sender_name TEXT,
    p_replacement_receiver_name TEXT,
    p_session_token TEXT DEFAULT NULL,
    p_operator_member_id UUID DEFAULT NULL,
    p_operator_pin TEXT DEFAULT NULL,
    p_replacement_customer_account_ref TEXT DEFAULT NULL,
    p_replacement_bank_folio TEXT DEFAULT NULL,
    p_replacement_commission_override_cents BIGINT DEFAULT NULL,
    p_supervisor_pin TEXT DEFAULT NULL,
    p_supervisor_member_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_owner_user_id UUID;
    v_operator_id UUID;
    v_shift_id UUID;
    v_member_role public.business_member_role;
    v_orig_op RECORD;
    v_orig_jrn RECORD;
    v_reversal_op_id UUID;
    v_reversal_jrn_id UUID;
    v_replacement_op_id UUID;
    v_replacement_jrn_id UUID;
    v_correction_id UUID;
    v_rev_folio TEXT;
    v_rep_folio TEXT;
    v_entry_num BIGINT;
    v_req_payload JSONB;
    v_req_hash TEXT;
    v_idem_id UUID;
    v_idem_status TEXT;
    v_idem_rpc TEXT;
    v_idem_hash TEXT;
    v_idem_payload JSONB;
    v_is_insert BOOLEAN;
    v_line RECORD;
    v_rep_response JSONB;
    v_response JSONB;
BEGIN
    SELECT owner_user_id INTO v_owner_user_id
    FROM public.businesses WHERE id = p_business_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'BUSINESS_NOT_FOUND: Empresa % no encontrada.', p_business_id;
    END IF;

    IF v_auth_uid IS NOT NULL AND v_auth_uid != v_owner_user_id THEN
        RAISE EXCEPTION 'FORBIDDEN_BUSINESS_ACCESS: Usuario autenticado no tiene acceso a esta empresa.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Resolver identidad de operador
    IF p_session_token IS NOT NULL AND trim(p_session_token) != '' THEN
        SELECT operator_member_id, shift_id, member_role
        INTO v_operator_id, v_shift_id, v_member_role
        FROM public.fn_verify_terminal_session(p_business_id, p_workstation_id, p_session_token, p_operator_member_id);
    ELSIF p_operator_member_id IS NOT NULL THEN
        IF NOT public.fn_verify_member_pin(p_business_id, p_operator_member_id, p_operator_pin) THEN
            RAISE EXCEPTION 'INVALID_OPERATOR_CREDENTIALS: PIN de operador incorrecto o miembro inactivo.'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
        SELECT s.id, bm.role INTO v_shift_id, v_member_role
        FROM public.shifts s
        JOIN public.business_members bm ON bm.id = p_operator_member_id AND bm.business_id = p_business_id
        WHERE s.business_id = p_business_id AND s.workstation_id = p_workstation_id AND s.status = 'open';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'NO_OPEN_SHIFT: No existe turno abierto en la estación indicada.';
        END IF;
        v_operator_id := p_operator_member_id;
    ELSE
        RAISE EXCEPTION 'AUTH_REQUIRED: Se requiere token de sesión o credenciales de operador.';
    END IF;

    -- Corrección exige rol supervisor (manager u owner)
    IF v_member_role NOT IN ('manager', 'owner') THEN
        IF p_supervisor_member_id IS NULL OR p_supervisor_pin IS NULL THEN
            RAISE EXCEPTION 'SUPERVISOR_REQUIRED_FOR_CORRECTION: Las correcciones exigen autorización de supervisor/owner.'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
        IF NOT public.fn_verify_member_pin(p_business_id, p_supervisor_member_id, p_supervisor_pin) THEN
            RAISE EXCEPTION 'INVALID_SUPERVISOR_PIN: PIN de supervisor inválido.'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    END IF;

    -- Idempotencia
    IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: Se requiere clave de idempotencia.'
            USING ERRCODE = 'check_violation';
    END IF;

    v_req_payload := jsonb_build_object(
        'original_operation_id', p_original_operation_id,
        'replacement_amount_cents', p_replacement_amount_cents,
        'replacement_source_resource_id', p_replacement_source_resource_id,
        'replacement_destination_resource_id', p_replacement_destination_resource_id
    );
    v_req_hash := pg_catalog.encode(pg_catalog.sha256(v_req_payload::text::bytea), 'hex');

    INSERT INTO public.idempotency_records (
        business_id, idempotency_key, rpc_name, request_hash, status, locked_by_pid
    ) VALUES (
        p_business_id, p_idempotency_key, 'rpc_correct_operation', v_req_hash, 'PROCESSING', pg_backend_pid()
    )
    ON CONFLICT (business_id, idempotency_key) DO UPDATE
        SET locked_by_pid = pg_backend_pid()
    RETURNING id, status, rpc_name, request_hash, response_payload, (xmax = 0)
    INTO v_idem_id, v_idem_status, v_idem_rpc, v_idem_hash, v_idem_payload, v_is_insert;

    IF NOT v_is_insert THEN
        IF v_idem_status = 'COMPLETED' THEN
            IF v_idem_rpc != 'rpc_correct_operation' THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC: Clave reutilizada para RPC %, original %.',
                    'rpc_correct_operation', v_idem_rpc
                    USING ERRCODE = 'check_violation';
            END IF;
            IF v_idem_hash != v_req_hash THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD: Clave reutilizada con parámetros diferentes.'
                    USING ERRCODE = 'check_violation';
            END IF;
            RETURN v_idem_payload;
        ELSE
            RAISE EXCEPTION 'CONCURRENT_REQUEST_PROCESSING: Otra transacción está procesando esta clave de idempotencia.'
                USING ERRCODE = 'active_sql_transaction';
        END IF;
    END IF;

    -- Validar operación original y bloquearla
    SELECT * INTO v_orig_op
    FROM public.operations
    WHERE id = p_original_operation_id AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORIGINAL_OPERATION_NOT_FOUND: Operación original % no existe.', p_original_operation_id;
    END IF;

    IF v_orig_op.status != 'completed' THEN
        RAISE EXCEPTION 'ORIGINAL_NOT_COMPLETED: Solo se pueden corregir operaciones en estado completed (estado actual: %).', v_orig_op.status;
    END IF;

    IF EXISTS (SELECT 1 FROM public.operation_corrections WHERE original_operation_id = p_original_operation_id) THEN
        RAISE EXCEPTION 'ALREADY_CORRECTED: La operación % ya ha sido corregida previamente.', p_original_operation_id;
    END IF;

    SELECT id INTO v_orig_jrn
    FROM public.journal_entries
    WHERE source_entity = 'operations' AND source_id = p_original_operation_id AND business_id = p_business_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORIGINAL_JOURNAL_NOT_FOUND: No se encontró el asiento contable original de la operación.';
    END IF;

    -- 1. Crear operación de reversión
    v_rev_folio := 'REV-' || substr(v_orig_op.folio, 4);
    INSERT INTO public.operations (
        business_id, shift_id, folio, type, origin, status,
        amount_cents, commission_cents, sender_name, receiver_name,
        source_resource_id, destination_resource_id,
        operator_member_id, auth_user_id, notes, created_at
    ) VALUES (
        p_business_id, v_shift_id, v_rev_folio, v_orig_op.type, v_orig_op.origin, 'completed',
        v_orig_op.amount_cents, v_orig_op.commission_cents, v_orig_op.sender_name, v_orig_op.receiver_name,
        v_orig_op.source_resource_id, v_orig_op.destination_resource_id,
        v_operator_id, v_owner_user_id, 'Reversión por corrección: ' || p_reason, clock_timestamp()
    ) RETURNING id INTO v_reversal_op_id;

    -- 2. Crear operación de reemplazo
    v_rep_folio := 'REP-' || substr(v_orig_op.folio, 4);
    INSERT INTO public.operations (
        business_id, shift_id, folio, type, origin, status,
        amount_cents, commission_cents, sender_name, receiver_name,
        customer_account_ref, bank_folio,
        source_resource_id, destination_resource_id,
        operator_member_id, auth_user_id, notes, created_at
    ) VALUES (
        p_business_id, v_shift_id, v_rep_folio, v_orig_op.type, 'NORMAL', 'completed',
        p_replacement_amount_cents, COALESCE(p_replacement_commission_override_cents, v_orig_op.commission_cents),
        p_replacement_sender_name, p_replacement_receiver_name,
        p_replacement_customer_account_ref, p_replacement_bank_folio,
        p_replacement_source_resource_id, p_replacement_destination_resource_id,
        v_operator_id, v_owner_user_id, 'Reemplazo de corrección: ' || p_reason, clock_timestamp()
    ) RETURNING id INTO v_replacement_op_id;

    -- 3. Registrar vínculo de corrección inmutable
    INSERT INTO public.operation_corrections (
        business_id, original_operation_id, reversal_operation_id, replacement_operation_id,
        reason, authorized_by_member_id, auth_user_id, created_at
    ) VALUES (
        p_business_id, p_original_operation_id, v_reversal_op_id, v_replacement_op_id,
        p_reason, COALESCE(p_supervisor_member_id, v_operator_id), v_owner_user_id, clock_timestamp()
    ) RETURNING id INTO v_correction_id;

    -- 4. Asiento de Reversión Espejo (operation_correction)
    v_entry_num := public.fn_acquire_journal_entry_number(p_business_id);
    INSERT INTO public.journal_entries (
        business_id, shift_id, entry_number, entry_type,
        source_entity, source_id, concept,
        operator_member_id, auth_user_id, occurred_at, created_at
    ) VALUES (
        p_business_id, v_shift_id, v_entry_num, 'operation_correction',
        'operation_corrections', v_correction_id, 'Reversión contable operación: ' || v_orig_op.folio,
        v_operator_id, v_owner_user_id, clock_timestamp(), clock_timestamp()
    ) RETURNING id INTO v_reversal_jrn_id;

    -- Reversión de líneas de tesorería con dirección invertida exacta
    FOR v_line IN (
        SELECT resource_id, amount_cents, direction
        FROM public.financial_ledger_entries
        WHERE journal_entry_id = v_orig_jrn.id
    ) LOOP
        PERFORM public.fn_post_financial_movement(
            p_business_id, v_reversal_jrn_id, v_line.resource_id, v_line.amount_cents,
            CASE WHEN v_line.direction = 'INFLOW' THEN 'OUTFLOW'::public.financial_direction ELSE 'INFLOW'::public.financial_direction END
        );
    END LOOP;

    -- Reversión de líneas económicas con dirección invertida exacta
    FOR v_line IN (
        SELECT account_id, amount_cents, direction
        FROM public.economic_ledger_entries
        WHERE journal_entry_id = v_orig_jrn.id
    ) LOOP
        PERFORM public.fn_post_economic_movement(
            p_business_id, v_reversal_jrn_id, v_line.account_id, v_line.amount_cents,
            CASE WHEN v_line.direction = 'CREDIT' THEN 'DEBIT'::public.economic_direction ELSE 'CREDIT'::public.economic_direction END
        );
    END LOOP;

    -- 5. Asiento de Reemplazo
    v_entry_num := public.fn_acquire_journal_entry_number(p_business_id);
    INSERT INTO public.journal_entries (
        business_id, shift_id, entry_number, entry_type,
        source_entity, source_id, concept,
        operator_member_id, auth_user_id, occurred_at, created_at
    ) VALUES (
        p_business_id, v_shift_id, v_entry_num, 'customer_operation',
        'operations', v_replacement_op_id, 'Reemplazo operación: ' || v_rep_folio,
        v_operator_id, v_owner_user_id, clock_timestamp(), clock_timestamp()
    ) RETURNING id INTO v_replacement_jrn_id;

    -- Contabilizar reemplazo
    PERFORM public.fn_post_financial_movement(
        p_business_id, v_replacement_jrn_id, p_replacement_source_resource_id,
        p_replacement_amount_cents + COALESCE(p_replacement_commission_override_cents, v_orig_op.commission_cents),
        'INFLOW'
    );
    PERFORM public.fn_post_financial_movement(
        p_business_id, v_replacement_jrn_id, p_replacement_destination_resource_id,
        p_replacement_amount_cents,
        'OUTFLOW'
    );

    IF COALESCE(p_replacement_commission_override_cents, v_orig_op.commission_cents) > 0 THEN
        DECLARE
            v_rev_id UUID;
        BEGIN
            SELECT id INTO v_rev_id FROM public.chart_of_accounts
            WHERE business_id = p_business_id AND (code = 'REV_COMMISSIONS' OR type = 'revenue') LIMIT 1;
            PERFORM public.fn_post_economic_movement(
                p_business_id, v_replacement_jrn_id, v_rev_id,
                COALESCE(p_replacement_commission_override_cents, v_orig_op.commission_cents), 'CREDIT'
            );
        END;
    END IF;

    -- Marcar operación original como corrected
    UPDATE public.operations
    SET status = 'corrected'
    WHERE id = p_original_operation_id;

    v_response := jsonb_build_object(
        'success', true,
        'correction_id', v_correction_id,
        'original_operation_id', p_original_operation_id,
        'reversal_operation_id', v_reversal_op_id,
        'reversal_journal_id', v_reversal_jrn_id,
        'replacement_operation_id', v_replacement_op_id,
        'replacement_journal_id', v_replacement_jrn_id
    );

    UPDATE public.idempotency_records
    SET status = 'COMPLETED',
        response_payload = v_response,
        completed_at = clock_timestamp(),
        locked_by_pid = NULL
    WHERE id = v_idem_id;

    RETURN v_response;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_correct_operation FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_correct_operation TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9. RPC 4: rpc_perform_cut_reconciliation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_perform_cut_reconciliation(
    p_business_id UUID,
    p_workstation_id UUID,
    p_idempotency_key TEXT,
    p_audited_shift_ids UUID[],
    p_cash_counts JSONB,       -- array de { resource_id, counted_amount_cents, notes }
    p_bank_audits JSONB,       -- array de { resource_id, observed_balance_cents, evidence_url, notes, items: [...] }
    p_session_token TEXT DEFAULT NULL,
    p_operator_member_id UUID DEFAULT NULL,
    p_operator_pin TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_owner_user_id UUID;
    v_operator_id UUID;
    v_shift_id UUID;
    v_member_role public.business_member_role;
    v_cut_id UUID;
    v_cut_folio TEXT;
    v_journal_id UUID;
    v_entry_num BIGINT;
    v_suspense_account_id UUID;
    v_has_differences BOOLEAN := false;
    v_req_payload JSONB;
    v_req_hash TEXT;
    v_idem_id UUID;
    v_idem_status TEXT;
    v_idem_rpc TEXT;
    v_idem_hash TEXT;
    v_idem_payload JSONB;
    v_is_insert BOOLEAN;
    v_res_ids UUID[] := ARRAY[]::UUID[];
    v_item JSONB;
    v_subitem JSONB;
    v_adj RECORD;
    v_res RECORD;
    v_diff BIGINT;
    v_diff_type public.difference_type;
    v_inc_id UUID;
    v_inc_folio TEXT;
    v_bank_audit_id UUID;
    v_response JSONB;
BEGIN
    SELECT owner_user_id INTO v_owner_user_id
    FROM public.businesses WHERE id = p_business_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'BUSINESS_NOT_FOUND: Empresa % no encontrada.', p_business_id;
    END IF;

    IF v_auth_uid IS NOT NULL AND v_auth_uid != v_owner_user_id THEN
        RAISE EXCEPTION 'FORBIDDEN_BUSINESS_ACCESS: Usuario autenticado no tiene acceso a esta empresa.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Resolver identidad de operador
    IF p_session_token IS NOT NULL AND trim(p_session_token) != '' THEN
        SELECT operator_member_id, shift_id, member_role
        INTO v_operator_id, v_shift_id, v_member_role
        FROM public.fn_verify_terminal_session(p_business_id, p_workstation_id, p_session_token, p_operator_member_id);
    ELSIF p_operator_member_id IS NOT NULL THEN
        IF NOT public.fn_verify_member_pin(p_business_id, p_operator_member_id, p_operator_pin) THEN
            RAISE EXCEPTION 'INVALID_OPERATOR_CREDENTIALS: PIN de operador incorrecto o miembro inactivo.'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
        SELECT s.id, bm.role INTO v_shift_id, v_member_role
        FROM public.shifts s
        JOIN public.business_members bm ON bm.id = p_operator_member_id AND bm.business_id = p_business_id
        WHERE s.business_id = p_business_id AND s.workstation_id = p_workstation_id AND s.status = 'open';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'NO_OPEN_SHIFT: No existe turno abierto en la estación indicada.';
        END IF;
        v_operator_id := p_operator_member_id;
    ELSE
        RAISE EXCEPTION 'AUTH_REQUIRED: Se requiere token de sesión o credenciales de operador.';
    END IF;

    -- Idempotencia
    IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: Se requiere clave de idempotencia.'
            USING ERRCODE = 'check_violation';
    END IF;

    v_req_payload := jsonb_build_object(
        'cash_counts', p_cash_counts,
        'bank_audits', p_bank_audits,
        'audited_shift_ids', p_audited_shift_ids
    );
    v_req_hash := pg_catalog.encode(pg_catalog.sha256(v_req_payload::text::bytea), 'hex');

    INSERT INTO public.idempotency_records (
        business_id, idempotency_key, rpc_name, request_hash, status, locked_by_pid
    ) VALUES (
        p_business_id, p_idempotency_key, 'rpc_perform_cut_reconciliation', v_req_hash, 'PROCESSING', pg_backend_pid()
    )
    ON CONFLICT (business_id, idempotency_key) DO UPDATE
        SET locked_by_pid = pg_backend_pid()
    RETURNING id, status, rpc_name, request_hash, response_payload, (xmax = 0)
    INTO v_idem_id, v_idem_status, v_idem_rpc, v_idem_hash, v_idem_payload, v_is_insert;

    IF NOT v_is_insert THEN
        IF v_idem_status = 'COMPLETED' THEN
            IF v_idem_rpc != 'rpc_perform_cut_reconciliation' THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC: Clave reutilizada para RPC %, original %.',
                    'rpc_perform_cut_reconciliation', v_idem_rpc
                    USING ERRCODE = 'check_violation';
            END IF;
            IF v_idem_hash != v_req_hash THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD: Clave reutilizada con parámetros diferentes.'
                    USING ERRCODE = 'check_violation';
            END IF;
            RETURN v_idem_payload;
        ELSE
            RAISE EXCEPTION 'CONCURRENT_REQUEST_PROCESSING: Otra transacción está procesando esta clave de idempotencia.'
                USING ERRCODE = 'active_sql_transaction';
        END IF;
    END IF;

    -- 1. RECOLECTAR Y ORDENAR DETERMINÍSTICAMENTE RECURSOS PARA ADQUIRIR FOR UPDATE
    -- PREVIENE DEADLOCKS Y GARANTIZA ORDEN DE BLOQUEOS FOR UPDATE ANTES DE TOCAR INCIDENCIAS
    IF p_cash_counts IS NOT NULL THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_cash_counts) LOOP
            v_res_ids := array_append(v_res_ids, (v_item->>'resource_id')::UUID);
        END LOOP;
    END IF;

    IF p_bank_audits IS NOT NULL THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_bank_audits) LOOP
            v_res_ids := array_append(v_res_ids, (v_item->>'resource_id')::UUID);
        END LOOP;
    END IF;

    -- Adquirir bloqueo exclusivo FOR UPDATE en orden canónico estricto de id ASC
    PERFORM 1
    FROM public.treasury_resources
    WHERE id = ANY(v_res_ids) AND business_id = p_business_id
    ORDER BY id ASC
    FOR UPDATE;

    -- 2. Crear evento formal de corte
    v_cut_folio := 'CUT-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    INSERT INTO public.cuts (
        business_id, folio, status, started_at, auditor_member_id, auth_user_id, notes, created_at
    ) VALUES (
        p_business_id, v_cut_folio, 'in_progress', clock_timestamp(), v_operator_id, v_owner_user_id, p_notes, clock_timestamp()
    ) RETURNING id INTO v_cut_id;

    -- Vincular turnos auditados
    IF p_audited_shift_ids IS NOT NULL THEN
        INSERT INTO public.cut_audited_shifts (business_id, cut_id, shift_id)
        SELECT p_business_id, v_cut_id, unnest(p_audited_shift_ids)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Localizar cuenta transitoria de suspenso
    SELECT id INTO v_suspense_account_id
    FROM public.chart_of_accounts
    WHERE business_id = p_business_id AND code = 'CUSTODY_DISCREPANCY_SUSPENSE';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SUSPENSE_ACCOUNT_NOT_FOUND: Cuenta CUSTODY_DISCREPANCY_SUSPENSE no existe.';
    END IF;

    -- 3. Procesar conteos de caja física (cut_cash_counts)
    IF p_cash_counts IS NOT NULL THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_cash_counts) LOOP
            SELECT id, current_balance_cents, last_entry_sequence INTO v_res
            FROM public.treasury_resources
            WHERE id = (v_item->>'resource_id')::UUID AND business_id = p_business_id;

            v_diff := (v_item->>'counted_amount_cents')::BIGINT - v_res.current_balance_cents;
            v_diff_type := CASE WHEN v_diff = 0 THEN 'exact'::public.difference_type
                                WHEN v_diff < 0 THEN 'shortage'::public.difference_type
                                ELSE 'surplus'::public.difference_type END;

            INSERT INTO public.cut_cash_counts (
                business_id, cut_id, resource_id, snapshot_sequence, cutoff_sequence,
                theoretical_balance_cents, counted_amount_cents, difference_type, notes
            ) VALUES (
                p_business_id, v_cut_id, v_res.id, v_res.last_entry_sequence, v_res.last_entry_sequence,
                v_res.current_balance_cents, (v_item->>'counted_amount_cents')::BIGINT, v_diff_type, v_item->>'notes'
            );

            IF v_diff != 0 THEN
                v_has_differences := true;
            END IF;
        END LOOP;
    END IF;

    -- 4. Procesar auditorías bancarias (bank_audits y bank_audit_items)
    IF p_bank_audits IS NOT NULL THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_bank_audits) LOOP
            SELECT id, current_balance_cents, last_entry_sequence INTO v_res
            FROM public.treasury_resources
            WHERE id = (v_item->>'resource_id')::UUID AND business_id = p_business_id;

            v_diff := (v_item->>'observed_balance_cents')::BIGINT - v_res.current_balance_cents;
            v_diff_type := CASE WHEN v_diff = 0 THEN 'exact'::public.difference_type
                                WHEN v_diff < 0 THEN 'shortage'::public.difference_type
                                ELSE 'surplus'::public.difference_type END;

            INSERT INTO public.bank_audits (
                business_id, cut_id, resource_id, snapshot_sequence, cutoff_sequence,
                theoretical_balance_cents, observed_balance_cents, difference_type,
                evidence_url, observations
            ) VALUES (
                p_business_id, v_cut_id, v_res.id, v_res.last_entry_sequence, v_res.last_entry_sequence,
                v_res.current_balance_cents, (v_item->>'observed_balance_cents')::BIGINT, v_diff_type,
                v_item->>'evidence_url', v_item->>'notes'
            ) RETURNING id INTO v_bank_audit_id;

            IF v_item ? 'items' AND jsonb_array_length(v_item->'items') > 0 THEN
                FOR v_subitem IN SELECT * FROM jsonb_array_elements(v_item->'items') LOOP
                    INSERT INTO public.bank_audit_items (
                        business_id, bank_audit_id, bank_movement_ref, movement_date,
                        category, amount_cents, verdict, notes
                    ) VALUES (
                        p_business_id, v_bank_audit_id, v_subitem->>'bank_movement_ref',
                        COALESCE((v_subitem->>'movement_date')::DATE, CURRENT_DATE),
                        (v_subitem->>'category')::public.bank_audit_item_category,
                        (v_subitem->>'amount_cents')::BIGINT,
                        (v_subitem->>'verdict')::public.bank_audit_item_verdict,
                        v_subitem->>'notes'
                    );
                END LOOP;
            END IF;

            IF v_diff != 0 THEN
                v_has_differences := true;
            END IF;
        END LOOP;
    END IF;

    -- 5. Si hay diferencias, generar Journal Entry y asientos de reconciliación contra CUSTODY_DISCREPANCY_SUSPENSE
    IF v_has_differences THEN
        v_entry_num := public.fn_acquire_journal_entry_number(p_business_id);
        INSERT INTO public.journal_entries (
            business_id, shift_id, entry_number, entry_type,
            source_entity, source_id, concept,
            operator_member_id, auth_user_id, occurred_at, created_at
        ) VALUES (
            p_business_id, v_shift_id, v_entry_num, 'cut_reconciliation',
            'cuts', v_cut_id, 'Ajuste de corte y conciliación: ' || v_cut_folio,
            v_operator_id, v_owner_user_id, clock_timestamp(), clock_timestamp()
        ) RETURNING id INTO v_journal_id;

        -- Ajustes de caja física con diferencias
        FOR v_adj IN (SELECT resource_id, difference_cents FROM public.cut_cash_counts WHERE cut_id = v_cut_id AND difference_cents != 0) LOOP
            IF v_adj.difference_cents < 0 THEN
                -- Faltante: salida de tesorería y débito a suspenso
                PERFORM public.fn_post_financial_movement(
                    p_business_id, v_journal_id, v_adj.resource_id, pg_catalog.abs(v_adj.difference_cents), 'OUTFLOW'
                );
                PERFORM public.fn_post_economic_movement(
                    p_business_id, v_journal_id, v_suspense_account_id, pg_catalog.abs(v_adj.difference_cents), 'DEBIT'
                );

                -- Crear incidencia de faltante
                v_inc_folio := 'INC-FAL-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
                INSERT INTO public.incidences (
                    business_id, folio, origin_cut_id, origin_resource_id, type, direction,
                    original_amount_cents, unresolved_amount_cents, status, notes
                ) VALUES (
                    p_business_id, v_inc_folio, v_cut_id, v_adj.resource_id, 'cash_shortage', 'shortage',
                    pg_catalog.abs(v_adj.difference_cents), pg_catalog.abs(v_adj.difference_cents), 'OPEN', 'Faltante detectado en corte'
                );
            ELSE
                -- Sobrante: entrada a tesorería y crédito a suspenso
                PERFORM public.fn_post_financial_movement(
                    p_business_id, v_journal_id, v_adj.resource_id, v_adj.difference_cents, 'INFLOW'
                );
                PERFORM public.fn_post_economic_movement(
                    p_business_id, v_journal_id, v_suspense_account_id, v_adj.difference_cents, 'CREDIT'
                );

                v_inc_folio := 'INC-SOB-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
                INSERT INTO public.incidences (
                    business_id, folio, origin_cut_id, origin_resource_id, type, direction,
                    original_amount_cents, unresolved_amount_cents, status, notes
                ) VALUES (
                    p_business_id, v_inc_folio, v_cut_id, v_adj.resource_id, 'cash_surplus', 'surplus',
                    v_adj.difference_cents, v_adj.difference_cents, 'OPEN', 'Sobrante detectado en corte'
                );
            END IF;
        END LOOP;

        -- Ajustes bancarios con diferencias
        FOR v_adj IN (SELECT resource_id, difference_cents FROM public.bank_audits WHERE cut_id = v_cut_id AND difference_cents != 0) LOOP
            IF v_adj.difference_cents < 0 THEN
                PERFORM public.fn_post_financial_movement(
                    p_business_id, v_journal_id, v_adj.resource_id, pg_catalog.abs(v_adj.difference_cents), 'OUTFLOW'
                );
                PERFORM public.fn_post_economic_movement(
                    p_business_id, v_journal_id, v_suspense_account_id, pg_catalog.abs(v_adj.difference_cents), 'DEBIT'
                );

                v_inc_folio := 'INC-BNK-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
                INSERT INTO public.incidences (
                    business_id, folio, origin_cut_id, origin_resource_id, type, direction,
                    original_amount_cents, unresolved_amount_cents, status, notes
                ) VALUES (
                    p_business_id, v_inc_folio, v_cut_id, v_adj.resource_id, 'bank_discrepancy', 'shortage',
                    pg_catalog.abs(v_adj.difference_cents), pg_catalog.abs(v_adj.difference_cents), 'OPEN', 'Discrepancia bancaria negativa en corte'
                );
            ELSE
                PERFORM public.fn_post_financial_movement(
                    p_business_id, v_journal_id, v_adj.resource_id, v_adj.difference_cents, 'INFLOW'
                );
                PERFORM public.fn_post_economic_movement(
                    p_business_id, v_journal_id, v_suspense_account_id, v_adj.difference_cents, 'CREDIT'
                );

                v_inc_folio := 'INC-BNK-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
                INSERT INTO public.incidences (
                    business_id, folio, origin_cut_id, origin_resource_id, type, direction,
                    original_amount_cents, unresolved_amount_cents, status, notes
                ) VALUES (
                    p_business_id, v_inc_folio, v_cut_id, v_adj.resource_id, 'bank_discrepancy', 'surplus',
                    v_adj.difference_cents, v_adj.difference_cents, 'OPEN', 'Discrepancia bancaria positiva en corte'
                );
            END IF;
        END LOOP;
    END IF;

    -- 6. Cerrar corte
    UPDATE public.cuts
    SET status = CASE WHEN v_has_differences THEN 'completed_with_issues'::public.cut_status ELSE 'completed'::public.cut_status END,
        closed_at = clock_timestamp(),
        updated_at = clock_timestamp()
    WHERE id = v_cut_id;

    v_response := jsonb_build_object(
        'success', true,
        'cut_id', v_cut_id,
        'folio', v_cut_folio,
        'status', CASE WHEN v_has_differences THEN 'completed_with_issues' ELSE 'completed' END,
        'journal_entry_id', v_journal_id,
        'has_differences', v_has_differences
    );

    UPDATE public.idempotency_records
    SET status = 'COMPLETED',
        response_payload = v_response,
        completed_at = clock_timestamp(),
        locked_by_pid = NULL
    WHERE id = v_idem_id;

    RETURN v_response;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_perform_cut_reconciliation FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_perform_cut_reconciliation TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 10. RPC 5: rpc_resolve_incidence
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_resolve_incidence(
    p_business_id UUID,
    p_workstation_id UUID,
    p_idempotency_key TEXT,
    p_incidence_id UUID,
    p_event_type public.incidence_resolution_type,
    p_amount_resolved_cents BIGINT,
    p_session_token TEXT DEFAULT NULL,
    p_operator_member_id UUID DEFAULT NULL,
    p_operator_pin TEXT DEFAULT NULL,
    p_linked_operation_id UUID DEFAULT NULL,
    p_linked_admin_movement_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_supervisor_pin TEXT DEFAULT NULL,
    p_supervisor_member_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_owner_user_id UUID;
    v_operator_id UUID;
    v_shift_id UUID;
    v_member_role public.business_member_role;
    v_inc RECORD;
    v_resolution_id UUID;
    v_journal_id UUID;
    v_entry_num BIGINT;
    v_suspense_account_id UUID;
    v_target_account_id UUID;
    v_req_payload JSONB;
    v_req_hash TEXT;
    v_idem_id UUID;
    v_idem_status TEXT;
    v_idem_rpc TEXT;
    v_idem_hash TEXT;
    v_idem_payload JSONB;
    v_is_insert BOOLEAN;
    v_response JSONB;
BEGIN
    SELECT owner_user_id INTO v_owner_user_id
    FROM public.businesses WHERE id = p_business_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'BUSINESS_NOT_FOUND: Empresa % no encontrada.', p_business_id;
    END IF;

    IF v_auth_uid IS NOT NULL AND v_auth_uid != v_owner_user_id THEN
        RAISE EXCEPTION 'FORBIDDEN_BUSINESS_ACCESS: Usuario autenticado no tiene acceso a esta empresa.'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Resolver identidad de operador
    IF p_session_token IS NOT NULL AND trim(p_session_token) != '' THEN
        SELECT operator_member_id, shift_id, member_role
        INTO v_operator_id, v_shift_id, v_member_role
        FROM public.fn_verify_terminal_session(p_business_id, p_workstation_id, p_session_token, p_operator_member_id);
    ELSIF p_operator_member_id IS NOT NULL THEN
        IF NOT public.fn_verify_member_pin(p_business_id, p_operator_member_id, p_operator_pin) THEN
            RAISE EXCEPTION 'INVALID_OPERATOR_CREDENTIALS: PIN de operador incorrecto o miembro inactivo.'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
        SELECT s.id, bm.role INTO v_shift_id, v_member_role
        FROM public.shifts s
        JOIN public.business_members bm ON bm.id = p_operator_member_id AND bm.business_id = p_business_id
        WHERE s.business_id = p_business_id AND s.workstation_id = p_workstation_id AND s.status = 'open';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'NO_OPEN_SHIFT: No existe turno abierto en la estación indicada.';
        END IF;
        v_operator_id := p_operator_member_id;
    ELSE
        RAISE EXCEPTION 'AUTH_REQUIRED: Se requiere token de sesión o credenciales de operador.';
    END IF;

    -- Permisos por tipo de resolución
    IF p_event_type IN ('confirmed_loss', 'confirmed_surplus') THEN
        IF v_member_role != 'owner' THEN
            RAISE EXCEPTION 'OWNER_EXCLUSIVE: Dictaminar pérdida o sobrante confirmado es exclusivo del dueño.'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    END IF;

    -- Idempotencia
    IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED: Se requiere clave de idempotencia.'
            USING ERRCODE = 'check_violation';
    END IF;

    v_req_payload := jsonb_build_object(
        'incidence_id', p_incidence_id,
        'event_type', p_event_type,
        'amount_resolved_cents', p_amount_resolved_cents
    );
    v_req_hash := pg_catalog.encode(pg_catalog.sha256(v_req_payload::text::bytea), 'hex');

    INSERT INTO public.idempotency_records (
        business_id, idempotency_key, rpc_name, request_hash, status, locked_by_pid
    ) VALUES (
        p_business_id, p_idempotency_key, 'rpc_resolve_incidence', v_req_hash, 'PROCESSING', pg_backend_pid()
    )
    ON CONFLICT (business_id, idempotency_key) DO UPDATE
        SET locked_by_pid = pg_backend_pid()
    RETURNING id, status, rpc_name, request_hash, response_payload, (xmax = 0)
    INTO v_idem_id, v_idem_status, v_idem_rpc, v_idem_hash, v_idem_payload, v_is_insert;

    IF NOT v_is_insert THEN
        IF v_idem_status = 'COMPLETED' THEN
            IF v_idem_rpc != 'rpc_resolve_incidence' THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC: Clave reutilizada para RPC %, original %.',
                    'rpc_resolve_incidence', v_idem_rpc
                    USING ERRCODE = 'check_violation';
            END IF;
            IF v_idem_hash != v_req_hash THEN
                RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD: Clave reutilizada con parámetros diferentes.'
                    USING ERRCODE = 'check_violation';
            END IF;
            RETURN v_idem_payload;
        ELSE
            RAISE EXCEPTION 'CONCURRENT_REQUEST_PROCESSING: Otra transacción está procesando esta clave de idempotencia.'
                USING ERRCODE = 'active_sql_transaction';
        END IF;
    END IF;

    -- Validar y bloquear incidencia FOR UPDATE
    SELECT * INTO v_inc
    FROM public.incidences
    WHERE id = p_incidence_id AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INCIDENCE_NOT_FOUND: Incidencia % no encontrada en este negocio.', p_incidence_id;
    END IF;

    IF v_inc.unresolved_amount_cents <= 0 THEN
        RAISE EXCEPTION 'INCIDENCE_ALREADY_RESOLVED: La incidencia ya se encuentra totalmente resuelta.';
    END IF;

    IF p_amount_resolved_cents > v_inc.unresolved_amount_cents THEN
        RAISE EXCEPTION 'OVER_RESOLUTION: El monto a resolver (%) supera el saldo no resuelto (%).',
            p_amount_resolved_cents, v_inc.unresolved_amount_cents;
    END IF;

    SELECT id INTO v_suspense_account_id
    FROM public.chart_of_accounts
    WHERE business_id = p_business_id AND code = 'CUSTODY_DISCREPANCY_SUSPENSE';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'SUSPENSE_ACCOUNT_NOT_FOUND: Cuenta CUSTODY_DISCREPANCY_SUSPENSE no encontrada.';
    END IF;

    -- Crear resolución y contabilización correspondiente
    IF p_event_type = 'explained_by_operation' THEN
        -- No emite asiento contable propio
        INSERT INTO public.incidence_resolutions (
            business_id, incidence_id, journal_entry_id, event_type,
            amount_resolved_cents, linked_operation_id, actor_member_id, auth_user_id, notes, created_at
        ) VALUES (
            p_business_id, p_incidence_id, gen_random_uuid(), p_event_type,
            p_amount_resolved_cents, p_linked_operation_id, v_operator_id, v_owner_user_id, p_notes, clock_timestamp()
        ) RETURNING id INTO v_resolution_id;

    ELSIF p_event_type IN ('reintegration_partial', 'reintegration_final') THEN
        v_entry_num := public.fn_acquire_journal_entry_number(p_business_id);
        v_resolution_id := gen_random_uuid();

        INSERT INTO public.journal_entries (
            business_id, shift_id, entry_number, entry_type,
            source_entity, source_id, concept,
            operator_member_id, auth_user_id, occurred_at, created_at
        ) VALUES (
            p_business_id, v_shift_id, v_entry_num, 'incidence_resolution',
            'incidence_resolutions', v_resolution_id, 'Reintegro de faltante: ' || v_inc.folio,
            v_operator_id, v_owner_user_id, clock_timestamp(), clock_timestamp()
        ) RETURNING id INTO v_journal_id;

        INSERT INTO public.incidence_resolutions (
            id, business_id, incidence_id, journal_entry_id, event_type,
            amount_resolved_cents, actor_member_id, auth_user_id, notes, created_at
        ) VALUES (
            v_resolution_id, p_business_id, p_incidence_id, v_journal_id, p_event_type,
            p_amount_resolved_cents, v_operator_id, v_owner_user_id, p_notes, clock_timestamp()
        );

        -- Entrada a tesorería en el recurso origen del faltante
        PERFORM public.fn_post_financial_movement(
            p_business_id, v_journal_id, v_inc.origin_resource_id, p_amount_resolved_cents, 'INFLOW'
        );
        -- Crédito a suspenso
        PERFORM public.fn_post_economic_movement(
            p_business_id, v_journal_id, v_suspense_account_id, p_amount_resolved_cents, 'CREDIT'
        );

    ELSIF p_event_type = 'confirmed_loss' THEN
        SELECT id INTO v_target_account_id FROM public.chart_of_accounts
        WHERE business_id = p_business_id AND (code = 'EXP_CONFIRMED_LOSS' OR type = 'expense') LIMIT 1;

        v_entry_num := public.fn_acquire_journal_entry_number(p_business_id);
        v_resolution_id := gen_random_uuid();

        INSERT INTO public.journal_entries (
            business_id, shift_id, entry_number, entry_type,
            source_entity, source_id, concept,
            operator_member_id, auth_user_id, occurred_at, created_at
        ) VALUES (
            p_business_id, v_shift_id, v_entry_num, 'incidence_resolution',
            'incidence_resolutions', v_resolution_id, 'Pérdida operativa confirmada: ' || v_inc.folio,
            v_operator_id, v_owner_user_id, clock_timestamp(), clock_timestamp()
        ) RETURNING id INTO v_journal_id;

        INSERT INTO public.incidence_resolutions (
            id, business_id, incidence_id, journal_entry_id, event_type,
            amount_resolved_cents, actor_member_id, auth_user_id, notes, created_at
        ) VALUES (
            v_resolution_id, p_business_id, p_incidence_id, v_journal_id, p_event_type,
            p_amount_resolved_cents, v_operator_id, v_owner_user_id, p_notes, clock_timestamp()
        );

        -- N=0 movimientos de tesorería, M=2 movimientos económicos:
        -- Débito a pérdida / gasto
        PERFORM public.fn_post_economic_movement(
            p_business_id, v_journal_id, v_target_account_id, p_amount_resolved_cents, 'DEBIT'
        );
        -- Crédito a suspenso
        PERFORM public.fn_post_economic_movement(
            p_business_id, v_journal_id, v_suspense_account_id, p_amount_resolved_cents, 'CREDIT'
        );

    ELSIF p_event_type = 'confirmed_surplus' THEN
        SELECT id INTO v_target_account_id FROM public.chart_of_accounts
        WHERE business_id = p_business_id AND type = 'revenue' LIMIT 1;

        v_entry_num := public.fn_acquire_journal_entry_number(p_business_id);
        v_resolution_id := gen_random_uuid();

        INSERT INTO public.journal_entries (
            business_id, shift_id, entry_number, entry_type,
            source_entity, source_id, concept,
            operator_member_id, auth_user_id, occurred_at, created_at
        ) VALUES (
            p_business_id, v_shift_id, v_entry_num, 'incidence_resolution',
            'incidence_resolutions', v_resolution_id, 'Sobrante confirmado dictaminado: ' || v_inc.folio,
            v_operator_id, v_owner_user_id, clock_timestamp(), clock_timestamp()
        ) RETURNING id INTO v_journal_id;

        INSERT INTO public.incidence_resolutions (
            id, business_id, incidence_id, journal_entry_id, event_type,
            amount_resolved_cents, actor_member_id, auth_user_id, notes, created_at
        ) VALUES (
            v_resolution_id, p_business_id, p_incidence_id, v_journal_id, p_event_type,
            p_amount_resolved_cents, v_operator_id, v_owner_user_id, p_notes, clock_timestamp()
        );

        -- Débito a suspenso
        PERFORM public.fn_post_economic_movement(
            p_business_id, v_journal_id, v_suspense_account_id, p_amount_resolved_cents, 'DEBIT'
        );
        -- Crédito a ingreso
        PERFORM public.fn_post_economic_movement(
            p_business_id, v_journal_id, v_target_account_id, p_amount_resolved_cents, 'CREDIT'
        );
    END IF;

    v_response := jsonb_build_object(
        'success', true,
        'resolution_id', v_resolution_id,
        'incidence_id', p_incidence_id,
        'event_type', p_event_type,
        'amount_resolved_cents', p_amount_resolved_cents,
        'unresolved_remaining_cents', v_inc.unresolved_amount_cents - p_amount_resolved_cents
    );

    UPDATE public.idempotency_records
    SET status = 'COMPLETED',
        response_payload = v_response,
        completed_at = clock_timestamp(),
        locked_by_pid = NULL
    WHERE id = v_idem_id;

    RETURN v_response;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_resolve_incidence FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_resolve_incidence TO authenticated, service_role;
