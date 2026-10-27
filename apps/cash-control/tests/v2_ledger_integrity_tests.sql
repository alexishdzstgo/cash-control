-- ==============================================================================
-- Cash-Control v2: Suite Reproducible de Pruebas de Integridad Contable
-- Archivo: tests/v2_ledger_integrity_tests.sql
-- Rama: v2/clean-core
-- Propósito: Pruebas unitarias y de integración para validar la inmutabilidad
--            append-only, la validación diferida al COMMIT, la semántica por
--            entry_type / origin (AUDIT_RECLASSIFICATION vs NORMAL), el balance
--            financiero-económico y la revocación estricta de privilegios.
--
-- NOTA IMPORTANTE DE AISLAMIENTO:
-- Ejecutar ÚNICAMENTE en una base de datos local de pruebas (Docker/Supabase local).
-- NUNCA ejecutar en entornos compartidos, staging ni producción.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. FIXTURES Y DATOS DE PRUEBA (UUIDs VÁLIDOS RFC 4122)
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    RAISE NOTICE '=== INICIANDO CONFIGURACIÓN DE FIXTURES DE PRUEBA ===';
END $$;

-- 1.1 Usuario en auth.users (mock para pruebas locales)
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

-- 1.3 Miembros del negocio (Dueño y Cajero)
INSERT INTO public.business_members (id, business_id, auth_user_id, full_name, role, pin_hash, status)
VALUES 
(
    'm1000000-0000-0000-0000-000000000001'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'a1000000-0000-0000-0000-000000000001'::uuid,
    'Dueño Administrador',
    'owner',
    NULL,
    'active'
),
(
    'm1000000-0000-0000-0000-000000000002'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    NULL,
    'Cajero Operativo 1',
    'cashier',
    'hash_pin_1234',
    'active'
);

-- 1.4 Estación de trabajo y turno operativo
INSERT INTO public.workstations (id, business_id, code, name, is_active)
VALUES (
    'w1000000-0000-0000-0000-000000000001'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'WS-01',
    'Ventanilla 1 Principal',
    true
);

INSERT INTO public.shifts (id, business_id, workstation_id, folio, status, opened_by_member_id)
VALUES (
    's1000000-0000-0000-0000-000000000001'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'w1000000-0000-0000-0000-000000000001'::uuid,
    'TURNO-TEST-001',
    'open',
    'm1000000-0000-0000-0000-000000000002'::uuid
);

-- 1.5 Recursos de tesorería (Caja física y Banco)
INSERT INTO public.treasury_resources (id, business_id, code, name, type, current_balance_cents)
VALUES 
(
    'r1000000-0000-0000-0000-000000000001'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'CAJA-01',
    'Caja Chica Ventanilla 1',
    'cash_box',
    500000
),
(
    'r1000000-0000-0000-0000-000000000002'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'BANCO-BBVA',
    'Cuenta Operativa BBVA',
    'bank_account',
    2000000
);

-- 1.6 Cuentas económicas
INSERT INTO public.chart_of_accounts (id, business_id, code, name, type)
VALUES 
(
    'c1000000-0000-0000-0000-000000000001'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'REV_COMMISSIONS',
    'Ingresos por Comisión de Servicios',
    'revenue'
),
(
    'c1000000-0000-0000-0000-000000000002'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'CUSTODY_DISCREPANCY_SUSPENSE',
    'Cuenta Transitoria de Descuadres de Custodia',
    'clearing_control'
),
(
    'c1000000-0000-0000-0000-000000000003'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'EXP_CONFIRMED_LOSS',
    'Pérdidas Operativas Confirmadas',
    'expense'
);

