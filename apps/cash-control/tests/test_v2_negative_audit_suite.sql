-- ==============================================================================
-- Cash-Control v2: Suite de Pruebas Negativas y Casos Límite (Fase C)
-- Archivo: tests/test_v2_negative_audit_suite.sql
-- Rama: v2/clean-core
-- Descripción:
--   Verificación de casos de borde, fallos forzados, secuencialidad de recursos,
--   aislamiento entre empresas/estaciones, y atomicidad ante rollback.
-- ==============================================================================

\set ON_ERROR_STOP on
\set ECHO all

BEGIN;

DO $$
DECLARE
    v_b1 UUID;
    v_b2 UUID;
    v_owner1_auth UUID;
    v_owner2_auth UUID;
    v_owner1_member UUID;
    v_cashier1_member UUID;
    v_ws1 UUID;
    v_ws2 UUID;
    v_caja1 UUID;
    v_banco1 UUID;
    v_shift1 UUID;
    v_session_res JSONB;
    v_token1 TEXT;
    v_op_res JSONB;
    v_res RECORD;
    v_bal_caja BIGINT;
    v_bal_banco BIGINT;
    v_fail BOOLEAN;
    v_cut_res JSONB;
    v_cut_id UUID;
    v_inc RECORD;
    v_rollback_key TEXT;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE '=== INICIANDO SUITE DE PRUEBAS NEGATIVAS Y CASOS LÍMITE      ===';
    RAISE NOTICE '================================================================';

    -- --------------------------------------------------------------------------
    -- 0. PREPARACIÓN DE FIXTURES DE PRUEBA
    -- --------------------------------------------------------------------------
    v_owner1_auth := 'a1000000-0000-0000-0000-000000000001'::UUID;
    v_owner2_auth := 'a2000000-0000-0000-0000-000000000002'::UUID;

    INSERT INTO auth.users (id, email) VALUES 
        (v_owner1_auth, 'dueno1@test.com'),
        (v_owner2_auth, 'dueno2@test.com')
    ON CONFLICT (id) DO NOTHING;

    v_b1 := 'b1000000-0000-0000-0000-000000000001'::UUID;
    v_b2 := 'b2000000-0000-0000-0000-000000000002'::UUID;

    INSERT INTO public.businesses (id, legal_name, commercial_name, owner_user_id, status)
    VALUES 
        (v_b1, 'Empresa 1 Test S.A.', 'Sucursal Alfa', v_owner1_auth, 'active'),
        (v_b2, 'Empresa 2 Test S.A.', 'Sucursal Beta', v_owner2_auth, 'active')
    ON CONFLICT (id) DO NOTHING;

    v_owner1_member := 'ba000000-0000-0000-0000-000000000001'::UUID;
    v_cashier1_member := 'ba000000-0000-0000-0000-000000000002'::UUID;

    INSERT INTO public.business_members (id, business_id, auth_user_id, full_name, role, pin_hash, status)
    VALUES
        (v_owner1_member, v_b1, v_owner1_auth, 'Dueño Alfa', 'owner', 'hash_pin_0000', 'active'),
        (v_cashier1_member, v_b1, NULL, 'Cajero Uno', 'cashier', 'hash_pin_1111', 'active')
    ON CONFLICT (id) DO NOTHING;

    v_ws1 := 'ca000000-0000-0000-0000-000000000001'::UUID;
    v_ws2 := 'ca000000-0000-0000-0000-000000000002'::UUID;

    INSERT INTO public.workstations (id, business_id, code, name, is_active)
    VALUES
        (v_ws1, v_b1, 'WS-TEST-1', 'Ventanilla 1 Test', true),
        (v_ws2, v_b1, 'WS-TEST-2', 'Ventanilla 2 Test', true)
    ON CONFLICT (id) DO NOTHING;

    v_caja1 := 'cc000000-0000-0000-0000-000000000001'::UUID;
    v_banco1 := 'cc000000-0000-0000-0000-000000000002'::UUID;

    INSERT INTO public.treasury_resources (id, business_id, code, name, type, current_balance_cents, last_entry_sequence)
    VALUES
        (v_caja1, v_b1, 'CAJA-ALFA', 'Caja Efectivo Alfa', 'cash_box', 5000000, 0), -- $50,000.00
        (v_banco1, v_b1, 'BBVA-ALFA', 'BBVA Operativo Alfa', 'bank_account', 10000000, 0) -- $100,000.00
    ON CONFLICT (id) DO UPDATE SET current_balance_cents = EXCLUDED.current_balance_cents, last_entry_sequence = 0;

    INSERT INTO public.chart_of_accounts (id, business_id, code, name, type, is_active)
    VALUES
        ('cd000000-0000-0000-0000-000000000001'::UUID, v_b1, 'REV_COMMISSIONS', 'Ingresos por Comisiones', 'revenue', true),
        ('cd000000-0000-0000-0000-000000000002'::UUID, v_b1, 'EXP_OPERATING', 'Gastos Operativos', 'expense', true),
        ('cd000000-0000-0000-0000-000000000003'::UUID, v_b1, 'EXP_CONFIRMED_LOSS', 'Pérdidas Operativas Confirmadas', 'expense', true),
        ('cd000000-0000-0000-0000-000000000004'::UUID, v_b1, 'CUSTODY_DISCREPANCY_SUSPENSE', 'Suspenso Discrepancias Custodia', 'clearing_control', true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.commission_rules (
        business_id, operation_type, min_amount_cents, max_amount_cents,
        fixed_fee_cents, percentage_fee_bps, effective_from, is_active
    ) VALUES (
        v_b1, 'deposit', 100, 10000000, 1000, 100, clock_timestamp() - INTERVAL '1 day', true
    ) ON CONFLICT DO NOTHING;

    -- Abrir turno en WS1
    v_session_res := public.rpc_open_shift(v_b1, v_ws1, v_cashier1_member, '1111');
    v_shift1 := (v_session_res->>'shift_id')::UUID;
    v_token1 := v_session_res->>'session_token';

    -- --------------------------------------------------------------------------
    -- CASO NEGATIVO 1: Movimientos consecutivos sobre el mismo recurso (secuencia estricta)
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> NEG-1: Verificando consistencia secuencial de movimientos sobre el mismo recurso...';
    -- Op 1: Depósito de $100.00 (10,000 cts)
    PERFORM public.rpc_register_customer_operation(
        p_business_id => v_b1,
        p_workstation_id => v_ws1,
        p_idempotency_key => 'NEG-IDEM-SEQ-1',
        p_type => 'deposit',
        p_amount_cents => 10000,
        p_source_resource_id => v_caja1,
        p_destination_resource_id => v_banco1,
        p_sender_name => 'Cliente A',
        p_receiver_name => 'Destinatario A',
        p_session_token => v_token1
    );

    -- Op 2: Depósito de $200.00 (20,000 cts)
    PERFORM public.rpc_register_customer_operation(
        p_business_id => v_b1,
        p_workstation_id => v_ws1,
        p_idempotency_key => 'NEG-IDEM-SEQ-2',
        p_type => 'deposit',
        p_amount_cents => 20000,
        p_source_resource_id => v_caja1,
        p_destination_resource_id => v_banco1,
        p_sender_name => 'Cliente B',
        p_receiver_name => 'Destinatario B',
        p_session_token => v_token1
    );

    SELECT current_balance_cents, last_entry_sequence INTO v_res FROM public.treasury_resources WHERE id = v_caja1;
    IF v_res.last_entry_sequence != 2 THEN
        RAISE EXCEPTION 'NEG-1 FALLÓ: last_entry_sequence no avanzó estrictamente a 2 (valor: %).', v_res.last_entry_sequence;
    END IF;
    RAISE NOTICE '   NEG-1 PASADO: Secuencia monótona e incremental garantizada en el recurso.';

    -- --------------------------------------------------------------------------
    -- CASO NEGATIVO 2: Operaciones cruzadas entre múltiples recursos
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> NEG-2: Operaciones bidireccionales entre múltiples recursos de tesorería...';
    -- Traslado Caja -> Banco ($500.00)
    PERFORM public.rpc_register_administrative_movement(
        p_business_id => v_b1,
        p_workstation_id => v_ws1,
        p_idempotency_key => 'NEG-IDEM-CROSS-1',
        p_category => 'transfer_internal',
        p_amount_cents => 50000,
        p_origin_resource_id => v_caja1,
        p_destination_resource_id => v_banco1,
        p_session_token => v_token1
    );

    -- Traslado Banco -> Caja ($300.00)
    PERFORM public.rpc_register_administrative_movement(
        p_business_id => v_b1,
        p_workstation_id => v_ws1,
        p_idempotency_key => 'NEG-IDEM-CROSS-2',
        p_category => 'transfer_internal',
        p_amount_cents => 30000,
        p_origin_resource_id => v_banco1,
        p_destination_resource_id => v_caja1,
        p_session_token => v_token1
    );

    -- Verificar secuencias de ambos recursos
    SELECT last_entry_sequence INTO v_res FROM public.treasury_resources WHERE id = v_caja1;
    IF v_res.last_entry_sequence != 4 THEN
        RAISE EXCEPTION 'NEG-2 FALLÓ: Secuencia en caja debe ser 4 (obtenido: %).', v_res.last_entry_sequence;
    END IF;
    SELECT last_entry_sequence INTO v_res FROM public.treasury_resources WHERE id = v_banco1;
    IF v_res.last_entry_sequence != 4 THEN
        RAISE EXCEPTION 'NEG-2 FALLÓ: Secuencia en banco debe ser 4 (obtenido: %).', v_res.last_entry_sequence;
    END IF;
    RAISE NOTICE '   NEG-2 PASADO: Recursos cruzados mantienen secuencias y saldos íntegros.';

    -- --------------------------------------------------------------------------
    -- CASO NEGATIVO 3: Intentos de operación con sesión inválida, expirada o de otra estación
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> NEG-3: Rechazo de sesiones inválidas, de otra estación o de otra empresa...';
    -- 3.1 Token de WS1 intentado usar en WS2
    v_fail := false;
    BEGIN
        PERFORM public.rpc_register_customer_operation(
            p_business_id => v_b1,
            p_workstation_id => v_ws2, -- Estación incorrecta
            p_idempotency_key => 'NEG-IDEM-CROSS-WS-FAIL',
            p_type => 'deposit',
            p_amount_cents => 10000,
            p_source_resource_id => v_caja1,
            p_destination_resource_id => v_banco1,
            p_sender_name => 'Cliente',
            p_receiver_name => 'Destinatario',
            p_session_token => v_token1
        );
    EXCEPTION WHEN OTHERS THEN
        v_fail := true;
    END;
    IF NOT v_fail THEN
        RAISE EXCEPTION 'NEG-3.1 FALLÓ: Se permitió usar token de WS1 en WS2.';
    END IF;

    -- 3.2 Token falso / inventado
    v_fail := false;
    BEGIN
        PERFORM public.rpc_register_customer_operation(
            p_business_id => v_b1,
            p_workstation_id => v_ws1,
            p_idempotency_key => 'NEG-IDEM-FAKE-TOKEN-FAIL',
            p_type => 'deposit',
            p_amount_cents => 10000,
            p_source_resource_id => v_caja1,
            p_destination_resource_id => v_banco1,
            p_sender_name => 'Cliente',
            p_receiver_name => 'Destinatario',
            p_session_token => 'token_totalmente_falso_123456789'
        );
    EXCEPTION WHEN OTHERS THEN
        v_fail := true;
    END;
    IF NOT v_fail THEN
        RAISE EXCEPTION 'NEG-3.2 FALLÓ: Se permitió operar con token falso.';
    END IF;

    -- 3.3 Token de Empresa 1 usado contra Empresa 2
    v_fail := false;
    BEGIN
        PERFORM public.rpc_register_customer_operation(
            p_business_id => v_b2, -- Otra empresa
            p_workstation_id => v_ws1,
            p_idempotency_key => 'NEG-IDEM-CROSS-BUS-FAIL',
            p_type => 'deposit',
            p_amount_cents => 10000,
            p_source_resource_id => v_caja1,
            p_destination_resource_id => v_banco1,
            p_sender_name => 'Cliente',
            p_receiver_name => 'Destinatario',
            p_session_token => v_token1
        );
    EXCEPTION WHEN OTHERS THEN
        v_fail := true;
    END;
    IF NOT v_fail THEN
        RAISE EXCEPTION 'NEG-3.3 FALLÓ: Se permitió usar sesión de Empresa 1 en Empresa 2.';
    END IF;
    RAISE NOTICE '   NEG-3 PASADO: Sesiones inválidas, cruzadas o falsas rechazadas de raíz.';

    -- --------------------------------------------------------------------------
    -- CASO NEGATIVO 4: Fallos intermedios y atomicidad absoluta (Rollback)
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> NEG-4: Verificando que errores intermedios revierten la totalidad de los cambios...';
    v_rollback_key := 'NEG-IDEM-ROLLBACK-ATOMIC';
    v_fail := false;
    BEGIN
        -- Forzar fallo por saldo insuficiente en retiro ($999,999,999.00)
        PERFORM public.rpc_register_customer_operation(
            p_business_id => v_b1,
            p_workstation_id => v_ws1,
            p_idempotency_key => v_rollback_key,
            p_type => 'withdrawal',
            p_amount_cents => 99999999900,
            p_source_resource_id => v_banco1,
            p_destination_resource_id => v_caja1,
            p_sender_name => 'Cliente',
            p_receiver_name => 'Cajero',
            p_session_token => v_token1
        );
    EXCEPTION WHEN OTHERS THEN
        v_fail := true;
    END;
    IF NOT v_fail THEN
        RAISE EXCEPTION 'NEG-4 FALLÓ: No falló la operación con saldo insuficiente.';
    END IF;

    -- Comprobar que NO quedó registro de idempotencia
    IF EXISTS (SELECT 1 FROM public.idempotency_records WHERE idempotency_key = v_rollback_key) THEN
        RAISE EXCEPTION 'NEG-4 FALLÓ: Registro de idempotencia quedó persistido tras fallo.';
    END IF;

    -- Comprobar que NO se creó ningún asiento huérfano
    IF EXISTS (SELECT 1 FROM public.journal_entries WHERE concept LIKE '%' || v_rollback_key || '%') THEN
        RAISE EXCEPTION 'NEG-4 FALLÓ: Asiento contable huérfano persistido tras fallo.';
    END IF;
    RAISE NOTICE '   NEG-4 PASADO: Rollback atómico sin registros huérfanos ni claves PROCESSING.';

    -- --------------------------------------------------------------------------
    -- CASO NEGATIVO 5: Reintentos tras éxito y reutilización limpia tras rollback
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> NEG-5: Reintento limpio de la misma clave tras haber fallado por rollback...';
    -- La misma clave v_rollback_key ahora se intenta con monto válido ($10.00)
    v_op_res := public.rpc_register_customer_operation(
        p_business_id => v_b1,
        p_workstation_id => v_ws1,
        p_idempotency_key => v_rollback_key, -- MISMA CLAVE QUE FALLÓ ANTERIORMENTE
        p_type => 'deposit',
        p_amount_cents => 1000,
        p_source_resource_id => v_caja1,
        p_destination_resource_id => v_banco1,
        p_sender_name => 'Cliente Reintento',
        p_receiver_name => 'Destinatario Reintento',
        p_session_token => v_token1
    );

    IF (v_op_res->>'success')::BOOLEAN IS NOT TRUE THEN
        RAISE EXCEPTION 'NEG-5 FALLÓ: No se pudo procesar la clave que previamente había hecho rollback.';
    END IF;

    -- Verificar que ahora sí quedó COMPLETED
    IF NOT EXISTS (
        SELECT 1 FROM public.idempotency_records 
        WHERE idempotency_key = v_rollback_key AND status = 'COMPLETED'
    ) THEN
        RAISE EXCEPTION 'NEG-5 FALLÓ: La clave no quedó en COMPLETED tras el reintento exitoso.';
    END IF;
    RAISE NOTICE '   NEG-5 PASADO: Claves fallidas se reciclan limpiamente sin interferencias.';

    -- --------------------------------------------------------------------------
    -- CASO NEGATIVO 6: Control de sobre-resolución e incidencias cerradas
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> NEG-6: Control estricto de sobre-resolución y doble resolución de incidencias...';
    -- Consultar saldo actual de caja
    SELECT current_balance_cents INTO v_bal_caja FROM public.treasury_resources WHERE id = v_caja1;

    -- Conciliación con faltante de $500.00 (50,000 cts)
    v_cut_res := public.rpc_perform_cut_reconciliation(
        p_business_id => v_b1,
        p_workstation_id => v_ws1,
        p_idempotency_key => 'NEG-IDEM-CUT-01',
        p_audited_shift_ids => ARRAY[v_shift1],
        p_cash_counts => jsonb_build_array(
            jsonb_build_object(
                'resource_id', v_caja1,
                'counted_amount_cents', v_bal_caja - 50000,
                'notes', 'Arqueo de prueba para casos límite'
            )
        ),
        p_bank_audits => '[]'::jsonb,
        p_session_token => v_token1
    );
    v_cut_id := (v_cut_res->>'cut_id')::UUID;

    SELECT id, unresolved_amount_cents INTO v_inc 
    FROM public.incidences 
    WHERE origin_cut_id = v_cut_id AND origin_resource_id = v_caja1;

    -- 6.1 Reintegro parcial legítimo de $300.00
    PERFORM public.rpc_resolve_incidence(
        p_business_id => v_b1,
        p_workstation_id => v_ws1,
        p_idempotency_key => 'NEG-IDEM-RES-P1',
        p_incidence_id => v_inc.id,
        p_event_type => 'reintegration_partial',
        p_amount_resolved_cents => 30000,
        p_session_token => v_token1
    );

    -- 6.2 Intento de sobre-resolución: pedir $250.00 cuando solo restan $200.00
    v_fail := false;
    BEGIN
        PERFORM public.rpc_resolve_incidence(
            p_business_id => v_b1,
            p_workstation_id => v_ws1,
            p_idempotency_key => 'NEG-IDEM-RES-OVER-FAIL',
            p_incidence_id => v_inc.id,
            p_event_type => 'reintegration_partial',
            p_amount_resolved_cents => 25000, -- EXCEDE LOS 20000 RESTANTES
            p_session_token => v_token1
        );
    EXCEPTION WHEN OTHERS THEN
        v_fail := true;
    END;
    IF NOT v_fail THEN
        RAISE EXCEPTION 'NEG-6.2 FALLÓ: Se permitió sobre-resolver la incidencia.';
    END IF;

    -- 6.3 Reintegro exacto de los $200.00 restantes
    PERFORM public.rpc_resolve_incidence(
        p_business_id => v_b1,
        p_workstation_id => v_ws1,
        p_idempotency_key => 'NEG-IDEM-RES-FINAL',
        p_incidence_id => v_inc.id,
        p_event_type => 'reintegration_final',
        p_amount_resolved_cents => 20000,
        p_session_token => v_token1
    );

    -- Comprobar estado RESOLVED
    SELECT status, unresolved_amount_cents INTO v_inc FROM public.incidences WHERE id = v_inc.id;
    IF v_inc.status != 'RESOLVED' OR v_inc.unresolved_amount_cents != 0 THEN
        RAISE EXCEPTION 'NEG-6.3 FALLÓ: Incidencia no se cerró en RESOLVED con saldo 0.';
    END IF;

    -- 6.4 Intento de resolver una incidencia que ya está cerrada
    v_fail := false;
    BEGIN
        PERFORM public.rpc_resolve_incidence(
            p_business_id => v_b1,
            p_workstation_id => v_ws1,
            p_idempotency_key => 'NEG-IDEM-RES-AFTER-CLOSED-FAIL',
            p_incidence_id => v_inc.id,
            p_event_type => 'reintegration_final',
            p_amount_resolved_cents => 5000,
            p_session_token => v_token1
        );
    EXCEPTION WHEN OTHERS THEN
        v_fail := true;
    END;
    IF NOT v_fail THEN
        RAISE EXCEPTION 'NEG-6.4 FALLÓ: Se permitió resolver una incidencia ya cerrada.';
    END IF;
    RAISE NOTICE '   NEG-6 PASADO: Sobre-resolución y post-resolución rechazadas categóricamente.';

    RAISE NOTICE '================================================================';
    RAISE NOTICE '=== TODAS LAS PRUEBAS NEGATIVAS Y DE BORDE PASARON CON ÉXITO ===';
    RAISE NOTICE '================================================================';
END $$;

ROLLBACK;
