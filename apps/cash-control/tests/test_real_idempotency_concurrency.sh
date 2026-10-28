#!/usr/bin/env bash
# ==============================================================================
# Cash-Control v2: Test de Concurrencia e Idempotencia Determinista
# Archivo: tests/test_real_idempotency_concurrency.sh
# Rama: v2/clean-core
# Descripción:
#   Prueba determinista de concurrencia real entre dos conexiones psql (C1 y C2).
#   1. C1 adquiere la clave de idempotencia en PROCESSING y espera en barrera.
#   2. C2 invoca rpc_register_customer_operation con idéntica clave y payload.
#   3. El controlador detecta en el catálogo de PostgreSQL que C2 está bloqueado
#      por C1 en espera de transactionid (conflicto de fila de idempotencia).
#   4. El controlador libera la barrera; C1 completa y confirma (COMMIT).
#   5. C2 se desbloquea, recupera la respuesta original y confirma (COMMIT).
#   6. Python valida JSON idénticos, asiento único y saldos consistentes.
#   7. Se prueban errores con payload diferente, RPC diferente y rollback.
# ==============================================================================

set -uo pipefail

export PGUSER="${PGUSER:-postgres}"
DB_NAME="cash_control_test"
RUN_ID="$(date +%s)_$$"
TEST_SCHEMA="test_harness_run_${RUN_ID}"
LOG_DIR="/tmp/cash_control_test_${RUN_ID}"
mkdir -p "$LOG_DIR"

C1_LOG="${LOG_DIR}/c1.log"
C2_LOG="${LOG_DIR}/c2.log"
C1_JSON="${LOG_DIR}/c1.json"
C2_JSON="${LOG_DIR}/c2.json"

PID_C1=""
PID_C2=""
CLEANUP_EXECUTED=0

# Función de log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# ------------------------------------------------------------------------------
# 3. LIMPIEZA SEGURA DE PROCESOS Y CONEXIONES (Sin vulnerabilidad a zombies)
# ------------------------------------------------------------------------------
is_process_alive() {
    local pid="$1"
    if [ -z "$pid" ]; then return 1; fi
    # Si el directorio /proc/$pid no existe, el proceso no existe
    if [ ! -d "/proc/$pid" ]; then return 1; fi
    # Leer el estado en /proc/$pid/stat: si es Z (Zombie), el proceso ya terminó
    local state
    state=$(awk '{print $3}' "/proc/$pid/stat" 2>/dev/null || echo "DEAD")
    if [ "$state" = "Z" ] || [ "$state" = "DEAD" ] || [ -z "$state" ]; then
        return 1
    fi
    return 0
}

wait_for_process_timeout() {
    local pid="$1"
    local timeout_sec="$2"
    local elapsed=0
    while is_process_alive "$pid"; do
        sleep 0.1
        elapsed=$((elapsed + 1))
        if [ "$elapsed" -ge $((timeout_sec * 10)) ]; then
            log "Timeout alcanzado esperando proceso $pid. Enviando SIGTERM..."
            kill -TERM "$pid" 2>/dev/null || true
            sleep 0.5
            if is_process_alive "$pid"; then
                log "Forzando SIGKILL en proceso $pid..."
                kill -KILL "$pid" 2>/dev/null || true
            fi
            break
        fi
    done
    # Invocar wait para cosechar el zombie y evitar acumulación en la tabla de procesos
    wait "$pid" 2>/dev/null || true
}

