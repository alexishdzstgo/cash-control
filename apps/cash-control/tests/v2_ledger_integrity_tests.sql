-- ==============================================================================
-- Cash-Control v2: Suite Reproducible de Pruebas de Integridad Contable
-- Archivo: tests/v2_ledger_integrity_tests.sql
-- Rama: v2/clean-core
-- Propósito: Pruebas unitarias y de integración para validar la inmutabilidad
--            append-only, la validación diferida al COMMIT, la semántica estricta por
--            entry_type / subtipo / status, la reversión fiel de correcciones,
--            la validación de cuentas concretas y la revocación de privilegios.
--
-- NOTA: Diseñado para ejecutarse con psql -v ON_ERROR_STOP=1.
-- Cada prueba negativa confirma que se produjo exactamente la excepción esperada.
-- ==============================================================================

\set ON_ERROR_STOP 1

BEGIN;

DO $$
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE '=== INICIANDO SUITE DE PRUEBAS DE INTEGRIDAD CONTABLE V2 ===';
    RAISE NOTICE '================================================================';
END $$;

-- ------------------------------------------------------------------------------
-- 1. FIXTURES Y DATOS BASE (UUIDs VÁLIDOS RFC 4122)
-- ------------------------------------------------------------------------------

-- Compatibilidad en entornos PostgreSQL aislados / contenedores sin extensión Supabase Auth
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS instance_id uuid;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS aud varchar(255);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS role varchar(255);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email varchar(255);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS encrypted_password varchar(255);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_app_meta_data jsonb;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- 1.1 Usuario dueño en auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
    'a1000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'dueño.test@cashcontrol.internal',
    'mock_pw_hash',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Dueño de Pruebas"}'::jsonb,
    now(),
    now()
)
ON CONFLICT (id) DO NOTHING;

-- 1.2 Empresa de pruebas
INSERT INTO public.businesses (id, legal_name, commercial_name, owner_user_id, status)
VALUES (
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'Cash Control Test S.A. de C.V.',
    'Sucursal Central Test',
    'a1000000-0000-0000-0000-000000000001'::uuid,
    'active'
);

-- 1.3 Miembros del negocio (UUIDs con prefijo ba)
INSERT INTO public.business_members (id, business_id, auth_user_id, full_name, role, pin_hash, status)
VALUES 
(
    'ba000000-0000-0000-0000-000000000001'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'a1000000-0000-0000-0000-000000000001'::uuid,
    'Dueño Administrador',
    'owner',
    NULL,
    'active'
),
(
    'ba000000-0000-0000-0000-000000000002'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    NULL,
    'Cajero Operativo 1',
    'cashier',
    'hash_pin_1234',
    'active'
);

-- 1.4 Estación y turno (UUIDs con prefijo ca y cb)
INSERT INTO public.workstations (id, business_id, code, name, is_active)
VALUES (
    'ca000000-0000-0000-0000-000000000001'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'WS-01',
    'Ventanilla 1 Principal',
    true
);

INSERT INTO public.shifts (id, business_id, workstation_id, folio, status, opened_by_member_id)
VALUES (
    'cb000000-0000-0000-0000-000000000001'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'ca000000-0000-0000-0000-000000000001'::uuid,
    'TURNO-TEST-001',
    'open',
    'ba000000-0000-0000-0000-000000000002'::uuid
);

-- 1.5 Recursos de tesorería (UUIDs con prefijo cc)
INSERT INTO public.treasury_resources (id, business_id, code, name, type, current_balance_cents)
VALUES 
(
    'cc000000-0000-0000-0000-000000000001'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'CAJA-01',
    'Caja Chica Ventanilla 1',
    'cash_box',
    500000
),
(
    'cc000000-0000-0000-0000-000000000002'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'BANCO-BBVA',
    'Cuenta Operativa BBVA',
    'bank_account',
    2000000
);