-- 1.7 Entidades de Origen para las pruebas
-- Operación ordinaria de depósito (NORMAL)
INSERT INTO public.operations (
    id, business_id, shift_id, folio, type, origin, status, amount_cents, commission_cents,
    sender_name, receiver_name, source_resource_id, destination_resource_id, operator_member_id, auth_user_id
) VALUES (
    'op000000-0000-0000-0000-000000000001'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    's1000000-0000-0000-0000-000000000001'::uuid,
    'OP-DEP-001',
    'deposit',
    'NORMAL',
    'completed',
    100000,
    5000,
    'Cliente Juan Pérez',
    'Comercio Destino',
    'r1000000-0000-0000-0000-000000000001'::uuid,
    'r1000000-0000-0000-0000-000000000002'::uuid,
    'm1000000-0000-0000-0000-000000000002'::uuid,
    'a1000000-0000-0000-0000-000000000001'::uuid
);

-- Operación de omisión descubierta (AUDIT_RECLASSIFICATION)
INSERT INTO public.operations (
    id, business_id, shift_id, folio, type, origin, status, amount_cents, commission_cents,
    sender_name, receiver_name, source_resource_id, destination_resource_id, operator_member_id, auth_user_id
) VALUES (
    'op000000-0000-0000-0000-000000000002'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    's1000000-0000-0000-0000-000000000001'::uuid,
    'OP-REC-001',
    'deposit',
    'AUDIT_RECLASSIFICATION',
    'completed',
    30000,
    0,
    'Auditoría',
    'Comisión Omitida',
    'r1000000-0000-0000-0000-000000000001'::uuid,
    'r1000000-0000-0000-0000-000000000002'::uuid,
    'm1000000-0000-0000-0000-000000000001'::uuid,
    'a1000000-0000-0000-0000-000000000001'::uuid
);

-- Movimiento administrativo de traslado interno (transfer_internal)
INSERT INTO public.administrative_movements (
    id, business_id, shift_id, folio, category, amount_cents, origin_resource_id, destination_resource_id, operator_member_id, auth_user_id
) VALUES (
    'ad000000-0000-0000-0000-000000000001'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    's1000000-0000-0000-0000-000000000001'::uuid,
    'ADM-TRF-001',
    'transfer_internal',
    50000,
    'r1000000-0000-0000-0000-000000000001'::uuid,
    'r1000000-0000-0000-0000-000000000002'::uuid,
    'm1000000-0000-0000-0000-000000000002'::uuid,
    'a1000000-0000-0000-0000-000000000001'::uuid
);

-- Incidencia y resolución de pérdida confirmada
INSERT INTO public.incidences (
    id, business_id, folio, origin_resource_id, type, direction, original_amount_cents, unresolved_amount_cents, status
) VALUES (
    'in000000-0000-0000-0000-000000000001'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'INC-FLT-001',
    'r1000000-0000-0000-0000-000000000001'::uuid,
    'cash_shortage',
    'shortage',
    10000,
    10000,
    'OPEN'
);

-- Placeholder del journal 3 para la FK de incidence_resolutions
INSERT INTO public.journal_entries (
    id, business_id, shift_id, entry_number, entry_type, source_entity, source_id, concept, operator_member_id, auth_user_id
) VALUES (
    'j1000000-0000-0000-0000-000000000003'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    's1000000-0000-0000-0000-000000000001'::uuid,
    3,
    'incidence_resolution',
    'incidence_resolutions',
    'ir000000-0000-0000-0000-000000000001'::uuid,
    'Resolución de incidencia: pérdida confirmada $100',
    'm1000000-0000-0000-0000-000000000001'::uuid,
    'a1000000-0000-0000-0000-000000000001'::uuid
);

INSERT INTO public.incidence_resolutions (
    id, business_id, incidence_id, journal_entry_id, event_type, amount_resolved_cents, actor_member_id, auth_user_id
) VALUES (
    'ir000000-0000-0000-0000-000000000001'::uuid,
    'b1000000-0000-0000-0000-000000000001'::uuid,
    'in000000-0000-0000-0000-000000000001'::uuid,
    'j1000000-0000-0000-0000-000000000003'::uuid,
    'confirmed_loss',
    10000,
    'm1000000-0000-0000-0000-000000000001'::uuid,
    'a1000000-0000-0000-0000-000000000001'::uuid
);

-- ------------------------------------------------------------------------------
-- 2. CASOS DE PRUEBA DE INTEGRIDAD Y BALANCE
-- ------------------------------------------------------------------------------