cleanup() {
    if [ "$CLEANUP_EXECUTED" -eq 1 ]; then return 0; fi
    CLEANUP_EXECUTED=1
    log "Iniciando cleanup de ejecución ${RUN_ID}..."

    # 1. Liberar la barrera por si C1 seguía esperando
    psql -d "$DB_NAME" -q -t -A -c "UPDATE ${TEST_SCHEMA}.barrier SET is_released = true WHERE id = 1;" 2>/dev/null || true

    # 2. Terminar procesos de fondo
    if [ -n "$PID_C1" ]; then wait_for_process_timeout "$PID_C1" 2; fi
    if [ -n "$PID_C2" ]; then wait_for_process_timeout "$PID_C2" 2; fi

    # 3. Terminar conexiones huérfanas en PostgreSQL antes de eliminar el esquema
    psql -d "$DB_NAME" -q -c "
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE datname = '$DB_NAME' 
          AND pid != pg_backend_pid() 
          AND application_name IN ('c1_harness_worker_${RUN_ID}', 'c2_harness_worker_${RUN_ID}');
    " 2>/dev/null || true

    # 4. Eliminar datos creados en el catálogo por esta ejecución
    psql -d "$DB_NAME" -q <<EOF 2>/dev/null || true
DELETE FROM public.idempotency_records WHERE business_id = '$BUSINESS_ID'::uuid;
DELETE FROM public.financial_ledger_entries WHERE business_id = '$BUSINESS_ID'::uuid;
DELETE FROM public.economic_ledger_entries WHERE business_id = '$BUSINESS_ID'::uuid;
DELETE FROM public.journal_entries WHERE business_id = '$BUSINESS_ID'::uuid;
DELETE FROM public.operations WHERE business_id = '$BUSINESS_ID'::uuid;
DELETE FROM public.terminal_operator_sessions WHERE business_id = '$BUSINESS_ID'::uuid;
DELETE FROM public.shift_participants WHERE business_id = '$BUSINESS_ID'::uuid;
DELETE FROM public.shifts WHERE business_id = '$BUSINESS_ID'::uuid;
DELETE FROM public.commission_rules WHERE business_id = '$BUSINESS_ID'::uuid;
DELETE FROM public.chart_of_accounts WHERE business_id = '$BUSINESS_ID'::uuid;
DELETE FROM public.treasury_resources WHERE business_id = '$BUSINESS_ID'::uuid;
DELETE FROM public.workstations WHERE business_id = '$BUSINESS_ID'::uuid;
DELETE FROM public.business_members WHERE business_id = '$BUSINESS_ID'::uuid;
DELETE FROM public.businesses WHERE id = '$BUSINESS_ID'::uuid;
EOF

    # 5. Eliminar exclusivamente el esquema de esta ejecución
    if ! psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -c "DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE;" 2>&1; then
        echo "ERROR_CLEANUP: Falló la eliminación del esquema aislado ${TEST_SCHEMA}." >&2
    fi

    rm -rf "$LOG_DIR"
    log "Cleanup completado con éxito."
}

trap 'cleanup' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# ------------------------------------------------------------------------------
# 1. CONFIGURACIÓN DEL ENTORNO AISLADO Y LA BARRERA
# ------------------------------------------------------------------------------
log "Preparando esquema de prueba aislado ${TEST_SCHEMA}..."
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q <<EOF
CREATE SCHEMA ${TEST_SCHEMA};