-- 1.6 Cuentas contables (UUIDs con prefijo cd)
INSERT INTO public.chart_of_accounts (id, business_id, code, name, type)
VALUES 
(
    'cd000000-0000-0000-0000-000000000001'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'REV_COMMISSIONS',
    'Ingresos por Comisión de Servicios',
    'revenue'
),
(
    'cd000000-0000-0000-0000-000000000002'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'CUSTODY_DISCREPANCY_SUSPENSE',
    'Cuenta Transitoria de Descuadres de Custodia',
    'clearing_control'
),
(
    'cd000000-0000-0000-0000-000000000003'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'EXP_CONFIRMED_LOSS',
    'Pérdidas Operativas Confirmadas',
    'expense'
);

-- ------------------------------------------------------------------------------
-- 2. CASOS DE PRUEBA POSITIVOS (CASOS VÁLIDOS)
-- ------------------------------------------------------------------------------

-- CASO 1: customer_operation ordinaria (NORMAL, status=completed)
--         Depósito: entrada $1,050 en caja, salida $1,000 en banco, crédito $50 comisión
DO $$
DECLARE
    v_op_id uuid := 'ce000000-0000-0000-0000-000000000001'::uuid;
    v_journal_id uuid := 'dd000000-0000-0000-0000-000000000001'::uuid;