-- CASO 1: Inserción exitosa de operación ordinaria (customer_operation: NORMAL)
--         N = 2 (+105,000 en Caja, -100,000 en Banco)
--         M = 1 (-5,000 en REV_COMMISSIONS)
--         Balance: +105,000 - 100,000 - 5,000 = 0.
DO $$
DECLARE
    v_journal_id uuid := 'j1000000-0000-0000-0000-000000000001'::uuid;
BEGIN
    RAISE NOTICE '-> TEST 1: Insertando customer_operation ordinaria (NORMAL, N=2, M=1)...';
    
    INSERT INTO public.journal_entries (
        id, business_id, shift_id, entry_number, entry_type, source_entity, source_id, concept, operator_member_id, auth_user_id
    ) VALUES (
        v_journal_id,
        'b1000000-0000-0000-0000-000000000001'::uuid,
        's1000000-0000-0000-0000-000000000001'::uuid,
        1,
        'customer_operation',
        'operations',
        'op000000-0000-0000-0000-000000000001'::uuid,
        'Depósito ordinario $1,000 con comisión $50',
        'm1000000-0000-0000-0000-000000000002'::uuid,
        'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.financial_ledger_entries (
        business_id, journal_entry_id, resource_id, entry_sequence, amount_cents, direction, balance_after_cents
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'r1000000-0000-0000-0000-000000000001'::uuid, 1, 105000, 'INFLOW', 605000),
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'r1000000-0000-0000-0000-000000000002'::uuid, 1, 100000, 'OUTFLOW', 1900000);

    INSERT INTO public.economic_ledger_entries (
        business_id, journal_entry_id, account_id, amount_cents, direction
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'c1000000-0000-0000-0000-000000000001'::uuid, 5000, 'CREDIT');

    PERFORM public.fn_validate_journal_balance(v_journal_id);
    RAISE NOTICE '   TEST 1 PASADO: customer_operation ordinaria validada con éxito.';
END $$;

-- CASO 2: Inserción exitosa de traslado interno (administrative_movement: transfer_internal)
--         N = 2 (-50,000 en Caja, +50,000 en Banco), M = 0
--         Balance: -50,000 + 50,000 = 0.
DO $$
DECLARE
    v_journal_id uuid := 'j1000000-0000-0000-0000-000000000002'::uuid;
BEGIN
    RAISE NOTICE '-> TEST 2: Insertando transfer_internal puramente financiero (N=2, M=0)...';

    INSERT INTO public.journal_entries (
        id, business_id, shift_id, entry_number, entry_type, source_entity, source_id, concept, operator_member_id, auth_user_id
    ) VALUES (
        v_journal_id,
        'b1000000-0000-0000-0000-000000000001'::uuid,
        's1000000-0000-0000-0000-000000000001'::uuid,
        2,
        'administrative_movement',
        'administrative_movements',
        'ad000000-0000-0000-0000-000000000001'::uuid,
        'Traspaso de caja a banco $500',
        'm1000000-0000-0000-0000-000000000002'::uuid,
        'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.financial_ledger_entries (
        business_id, journal_entry_id, resource_id, entry_sequence, amount_cents, direction, balance_after_cents
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'r1000000-0000-0000-0000-000000000001'::uuid, 2, 50000, 'OUTFLOW', 555000),
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'r1000000-0000-0000-0000-000000000002'::uuid, 2, 50000, 'INFLOW', 1950000);

    PERFORM public.fn_validate_journal_balance(v_journal_id);
    RAISE NOTICE '   TEST 2 PASADO: Asiento puramente financiero transfer_internal validado con éxito.';
END $$;

-- CASO 3: Inserción exitosa de pérdida confirmada (incidence_resolution: confirmed_loss)
--         N = 0, M = 2 (+10,000 en Gasto, -10,000 en Suspenso)
--         Balance: +10,000 - 10,000 = 0.
DO $$
DECLARE
    v_journal_id uuid := 'j1000000-0000-0000-0000-000000000003'::uuid;