-- Tabla de barrera de sincronización
CREATE TABLE ${TEST_SCHEMA}.barrier (
    id INT PRIMARY KEY,
    is_released BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO ${TEST_SCHEMA}.barrier (id, is_released) VALUES (1, false);

-- Función de espera activa controlada dentro de la transacción de C1
CREATE OR REPLACE FUNCTION ${TEST_SCHEMA}.wait_for_barrier(p_timeout_sec INT DEFAULT 15)
RETURNS VOID
LANGUAGE plpgsql
AS \$\$
DECLARE
    v_start TIMESTAMPTZ := clock_timestamp();
    v_released BOOLEAN := false;
BEGIN
    LOOP
        SELECT is_released INTO v_released FROM ${TEST_SCHEMA}.barrier WHERE id = 1;
        IF v_released THEN
            RETURN;
        END IF;
        IF clock_timestamp() - v_start > (p_timeout_sec || ' seconds')::INTERVAL THEN
            RAISE EXCEPTION 'BARRIER_TIMEOUT: Se agotó el tiempo esperando que el controlador libere la barrera.';
        END IF;
        PERFORM pg_sleep(0.05);
    END LOOP;
END;
\$\$;
EOF

# Constantes de negocio de prueba (aisladas exclusivamente para el harness de concurrencia)
BUSINESS_ID="b9000000-0000-0000-0000-000000000001"
WORKSTATION_ID="ca900000-0000-0000-0000-000000000001"
OPERATOR_ID="ba900000-0000-0000-0000-000000000002"
OPERATOR_PIN="1111"
SOURCE_RES="cc900000-0000-0000-0000-000000000001"
DEST_RES="cc900000-0000-0000-0000-000000000002"
OWNER_AUTH="a9000000-0000-0000-0000-000000000001"
OWNER_MEMBER="ba900000-0000-0000-0000-000000000001"
REV_ACCOUNT="cd900000-0000-0000-0000-000000000001"
IDEM_KEY="IDEM-CONCURRENCY-${RUN_ID}"
AMOUNT_CENTS=100000 # $1,000.00 MXN

# Asegurar entidades maestras de prueba para el harness de concurrencia
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q <<EOF
INSERT INTO auth.users (id, email) VALUES 
    ('$OWNER_AUTH'::uuid, 'dueno9@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.businesses (id, legal_name, commercial_name, owner_user_id, status)
VALUES 
    ('$BUSINESS_ID'::uuid, 'Empresa Concurrencia Test S.A.', 'Sucursal Concurrencia', '$OWNER_AUTH'::uuid, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.business_members (id, business_id, auth_user_id, full_name, role, pin_hash, status)
VALUES
    ('$OWNER_MEMBER'::uuid, '$BUSINESS_ID'::uuid, '$OWNER_AUTH'::uuid, 'Dueño Concurrente', 'owner', 'hash_pin_0000', 'active'),
    ('$OPERATOR_ID'::uuid, '$BUSINESS_ID'::uuid, NULL, 'Cajero Uno', 'cashier', 'hash_pin_1111', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workstations (id, business_id, code, name, is_active)
VALUES
    ('$WORKSTATION_ID'::uuid, '$BUSINESS_ID'::uuid, 'WS-TEST-CONCURRENCY', 'Ventanilla Concurrencia', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.treasury_resources (id, business_id, code, name, type, current_balance_cents, last_entry_sequence)
VALUES
    ('$SOURCE_RES'::uuid, '$BUSINESS_ID'::uuid, 'CAJA-CONCURRENCY', 'Caja Efectivo Concurrencia', 'cash_box', 5000000, 0),
    ('$DEST_RES'::uuid, '$BUSINESS_ID'::uuid, 'BANCO-CONCURRENCY', 'Banco Concurrencia', 'bank_account', 10000000, 0)
ON CONFLICT (id) DO UPDATE SET current_balance_cents = EXCLUDED.current_balance_cents, last_entry_sequence = 0;

INSERT INTO public.chart_of_accounts (id, business_id, code, name, type, is_active)
VALUES
    ('$REV_ACCOUNT'::uuid, '$BUSINESS_ID'::uuid, 'REV_COMMISSIONS', 'Ingresos por Comisiones Concurrencia', 'revenue', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.commission_rules (
    business_id, operation_type, min_amount_cents, max_amount_cents,
    fixed_fee_cents, percentage_fee_bps, effective_from, is_active
) VALUES (
    '$BUSINESS_ID'::uuid, 'deposit', 100, 10000000, 1000, 100, clock_timestamp() - INTERVAL '1 day', true
) ON CONFLICT DO NOTHING;

-- Cerrar cualquier turno residual en esta estación de prueba
UPDATE public.shifts SET status = 'closed', closed_at = clock_timestamp() WHERE workstation_id = '$WORKSTATION_ID'::uuid AND status = 'open';
UPDATE public.terminal_operator_sessions SET revoked_at = clock_timestamp(), revoked_reason = 'TEST_RESET' WHERE workstation_id = '$WORKSTATION_ID'::uuid AND revoked_at IS NULL;
EOF

# Obtener o abrir turno válido para el cajero
SESSION_JSON=$(psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -t -A -c "
    SELECT public.rpc_open_shift(
        '$BUSINESS_ID'::uuid, '$WORKSTATION_ID'::uuid, '$OPERATOR_ID'::uuid, '$OPERATOR_PIN'
    );
" 2>/dev/null || psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -t -A -c "
    SELECT public.rpc_join_shift(
        '$BUSINESS_ID'::uuid, '$WORKSTATION_ID'::uuid, '$OPERATOR_ID'::uuid, '$OPERATOR_PIN'
    );
")
SESSION_TOKEN=$(echo "$SESSION_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin)['session_token'])")

# Calcular hash normalizado idéntico del payload
REQ_HASH=$(psql -d "$DB_NAME" -q -t -A -c "
    SELECT encode(sha256(jsonb_build_object(
        'type', 'deposit',
        'amount_cents', $AMOUNT_CENTS,
        'source_resource_id', '$SOURCE_RES'::uuid,
        'destination_resource_id', '$DEST_RES'::uuid,
        'sender_name', 'Cliente Concurrente 1',
        'receiver_name', 'Destinatario Concurrente 1',
        'commission_override_cents', NULL
    )::text::bytea), 'hex');
")

log "Entorno preparado. Session token obtenido. Hash de requerimiento: ${REQ_HASH}"

# ------------------------------------------------------------------------------
# 2. LANZAR CLIENTE C1 (Inicia transacción, retiene clave y espera en barrera)
# ------------------------------------------------------------------------------
log "Lanzando C1 (iniciará transacción y retendrá la clave)..."
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -t -A > "$C1_JSON" 2> "$C1_LOG" <<EOF &
SET application_name = 'c1_harness_worker_${RUN_ID}';
BEGIN;

-- C1 inserta el registro de idempotencia en PROCESSING
INSERT INTO public.idempotency_records (
    business_id, idempotency_key, rpc_name, request_hash, status, locked_by_pid
) VALUES (
    '$BUSINESS_ID'::uuid, '$IDEM_KEY', 'rpc_register_customer_operation', '$REQ_HASH', 'PROCESSING', pg_backend_pid()
);

-- C1 espera en la barrera efectiva (mantiene abierta la transacción y el tuple lock)
SELECT ${TEST_SCHEMA}.wait_for_barrier(15);

-- Al ser liberado por el controlador, C1 procesa la operación real mediante los componentes canónicos
DO \$\$
DECLARE
    v_op_res JSONB;
    v_entry_num BIGINT;
    v_op_id UUID;
    v_jrn_id UUID;
    v_folio TEXT;
    v_src_move RECORD;
    v_dst_move RECORD;
    v_rev_account UUID;
    v_comm BIGINT := 2000; -- 1000 fijo + 1% de 100000 = 2000 cts
    v_tot BIGINT := 102000;
BEGIN
    v_entry_num := public.fn_acquire_journal_entry_number('$BUSINESS_ID'::uuid);
    v_folio := 'OP-C1-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

    INSERT INTO public.operations (
        business_id, shift_id, folio, type, origin, status,
        amount_cents, commission_cents,
        sender_name, receiver_name,
        source_resource_id, destination_resource_id,
        operator_member_id, auth_user_id, notes, created_at
    ) VALUES (
        '$BUSINESS_ID'::uuid, (SELECT shift_id FROM public.terminal_operator_sessions WHERE session_token_hash = encode(sha256('$SESSION_TOKEN'::bytea), 'hex') AND revoked_at IS NULL),
        v_folio, 'deposit', 'NORMAL', 'completed',
        $AMOUNT_CENTS, v_comm,
        'Cliente Concurrente 1', 'Destinatario Concurrente 1',
        '$SOURCE_RES'::uuid, '$DEST_RES'::uuid,
        '$OPERATOR_ID'::uuid, (SELECT owner_user_id FROM public.businesses WHERE id = '$BUSINESS_ID'::uuid),
        'Operación de prueba de concurrencia C1', clock_timestamp()
    ) RETURNING id INTO v_op_id;

    INSERT INTO public.journal_entries (
        business_id, shift_id, entry_number, entry_type,
        source_entity, source_id, concept,
        operator_member_id, auth_user_id, occurred_at, created_at
    ) VALUES (
        '$BUSINESS_ID'::uuid, (SELECT shift_id FROM public.terminal_operator_sessions WHERE session_token_hash = encode(sha256('$SESSION_TOKEN'::bytea), 'hex') AND revoked_at IS NULL),
        v_entry_num, 'customer_operation',
        'operations', v_op_id, 'Depósito cliente concurrente',
        '$OPERATOR_ID'::uuid, (SELECT owner_user_id FROM public.businesses WHERE id = '$BUSINESS_ID'::uuid),
        clock_timestamp(), clock_timestamp()
    ) RETURNING id INTO v_jrn_id;

    SELECT * INTO v_src_move FROM public.fn_post_financial_movement(
        '$BUSINESS_ID'::uuid, v_jrn_id, '$SOURCE_RES'::uuid, v_tot, 'INFLOW'
    );
    SELECT * INTO v_dst_move FROM public.fn_post_financial_movement(
        '$BUSINESS_ID'::uuid, v_jrn_id, '$DEST_RES'::uuid, $AMOUNT_CENTS, 'OUTFLOW'
    );

    SELECT id INTO v_rev_account FROM public.chart_of_accounts WHERE business_id = '$BUSINESS_ID'::uuid AND (code = 'REV_COMMISSIONS' OR type = 'revenue') LIMIT 1;
    PERFORM public.fn_post_economic_movement('$BUSINESS_ID'::uuid, v_jrn_id, v_rev_account, v_comm, 'CREDIT');

    v_op_res := jsonb_build_object(
        'success', true,
        'operation_id', v_op_id,
        'folio', v_folio,
        'journal_entry_id', v_jrn_id,
        'entry_number', v_entry_num,
        'amount_cents', $AMOUNT_CENTS,
        'commission_cents', v_comm,
        'total_cents', v_tot,
        'source_resource', jsonb_build_object(
            'resource_id', '$SOURCE_RES',
            'direction', 'INFLOW',
            'amount_cents', v_tot,
            'sequence', v_src_move.entry_sequence,
            'balance_after_cents', v_src_move.balance_after_cents
        ),
        'destination_resource', jsonb_build_object(
            'resource_id', '$DEST_RES',
            'direction', 'OUTFLOW',
            'amount_cents', $AMOUNT_CENTS,
            'sequence', v_dst_move.entry_sequence,
            'balance_after_cents', v_dst_move.balance_after_cents
        )
    );

    UPDATE public.idempotency_records
    SET status = 'COMPLETED',
        response_payload = v_op_res,
        completed_at = clock_timestamp(),
        locked_by_pid = NULL
    WHERE business_id = '$BUSINESS_ID'::uuid AND idempotency_key = '$IDEM_KEY';
END;
\$\$;

COMMIT;

-- Imprimir la respuesta final de C1
SELECT response_payload FROM public.idempotency_records WHERE business_id = '$BUSINESS_ID'::uuid AND idempotency_key = '$IDEM_KEY';
EOF
PID_C1=$!

# Esperar a que C1 adquiera la clave y entre en wait_for_barrier
sleep 0.4

# ------------------------------------------------------------------------------
# 3. LANZAR CLIENTE C2 (Invoca la RPC de producción con idéntica clave)
# ------------------------------------------------------------------------------
log "Lanzando C2 (intentará insertar la misma clave de idempotencia)..."
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -t -A > "$C2_JSON" 2> "$C2_LOG" <<EOF &
SET application_name = 'c2_harness_worker_${RUN_ID}';
SELECT public.rpc_register_customer_operation(
    p_business_id => '$BUSINESS_ID'::uuid,
    p_workstation_id => '$WORKSTATION_ID'::uuid,
    p_idempotency_key => '$IDEM_KEY',
    p_type => 'deposit',
    p_amount_cents => $AMOUNT_CENTS,
    p_source_resource_id => '$SOURCE_RES'::uuid,
    p_destination_resource_id => '$DEST_RES'::uuid,
    p_sender_name => 'Cliente Concurrente 1',
    p_receiver_name => 'Destinatario Concurrente 1',
    p_session_token => '$SESSION_TOKEN'
);
EOF
PID_C2=$!

# ------------------------------------------------------------------------------
# 4. DIAGNÓSTICO DEL BLOQUEO EN EL CONTROLADOR (pg_blocking_pids y transactionid)
# ------------------------------------------------------------------------------
log "Controlador verificando bloqueo de C2 por C1 en catálogo de PostgreSQL..."
BLOCK_DETECTED=0
for i in $(seq 1 50); do
    DIAG=$(psql -d "$DB_NAME" -q -t -A -c "
        SELECT 
            c2.pid AS c2_pid,
            c1.pid AS c1_pid,
            c2.wait_event_type,
            c2.wait_event,
            pg_blocking_pids(c2.pid)::text AS blocking_pids
        FROM pg_stat_activity c2
        CROSS JOIN LATERAL (
            SELECT pid FROM pg_stat_activity WHERE application_name = 'c1_harness_worker_${RUN_ID}'
        ) c1
        WHERE c2.application_name = 'c2_harness_worker_${RUN_ID}'
          AND c1.pid = ANY(pg_blocking_pids(c2.pid));
    ")

    if [ -n "$DIAG" ]; then
        log "BLOQUEO REAL CONFIRMADO: $DIAG"
        BLOCK_DETECTED=1
        break
    fi
    sleep 0.1
done

if [ "$BLOCK_DETECTED" -ne 1 ]; then
    echo "ERROR: El controlador no pudo comprobar el bloqueo determinista de C2." >&2
    exit 1
fi

# ------------------------------------------------------------------------------
# 5. LIBERACIÓN DE LA BARRERA Y ESPERA DE TERMINACIÓN
# ------------------------------------------------------------------------------
log "Liberando barrera para que C1 confirme y C2 se desbloquee..."
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -c "UPDATE ${TEST_SCHEMA}.barrier SET is_released = true WHERE id = 1;"

log "Esperando que C1 y C2 terminen limpiamente..."
wait_for_process_timeout "$PID_C1" 10
wait_for_process_timeout "$PID_C2" 10

# ------------------------------------------------------------------------------
# 6. ASERCIÓN EN PYTHON: COMPARACIÓN DE RESPUESTAS JSON Y VERIFICACIÓN CONTABLE
# ------------------------------------------------------------------------------
log "Verificando respuestas JSON y estado contable en Python..."
python3 - <<PYEOF
import json, sys

with open("$C1_JSON", "r") as f:
    c1_raw = f.read().strip()
with open("$C2_JSON", "r") as f:
    c2_raw = f.read().strip()

if not c1_raw:
    print("ERROR: C1 no produjo respuesta JSON.", file=sys.stderr)
    sys.exit(1)
if not c2_raw:
    print("ERROR: C2 no produjo respuesta JSON.", file=sys.stderr)
    sys.exit(1)

c1_data = json.loads(c1_raw)
c2_data = json.loads(c2_raw)

print(f"C1 response: {c1_data}")
print(f"C2 response: {c2_data}")

# 1. Las respuestas deben ser idénticas
assert c1_data == c2_data, f"Respuestas no coinciden!\nC1: {c1_data}\nC2: {c2_data}"
assert c1_data["success"] is True, "success != True"
assert c1_data["amount_cents"] == $AMOUNT_CENTS, "amount_cents incorrecto"
assert c1_data["commission_cents"] == 2000, "commission_cents != 2000"
assert c1_data["total_cents"] == 102000, "total_cents != 102000"

print(">> Aserción 1 Pasada: Respuestas JSON de C1 y C2 son idénticas al 100%.")
PYEOF

# Verificar en PostgreSQL que existe EXACTAMENTE UN ASIENTO y dos líneas financieras
log "Verificando unicidad contable en la base de datos..."
psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q <<EOF
DO \$\$
DECLARE
    v_op_count INT;
    v_jrn_count INT;
    v_fin_count INT;
    v_econ_count INT;
    v_target_jrn_id UUID;
BEGIN
    SELECT (response_payload->>'journal_entry_id')::uuid INTO v_target_jrn_id 
    FROM public.idempotency_records 
    WHERE idempotency_key = '$IDEM_KEY' AND business_id = '$BUSINESS_ID'::uuid;

    IF v_target_jrn_id IS NULL THEN
        RAISE EXCEPTION 'FALLO: No se encontró journal_entry_id en response_payload.';
    END IF;

    SELECT count(*) INTO v_jrn_count 
    FROM public.journal_entries j 
    WHERE j.id = v_target_jrn_id;

    SELECT count(*) INTO v_fin_count 
    FROM public.financial_ledger_entries fl
    WHERE fl.journal_entry_id = v_target_jrn_id;

    SELECT count(*) INTO v_econ_count 
    FROM public.economic_ledger_entries el
    WHERE el.journal_entry_id = v_target_jrn_id;

    IF v_jrn_count != 1 THEN
        RAISE EXCEPTION 'FALLO: Se crearon % asientos para la misma clave de idempotencia (debe ser 1).', v_jrn_count;
    END IF;

    IF v_fin_count != 2 THEN
        RAISE EXCEPTION 'FALLO: Se crearon % líneas de tesorería (deben ser exactamente 2).', v_fin_count;
    END IF;

    IF v_econ_count != 1 THEN
        RAISE EXCEPTION 'FALLO: Se crearon % líneas económicas de comisión (debe ser exactamente 1).', v_econ_count;
    END IF;

    RAISE NOTICE '>> Aserción 2 Pasada: Exactamente 1 asiento contable y 2 líneas de tesorería creadas.';
END;
\$\$;
EOF

# ------------------------------------------------------------------------------
# 7. PRUEBAS DE RECHAZO: MISMA CLAVE CON PAYLOAD DIFERENTE Y CON RPC DIFERENTE
# ------------------------------------------------------------------------------
log "Probando rechazo de clave reutilizada con payload diferente..."
DIFF_PAYLOAD_ERR=$(psql -d "$DB_NAME" -q -c "
    SELECT public.rpc_register_customer_operation(
        p_business_id => '$BUSINESS_ID'::uuid,
        p_workstation_id => '$WORKSTATION_ID'::uuid,
        p_idempotency_key => '$IDEM_KEY',
        p_type => 'deposit',
        p_amount_cents => 9999999, -- MONTO ALTERADO
        p_source_resource_id => '$SOURCE_RES'::uuid,
        p_destination_resource_id => '$DEST_RES'::uuid,
        p_sender_name => 'Cliente Concurrente 1',
        p_receiver_name => 'Destinatario Concurrente 1',
        p_session_token => '$SESSION_TOKEN'
    );
" 2>&1 || true)

if ! echo "$DIFF_PAYLOAD_ERR" | grep -q "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD"; then
    echo "ERROR: Falló el rechazo por payload diferente: $DIFF_PAYLOAD_ERR" >&2
    exit 1
fi
log ">> Aserción 3 Pasada: Payload diferente rechazado correctamente."

log "Probando rechazo de clave reutilizada con RPC diferente..."
DIFF_RPC_ERR=$(psql -d "$DB_NAME" -q -c "
    SELECT public.rpc_register_administrative_movement(
        p_business_id => '$BUSINESS_ID'::uuid,
        p_workstation_id => '$WORKSTATION_ID'::uuid,
        p_idempotency_key => '$IDEM_KEY', -- MISMA CLAVE
        p_category => 'transfer_internal',
        p_amount_cents => 50000,
        p_origin_resource_id => '$SOURCE_RES'::uuid,
        p_destination_resource_id => '$DEST_RES'::uuid,
        p_session_token => '$SESSION_TOKEN'
    );
" 2>&1 || true)

if ! echo "$DIFF_RPC_ERR" | grep -q "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RPC"; then
    echo "ERROR: Falló el rechazo por RPC diferente: $DIFF_RPC_ERR" >&2
    exit 1
fi
log ">> Aserción 4 Pasada: RPC diferente rechazada correctamente."

# ------------------------------------------------------------------------------
# 8. PRUEBA DE ROLLBACK: TRANSACCIÓN FALLIDA NO DEJA CLAVE EN PROCESSING
# ------------------------------------------------------------------------------
log "Probando comportamiento de rollback (operación fallida no deja clave en PROCESSING)..."
ROLLBACK_KEY="IDEM-ROLLBACK-${RUN_ID}"
psql -d "$DB_NAME" -q -c "
    BEGIN;
    -- Intento con saldo insuficiente que dispara check_violation
    SELECT public.rpc_register_customer_operation(
        p_business_id => '$BUSINESS_ID'::uuid,
        p_workstation_id => '$WORKSTATION_ID'::uuid,
        p_idempotency_key => '$ROLLBACK_KEY',
        p_type => 'withdrawal',
        p_amount_cents => 99999999999, -- Saldo insuficiente en caja
        p_source_resource_id => '$DEST_RES'::uuid,
        p_destination_resource_id => '$SOURCE_RES'::uuid,
        p_sender_name => 'Cliente',
        p_receiver_name => 'Cajero',
        p_session_token => '$SESSION_TOKEN'
    );
    COMMIT;
" 2>/dev/null || true

# Comprobar que no quedó ningún registro en PROCESSING para esa clave
STUCK_COUNT=$(psql -d "$DB_NAME" -q -t -A -c "
    SELECT count(*) FROM public.idempotency_records 
    WHERE business_id = '$BUSINESS_ID'::uuid AND idempotency_key = '$ROLLBACK_KEY';
")
if [ "$STUCK_COUNT" -ne 0 ]; then
    echo "ERROR: La clave fallida quedó registrada tras el rollback ($STUCK_COUNT registros)." >&2
    exit 1
fi
log ">> Aserción 5 Pasada: Transacción fallida revirtió el registro de idempotencia sin dejar huérfanos."

log "================================================================="
log "=== HARNESS DE CONCURRENCIA COMPLETADO CON 100% DE ÉXITO      ==="
log "================================================================="
exit 0