BEGIN
    RAISE NOTICE '-> TEST 1: customer_operation ordinaria (NORMAL, N=2, M=1)...';

    INSERT INTO public.operations (
        id, business_id, shift_id, folio, type, origin, status, amount_cents, commission_cents,
        sender_name, receiver_name, source_resource_id, destination_resource_id, operator_member_id, auth_user_id
    ) VALUES (
        v_op_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid,
        'OP-DEP-001', 'deposit', 'NORMAL', 'completed', 100000, 5000,
        'Cliente Juan Pérez', 'Comercio Destino',
        'cc000000-0000-0000-0000-000000000001'::uuid, 'cc000000-0000-0000-0000-000000000002'::uuid,
        'ba000000-0000-0000-0000-000000000002'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.journal_entries (
        id, business_id, shift_id, entry_number, entry_type, source_entity, source_id, concept, operator_member_id, auth_user_id
    ) VALUES (
        v_journal_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid,
        1, 'customer_operation', 'operations', v_op_id,
        'Depósito ordinario $1,000 con comisión $50',
        'ba000000-0000-0000-0000-000000000002'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.financial_ledger_entries (
        business_id, journal_entry_id, resource_id, entry_sequence, amount_cents, direction, balance_after_cents
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cc000000-0000-0000-0000-000000000001'::uuid, 1, 105000, 'INFLOW', 605000),
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cc000000-0000-0000-0000-000000000002'::uuid, 1, 100000, 'OUTFLOW', 1900000);

    INSERT INTO public.economic_ledger_entries (
        business_id, journal_entry_id, account_id, amount_cents, direction
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cd000000-0000-0000-0000-000000000001'::uuid, 5000, 'CREDIT');

    PERFORM public.fn_validate_journal_balance(v_journal_id);
    RAISE NOTICE '   TEST 1 PASADO: customer_operation ordinaria validada.';
END $$;

-- CASO 2: administrative_movement transfer_internal (N=2, M=0, salida e ingreso idénticos)
DO $$
DECLARE
    v_adm_id uuid := 'cf000000-0000-0000-0000-000000000001'::uuid;
    v_journal_id uuid := 'dd000000-0000-0000-0000-000000000002'::uuid;
BEGIN
    RAISE NOTICE '-> TEST 2: transfer_internal (N=2, M=0, montos idénticos)...';

    INSERT INTO public.administrative_movements (
        id, business_id, shift_id, folio, category, amount_cents, origin_resource_id, destination_resource_id, operator_member_id, auth_user_id
    ) VALUES (
        v_adm_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid,
        'ADM-TRF-001', 'transfer_internal', 50000,
        'cc000000-0000-0000-0000-000000000001'::uuid, 'cc000000-0000-0000-0000-000000000002'::uuid,
        'ba000000-0000-0000-0000-000000000002'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.journal_entries (
        id, business_id, shift_id, entry_number, entry_type, source_entity, source_id, concept, operator_member_id, auth_user_id
    ) VALUES (
        v_journal_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid,
        2, 'administrative_movement', 'administrative_movements', v_adm_id,
        'Traspaso de caja a banco $500',
        'ba000000-0000-0000-0000-000000000002'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.financial_ledger_entries (
        business_id, journal_entry_id, resource_id, entry_sequence, amount_cents, direction, balance_after_cents
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cc000000-0000-0000-0000-000000000001'::uuid, 2, 50000, 'OUTFLOW', 555000),
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cc000000-0000-0000-0000-000000000002'::uuid, 2, 50000, 'INFLOW', 1950000);

    PERFORM public.fn_validate_journal_balance(v_journal_id);
    RAISE NOTICE '   TEST 2 PASADO: transfer_internal validado con éxito.';
END $$;

-- CASO 3: AUDIT_RECLASSIFICATION (N=0, M=2, DEBIT a CUSTODY_DISCREPANCY_SUSPENSE y CREDIT a REV_COMMISSIONS)
DO $$
DECLARE
    v_op_id uuid := 'ce000000-0000-0000-0000-000000000002'::uuid;
    v_journal_id uuid := 'dd000000-0000-0000-0000-000000000003'::uuid;
BEGIN
    RAISE NOTICE '-> TEST 3: AUDIT_RECLASSIFICATION con cuentas concretas (N=0, M=2)...';

    INSERT INTO public.operations (
        id, business_id, shift_id, folio, type, origin, status, amount_cents, commission_cents,
        sender_name, receiver_name, source_resource_id, destination_resource_id, operator_member_id, auth_user_id
    ) VALUES (
        v_op_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid,
        'OP-REC-001', 'deposit', 'AUDIT_RECLASSIFICATION', 'completed', 30000, 0,
        'Auditoría', 'Comisión Omitida',
        'cc000000-0000-0000-0000-000000000001'::uuid, 'cc000000-0000-0000-0000-000000000002'::uuid,
        'ba000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.journal_entries (
        id, business_id, shift_id, entry_number, entry_type, source_entity, source_id, concept, operator_member_id, auth_user_id
    ) VALUES (
        v_journal_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid,
        3, 'customer_operation', 'operations', v_op_id,
        'Reclasificación de comisión omitida previamente arqueada',
        'ba000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.economic_ledger_entries (
        business_id, journal_entry_id, account_id, amount_cents, direction
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cd000000-0000-0000-0000-000000000002'::uuid, 30000, 'DEBIT'),
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cd000000-0000-0000-0000-000000000001'::uuid, 30000, 'CREDIT');

    PERFORM public.fn_validate_journal_balance(v_journal_id);
    RAISE NOTICE '   TEST 3 PASADO: AUDIT_RECLASSIFICATION validada con éxito.';
END $$;

-- CASO 4: incidence_resolution confirmed_loss (N=0, M=2, DEBIT EXP_CONFIRMED_LOSS, CREDIT CUSTODY_DISCREPANCY_SUSPENSE)
DO $$
DECLARE
    v_inc_id uuid := 'da000000-0000-0000-0000-000000000001'::uuid;
    v_res_id uuid := 'db000000-0000-0000-0000-000000000001'::uuid;
    v_journal_id uuid := 'dd000000-0000-0000-0000-000000000004'::uuid;
BEGIN
    RAISE NOTICE '-> TEST 4: confirmed_loss con cuentas concretas (N=0, M=2)...';

    INSERT INTO public.incidences (
        id, business_id, folio, origin_resource_id, type, direction, original_amount_cents, unresolved_amount_cents, status
    ) VALUES (
        v_inc_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'INC-FLT-001',
        'cc000000-0000-0000-0000-000000000001'::uuid, 'cash_shortage', 'shortage', 10000, 10000, 'OPEN'
    );

    INSERT INTO public.journal_entries (
        id, business_id, shift_id, entry_number, entry_type, source_entity, source_id, concept, operator_member_id, auth_user_id
    ) VALUES (
        v_journal_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid,
        4, 'incidence_resolution', 'incidence_resolutions', v_res_id,
        'Resolución de incidencia: pérdida confirmada $100',
        'ba000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.incidence_resolutions (
        id, business_id, incidence_id, journal_entry_id, event_type, amount_resolved_cents, actor_member_id, auth_user_id
    ) VALUES (
        v_res_id, 'b1000000-0000-0000-0000-000000000001'::uuid, v_inc_id, v_journal_id,
        'confirmed_loss', 10000,
        'ba000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.economic_ledger_entries (
        business_id, journal_entry_id, account_id, amount_cents, direction
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cd000000-0000-0000-0000-000000000003'::uuid, 10000, 'DEBIT'),
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cd000000-0000-0000-0000-000000000002'::uuid, 10000, 'CREDIT');

    PERFORM public.fn_validate_journal_balance(v_journal_id);
    RAISE NOTICE '   TEST 4 PASADO: confirmed_loss validada con éxito.';
END $$;

-- CASO 5: operation_correction fiel (Reversión espejo exacta de TEST 1)
DO $$
DECLARE
    v_orig_op_id uuid := 'ce000000-0000-0000-0000-000000000001'::uuid;
    v_rev_op_id uuid := 'ce000000-0000-0000-0000-000000000099'::uuid;
    v_rep_op_id uuid := 'ce000000-0000-0000-0000-000000000100'::uuid;
    v_corr_id uuid := 'dc000000-0000-0000-0000-000000000001'::uuid;
    v_journal_id uuid := 'dd000000-0000-0000-0000-000000000005'::uuid;
BEGIN
    RAISE NOTICE '-> TEST 5: operation_correction como reversión fiel espejo...';

    INSERT INTO public.operations (
        id, business_id, shift_id, folio, type, origin, status, amount_cents, commission_cents,
        sender_name, receiver_name, source_resource_id, destination_resource_id, operator_member_id, auth_user_id
    ) VALUES 
    (v_rev_op_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid, 'OP-REV-001', 'deposit', 'NORMAL', 'completed', 100000, 5000, 'Reversión', 'Reversión', 'cc000000-0000-0000-0000-000000000001'::uuid, 'cc000000-0000-0000-0000-000000000002'::uuid, 'ba000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid),
    (v_rep_op_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid, 'OP-REP-001', 'deposit', 'NORMAL', 'completed', 100000, 5000, 'Reemplazo', 'Reemplazo', 'cc000000-0000-0000-0000-000000000001'::uuid, 'cc000000-0000-0000-0000-000000000002'::uuid, 'ba000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid);

    INSERT INTO public.operation_corrections (
        id, business_id, original_operation_id, reversal_operation_id, replacement_operation_id, reason, authorized_by_member_id, auth_user_id
    ) VALUES (
        v_corr_id, 'b1000000-0000-0000-0000-000000000001'::uuid,
        v_orig_op_id, v_rev_op_id, v_rep_op_id,
        'Error en datos de receptor',
        'ba000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.journal_entries (
        id, business_id, shift_id, entry_number, entry_type, source_entity, source_id, concept, operator_member_id, auth_user_id
    ) VALUES (
        v_journal_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid,
        5, 'operation_correction', 'operation_corrections', v_corr_id,
        'Reversión espejo de OP-DEP-001',
        'ba000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    -- Líneas financieras con dirección invertida:
    -- Original 1: Caja INFLOW 105,000 -> Reversión: Caja OUTFLOW 105,000
    -- Original 2: Banco OUTFLOW 100,000 -> Reversión: Banco INFLOW 100,000
    INSERT INTO public.financial_ledger_entries (
        business_id, journal_entry_id, resource_id, entry_sequence, amount_cents, direction, balance_after_cents
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cc000000-0000-0000-0000-000000000001'::uuid, 3, 105000, 'OUTFLOW', 450000),
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cc000000-0000-0000-0000-000000000002'::uuid, 3, 100000, 'INFLOW', 2050000);

    -- Línea económica con dirección invertida:
    -- Original: REV_COMMISSIONS CREDIT 5,000 -> Reversión: REV_COMMISSIONS DEBIT 5,000
    INSERT INTO public.economic_ledger_entries (
        business_id, journal_entry_id, account_id, amount_cents, direction
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cd000000-0000-0000-0000-000000000001'::uuid, 5000, 'DEBIT');

    PERFORM public.fn_validate_journal_balance(v_journal_id);
    RAISE NOTICE '   TEST 5 PASADO: Reversión espejo fiel de operation_correction validada.';
END $$;

-- CASO 5B: incidence_resolution confirmed_surplus (N=0, M=2, DEBIT CUSTODY_DISCREPANCY_SUSPENSE, CREDIT cuenta ingreso)
DO $$
DECLARE
    v_inc_id uuid := 'da000000-0000-0000-0000-000000000002'::uuid;
    v_res_id uuid := 'db000000-0000-0000-0000-000000000002'::uuid;
    v_journal_id uuid := 'dd000000-0000-0000-0000-000000000010'::uuid;
BEGIN
    RAISE NOTICE '-> TEST 5B: confirmed_surplus con cuentas e importes concretos (N=0, M=2)...';

    INSERT INTO public.incidences (
        id, business_id, folio, origin_resource_id, type, direction, original_amount_cents, unresolved_amount_cents, status
    ) VALUES (
        v_inc_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'INC-SOB-001',
        'cc000000-0000-0000-0000-000000000001'::uuid, 'cash_surplus', 'surplus', 5000, 5000, 'OPEN'
    );

    INSERT INTO public.journal_entries (
        id, business_id, shift_id, entry_number, entry_type, source_entity, source_id, concept, operator_member_id, auth_user_id
    ) VALUES (
        v_journal_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid,
        10, 'incidence_resolution', 'incidence_resolutions', v_res_id,
        'Resolución de sobrante confirmado $50',
        'ba000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.incidence_resolutions (
        id, business_id, incidence_id, journal_entry_id, event_type, amount_resolved_cents, actor_member_id, auth_user_id
    ) VALUES (
        v_res_id, 'b1000000-0000-0000-0000-000000000001'::uuid, v_inc_id, v_journal_id,
        'confirmed_surplus', 5000,
        'ba000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.economic_ledger_entries (
        business_id, journal_entry_id, account_id, amount_cents, direction
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cd000000-0000-0000-0000-000000000002'::uuid, 5000, 'DEBIT'),
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cd000000-0000-0000-0000-000000000001'::uuid, 5000, 'CREDIT');

    PERFORM public.fn_validate_journal_balance(v_journal_id);
    RAISE NOTICE '   TEST 5B PASADO: confirmed_surplus validada con éxito.';
END $$;

-- CASO 5C: incidence_resolution reintegration_partial (N=1, M=1, INFLOW tesorería y CREDIT CUSTODY_DISCREPANCY_SUSPENSE)
DO $$
DECLARE
    v_inc_id uuid := 'da000000-0000-0000-0000-000000000001'::uuid;
    v_res_id uuid := 'db000000-0000-0000-0000-000000000003'::uuid;
    v_journal_id uuid := 'dd000000-0000-0000-0000-000000000011'::uuid;
BEGIN
    RAISE NOTICE '-> TEST 5C: reintegration_partial con tesorería y cuenta suspenso (N=1, M=1)...';

    INSERT INTO public.journal_entries (
        id, business_id, shift_id, entry_number, entry_type, source_entity, source_id, concept, operator_member_id, auth_user_id
    ) VALUES (
        v_journal_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid,
        11, 'incidence_resolution', 'incidence_resolutions', v_res_id,
        'Reintegro parcial de faltante por $25',
        'ba000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.incidence_resolutions (
        id, business_id, incidence_id, journal_entry_id, event_type, amount_resolved_cents, actor_member_id, auth_user_id
    ) VALUES (
        v_res_id, 'b1000000-0000-0000-0000-000000000001'::uuid, v_inc_id, v_journal_id,
        'reintegration_partial', 2500,
        'ba000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.financial_ledger_entries (
        business_id, journal_entry_id, resource_id, entry_sequence, amount_cents, direction, balance_after_cents
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cc000000-0000-0000-0000-000000000001'::uuid, 6, 2500, 'INFLOW', 452500);

    INSERT INTO public.economic_ledger_entries (
        business_id, journal_entry_id, account_id, amount_cents, direction
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cd000000-0000-0000-0000-000000000002'::uuid, 2500, 'CREDIT');

    PERFORM public.fn_validate_journal_balance(v_journal_id);
    RAISE NOTICE '   TEST 5C PASADO: reintegration_partial validada con éxito.';
END $$;

-- ------------------------------------------------------------------------------
-- 3. CASOS DE PRUEBA NEGATIVOS (VERIFICACIÓN DE RECHAZO EXACTO)
-- ------------------------------------------------------------------------------

-- CASO 6: Rechazo a transfer_internal con montos desiguales entre salida y entrada
DO $$
DECLARE
    v_adm_id uuid := 'cf000000-0000-0000-0000-000000000002'::uuid;
    v_journal_id uuid := 'dd000000-0000-0000-0000-000000000006'::uuid;
    v_caught boolean := false;
BEGIN
    RAISE NOTICE '-> TEST 6: Probando rechazo de transfer_internal con montos desiguales...';

    INSERT INTO public.administrative_movements (
        id, business_id, shift_id, folio, category, amount_cents, origin_resource_id, destination_resource_id, operator_member_id, auth_user_id
    ) VALUES (
        v_adm_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid,
        'ADM-TRF-BAD', 'transfer_internal', 50000,
        'cc000000-0000-0000-0000-000000000001'::uuid, 'cc000000-0000-0000-0000-000000000002'::uuid,
        'ba000000-0000-0000-0000-000000000002'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.journal_entries (
        id, business_id, shift_id, entry_number, entry_type, source_entity, source_id, concept, operator_member_id, auth_user_id
    ) VALUES (
        v_journal_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid,
        6, 'administrative_movement', 'administrative_movements', v_adm_id,
        'Traspaso con salida 500 y entrada 400',
        'ba000000-0000-0000-0000-000000000002'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.financial_ledger_entries (
        business_id, journal_entry_id, resource_id, entry_sequence, amount_cents, direction, balance_after_cents
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cc000000-0000-0000-0000-000000000001'::uuid, 4, 50000, 'OUTFLOW', 400000),
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cc000000-0000-0000-0000-000000000002'::uuid, 4, 40000, 'INFLOW', 2090000);

    BEGIN
        PERFORM public.fn_validate_journal_balance(v_journal_id);
    EXCEPTION WHEN integrity_constraint_violation THEN
        v_caught := true;
        RAISE NOTICE '   TEST 6 PASADO: Rechazado correctamente por montos de traslado desiguales.';
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'FALLO: Se permitió un traslado interno con salida y entrada desiguales.';
    END IF;
END $$;

-- CASO 7: Rechazo a customer_operation con status = 'cancelled'
DO $$
DECLARE
    v_op_id uuid := 'ce000000-0000-0000-0000-000000000007'::uuid;
    v_journal_id uuid := 'dd000000-0000-0000-0000-000000000007'::uuid;
    v_caught boolean := false;
BEGIN
    RAISE NOTICE '-> TEST 7: Probando rechazo de customer_operation en estado cancelled...';

    INSERT INTO public.operations (
        id, business_id, shift_id, folio, type, origin, status, amount_cents, commission_cents,
        sender_name, receiver_name, source_resource_id, destination_resource_id, operator_member_id, auth_user_id
    ) VALUES (
        v_op_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid,
        'OP-CAN-001', 'deposit', 'NORMAL', 'cancelled', 50000, 2000,
        'Cancelado', 'Cancelado', 'cc000000-0000-0000-0000-000000000001'::uuid, 'cc000000-0000-0000-0000-000000000002'::uuid,
        'ba000000-0000-0000-0000-000000000002'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.journal_entries (
        id, business_id, shift_id, entry_number, entry_type, source_entity, source_id, concept, operator_member_id, auth_user_id
    ) VALUES (
        v_journal_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid,
        7, 'customer_operation', 'operations', v_op_id,
        'Intento de asentar operación cancelada',
        'ba000000-0000-0000-0000-000000000002'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.financial_ledger_entries (
        business_id, journal_entry_id, resource_id, entry_sequence, amount_cents, direction, balance_after_cents
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cc000000-0000-0000-0000-000000000001'::uuid, 5, 52000, 'INFLOW', 452000),
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cc000000-0000-0000-0000-000000000002'::uuid, 5, 50000, 'OUTFLOW', 2040000);

    INSERT INTO public.economic_ledger_entries (
        business_id, journal_entry_id, account_id, amount_cents, direction
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'cd000000-0000-0000-0000-000000000001'::uuid, 2000, 'CREDIT');

    BEGIN
        PERFORM public.fn_validate_journal_balance(v_journal_id);
    EXCEPTION WHEN integrity_constraint_violation THEN
        v_caught := true;
        RAISE NOTICE '   TEST 7 PASADO: Rechazada exitosamente por estado cancelled.';
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'FALLO: Se permitió asentar una operación cancelada.';
    END IF;
END $$;

-- CASO 7B: Rechazo de doble reversión para el mismo asiento original
DO $$
DECLARE
    v_orig_op_id uuid := 'ce000000-0000-0000-0000-000000000001'::uuid;
    v_rev2_op_id uuid := 'ce000000-0000-0000-0000-000000000199'::uuid;
    v_rep2_op_id uuid := 'ce000000-0000-0000-0000-000000000200'::uuid;
    v_corr2_id uuid := 'dc000000-0000-0000-0000-000000000002'::uuid;
    v_journal2_id uuid := 'dd000000-0000-0000-0000-000000000012'::uuid;
    v_caught boolean := false;
BEGIN
    RAISE NOTICE '-> TEST 7B: Probando rechazo de doble reversión sobre el mismo asiento original...';

    INSERT INTO public.operations (
        id, business_id, shift_id, folio, type, origin, status, amount_cents, commission_cents,
        sender_name, receiver_name, source_resource_id, destination_resource_id, operator_member_id, auth_user_id
    ) VALUES 
    (v_rev2_op_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid, 'OP-REV-002', 'deposit', 'NORMAL', 'completed', 100000, 5000, 'Reversión Duplicada', 'Reversión Duplicada', 'cc000000-0000-0000-0000-000000000001'::uuid, 'cc000000-0000-0000-0000-000000000002'::uuid, 'ba000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid),
    (v_rep2_op_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid, 'OP-REP-002', 'deposit', 'NORMAL', 'completed', 100000, 5000, 'Reemplazo 2', 'Reemplazo 2', 'cc000000-0000-0000-0000-000000000001'::uuid, 'cc000000-0000-0000-0000-000000000002'::uuid, 'ba000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid);

    BEGIN
        INSERT INTO public.operation_corrections (
            id, business_id, original_operation_id, reversal_operation_id, replacement_operation_id, reason, authorized_by_member_id, auth_user_id
        ) VALUES (
            v_corr2_id, 'b1000000-0000-0000-0000-000000000001'::uuid,
            v_orig_op_id, v_rev2_op_id, v_rep2_op_id,
            'Segundo intento indebido de reversión de la misma operación',
            'ba000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
        );

        INSERT INTO public.journal_entries (
            id, business_id, shift_id, entry_number, entry_type, source_entity, source_id, concept, operator_member_id, auth_user_id
        ) VALUES (
            v_journal2_id, 'b1000000-0000-0000-0000-000000000001'::uuid, 'cb000000-0000-0000-0000-000000000001'::uuid,
            12, 'operation_correction', 'operation_corrections', v_corr2_id,
            'Intento ilegal de segunda reversión',
            'ba000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid
        );

        INSERT INTO public.financial_ledger_entries (
            business_id, journal_entry_id, resource_id, entry_sequence, amount_cents, direction, balance_after_cents
        ) VALUES 
        ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal2_id, 'cc000000-0000-0000-0000-000000000001'::uuid, 7, 105000, 'OUTFLOW', 347500),
        ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal2_id, 'cc000000-0000-0000-0000-000000000002'::uuid, 7, 100000, 'INFLOW', 2150000);

        INSERT INTO public.economic_ledger_entries (
            business_id, journal_entry_id, account_id, amount_cents, direction
        ) VALUES 
        ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal2_id, 'cd000000-0000-0000-0000-000000000001'::uuid, 5000, 'DEBIT');

        PERFORM public.fn_validate_journal_balance(v_journal2_id);
    EXCEPTION 
        WHEN unique_violation THEN
            v_caught := true;
            RAISE NOTICE '   TEST 7B PASADO: Doble reversión rechazada inmediatamente por constraint uq_corrections_original.';
        WHEN integrity_constraint_violation THEN
            v_caught := true;
            RAISE NOTICE '   TEST 7B PASADO: Doble reversión rechazada por validación contable de integridad.';
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'FALLO: Se permitió revertir dos veces el mismo asiento original.';
    END IF;
END $$;

-- CASO 8: Inmutabilidad - Rechazo inmediato de DELETE en journal_entries y ledgers
DO $$
DECLARE
    v_caught_jrn boolean := false;
    v_caught_fin boolean := false;
    v_caught_eco boolean := false;
BEGIN
    RAISE NOTICE '-> TEST 8: Probando disparadores de inmutabilidad ante DELETE...';

    BEGIN
        DELETE FROM public.journal_entries WHERE id = 'dd000000-0000-0000-0000-000000000001'::uuid;
    EXCEPTION WHEN integrity_constraint_violation THEN
        v_caught_jrn := true;
    END;

    BEGIN
        DELETE FROM public.financial_ledger_entries WHERE journal_entry_id = 'dd000000-0000-0000-0000-000000000001'::uuid;
    EXCEPTION WHEN integrity_constraint_violation THEN
        v_caught_fin := true;
    END;

    BEGIN
        DELETE FROM public.economic_ledger_entries WHERE journal_entry_id = 'dd000000-0000-0000-0000-000000000001'::uuid;
    EXCEPTION WHEN integrity_constraint_violation THEN
        v_caught_eco := true;
    END;

    IF v_caught_jrn AND v_caught_fin AND v_caught_eco THEN
        RAISE NOTICE '   TEST 8 PASADO: Los disparadores BEFORE DELETE impiden la destrucción del historial.';
    ELSE
        RAISE EXCEPTION 'FALLO: Se permitió la eliminación de registros contables inmutables.';
    END IF;
END $$;

-- CASO 9: Verificación de Privilegios DDL (service_role y authenticated sin escritura directa)
DO $$
DECLARE
    v_has_insert_service boolean;
    v_has_delete_service boolean;
    v_has_select_auth boolean;
    v_has_exec_func_auth boolean;
BEGIN
    RAISE NOTICE '-> TEST 9: Verificando blindaje de privilegios...';

    SELECT has_table_privilege('service_role', 'public.journal_entries', 'INSERT') INTO v_has_insert_service;
    SELECT has_table_privilege('service_role', 'public.financial_ledger_entries', 'DELETE') INTO v_has_delete_service;
    SELECT has_table_privilege('authenticated', 'public.journal_entries', 'SELECT') INTO v_has_select_auth;
    SELECT has_function_privilege('authenticated', 'public.fn_validate_journal_balance(uuid)', 'EXECUTE') INTO v_has_exec_func_auth;

    IF v_has_insert_service OR v_has_delete_service THEN
        RAISE EXCEPTION 'FALLO: service_role conserva permisos directos de escritura/borrado en ledgers.';
    END IF;

    IF v_has_select_auth THEN
        RAISE EXCEPTION 'FALLO: authenticated conserva acceso de SELECT directo sin RLS.';
    END IF;

    IF v_has_exec_func_auth THEN
        RAISE EXCEPTION 'FALLO: fn_validate_journal_balance es ejecutable por authenticated.';
    END IF;

    RAISE NOTICE '   TEST 9 PASADO: Todos los privilegios DDL están estrictamente blindados.';
END $$;

DO $$
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE '=== TODAS LAS 12 PRUEBAS DE INTEGRIDAD PASARON SATISFACTORIAMENTE ===';
    RAISE NOTICE '================================================================';
END $$;

-- Revertir para mantener la base limpia
ROLLBACK;