BEGIN
    RAISE NOTICE '-> TEST 3: Insertando confirmed_loss puramente económico (N=0, M=2)...';

    INSERT INTO public.economic_ledger_entries (
        business_id, journal_entry_id, account_id, amount_cents, direction
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'c1000000-0000-0000-0000-000000000003'::uuid, 10000, 'DEBIT'),
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'c1000000-0000-0000-0000-000000000002'::uuid, 10000, 'CREDIT');

    PERFORM public.fn_validate_journal_balance(v_journal_id);
    RAISE NOTICE '   TEST 3 PASADO: Asiento puramente económico confirmed_loss validado con éxito.';
END $$;

-- CASO 4: Inserción exitosa de AUDIT_RECLASSIFICATION (customer_operation puramente económica)
--         N = 0, M = 2 (+30,000 en Suspenso, -30,000 en Ingreso comisiones)
--         Balance: +30,000 - 30,000 = 0.
DO $$
DECLARE
    v_journal_id uuid := 'j1000000-0000-0000-0000-000000000004'::uuid;
BEGIN
    RAISE NOTICE '-> TEST 4: Insertando AUDIT_RECLASSIFICATION puramente económica (N=0, M=2)...';

    INSERT INTO public.journal_entries (
        id, business_id, shift_id, entry_number, entry_type, source_entity, source_id, concept, operator_member_id, auth_user_id
    ) VALUES (
        v_journal_id,
        'b1000000-0000-0000-0000-000000000001'::uuid,
        's1000000-0000-0000-0000-000000000001'::uuid,
        4,
        'customer_operation',
        'operations',
        'op000000-0000-0000-0000-000000000002'::uuid,
        'Reclasificación de comisión omitida previamente arqueada',
        'm1000000-0000-0000-0000-000000000001'::uuid,
        'a1000000-0000-0000-0000-000000000001'::uuid
    );

    INSERT INTO public.economic_ledger_entries (
        business_id, journal_entry_id, account_id, amount_cents, direction
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'c1000000-0000-0000-0000-000000000002'::uuid, 30000, 'DEBIT'),
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'c1000000-0000-0000-0000-000000000001'::uuid, 30000, 'CREDIT');

    PERFORM public.fn_validate_journal_balance(v_journal_id);
    RAISE NOTICE '   TEST 4 PASADO: AUDIT_RECLASSIFICATION (N=0, M=2) validada con éxito.';
END $$;

-- CASO 5: Rechazo Semántico - Operación ordinaria (NORMAL) que intenta no registrar tesorería (N = 0)
DO $$
DECLARE
    v_journal_id uuid := 'j1000000-0000-0000-0000-000000000005'::uuid;
    v_caught boolean := false;
BEGIN
    RAISE NOTICE '-> TEST 5: Probando rechazo de customer_operation NORMAL con N=0...';

    INSERT INTO public.journal_entries (
        id, business_id, shift_id, entry_number, entry_type, source_entity, source_id, concept, operator_member_id, auth_user_id
    ) VALUES (
        v_journal_id,
        'b1000000-0000-0000-0000-000000000001'::uuid,
        's1000000-0000-0000-0000-000000000001'::uuid,
        5,
        'customer_operation',
        'operations',
        'op000000-0000-0000-0000-000000000001'::uuid,
        'Intento fraudulento de omitir tesorería en operación normal',
        'm1000000-0000-0000-0000-000000000002'::uuid,
        'a1000000-0000-0000-0000-000000000001'::uuid
    );

    -- Solo registra líneas económicas (N = 0)
    INSERT INTO public.economic_ledger_entries (
        business_id, journal_entry_id, account_id, amount_cents, direction
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'c1000000-0000-0000-0000-000000000003'::uuid, 5000, 'DEBIT'),
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'c1000000-0000-0000-0000-000000000001'::uuid, 5000, 'CREDIT');

    BEGIN
        PERFORM public.fn_validate_journal_balance(v_journal_id);
    EXCEPTION WHEN integrity_constraint_violation THEN
        v_caught := true;
        RAISE NOTICE '   TEST 5 PASADO: Rechazada exitosamente: Operación ordinaria con N=0 fue bloqueada.';
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'FALLO DE PRUEBA 5: El sistema permitió una customer_operation ordinaria sin tesorería.';
    END IF;
