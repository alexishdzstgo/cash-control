-- ==============================================================================
-- Cash-Control v2: Suite Exhaustiva de Pruebas RPC y Sesiones Operativas
-- Archivo: tests/test_v2_rpc_suite.sql
-- Rama: v2/clean-core
-- Descripción:
--   Verificación integral de las 5 RPCs transaccionales, sesiones de terminal,
--   límites operativos, idempotencia, reversión fiel, reconciliación de cortes,
--   resolución de incidencias y aislamiento multi-empresa.
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
    v_manager1_member UUID;
    v_cashier1_member UUID;
    v_cashier2_member UUID;
    v_ws1 UUID;
    v_ws2 UUID;
    v_caja1 UUID;
    v_banco1 UUID;
    v_banco2 UUID;
    v_shift1 UUID;
    v_session_res JSONB;
    v_token1 TEXT;
    v_token2 TEXT;
    v_op_res JSONB;
    v_op_id UUID;
    v_idem_key TEXT;
    v_res RECORD;
    v_bal_caja BIGINT;
    v_bal_banco BIGINT;
    v_cut_res JSONB;
    v_cut_id UUID;
    v_inc_id UUID;
    v_inc RECORD;
    v_corr_res JSONB;
    v_adm_res JSONB;
    v_fail BOOLEAN;
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE '=== INICIANDO SUITE DE PRUEBAS TRANSACCIONALES V2 (FASE C)   ===';
    RAISE NOTICE '================================================================';

    -- --------------------------------------------------------------------------
    -- 0. PREPARACIÓN DE ENTORNO DE PRUEBA Y ENTIDADES MAESTRAS
    -- --------------------------------------------------------------------------
    v_owner1_auth := 'a1000000-0000-0000-0000-000000000001'::UUID;
    v_owner2_auth := 'a2000000-0000-0000-0000-000000000002'::UUID;

    -- Asegurar auth.users
    INSERT INTO auth.users (id, email) VALUES 
        (v_owner1_auth, 'dueno1@test.com'),
        (v_owner2_auth, 'dueno2@test.com')
    ON CONFLICT (id) DO NOTHING;

    -- Empresas
    v_b1 := 'b1000000-0000-0000-0000-000000000001'::UUID;
    v_b2 := 'b2000000-0000-0000-0000-000000000002'::UUID;

    INSERT INTO public.businesses (id, legal_name, commercial_name, owner_user_id, status)
    VALUES 
        (v_b1, 'Empresa 1 Test S.A.', 'Sucursal Alfa', v_owner1_auth, 'active'),
        (v_b2, 'Empresa 2 Test S.A.', 'Sucursal Beta', v_owner2_auth, 'active')
    ON CONFLICT (id) DO NOTHING;

    -- Miembros
    v_owner1_member := 'ba000000-0000-0000-0000-000000000001'::UUID;
    v_cashier1_member := 'ba000000-0000-0000-0000-000000000002'::UUID;
    v_manager1_member := 'ba000000-0000-0000-0000-000000000003'::UUID;
    v_cashier2_member := 'ba000000-0000-0000-0000-000000000004'::UUID;

    INSERT INTO public.business_members (id, business_id, auth_user_id, full_name, role, pin_hash, status)
    VALUES
        (v_owner1_member, v_b1, v_owner1_auth, 'Dueño Alfa', 'owner', 'hash_pin_0000', 'active'),
        (v_cashier1_member, v_b1, NULL, 'Cajero Uno', 'cashier', 'hash_pin_1111', 'active'),
        (v_manager1_member, v_b1, NULL, 'Gerente Alfa', 'manager', 'hash_pin_9999', 'active'),
        (v_cashier2_member, v_b1, NULL, 'Cajero Dos', 'cashier', 'hash_pin_2222', 'active')
    ON CONFLICT (id) DO NOTHING;

    -- Estaciones de trabajo
    v_ws1 := 'ca000000-0000-0000-0000-000000000001'::UUID;
    v_ws2 := 'ca000000-0000-0000-0000-000000000002'::UUID;

    INSERT INTO public.workstations (id, business_id, code, name, is_active)
    VALUES
        (v_ws1, v_b1, 'WS-TEST-1', 'Ventanilla 1 Test', true),
        (v_ws2, v_b1, 'WS-TEST-2', 'Ventanilla 2 Test', true)
    ON CONFLICT (id) DO NOTHING;

    -- Recursos de tesorería
    v_caja1 := 'cc000000-0000-0000-0000-000000000001'::UUID;
    v_banco1 := 'cc000000-0000-0000-0000-000000000002'::UUID;
    v_banco2 := 'cc000000-0000-0000-0000-000000000003'::UUID;

    INSERT INTO public.treasury_resources (id, business_id, code, name, type, current_balance_cents, last_entry_sequence)
    VALUES
        (v_caja1, v_b1, 'CAJA-ALFA', 'Caja Efectivo Alfa', 'cash_box', 5000000, 0), -- $50,000.00
        (v_banco1, v_b1, 'BBVA-ALFA', 'BBVA Operativo Alfa', 'bank_account', 10000000, 0), -- $100,000.00
        (v_banco2, v_b1, 'AZTECA-ALFA', 'Azteca Fondeo Alfa', 'bank_account', 2000000, 0)
    ON CONFLICT (id) DO UPDATE SET current_balance_cents = EXCLUDED.current_balance_cents, last_entry_sequence = 0;

    -- Cuentas de P&L y Control
    INSERT INTO public.chart_of_accounts (id, business_id, code, name, type, is_active)
    VALUES
        ('cd000000-0000-0000-0000-000000000001'::UUID, v_b1, 'REV_COMMISSIONS', 'Ingresos por Comisiones', 'revenue', true),
        ('cd000000-0000-0000-0000-000000000002'::UUID, v_b1, 'EXP_OPERATING', 'Gastos Operativos', 'expense', true),
        ('cd000000-0000-0000-0000-000000000003'::UUID, v_b1, 'EXP_CONFIRMED_LOSS', 'Pérdidas Operativas Confirmadas', 'expense', true),
        ('cd000000-0000-0000-0000-000000000004'::UUID, v_b1, 'CUSTODY_DISCREPANCY_SUSPENSE', 'Suspenso Discrepancias Custodia', 'clearing_control', true),
        ('cd000000-0000-0000-0000-000000000005'::UUID, v_b1, 'EQUITY_OWNER_CAPITAL', 'Capital Aportado por Dueño', 'equity', true)
    ON CONFLICT (id) DO NOTHING;

    -- Reglas de comisiones: depósito 1% ($10 fijo + 100 bps)
    INSERT INTO public.commission_rules (
        business_id, operation_type, min_amount_cents, max_amount_cents,
        fixed_fee_cents, percentage_fee_bps, effective_from, is_active
    ) VALUES (
        v_b1, 'deposit', 100, 10000000, 1000, 100, clock_timestamp() - INTERVAL '1 day', true
    );

    -- Regla de retiro: sin comisión fija ni porcentaje (comisión = 0)
    INSERT INTO public.commission_rules (
        business_id, operation_type, min_amount_cents, max_amount_cents,
        fixed_fee_cents, percentage_fee_bps, effective_from, is_active
    ) VALUES (
        v_b1, 'withdrawal', 100, 10000000, 0, 0, clock_timestamp() - INTERVAL '1 day', true
    );

    RAISE NOTICE '-> Entorno inicial y catálogos preparados con éxito.';

    -- --------------------------------------------------------------------------
    -- TEST 1: Apertura de Turno y Sesión Operativa (rpc_open_shift)
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> TEST 1: Apertura de turno con PIN inicial y emisión de token...';
    v_session_res := public.rpc_open_shift(v_b1, v_ws1, v_cashier1_member, '1111');
    v_shift1 := (v_session_res->>'shift_id')::UUID;
    v_token1 := v_session_res->>'session_token';

    IF v_shift1 IS NULL OR v_token1 IS NULL THEN
        RAISE EXCEPTION 'TEST 1 FALLÓ: No se generó shift_id o session_token.';
    END IF;

    -- Verificar que la sesión quedó registrada en terminal_operator_sessions
    IF NOT EXISTS (
        SELECT 1 FROM public.terminal_operator_sessions
        WHERE business_id = v_b1 AND workstation_id = v_ws1 AND operator_member_id = v_cashier1_member
          AND revoked_at IS NULL
    ) THEN
        RAISE EXCEPTION 'TEST 1 FALLÓ: No se encontró sesión activa en terminal_operator_sessions.';
    END IF;
    RAISE NOTICE '   TEST 1 PASADO: Turno abierto y token de terminal generado.';

    -- --------------------------------------------------------------------------
    -- TEST 2: Incorporación de Nuevo Cajero (rpc_join_shift / relevo legítimo)
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> TEST 2: Relevo de cajero en la misma estación...';
    v_session_res := public.rpc_join_shift(v_b1, v_ws1, v_cashier2_member, '2222');
    v_token2 := v_session_res->>'session_token';

    -- Comprobar que la sesión previa de cajero 1 fue revocada
    IF NOT EXISTS (
        SELECT 1 FROM public.terminal_operator_sessions
        WHERE business_id = v_b1 AND workstation_id = v_ws1 AND operator_member_id = v_cashier1_member
          AND revoked_at IS NOT NULL AND revoked_reason = 'CASHIER_HANDOVER'
    ) THEN
        RAISE EXCEPTION 'TEST 2 FALLÓ: La sesión anterior del cajero 1 no fue revocada tras el relevo.';
    END IF;

    -- Comprobar que la sesión activa ahora pertenece al cajero 2
    IF NOT EXISTS (
        SELECT 1 FROM public.terminal_operator_sessions
        WHERE business_id = v_b1 AND workstation_id = v_ws1 AND operator_member_id = v_cashier2_member
          AND revoked_at IS NULL
    ) THEN
        RAISE EXCEPTION 'TEST 2 FALLÓ: La nueva sesión del cajero 2 no está activa.';
    END IF;

    -- Intentar operar con el token viejo de cajero 1 debe ser rechazado
    v_fail := false;
    BEGIN
        PERFORM * FROM public.fn_verify_terminal_session(v_b1, v_ws1, v_token1);
    EXCEPTION WHEN OTHERS THEN
        v_fail := true;
    END;
    IF NOT v_fail THEN
        RAISE EXCEPTION 'TEST 2 FALLÓ: Token revocado del cajero 1 sigue siendo aceptado.';
    END IF;
    RAISE NOTICE '   TEST 2 PASADO: Relevo correcto y revocación inmediata de sesión previa.';

    -- --------------------------------------------------------------------------
    -- TEST 3: Detección de Suplantación de Operador (Anti-Spoofing)
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> TEST 3: Probando rechazo de intento de suplantación de operador...';
    v_fail := false;
    BEGIN
        -- Cajero 2 intenta enviar token legítimo pero afirmando ser cajero 1
        PERFORM * FROM public.fn_verify_terminal_session(v_b1, v_ws1, v_token2, v_cashier1_member);
    EXCEPTION WHEN OTHERS THEN
        v_fail := true;
    END;
    IF NOT v_fail THEN
        RAISE EXCEPTION 'TEST 3 FALLÓ: Se permitió suplantar operator_member_id con token de otro cajero.';
    END IF;
    RAISE NOTICE '   TEST 3 PASADO: Detección anti-spoofing validada con éxito.';

    -- --------------------------------------------------------------------------
    -- TEST 4: Operación de Cliente con Comisión (rpc_register_customer_operation)
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> TEST 4: Depósito con comisión calculada por regla...';
    -- Monto: $1,000.00 (100,000 centavos). Regla: $10 (1000 cts) + 1% (1000 cts) = $20 (2000 cts). Total cliente: $1,020.00 (102,000 cts)
    -- Caja (source): entra $1,020.00. Banco (dest): sale $1,000.00.
    v_bal_caja := 5000000;
    v_bal_banco := 10000000;
    v_idem_key := 'IDEM-DEP-001';

    v_op_res := public.rpc_register_customer_operation(
        p_business_id => v_b1,
        p_workstation_id => v_ws1,
        p_idempotency_key => v_idem_key,
        p_type => 'deposit',
        p_amount_cents => 100000,
        p_source_resource_id => v_caja1,
        p_destination_resource_id => v_banco1,
        p_sender_name => 'Juan Pérez Cliente',
        p_receiver_name => 'María López Destinataria',
        p_session_token => v_token2
    );
    v_op_id := (v_op_res->>'operation_id')::UUID;

    -- Verificar respuesta JSON
    IF (v_op_res->>'commission_cents')::BIGINT != 2000 OR (v_op_res->>'total_cents')::BIGINT != 102000 THEN
        RAISE EXCEPTION 'TEST 4 FALLÓ: Comisión calculada incorrecta (esperado 2000, obtenido %).', v_op_res->>'commission_cents';
    END IF;

    -- Verificar saldos materializados en treasury_resources
    SELECT current_balance_cents, last_entry_sequence INTO v_res FROM public.treasury_resources WHERE id = v_caja1;
    IF v_res.current_balance_cents != (v_bal_caja + 102000) OR v_res.last_entry_sequence != 1 THEN
        RAISE EXCEPTION 'TEST 4 FALLÓ: Saldo o secuencia de caja incorrectos (saldo: %, seq: %).', v_res.current_balance_cents, v_res.last_entry_sequence;
    END IF;

    SELECT current_balance_cents, last_entry_sequence INTO v_res FROM public.treasury_resources WHERE id = v_banco1;
    IF v_res.current_balance_cents != (v_bal_banco - 100000) OR v_res.last_entry_sequence != 1 THEN
        RAISE EXCEPTION 'TEST 4 FALLÓ: Saldo o secuencia de banco incorrectos (saldo: %, seq: %).', v_res.current_balance_cents, v_res.last_entry_sequence;
    END IF;

    -- Verificar que se crearon exactamente 2 líneas de tesorería y 1 económica (REV_COMMISSIONS)
    IF (SELECT count(*) FROM public.financial_ledger_entries WHERE journal_entry_id = (v_op_res->>'journal_entry_id')::UUID) != 2 THEN
        RAISE EXCEPTION 'TEST 4 FALLÓ: No se crearon exactamente 2 líneas en financial_ledger_entries.';
    END IF;
    IF (SELECT count(*) FROM public.economic_ledger_entries WHERE journal_entry_id = (v_op_res->>'journal_entry_id')::UUID) != 1 THEN
        RAISE EXCEPTION 'TEST 4 FALLÓ: No se creó exactamente 1 línea en economic_ledger_entries.';
    END IF;
    RAISE NOTICE '   TEST 4 PASADO: Depósito con comisión y asientos contables completos validado.';

    -- --------------------------------------------------------------------------
    -- TEST 5: Idempotencia Exacta (reintento con misma clave y mismo payload)
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> TEST 5: Reintento idempotente idéntico...';
    DECLARE
        v_retry_res JSONB;
    BEGIN
        v_retry_res := public.rpc_register_customer_operation(
            p_business_id => v_b1,
            p_workstation_id => v_ws1,
            p_idempotency_key => v_idem_key,
            p_type => 'deposit',
            p_amount_cents => 100000,
            p_source_resource_id => v_caja1,
            p_destination_resource_id => v_banco1,
            p_sender_name => 'Juan Pérez Cliente',
            p_receiver_name => 'María López Destinataria',
            p_session_token => v_token2
        );

        -- La respuesta debe ser idéntica
        IF (v_retry_res->>'operation_id')::UUID != v_op_id THEN
            RAISE EXCEPTION 'TEST 5 FALLÓ: Idempotencia no devolvió la operación original.';
        END IF;

        -- No deben haber aumentado las secuencias ni modificado los saldos
        SELECT current_balance_cents, last_entry_sequence INTO v_res FROM public.treasury_resources WHERE id = v_caja1;
        IF v_res.last_entry_sequence != 1 THEN
            RAISE EXCEPTION 'TEST 5 FALLÓ: Se ejecutó un segundo movimiento en vez de retornar idempotentemente.';
        END IF;
    END;
    RAISE NOTICE '   TEST 5 PASADO: Idempotencia garantizada sin duplicar movimientos.';

    -- --------------------------------------------------------------------------
    -- TEST 6: Rechazo de Reutilización de Clave con Payload Diferente
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> TEST 6: Probando rechazo de clave con payload alterado...';
    v_fail := false;
    BEGIN
        PERFORM public.rpc_register_customer_operation(
            p_business_id => v_b1,
            p_workstation_id => v_ws1,
            p_idempotency_key => v_idem_key, -- Misma clave
            p_type => 'deposit',
            p_amount_cents => 999999, -- MONTO ALTERADO
            p_source_resource_id => v_caja1,
            p_destination_resource_id => v_banco1,
            p_sender_name => 'Juan Pérez Cliente',
            p_receiver_name => 'María López Destinataria',
            p_session_token => v_token2
        );
    EXCEPTION WHEN OTHERS THEN
        v_fail := true;
    END;
    IF NOT v_fail THEN
        RAISE EXCEPTION 'TEST 6 FALLÓ: Se permitió reutilizar clave de idempotencia con payload diferente.';
    END IF;
    RAISE NOTICE '   TEST 6 PASADO: Rechazo por alteración de payload verificado.';

    -- --------------------------------------------------------------------------
    -- TEST 7: Límites Operativos y Autorización con Supervisor
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> TEST 7: Límites operativos para cajero y escalación a supervisor...';
    -- Configurar límite: retiro máximo para cajero de $500.00 (50,000 centavos)
    INSERT INTO public.business_operational_limits (
        business_id, role, action_type, max_amount_per_event_cents, max_daily_cumulative_cents, requires_supervisor_approval
    ) VALUES (
        v_b1, 'cashier', 'withdrawal', 50000, 1000000, false
    ) ON CONFLICT (business_id, role, action_type) DO UPDATE SET max_amount_per_event_cents = 50000;

    -- Intento de retiro de $800.00 (80,000 centavos) sin supervisor debe fallar
    v_fail := false;
    BEGIN
        PERFORM public.rpc_register_customer_operation(
            p_business_id => v_b1,
            p_workstation_id => v_ws1,
            p_idempotency_key => 'IDEM-WTH-OVERLIMIT-FAIL',
            p_type => 'withdrawal',
            p_amount_cents => 80000,
            p_source_resource_id => v_banco1,
            p_destination_resource_id => v_caja1,
            p_sender_name => 'Cliente Retiro',
            p_receiver_name => 'Cajero Alfa',
            p_session_token => v_token2
        );
    EXCEPTION WHEN OTHERS THEN
        v_fail := true;
    END;
    IF NOT v_fail THEN
        RAISE EXCEPTION 'TEST 7 FALLÓ: Se permitió operación sobre límite sin supervisor.';
    END IF;

    -- Mismo retiro con autorización y PIN de supervisor debe proceder
    PERFORM public.rpc_register_customer_operation(
        p_business_id => v_b1,
        p_workstation_id => v_ws1,
        p_idempotency_key => 'IDEM-WTH-OVERLIMIT-PASS',
        p_type => 'withdrawal',
        p_amount_cents => 80000,
        p_source_resource_id => v_banco1,
        p_destination_resource_id => v_caja1,
        p_sender_name => 'Cliente Retiro',
        p_receiver_name => 'Cajero Alfa',
        p_session_token => v_token2,
        p_supervisor_member_id => v_manager1_member,
        p_supervisor_pin => '9999'
    );
    RAISE NOTICE '   TEST 7 PASADO: Límite operativo rechazado y autorizado con supervisor con éxito.';

    -- --------------------------------------------------------------------------
    -- TEST 8: Movimiento Administrativo y Exclusividad del Dueño
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> TEST 8: Movimientos administrativos y restricción de owner...';
    -- Traslado interno Caja -> Banco ($500.00)
    v_adm_res := public.rpc_register_administrative_movement(
        p_business_id => v_b1,
        p_workstation_id => v_ws1,
        p_idempotency_key => 'IDEM-ADM-TRANSFER-01',
        p_category => 'transfer_internal',
        p_amount_cents => 50000,
        p_origin_resource_id => v_caja1,
        p_destination_resource_id => v_banco1,
        p_session_token => v_token2
    );
    IF (v_adm_res->>'success')::BOOLEAN IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 8 FALLÓ: Error al registrar transfer_internal.';
    END IF;

    -- Intento de retiro de utilidades (owner_drawing_withdrawal) por parte de cajero debe fallar
    v_fail := false;
    BEGIN
        PERFORM public.rpc_register_administrative_movement(
            p_business_id => v_b1,
            p_workstation_id => v_ws1,
            p_idempotency_key => 'IDEM-ADM-DRAWING-FAIL',
            p_category => 'owner_drawing_withdrawal',
            p_amount_cents => 100000,
            p_origin_resource_id => v_caja1,
            p_session_token => v_token2
        );
    EXCEPTION WHEN OTHERS THEN
        v_fail := true;
    END;
    IF NOT v_fail THEN
        RAISE EXCEPTION 'TEST 8 FALLÓ: Se permitió retiro de dueño ejecutado por cajero.';
    END IF;

    -- Retiro de utilidades ejecutado por el Dueño directamente debe ser exitoso
    PERFORM public.rpc_register_administrative_movement(
        p_business_id => v_b1,
        p_workstation_id => v_ws1,
        p_idempotency_key => 'IDEM-ADM-DRAWING-PASS',
        p_category => 'owner_drawing_withdrawal',
        p_amount_cents => 100000,
        p_origin_resource_id => v_caja1,
        p_operator_member_id => v_owner1_member,
        p_operator_pin => '0000'
    );
    RAISE NOTICE '   TEST 8 PASADO: Traslado y exclusividad patrimonial de owner validados.';

    -- --------------------------------------------------------------------------
    -- TEST 9: Corrección de Operación como Reversión Espejo Fiel (rpc_correct_operation)
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> TEST 9: Corrección de operación con reversión espejo y reemplazo...';
    v_corr_res := public.rpc_correct_operation(
        p_business_id => v_b1,
        p_workstation_id => v_ws1,
        p_idempotency_key => 'IDEM-CORR-01',
        p_original_operation_id => v_op_id,
        p_reason => 'Error en monto capturado originalmente por cajero',
        p_replacement_amount_cents => 150000,
        p_replacement_source_resource_id => v_caja1,
        p_replacement_destination_resource_id => v_banco1,
        p_replacement_sender_name => 'Juan Pérez Corregido',
        p_replacement_receiver_name => 'María López Corregida',
        p_session_token => v_token2,
        p_supervisor_member_id => v_manager1_member,
        p_supervisor_pin => '9999'
    );

    IF (v_corr_res->>'success')::BOOLEAN IS NOT TRUE THEN
        RAISE EXCEPTION 'TEST 9 FALLÓ: rpc_correct_operation falló.';
    END IF;

    -- Verificar que la original quedó en estado corrected
    SELECT status INTO v_res FROM public.operations WHERE id = v_op_id;
    IF v_res.status != 'corrected' THEN
        RAISE EXCEPTION 'TEST 9 FALLÓ: La operación original no fue marcada como corrected (estado: %).', v_res.status;
    END IF;

    -- Intentar volver a corregir la misma operación debe fallar inmediatamente
    v_fail := false;
    BEGIN
        PERFORM public.rpc_correct_operation(
            p_business_id => v_b1,
            p_workstation_id => v_ws1,
            p_idempotency_key => 'IDEM-CORR-DOUBLE-FAIL',
            p_original_operation_id => v_op_id,
            p_reason => 'Segunda corrección indebida',
            p_replacement_amount_cents => 150000,
            p_replacement_source_resource_id => v_caja1,
            p_replacement_destination_resource_id => v_banco1,
            p_replacement_sender_name => 'Juan',
            p_replacement_receiver_name => 'María',
            p_session_token => v_token2,
            p_supervisor_member_id => v_manager1_member,
            p_supervisor_pin => '9999'
        );
    EXCEPTION WHEN OTHERS THEN
        v_fail := true;
    END;
    IF NOT v_fail THEN
        RAISE EXCEPTION 'TEST 9 FALLÓ: Se permitió doble corrección sobre la misma operación.';
    END IF;
    RAISE NOTICE '   TEST 9 PASADO: Corrección espejo y protección contra doble reversión validadas.';

    -- --------------------------------------------------------------------------
    -- TEST 10: Conciliación de Corte y Generación de Incidencias (rpc_perform_cut_reconciliation)
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> TEST 10: Corte de caja con faltante y ajuste automático a saldo contado...';
    -- Consultar saldo teórico actual de caja
    SELECT current_balance_cents INTO v_bal_caja FROM public.treasury_resources WHERE id = v_caja1;
    -- Simulamos conteo físico con un faltante de $300.00 (30,000 centavos)
    v_cut_res := public.rpc_perform_cut_reconciliation(
        p_business_id => v_b1,
        p_workstation_id => v_ws1,
        p_idempotency_key => 'IDEM-CUT-01',
        p_audited_shift_ids => ARRAY[v_shift1],
        p_cash_counts => jsonb_build_array(
            jsonb_build_object(
                'resource_id', v_caja1,
                'counted_amount_cents', v_bal_caja - 30000,
                'notes', 'Arqueo de cierre de ventanilla 1 con faltante'
            )
        ),
        p_bank_audits => '[]'::jsonb,
        p_session_token => v_token2,
        p_notes => 'Corte formal vespertino'
    );
    v_cut_id := (v_cut_res->>'cut_id')::UUID;

    -- El saldo de la caja debe coincidir AL CENTAVO con el monto contado (Axioma 1)
    SELECT current_balance_cents INTO v_res FROM public.treasury_resources WHERE id = v_caja1;
    IF v_res.current_balance_cents != (v_bal_caja - 30000) THEN
        RAISE EXCEPTION 'TEST 10 FALLÓ: El saldo de la caja (%) no coincide exactamente con el monto contado (%).',
            v_res.current_balance_cents, (v_bal_caja - 30000);
    END IF;

    -- Verificar que se generó la incidencia de faltante (cash_shortage)
    SELECT id, folio, unresolved_amount_cents, status INTO v_inc
    FROM public.incidences
    WHERE origin_cut_id = v_cut_id AND origin_resource_id = v_caja1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TEST 10 FALLÓ: No se generó la incidencia correspondiente al faltante.';
    END IF;
    IF v_inc.unresolved_amount_cents != 30000 OR v_inc.status != 'OPEN' THEN
        RAISE EXCEPTION 'TEST 10 FALLÓ: Incidencia generada con saldo o estado incorrectos.';
    END IF;
    v_inc_id := v_inc.id;
    RAISE NOTICE '   TEST 10 PASADO: Corte ajustó saldo al contado y creó incidencia de faltante.';

    -- --------------------------------------------------------------------------
    -- TEST 11: Resolución de Incidencia (Reintegro Parcial y Pérdida Confirmada)
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> TEST 11: Resolución de incidencia: reintegro y dictamen de pérdida...';
    -- 11.1 Reintegro parcial de $100.00 (10,000 centavos) depositado a la caja
    PERFORM public.rpc_resolve_incidence(
        p_business_id => v_b1,
        p_workstation_id => v_ws1,
        p_idempotency_key => 'IDEM-RES-REINT-01',
        p_incidence_id => v_inc_id,
        p_event_type => 'reintegration_partial',
        p_amount_resolved_cents => 10000,
        p_session_token => v_token2,
        p_notes => 'Cajero aporta $100 de su dinero para reponer faltante'
    );

    -- Comprobar que la caja subió $100 y la incidencia bajó a $200 pendiente
    SELECT current_balance_cents INTO v_res FROM public.treasury_resources WHERE id = v_caja1;
    IF v_res.current_balance_cents != (v_bal_caja - 30000 + 10000) THEN
        RAISE EXCEPTION 'TEST 11.1 FALLÓ: Saldo de caja no aumentó tras el reintegro.';
    END IF;

    SELECT unresolved_amount_cents, status INTO v_inc FROM public.incidences WHERE id = v_inc_id;
    IF v_inc.unresolved_amount_cents != 20000 OR v_inc.status != 'PARTIALLY_RESOLVED' THEN
        RAISE EXCEPTION 'TEST 11.1 FALLÓ: Saldo no resuelto de incidencia incorrecto tras reintegro parcial.';
    END IF;

    -- 11.2 Intento de sobre-resolución ($250.00 cuando solo restan $200.00) debe fallar
    v_fail := false;
    BEGIN
        PERFORM public.rpc_resolve_incidence(
            p_business_id => v_b1,
            p_workstation_id => v_ws1,
            p_idempotency_key => 'IDEM-RES-OVER-FAIL',
            p_incidence_id => v_inc_id,
            p_event_type => 'reintegration_final',
            p_amount_resolved_cents => 25000,
            p_session_token => v_token2
        );
    EXCEPTION WHEN OTHERS THEN
        v_fail := true;
    END;
    IF NOT v_fail THEN
        RAISE EXCEPTION 'TEST 11.2 FALLÓ: Se permitió sobre-resolver la incidencia por encima del saldo restante.';
    END IF;

    -- 11.3 Dictamen de pérdida confirmada por los $200.00 restantes exclusivo del Dueño
    -- Intento por cajero debe fallar
    v_fail := false;
    BEGIN
        PERFORM public.rpc_resolve_incidence(
            p_business_id => v_b1,
            p_workstation_id => v_ws1,
            p_idempotency_key => 'IDEM-RES-LOSS-CASHIER-FAIL',
            p_incidence_id => v_inc_id,
            p_event_type => 'confirmed_loss',
            p_amount_resolved_cents => 20000,
            p_session_token => v_token2
        );
    EXCEPTION WHEN OTHERS THEN
        v_fail := true;
    END;
    IF NOT v_fail THEN
        RAISE EXCEPTION 'TEST 11.3 FALLÓ: Cajero dictaminó pérdida confirmada (exclusivo de owner).';
    END IF;

    -- Dictamen por el dueño directamente
    PERFORM public.rpc_resolve_incidence(
        p_business_id => v_b1,
        p_workstation_id => v_ws1,
        p_idempotency_key => 'IDEM-RES-LOSS-OWNER-PASS',
        p_incidence_id => v_inc_id,
        p_event_type => 'confirmed_loss',
        p_amount_resolved_cents => 20000,
        p_operator_member_id => v_owner1_member,
        p_operator_pin => '0000',
        p_notes => 'Dueño absorbe $200 restantes como pérdida operativa'
    );

    SELECT unresolved_amount_cents, status INTO v_inc FROM public.incidences WHERE id = v_inc_id;
    IF v_inc.unresolved_amount_cents != 0 OR v_inc.status != 'RESOLVED' THEN
        RAISE EXCEPTION 'TEST 11.3 FALLÓ: La incidencia no quedó completamente resuelta (saldo: %, estado: %).',
            v_inc.unresolved_amount_cents, v_inc.status;
    END IF;
    RAISE NOTICE '   TEST 11 PASADO: Ciclo de vida completo de resolución de incidencias verificado.';

    -- --------------------------------------------------------------------------
    -- TEST 12: Aislamiento Multi-Empresa en RPCs
    -- --------------------------------------------------------------------------
    RAISE NOTICE '-> TEST 12: Validando aislamiento hermético multi-empresa...';
    -- Simular contexto de sesión Supabase del Dueño de Empresa 1
    PERFORM set_config('request.jwt.claim.sub', v_owner1_auth::text, true);

    -- Intentar ejecutar una RPC contra la Empresa 2 debe ser rechazado
    v_fail := false;
    BEGIN
        PERFORM public.rpc_open_shift(v_b2, v_ws1, v_cashier1_member, '1111');
    EXCEPTION WHEN OTHERS THEN
        v_fail := true;
    END;
    IF NOT v_fail THEN
        RAISE EXCEPTION 'TEST 12 FALLÓ: Usuario de Empresa 1 pudo interactuar con Empresa 2.';
    END IF;
    RAISE NOTICE '   TEST 12 PASADO: Aislamiento multi-empresa estricto verificado.';

    RAISE NOTICE '================================================================';
    RAISE NOTICE '=== TODAS LAS PRUEBAS DE LA SUITE RPC PASARON CON ÉXITO      ===';
    RAISE NOTICE '================================================================';
END $$;

ROLLBACK;