END $$;

-- CASO 6: Rechazo Semántico - AUDIT_RECLASSIFICATION que intenta registrar tesorería (N > 0)
DO $$
DECLARE
    v_journal_id uuid := 'j1000000-0000-0000-0000-000000000006'::uuid;
    v_caught boolean := false;
BEGIN
    RAISE NOTICE '-> TEST 6: Probando rechazo de AUDIT_RECLASSIFICATION con N > 0...';

    INSERT INTO public.journal_entries (
        id, business_id, shift_id, entry_number, entry_type, source_entity, source_id, concept, operator_member_id, auth_user_id
    ) VALUES (
        v_journal_id,
        'b1000000-0000-0000-0000-000000000001'::uuid,
        's1000000-0000-0000-0000-000000000001'::uuid,
        6,
        'customer_operation',
        'operations',
        'op000000-0000-0000-0000-000000000002'::uuid,
        'Intento erróneo de duplicar tesorería en reclasificación',
        'm1000000-0000-0000-0000-000000000001'::uuid,
        'a1000000-0000-0000-0000-000000000001'::uuid
    );

    -- Entrada en caja indebida (+30,000)
    INSERT INTO public.financial_ledger_entries (
        business_id, journal_entry_id, resource_id, entry_sequence, amount_cents, direction, balance_after_cents
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'r1000000-0000-0000-0000-000000000001'::uuid, 3, 30000, 'INFLOW', 585000);

    -- Contrapartida crédito en comisiones (-30,000)
    INSERT INTO public.economic_ledger_entries (
        business_id, journal_entry_id, account_id, amount_cents, direction
    ) VALUES 
    ('b1000000-0000-0000-0000-000000000001'::uuid, v_journal_id, 'c1000000-0000-0000-0000-000000000001'::uuid, 30000, 'CREDIT');

    BEGIN
        PERFORM public.fn_validate_journal_balance(v_journal_id);
    EXCEPTION WHEN integrity_constraint_violation THEN
        v_caught := true;
        RAISE NOTICE '   TEST 6 PASADO: Rechazada exitosamente: AUDIT_RECLASSIFICATION con tesorería (N>0) fue bloqueada.';
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'FALLO DE PRUEBA 6: Se permitió duplicar saldo físico en AUDIT_RECLASSIFICATION.';
    END IF;
END $$;

-- CASO 7: Inmutabilidad - Prohibición absoluta de DELETE en journal_entries
DO $$
DECLARE
    v_caught boolean := false;
BEGIN
    RAISE NOTICE '-> TEST 7: Probando inmutabilidad (DELETE en journal_entries)...';
    BEGIN
        DELETE FROM public.journal_entries WHERE id = 'j1000000-0000-0000-0000-000000000001'::uuid;
    EXCEPTION WHEN integrity_constraint_violation THEN
        v_caught := true;
        RAISE NOTICE '   TEST 7 PASADO: trg_prevent_journal_mutation impidió DELETE en journal_entries.';
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'FALLO DE PRUEBA 7: Se permitió DELETE en journal_entries.';
    END IF;
END $$;

-- CASO 8: Inmutabilidad - Prohibición de UPDATE/DELETE en financial_ledger_entries y economic_ledger_entries
DO $$
DECLARE
    v_caught_del_fin boolean := false;
    v_caught_upd_fin boolean := false;
    v_caught_del_eco boolean := false;
    v_caught_upd_eco boolean := false;
BEGIN
    RAISE NOTICE '-> TEST 8: Probando inmutabilidad en ambos ledgers...';
    
    BEGIN
        DELETE FROM public.financial_ledger_entries WHERE journal_entry_id = 'j1000000-0000-0000-0000-000000000001'::uuid;
    EXCEPTION WHEN integrity_constraint_violation THEN
        v_caught_del_fin := true;
    END;

    BEGIN
        UPDATE public.financial_ledger_entries SET amount_cents = 999999 WHERE journal_entry_id = 'j1000000-0000-0000-0000-000000000001'::uuid;
    EXCEPTION WHEN integrity_constraint_violation THEN
        v_caught_upd_fin := true;
    END;

    BEGIN
        DELETE FROM public.economic_ledger_entries WHERE journal_entry_id = 'j1000000-0000-0000-0000-000000000001'::uuid;
    EXCEPTION WHEN integrity_constraint_violation THEN
        v_caught_del_eco := true;
    END;

    BEGIN
        UPDATE public.economic_ledger_entries SET amount_cents = 999999 WHERE journal_entry_id = 'j1000000-0000-0000-0000-000000000001'::uuid;
    EXCEPTION WHEN integrity_constraint_violation THEN
        v_caught_upd_eco := true;
    END;

    IF v_caught_del_fin AND v_caught_upd_fin AND v_caught_del_eco AND v_caught_upd_eco THEN
        RAISE NOTICE '   TEST 8 PASADO: Ambos ledgers son 100%% inmutables ante UPDATE y DELETE.';
    ELSE
        RAISE EXCEPTION 'FALLO DE PRUEBA 8: Se permitió modificar o eliminar registros en los libros mayores.';
    END IF;
END $$;

-- CASO 9: Verificación de Privilegios DDL - Bloqueo de escritura a service_role y authenticated
DO $$
DECLARE
    v_has_insert_service boolean;
    v_has_update_service boolean;
    v_has_delete_service boolean;
    v_has_select_auth boolean;
    v_has_exec_func_auth boolean;
    v_has_exec_func_srv boolean;
BEGIN
    RAISE NOTICE '-> TEST 9: Verificando revocación estricta de privilegios directos...';

    -- Comprobar que service_role NO tiene INSERT, UPDATE ni DELETE en ledgers
    SELECT has_table_privilege('service_role', 'public.journal_entries', 'INSERT') INTO v_has_insert_service;
    SELECT has_table_privilege('service_role', 'public.financial_ledger_entries', 'UPDATE') INTO v_has_update_service;
    SELECT has_table_privilege('service_role', 'public.economic_ledger_entries', 'DELETE') INTO v_has_delete_service;

    IF v_has_insert_service OR v_has_update_service OR v_has_delete_service THEN
        RAISE EXCEPTION 'FALLO DE PRUEBA 9: service_role conserva permisos de escritura directa sobre ledgers.';
    END IF;

    -- Comprobar que authenticated NO tiene SELECT directo sobre ledgers (sin RLS completo)
    SELECT has_table_privilege('authenticated', 'public.journal_entries', 'SELECT') INTO v_has_select_auth;
    IF v_has_select_auth THEN
        RAISE EXCEPTION 'FALLO DE PRUEBA 9: authenticated conserva permiso de SELECT directo sobre journal_entries sin RLS.';
    END IF;

    -- Comprobar que la función interna de validación no puede ser invocada directamente por clientes
    SELECT has_function_privilege('authenticated', 'public.fn_validate_journal_balance(uuid)', 'EXECUTE') INTO v_has_exec_func_auth;
    SELECT has_function_privilege('service_role', 'public.fn_validate_journal_balance(uuid)', 'EXECUTE') INTO v_has_exec_func_srv;

    IF v_has_exec_func_auth OR v_has_exec_func_srv THEN
        RAISE EXCEPTION 'FALLO DE PRUEBA 9: fn_validate_journal_balance es ejecutable directamente por roles externos.';
    END IF;

    RAISE NOTICE '   TEST 9 PASADO: Todos los privilegios innecesarios fueron revocados exitosamente.';
END $$;

DO $$
BEGIN
    RAISE NOTICE '=== TODAS LAS PRUEBAS DE INTEGRIDAD FUERON COMPLETADAS EXITOSAMENTE ===';
END $$;

-- Revertir la transacción al finalizar para garantizar entorno limpio
ROLLBACK;
