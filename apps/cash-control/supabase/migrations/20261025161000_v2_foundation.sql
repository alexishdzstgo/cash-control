-- ==============================================================================
-- Cash-Control v2: Migración Estructural de Fundación (DDL v1.5.0 Corregido)
-- Archivo: supabase/migrations/20261025161000_v2_foundation.sql
-- Rama: v2/clean-core
-- Descripción: Creación de ENUMs, tablas maestras, llaves primarias/foráneas
--              compuestas para estricto aislamiento multi-inquilino, restricciones
--              de integridad (CHECK, UNIQUE), índices parciales, columnas generadas
--              almacenadas, triggers de inmutabilidad append-only, validación diferida
--              de balance contable e integridad al COMMIT, y blindaje de privilegios.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. COMPATIBILIDAD CON ENTORNO AISLADO / SUPABASE AUTH
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
        CREATE SCHEMA auth;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
        CREATE TABLE auth.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT,
            raw_app_meta_data JSONB DEFAULT '{}'::jsonb,
            raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now()
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'auth' AND p.proname = 'uid') THEN
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid;';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. TIPOS ENUMERADOS (ENUMS)
-- ------------------------------------------------------------------------------

-- Capacidad y cargo permanente del miembro en la empresa
CREATE TYPE public.business_member_role AS ENUM (
    'owner',
    'manager',
    'cashier'
);
COMMENT ON TYPE public.business_member_role IS 'Cargo permanente del empleado u owner en la empresa. No confundir con la responsabilidad temporal en turno.';

-- Estado operativo del miembro
CREATE TYPE public.business_member_status AS ENUM (
    'active',
    'suspended',
    'inactive'
);

-- Estado del turno de custodia
CREATE TYPE public.shift_status AS ENUM (
    'open',
    'closed'
);

-- Responsabilidad de custodia temporal asignada durante un turno específico
CREATE TYPE public.shift_role_in_shift AS ENUM (
    'responsible',
    'participant'
);
COMMENT ON TYPE public.shift_role_in_shift IS 'Responsabilidad temporal en el turno. Un cashier permanente puede ser responsible en un turno y participant en otro.';

-- Estado del participante en el turno
CREATE TYPE public.shift_participant_status AS ENUM (
    'active',
    'left'
);

-- Tipo de entrega-recepción de custodia
CREATE TYPE public.custody_handover_type AS ENUM (
    'shift_change',
    'temporary_relief',
    'workstation_handover'
);

-- Tipo de operación de cliente
CREATE TYPE public.operation_type AS ENUM (
    'deposit',
    'withdrawal'
);

-- Origen contable de la operación
CREATE TYPE public.operation_origin AS ENUM (
    'NORMAL',
    'AUDIT_ADJUSTMENT',
    'AUDIT_RECLASSIFICATION'
);
COMMENT ON TYPE public.operation_origin IS 'NORMAL: captura ordinaria. AUDIT_ADJUSTMENT: omisión descubierta donde el dinero NO estaba en el saldo anterior. AUDIT_RECLASSIFICATION: omisión descubierta donde el dinero YA estaba en el saldo anterior (impacto neto tesorería = 0).';

-- Estado del ciclo de vida de la operación
CREATE TYPE public.operation_status AS ENUM (
    'completed',
    'pending_cash_delivery',
    'corrected',
    'cancelled'
);

-- Clasificación del recurso de tesorería
CREATE TYPE public.treasury_resource_type AS ENUM (
    'cash_box',
    'cash_reserved_envelope',
    'bank_account'
);

-- Categoría de movimientos administrativos ajenos a operaciones de clientes
CREATE TYPE public.administrative_movement_category AS ENUM (
    'funding_in',
    'expense_out',
    'transfer_internal',
    'owner_capital_injection',
    'owner_drawing_withdrawal',
    'reconciliation_adjustment'
);

-- Tipo de hecho financiero registrado en el Journal
CREATE TYPE public.journal_entry_type AS ENUM (
    'customer_operation',
    'administrative_movement',
    'cut_reconciliation',
    'incidence_resolution',
    'operation_correction'
);

-- Sentido del movimiento en el libro de tesorería (Activos líquidos disponibles)
CREATE TYPE public.financial_direction AS ENUM (
    'INFLOW',   -- Entrada de activo líquido (+ dinero físico/banco)
    'OUTFLOW'   -- Salida de activo líquido (- dinero físico/banco)
);
COMMENT ON TYPE public.financial_direction IS 'Dirección unívoca de tesorería: INFLOW (incremento de dinero líquido) y OUTFLOW (decremento de dinero líquido).';

-- Sentido del movimiento en el libro económico y patrimonial
CREATE TYPE public.economic_direction AS ENUM (
    'CREDIT',  -- Ingreso (comisión) o aumento de capital de dueño
    'DEBIT'    -- Gasto, pérdida confirmada, retiro de dueño o activo transitorio
);

-- Clasificación de cuentas en el catálogo contable
CREATE TYPE public.chart_account_type AS ENUM (
    'revenue',
    'expense',
    'equity',
    'clearing_control'
);

-- Estado del evento de corte / auditoría
CREATE TYPE public.cut_status AS ENUM (
    'in_progress',
    'completed',
    'completed_with_issues',
    'cancelled'
);

-- Tipo de diferencia en arqueos y conciliaciones
CREATE TYPE public.difference_type AS ENUM (
    'exact',
    'shortage',
    'surplus'
);

-- Categoría de movimiento en auditoría bancaria
CREATE TYPE public.bank_audit_item_category AS ENUM (
    'deposit',
    'withdrawal',
    'other'
);

-- Dictamen individual del movimiento bancario auditado
CREATE TYPE public.bank_audit_item_verdict AS ENUM (
    'coincide',
    'falta_en_sistema',
    'datos_incorrectos',
    'otro_gasto_comision',
    'genera_incidencia'
);

-- Tipo de incidencia permanente
CREATE TYPE public.incidence_type AS ENUM (
    'cash_shortage',
    'cash_surplus',
    'bank_discrepancy',
    'unidentified_cash'
);

-- Dirección o sentido financiero del descuadre en la incidencia
CREATE TYPE public.incidence_direction AS ENUM (
    'shortage',   -- Faltante: Real < Esperado (Impacto analítico neto: -unresolved_amount_cents)
    'surplus'     -- Sobrante: Real > Esperado (Impacto analítico neto: +unresolved_amount_cents)
);

-- Estado del ciclo de vida de la incidencia
CREATE TYPE public.incidence_status AS ENUM (
    'OPEN',
    'UNDER_REVIEW',
    'PARTIALLY_RESOLVED',
    'RESOLVED',
    'CLOSED'
);

-- Tipo de resolución formal de una incidencia
CREATE TYPE public.incidence_resolution_type AS ENUM (
    'reintegration_partial',
    'reintegration_final',
    'explained_by_operation',
    'confirmed_loss',
    'confirmed_surplus'
);

-- ------------------------------------------------------------------------------
-- 2. TABLAS DE MÓDULO 1: NEGOCIO, SEGURIDAD Y ESTACIONES DE TRABAJO
-- ------------------------------------------------------------------------------

-- 1. Empresas / Sucursales (Tenencia multi-inquilino)
CREATE TABLE public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name TEXT NOT NULL,
    commercial_name TEXT NOT NULL,
    owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    last_journal_entry_number BIGINT NOT NULL DEFAULT 0 CHECK (last_journal_entry_number >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_businesses_id_owner UNIQUE (id, owner_user_id)
);
COMMENT ON TABLE public.businesses IS 'Empresa raíz. owner_user_id apunta a la cuenta real de Supabase Auth del Dueño. last_journal_entry_number es el contador atómico secuencial bajo lock FOR UPDATE.';

-- 2. Estaciones físicas de mostrador / ventanilla
CREATE TABLE public.workstations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_workstations_business_code UNIQUE (business_id, code),
    CONSTRAINT uq_workstations_business_id UNIQUE (business_id, id)
);

-- 3. Miembros del negocio (Dueño y Empleados operacionales)
CREATE TABLE public.business_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    auth_user_id UUID NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    full_name TEXT NOT NULL,
    role public.business_member_role NOT NULL,
    pin_hash TEXT NULL,
    status public.business_member_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_business_members_business_id UNIQUE (business_id, id),
    CONSTRAINT fk_business_members_owner_auth FOREIGN KEY (business_id, auth_user_id) 
        REFERENCES public.businesses(id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT chk_business_members_auth_by_role CHECK (
        (role = 'owner' AND auth_user_id IS NOT NULL) OR 
        (role != 'owner' AND auth_user_id IS NULL)
    ),
    CONSTRAINT chk_business_members_pin_requirement CHECK (
        (role = 'owner') OR 
        (role IN ('manager', 'cashier') AND pin_hash IS NOT NULL)
    )
);
COMMENT ON TABLE public.business_members IS 'Perfiles del personal. Solo el OWNER tiene auth_user_id (vinculado a businesses.owner_user_id) y su PIN es opcional. Empleados operan obligatoriamente con pin_hash sin cuenta auth.users.';

-- Garantizar exactamente un solo perfil 'owner' por negocio
CREATE UNIQUE INDEX idx_business_members_single_owner 
    ON public.business_members(business_id) 
    WHERE (role = 'owner');

-- 4. Bitácora forense de auditoría técnica (Append-Only)
CREATE TABLE public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    auth_user_id UUID NULL,
    operator_member_id UUID NULL,
    workstation_id UUID NULL,
    action TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id UUID NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_audit_events_owner_auth FOREIGN KEY (business_id, auth_user_id) 
        REFERENCES public.businesses(id, owner_user_id) ON DELETE SET NULL (auth_user_id),
    CONSTRAINT fk_audit_events_member FOREIGN KEY (business_id, operator_member_id) 
        REFERENCES public.business_members(business_id, id) ON DELETE SET NULL (operator_member_id),
    CONSTRAINT fk_audit_events_workstation FOREIGN KEY (business_id, workstation_id) 
        REFERENCES public.workstations(business_id, id) ON DELETE SET NULL (workstation_id)
);
COMMENT ON TABLE public.audit_events IS 'Bitácora técnica forense. ON DELETE SET NULL (columna) en PG15+ preserva el business_id intacto al desvincular actores.';

-- ------------------------------------------------------------------------------
-- 3. TABLAS DE MÓDULO 3 Y 4: TARIFARIOS, RECURSOS Y PLAN CONTABLE
-- ------------------------------------------------------------------------------

-- 5. Tarifarios versionados de comisiones
CREATE TABLE public.commission_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    operation_type public.operation_type NOT NULL,
    min_amount_cents BIGINT NOT NULL CHECK (min_amount_cents >= 0),
    max_amount_cents BIGINT NOT NULL CHECK (max_amount_cents >= min_amount_cents),
    fixed_fee_cents BIGINT NOT NULL DEFAULT 0 CHECK (fixed_fee_cents >= 0),
    percentage_fee_bps INTEGER NOT NULL DEFAULT 0 CHECK (percentage_fee_bps >= 0 AND percentage_fee_bps <= 10000),
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ NULL CHECK (effective_to IS NULL OR effective_to > effective_from),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_commission_rules_business_id UNIQUE (business_id, id)
);
COMMENT ON TABLE public.commission_rules IS 'Tarifario inmutable versionado en centavos y basis points (100 bps = 1%).';

-- 6. Recursos de tesorería operativa (Cajas físicas, sobres y cuentas bancarias)
CREATE TABLE public.treasury_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type public.treasury_resource_type NOT NULL,
    currency TEXT NOT NULL DEFAULT 'MXN',
    current_balance_cents BIGINT NOT NULL DEFAULT 0,
    last_entry_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_entry_sequence >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_treasury_resources_business_code UNIQUE (business_id, code),
    CONSTRAINT uq_treasury_resources_business_id UNIQUE (business_id, id),
    CONSTRAINT chk_treasury_resources_cash_non_negative CHECK (
        (type IN ('cash_box', 'cash_reserved_envelope') AND current_balance_cents >= 0) OR
        (type = 'bank_account')
    )
);
COMMENT ON TABLE public.treasury_resources IS 'Saldos reales de tesorería por recurso individual. current_balance_cents y last_entry_sequence se actualizan exclusivamente bajo lock FOR UPDATE.';

-- 7. Catálogo de cuentas económicas, de patrimonio y transitorias
CREATE TABLE public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type public.chart_account_type NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_chart_of_accounts_business_code UNIQUE (business_id, code),
    CONSTRAINT uq_chart_of_accounts_business_id UNIQUE (business_id, id)
);
COMMENT ON TABLE public.chart_of_accounts IS 'Cuentas para P&L (comisiones, gastos, pérdidas), patrimonio (capital, drawings) y control transitorio (CUSTODY_DISCREPANCY_SUSPENSE).';

-- ------------------------------------------------------------------------------
-- 4. TABLAS DE MÓDULO 2: TURNOS Y CUSTODIA OPERATIVA
-- ------------------------------------------------------------------------------

-- 8. Turnos de ventanilla (Delimitación de custodia humana temporal)
CREATE TABLE public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    workstation_id UUID NOT NULL,
    folio TEXT NOT NULL,
    status public.shift_status NOT NULL DEFAULT 'open',
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ NULL CHECK (closed_at IS NULL OR closed_at >= opened_at),
    opened_by_member_id UUID NOT NULL,
    closed_by_member_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_shifts_business_folio UNIQUE (business_id, folio),
    CONSTRAINT uq_shifts_business_id UNIQUE (business_id, id),
    CONSTRAINT fk_shifts_workstation FOREIGN KEY (business_id, workstation_id) 
        REFERENCES public.workstations(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_shifts_opened_by FOREIGN KEY (business_id, opened_by_member_id) 
        REFERENCES public.business_members(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_shifts_closed_by FOREIGN KEY (business_id, closed_by_member_id) 
        REFERENCES public.business_members(business_id, id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.shifts IS 'Turno operativo de custodia humana. Desacoplado de cortes; solo intervalo laboral de ventanilla.';

-- Exclusividad: No se permite abrir más de un turno simultáneo en la misma estación
CREATE UNIQUE INDEX idx_shifts_single_open_per_workstation 
    ON public.shifts(business_id, workstation_id) 
    WHERE (status = 'open');

-- 9. Participantes y cajeros activos en el turno
CREATE TABLE public.shift_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    shift_id UUID NOT NULL,
    member_id UUID NOT NULL,
    role_in_shift public.shift_role_in_shift NOT NULL DEFAULT 'participant',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at TIMESTAMPTZ NULL CHECK (left_at IS NULL OR left_at >= joined_at),
    status public.shift_participant_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_shift_participants_active UNIQUE (shift_id, member_id, joined_at),
    CONSTRAINT fk_shift_participants_shift FOREIGN KEY (business_id, shift_id) 
        REFERENCES public.shifts(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_shift_participants_member FOREIGN KEY (business_id, member_id) 
        REFERENCES public.business_members(business_id, id) ON DELETE RESTRICT
);

-- 10. Entregas-recepciones de custodia física entre cajeros
CREATE TABLE public.custody_handovers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    shift_id UUID NOT NULL,
    resource_id UUID NOT NULL,
    from_member_id UUID NOT NULL,
    to_member_id UUID NOT NULL,
    handover_type public.custody_handover_type NOT NULL,
    counted_cash_cents BIGINT NOT NULL CHECK (counted_cash_cents >= 0),
    from_member_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    to_member_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_custody_handovers_distinct_members CHECK (from_member_id != to_member_id),
    CONSTRAINT fk_custody_handovers_shift FOREIGN KEY (business_id, shift_id) 
        REFERENCES public.shifts(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_custody_handovers_resource FOREIGN KEY (business_id, resource_id) 
        REFERENCES public.treasury_resources(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_custody_handovers_from_member FOREIGN KEY (business_id, from_member_id) 
        REFERENCES public.business_members(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_custody_handovers_to_member FOREIGN KEY (business_id, to_member_id) 
        REFERENCES public.business_members(business_id, id) ON DELETE RESTRICT
);

-- ------------------------------------------------------------------------------
-- 5. TABLAS DE MÓDULO 5: CORTE INTEGRADO Y AUDITORÍA MULTIRRECURSO
-- ------------------------------------------------------------------------------

-- 11. Eventos consolidados de corte físico y bancario
CREATE TABLE public.cuts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    folio TEXT NOT NULL,
    status public.cut_status NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ NULL CHECK (closed_at IS NULL OR closed_at >= started_at),
    auditor_member_id UUID NOT NULL,
    auth_user_id UUID NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cuts_business_folio UNIQUE (business_id, folio),
    CONSTRAINT uq_cuts_business_id UNIQUE (business_id, id),
    CONSTRAINT fk_cuts_owner_auth FOREIGN KEY (business_id, auth_user_id) 
        REFERENCES public.businesses(id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_cuts_auditor FOREIGN KEY (business_id, auditor_member_id) 
        REFERENCES public.business_members(business_id, id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.cuts IS 'Hito formal de verificación financiera multirrecurso. Independiente de shifts. auth_user_id está vinculado al owner del negocio.';

-- 12. Relación muchos a muchos entre cortes y turnos auditados
CREATE TABLE public.cut_audited_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    cut_id UUID NOT NULL,
    shift_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cut_audited_shifts UNIQUE (cut_id, shift_id),
    CONSTRAINT fk_cut_audited_shifts_cut FOREIGN KEY (business_id, cut_id) 
        REFERENCES public.cuts(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_cut_audited_shifts_shift FOREIGN KEY (business_id, shift_id) 
        REFERENCES public.shifts(business_id, id) ON DELETE RESTRICT
);

-- 13. Arqueo físico de caja por recurso individual (Charola o sobre independiente)
CREATE TABLE public.cut_cash_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    cut_id UUID NOT NULL,
    resource_id UUID NOT NULL,
    snapshot_sequence BIGINT NOT NULL CHECK (snapshot_sequence >= 0),
    cutoff_sequence BIGINT NULL CHECK (cutoff_sequence IS NULL OR cutoff_sequence >= snapshot_sequence),
    theoretical_balance_cents BIGINT NOT NULL,
    counted_amount_cents BIGINT NOT NULL CHECK (counted_amount_cents >= 0),
    difference_cents BIGINT GENERATED ALWAYS AS (counted_amount_cents - theoretical_balance_cents) STORED,
    difference_type public.difference_type NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cut_cash_counts_cut_resource UNIQUE (cut_id, resource_id),
    CONSTRAINT fk_cut_cash_counts_cut FOREIGN KEY (business_id, cut_id) 
        REFERENCES public.cuts(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_cut_cash_counts_resource FOREIGN KEY (business_id, resource_id) 
        REFERENCES public.treasury_resources(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT chk_cut_cash_counts_difference_consistency CHECK (
        (difference_cents = 0 AND difference_type = 'exact') OR
        (difference_cents < 0 AND difference_type = 'shortage') OR
        (difference_cents > 0 AND difference_type = 'surplus')
    )
);
COMMENT ON TABLE public.cut_cash_counts IS 'Arqueo por recurso físico individual (caja o sobre). La restricción de tipo de recurso (exclusividad de efectivo) depende de validación procedimental RPC / Triggers en etapas posteriores.';

-- 14. Conciliación y corte por cuenta bancaria individual
CREATE TABLE public.bank_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    cut_id UUID NOT NULL,
    resource_id UUID NOT NULL,
    snapshot_sequence BIGINT NOT NULL CHECK (snapshot_sequence >= 0),
    cutoff_sequence BIGINT NULL CHECK (cutoff_sequence IS NULL OR cutoff_sequence >= snapshot_sequence),
    theoretical_balance_cents BIGINT NOT NULL,
    observed_balance_cents BIGINT NOT NULL,
    difference_cents BIGINT GENERATED ALWAYS AS (observed_balance_cents - theoretical_balance_cents) STORED,
    difference_type public.difference_type NOT NULL,
    evidence_url TEXT NULL,
    observations TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_bank_audits_cut_resource UNIQUE (cut_id, resource_id),
    CONSTRAINT uq_bank_audits_business_id UNIQUE (business_id, id),
    CONSTRAINT fk_bank_audits_cut FOREIGN KEY (business_id, cut_id) 
        REFERENCES public.cuts(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_bank_audits_resource FOREIGN KEY (business_id, resource_id) 
        REFERENCES public.treasury_resources(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT chk_bank_audits_difference_consistency CHECK (
        (difference_cents = 0 AND difference_type = 'exact') OR
        (difference_cents < 0 AND difference_type = 'shortage') OR
        (difference_cents > 0 AND difference_type = 'surplus')
    )
);
COMMENT ON TABLE public.bank_audits IS 'Conciliación bancaria individual. La restricción de tipo de recurso (exclusividad bancaria) depende de validación procedimental RPC / Triggers en etapas posteriores.';

-- ------------------------------------------------------------------------------
-- 6. TABLAS DE MÓDULO 6: INCIDENCIAS PERMANENTES
-- ------------------------------------------------------------------------------

-- 15. Incidencias históricas permanentes (Faltantes, sobrantes, descuadres bancarios)
CREATE TABLE public.incidences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    folio TEXT NOT NULL,
    origin_cut_id UUID NULL,
    origin_resource_id UUID NOT NULL,
    type public.incidence_type NOT NULL,
    direction public.incidence_direction NOT NULL,
    original_amount_cents BIGINT NOT NULL CHECK (original_amount_cents > 0),
    unresolved_amount_cents BIGINT NOT NULL CHECK (
        unresolved_amount_cents >= 0 AND unresolved_amount_cents <= original_amount_cents
    ),
    signed_unresolved_cents BIGINT GENERATED ALWAYS AS (
        CASE WHEN direction = 'surplus' THEN unresolved_amount_cents ELSE -unresolved_amount_cents END
    ) STORED,
    status public.incidence_status NOT NULL DEFAULT 'OPEN',
    review_deadline TIMESTAMPTZ NULL,
    assigned_investigator_id UUID NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ NULL CHECK (closed_at IS NULL OR closed_at >= created_at),
    CONSTRAINT uq_incidences_business_folio UNIQUE (business_id, folio),
    CONSTRAINT uq_incidences_business_id UNIQUE (business_id, id),
    CONSTRAINT fk_incidences_origin_cut FOREIGN KEY (business_id, origin_cut_id) 
        REFERENCES public.cuts(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_incidences_origin_resource FOREIGN KEY (business_id, origin_resource_id) 
        REFERENCES public.treasury_resources(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_incidences_investigator FOREIGN KEY (business_id, assigned_investigator_id) 
        REFERENCES public.business_members(business_id, id) ON DELETE SET NULL (assigned_investigator_id),
    CONSTRAINT chk_incidences_type_direction CHECK (
        (type = 'cash_shortage' AND direction = 'shortage') OR
        (type = 'cash_surplus' AND direction = 'surplus') OR
        (type = 'unidentified_cash' AND direction = 'surplus') OR
        (type = 'bank_discrepancy' AND direction IN ('shortage', 'surplus'))
    )
);
COMMENT ON TABLE public.incidences IS 'Entidad de discrepancia. ON DELETE SET NULL (assigned_investigator_id) en PG15+ preserva el business_id intacto al desasignar.';

-- ------------------------------------------------------------------------------
-- 7. TABLAS DE OPERACIONES Y MOVIMIENTOS ADMINISTRATIVOS
-- ------------------------------------------------------------------------------

-- 16. Operaciones canónicas de clientes (Depósitos y Retiros)
CREATE TABLE public.operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    shift_id UUID NOT NULL,
    folio TEXT NOT NULL,
    type public.operation_type NOT NULL,
    origin public.operation_origin NOT NULL DEFAULT 'NORMAL',
    status public.operation_status NOT NULL DEFAULT 'completed',
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    commission_cents BIGINT NOT NULL CHECK (commission_cents >= 0),
    total_cents BIGINT GENERATED ALWAYS AS (amount_cents + commission_cents) STORED,
    sender_name TEXT NOT NULL,
    receiver_name TEXT NOT NULL,
    customer_account_ref TEXT NULL,
    bank_folio TEXT NULL,
    source_resource_id UUID NOT NULL,
    destination_resource_id UUID NOT NULL,
    commission_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    operator_member_id UUID NOT NULL,
    auth_user_id UUID NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_operations_business_folio UNIQUE (business_id, folio),
    CONSTRAINT uq_operations_business_id UNIQUE (business_id, id),
    CONSTRAINT chk_operations_resources_distinct CHECK (source_resource_id != destination_resource_id),
    CONSTRAINT fk_operations_owner_auth FOREIGN KEY (business_id, auth_user_id) 
        REFERENCES public.businesses(id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_operations_shift FOREIGN KEY (business_id, shift_id) 
        REFERENCES public.shifts(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_operations_source_resource FOREIGN KEY (business_id, source_resource_id) 
        REFERENCES public.treasury_resources(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_operations_dest_resource FOREIGN KEY (business_id, destination_resource_id) 
        REFERENCES public.treasury_resources(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_operations_operator FOREIGN KEY (business_id, operator_member_id) 
        REFERENCES public.business_members(business_id, id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.operations IS 'Operaciones canónicas inmutables. auth_user_id está vinculado al owner del negocio; operator_member_id al cajero.';

-- 17. Vínculo inmutable de compensación y corrección de operaciones
CREATE TABLE public.operation_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    original_operation_id UUID NOT NULL,
    reversal_operation_id UUID NOT NULL,
    replacement_operation_id UUID NOT NULL,
    reason TEXT NOT NULL,
    authorized_by_member_id UUID NOT NULL,
    auth_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_corrections_original UNIQUE (original_operation_id),
    CONSTRAINT uq_corrections_reversal UNIQUE (reversal_operation_id),
    CONSTRAINT uq_corrections_replacement UNIQUE (replacement_operation_id),
    CONSTRAINT chk_corrections_distinct_operations CHECK (
        original_operation_id != reversal_operation_id AND
        original_operation_id != replacement_operation_id AND
        reversal_operation_id != replacement_operation_id
    ),
    CONSTRAINT fk_corrections_owner_auth FOREIGN KEY (business_id, auth_user_id) 
        REFERENCES public.businesses(id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_corrections_original FOREIGN KEY (business_id, original_operation_id) 
        REFERENCES public.operations(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_corrections_reversal FOREIGN KEY (business_id, reversal_operation_id) 
        REFERENCES public.operations(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_corrections_replacement FOREIGN KEY (business_id, replacement_operation_id) 
        REFERENCES public.operations(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_corrections_authorizer FOREIGN KEY (business_id, authorized_by_member_id) 
        REFERENCES public.business_members(business_id, id) ON DELETE RESTRICT
);

-- 18. Movimientos de tesorería administrativos (Fondeos, gastos, traslados, patrimonio)
CREATE TABLE public.administrative_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    shift_id UUID NOT NULL,
    folio TEXT NOT NULL,
    category public.administrative_movement_category NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    origin_resource_id UUID NULL,
    destination_resource_id UUID NULL,
    voucher_url TEXT NULL,
    notes TEXT NULL,
    operator_member_id UUID NOT NULL,
    auth_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_admin_movements_business_folio UNIQUE (business_id, folio),
    CONSTRAINT uq_admin_movements_business_id UNIQUE (business_id, id),
    CONSTRAINT chk_admin_movements_has_resource CHECK (
        origin_resource_id IS NOT NULL OR destination_resource_id IS NOT NULL
    ),
    CONSTRAINT chk_admin_movements_resources_distinct CHECK (
        origin_resource_id IS NULL OR destination_resource_id IS NULL OR origin_resource_id != destination_resource_id
    ),
    CONSTRAINT fk_admin_movements_owner_auth FOREIGN KEY (business_id, auth_user_id) 
        REFERENCES public.businesses(id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_admin_movements_shift FOREIGN KEY (business_id, shift_id) 
        REFERENCES public.shifts(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_admin_movements_origin_resource FOREIGN KEY (business_id, origin_resource_id) 
        REFERENCES public.treasury_resources(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_admin_movements_dest_resource FOREIGN KEY (business_id, destination_resource_id) 
        REFERENCES public.treasury_resources(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_admin_movements_operator FOREIGN KEY (business_id, operator_member_id) 
        REFERENCES public.business_members(business_id, id) ON DELETE RESTRICT
);

-- ------------------------------------------------------------------------------
-- 8. TABLAS DE MÓDULO 4: EL LIBRO MAYOR (JOURNAL Y DOS LEDGERS)
-- ------------------------------------------------------------------------------

-- 19. El Hecho Financiero Único (Journal raíz atómica)
CREATE TABLE public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    shift_id UUID NULL,
    entry_number BIGINT NOT NULL CHECK (entry_number > 0),
    entry_type public.journal_entry_type NOT NULL,
    source_entity TEXT NOT NULL CHECK (
        source_entity IN ('operations', 'administrative_movements', 'cuts', 'incidence_resolutions', 'operation_corrections')
    ),
    source_id UUID NOT NULL,
    concept TEXT NOT NULL,
    operator_member_id UUID NOT NULL,
    auth_user_id UUID NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_journal_entries_business_number UNIQUE (business_id, entry_number),
    CONSTRAINT uq_journal_entries_business_id UNIQUE (business_id, id),
    CONSTRAINT fk_journal_entries_owner_auth FOREIGN KEY (business_id, auth_user_id) 
        REFERENCES public.businesses(id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_journal_entries_shift FOREIGN KEY (business_id, shift_id) 
        REFERENCES public.shifts(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_journal_entries_operator FOREIGN KEY (business_id, operator_member_id) 
        REFERENCES public.business_members(business_id, id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.journal_entries IS 'Raíz atómica del hecho financiero. entry_number se genera incrementalmente bajo lock FOR UPDATE en businesses.last_journal_entry_number.';

-- 20. Libro Mayor de Tesorería Líquida (Activos reales)
CREATE TABLE public.financial_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    journal_entry_id UUID NOT NULL,
    resource_id UUID NOT NULL,
    entry_sequence BIGINT NOT NULL CHECK (entry_sequence > 0),
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    direction public.financial_direction NOT NULL,
    balance_after_cents BIGINT NOT NULL,
    signed_amount_cents BIGINT GENERATED ALWAYS AS (
        CASE WHEN direction = 'INFLOW' THEN amount_cents ELSE -amount_cents END
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_financial_ledger_resource_seq UNIQUE (resource_id, entry_sequence),
    CONSTRAINT fk_financial_ledger_journal FOREIGN KEY (business_id, journal_entry_id) 
        REFERENCES public.journal_entries(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_financial_ledger_resource FOREIGN KEY (business_id, resource_id) 
        REFERENCES public.treasury_resources(business_id, id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.financial_ledger_entries IS 'Asientos de tesorería líquida. entry_sequence es estrictamente monótono creciente por recurso individual.';

-- 21. Libro Mayor Económico y Patrimonial (P&L, Capital y Suspenso)
CREATE TABLE public.economic_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    journal_entry_id UUID NOT NULL,
    account_id UUID NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    direction public.economic_direction NOT NULL,
    signed_amount_cents BIGINT GENERATED ALWAYS AS (
        CASE WHEN direction = 'DEBIT' THEN amount_cents ELSE -amount_cents END
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_economic_ledger_journal FOREIGN KEY (business_id, journal_entry_id) 
        REFERENCES public.journal_entries(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_economic_ledger_account FOREIGN KEY (business_id, account_id) 
        REFERENCES public.chart_of_accounts(business_id, id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.economic_ledger_entries IS 'Asientos de resultado económico, patrimonio y activos transitorios de custodia (CUSTODY_DISCREPANCY_SUSPENSE).';

-- ------------------------------------------------------------------------------
-- 9. TABLAS DE RESOLUCIÓN Y DETALLE BANCARIO
-- ------------------------------------------------------------------------------

-- 22. Historial inmutable de resoluciones de incidencias
CREATE TABLE public.incidence_resolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    incidence_id UUID NOT NULL,
    journal_entry_id UUID NOT NULL,
    event_type public.incidence_resolution_type NOT NULL,
    amount_resolved_cents BIGINT NOT NULL CHECK (amount_resolved_cents > 0),
    linked_operation_id UUID NULL,
    linked_admin_movement_id UUID NULL,
    actor_member_id UUID NOT NULL,
    auth_user_id UUID NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_incidence_resolutions_owner_auth FOREIGN KEY (business_id, auth_user_id) 
        REFERENCES public.businesses(id, owner_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_incidence_resolutions_incidence FOREIGN KEY (business_id, incidence_id) 
        REFERENCES public.incidences(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_incidence_resolutions_journal FOREIGN KEY (business_id, journal_entry_id) 
        REFERENCES public.journal_entries(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_incidence_resolutions_actor FOREIGN KEY (business_id, actor_member_id) 
        REFERENCES public.business_members(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_incidence_resolutions_linked_op FOREIGN KEY (business_id, linked_operation_id) 
        REFERENCES public.operations(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_incidence_resolutions_linked_admin FOREIGN KEY (business_id, linked_admin_movement_id) 
        REFERENCES public.administrative_movements(business_id, id) ON DELETE RESTRICT
);
COMMENT ON TABLE public.incidence_resolutions IS 'Hechos históricos inmutables de solución. Invariante: unresolved_amount_cents = original - sum(amount_resolved_cents).';

-- 23. Desglose movimiento por movimiento de la auditoría bancaria
CREATE TABLE public.bank_audit_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
    bank_audit_id UUID NOT NULL,
    bank_movement_ref TEXT NOT NULL,
    movement_date DATE NOT NULL,
    category public.bank_audit_item_category NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    verdict public.bank_audit_item_verdict NOT NULL,
    linked_operation_id UUID NULL,
    linked_admin_movement_id UUID NULL,
    linked_incidence_id UUID NULL,
    is_audited BOOLEAN NOT NULL DEFAULT true,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_bank_audit_items_bank_audit FOREIGN KEY (business_id, bank_audit_id) 
        REFERENCES public.bank_audits(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_bank_audit_items_linked_op FOREIGN KEY (business_id, linked_operation_id) 
        REFERENCES public.operations(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_bank_audit_items_linked_admin FOREIGN KEY (business_id, linked_admin_movement_id) 
        REFERENCES public.administrative_movements(business_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_bank_audit_items_linked_incidence FOREIGN KEY (business_id, linked_incidence_id) 
        REFERENCES public.incidences(business_id, id) ON DELETE RESTRICT
);

-- ------------------------------------------------------------------------------
-- 10. ÍNDICES DE INTEGRIDAD, AISLAMIENTO Y DESEMPEÑO
-- ------------------------------------------------------------------------------

-- Módulo 1: Negocio y Miembros
CREATE INDEX idx_workstations_business_id ON public.workstations(business_id);
CREATE INDEX idx_business_members_business_id ON public.business_members(business_id);
CREATE INDEX idx_business_members_auth_user_id ON public.business_members(auth_user_id);
CREATE INDEX idx_audit_events_business_created ON public.audit_events(business_id, created_at DESC);
CREATE INDEX idx_audit_events_business_operator ON public.audit_events(business_id, operator_member_id);

-- Módulo 3 y 4: Tarifarios, Recursos y Cuentas
CREATE INDEX idx_commission_rules_lookup ON public.commission_rules(business_id, operation_type, is_active);
CREATE INDEX idx_treasury_resources_business_type ON public.treasury_resources(business_id, type);
CREATE INDEX idx_chart_of_accounts_business_type ON public.chart_of_accounts(business_id, type);

-- Módulo 2: Turnos y Custodia
CREATE INDEX idx_shifts_business_status ON public.shifts(business_id, status);
CREATE INDEX idx_shifts_business_workstation ON public.shifts(business_id, workstation_id);
CREATE INDEX idx_shift_participants_business_shift ON public.shift_participants(business_id, shift_id);
CREATE INDEX idx_shift_participants_business_member ON public.shift_participants(business_id, member_id);
CREATE INDEX idx_custody_handovers_business_shift ON public.custody_handovers(business_id, shift_id);
CREATE INDEX idx_custody_handovers_business_resource ON public.custody_handovers(business_id, resource_id);

-- Módulo 5: Cortes y Auditoría Multirrecurso
CREATE INDEX idx_cuts_business_status ON public.cuts(business_id, status);
CREATE INDEX idx_cuts_business_auditor ON public.cuts(business_id, auditor_member_id);
CREATE INDEX idx_cut_audited_shifts_business_cut ON public.cut_audited_shifts(business_id, cut_id);
CREATE INDEX idx_cut_audited_shifts_business_shift ON public.cut_audited_shifts(business_id, shift_id);
CREATE INDEX idx_cut_cash_counts_business_cut ON public.cut_cash_counts(business_id, cut_id);
CREATE INDEX idx_cut_cash_counts_business_resource ON public.cut_cash_counts(business_id, resource_id);
CREATE INDEX idx_bank_audits_business_cut ON public.bank_audits(business_id, cut_id);
CREATE INDEX idx_bank_audits_business_resource ON public.bank_audits(business_id, resource_id);
CREATE INDEX idx_bank_audit_items_business_audit ON public.bank_audit_items(business_id, bank_audit_id);

-- Módulo 6: Incidencias y Resoluciones
CREATE INDEX idx_incidences_business_status ON public.incidences(business_id, status);
CREATE INDEX idx_incidences_business_origin_cut ON public.incidences(business_id, origin_cut_id);
CREATE INDEX idx_incidences_business_origin_res ON public.incidences(business_id, origin_resource_id);
CREATE INDEX idx_incidence_resolutions_business_inc ON public.incidence_resolutions(business_id, incidence_id);
CREATE INDEX idx_incidence_resolutions_business_jrn ON public.incidence_resolutions(business_id, journal_entry_id);

-- Módulo 3: Operaciones y Correcciones
CREATE INDEX idx_operations_business_status ON public.operations(business_id, status);
CREATE INDEX idx_operations_business_shift ON public.operations(business_id, shift_id);
CREATE INDEX idx_operations_business_src_res ON public.operations(business_id, source_resource_id);
CREATE INDEX idx_operations_business_dst_res ON public.operations(business_id, destination_resource_id);
CREATE INDEX idx_operations_business_created ON public.operations(business_id, created_at DESC);
CREATE INDEX idx_operation_corrections_business_orig ON public.operation_corrections(business_id, original_operation_id);

-- Movimientos Administrativos
CREATE INDEX idx_admin_movements_business_cat ON public.administrative_movements(business_id, category);
CREATE INDEX idx_admin_movements_business_shift ON public.administrative_movements(business_id, shift_id);

-- Módulo 4: Journal y Ledgers
CREATE INDEX idx_journal_entries_business_occurred ON public.journal_entries(business_id, occurred_at DESC);
CREATE UNIQUE INDEX idx_journal_entries_unique_source ON public.journal_entries(business_id, source_entity, source_id);
CREATE INDEX idx_financial_ledger_business_journal ON public.financial_ledger_entries(business_id, journal_entry_id);
CREATE INDEX idx_financial_ledger_resource_seq ON public.financial_ledger_entries(resource_id, entry_sequence DESC);
CREATE INDEX idx_economic_ledger_business_journal ON public.economic_ledger_entries(business_id, journal_entry_id);
CREATE INDEX idx_economic_ledger_business_account ON public.economic_ledger_entries(business_id, account_id);

-- ------------------------------------------------------------------------------
-- 11. INMUTABILIDAD CONTABLE APPEND-ONLY (PROTECCIÓN CONTRA ELIMINACIÓN Y EDICIÓN)
-- ------------------------------------------------------------------------------

-- Función para impedir la eliminación o modificación de asientos contables (journal_entries)
CREATE OR REPLACE FUNCTION public.fn_prevent_journal_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Violación contable: Los asientos de diario (public.journal_entries) son estrictamente append-only. Prohibido eliminar el asiento ID % (Número %). Corrija mediante reversión y un nuevo asiento.',
            OLD.id, OLD.entry_number
            USING ERRCODE = 'integrity_constraint_violation';
    ELSIF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Violación contable: Los asientos de diario (public.journal_entries) son inmutables. Prohibido actualizar el asiento ID % (Número %). Corrija mediante reversión y un nuevo asiento.',
            OLD.id, OLD.entry_number
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NULL;
END;
$$;
COMMENT ON FUNCTION public.fn_prevent_journal_mutation() IS 'Garantiza que ningún asiento de diario pueda ser eliminado o modificado tras su inserción.';

CREATE TRIGGER trg_prevent_journal_mutation
    BEFORE UPDATE OR DELETE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_journal_mutation();

-- Función para impedir la eliminación o modificación de líneas de libro mayor (financial y economic ledgers)
CREATE OR REPLACE FUNCTION public.fn_prevent_ledger_line_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Violación contable: Las líneas del libro mayor (public.%) son estrictamente append-only. Prohibido eliminar la línea ID % perteneciente al asiento %.',
            TG_TABLE_NAME, OLD.id, OLD.journal_entry_id
            USING ERRCODE = 'integrity_constraint_violation';
    ELSIF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Violación contable: Las líneas del libro mayor (public.%) son inmutables. Prohibido actualizar la línea ID % perteneciente al asiento %.',
            TG_TABLE_NAME, OLD.id, OLD.journal_entry_id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NULL;
END;
$$;
COMMENT ON FUNCTION public.fn_prevent_ledger_line_mutation() IS 'Garantiza la inmutabilidad de los registros contables individuales en ambos libros mayores.';

CREATE TRIGGER trg_prevent_financial_ledger_mutation
    BEFORE UPDATE OR DELETE ON public.financial_ledger_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_ledger_line_mutation();

CREATE TRIGGER trg_prevent_economic_ledger_mutation
    BEFORE UPDATE OR DELETE ON public.economic_ledger_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_ledger_line_mutation();

-- Función y trigger para procesar y validar atómicamente la resolución de incidencias
CREATE OR REPLACE FUNCTION public.fn_incidence_resolutions_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_inc RECORD;
    v_new_unresolved pg_catalog.int8;
    v_new_status public.incidence_status;
BEGIN
    -- 1. Bloqueo exclusivo FOR UPDATE de la incidencia para serializar resoluciones concurrentes
    SELECT inc.id, inc.unresolved_amount_cents, inc.original_amount_cents, inc.status, inc.origin_resource_id
    INTO v_inc
    FROM public.incidences inc
    WHERE inc.id = NEW.incidence_id AND inc.business_id = NEW.business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Violación de integridad: La incidencia origen (ID %) no existe o pertenece a otro negocio.',
            NEW.incidence_id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    -- 2. Impedir resolver incidencias ya cerradas o sin saldo pendiente
    IF v_inc.unresolved_amount_cents <= 0 THEN
        RAISE EXCEPTION 'Violación semántica: La incidencia % ya se encuentra completamente resuelta (saldo pendiente: 0).',
            NEW.incidence_id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    -- 3. Evitar sobre-resolución: amount_resolved_cents no puede exceder unresolved_amount_cents
    IF NEW.amount_resolved_cents > v_inc.unresolved_amount_cents THEN
        RAISE EXCEPTION 'Violación semántica: El monto a resolver (% céntimos) excede el saldo no resuelto (% céntimos) de la incidencia %.',
            NEW.amount_resolved_cents, v_inc.unresolved_amount_cents, NEW.incidence_id
            USING ERRCODE = 'check_violation';
    END IF;

    v_new_unresolved := v_inc.unresolved_amount_cents - NEW.amount_resolved_cents;

    -- 4. Determinar nuevo estado según el remanente
    IF v_new_unresolved = 0 THEN
        v_new_status := 'RESOLVED';
    ELSE
        v_new_status := 'PARTIALLY_RESOLVED';
    END IF;

    -- 5. Actualizar la incidencia origen
    UPDATE public.incidences
    SET unresolved_amount_cents = v_new_unresolved,
        status = v_new_status,
        closed_at = CASE WHEN v_new_unresolved = 0 THEN pg_catalog.now() ELSE NULL END
    WHERE id = NEW.incidence_id;

    RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.fn_incidence_resolutions_before_insert() IS 'Aplica bloqueo FOR UPDATE sobre incidences, previene sobre-resolución concurrente y recalcula unresolved_amount_cents.';

CREATE TRIGGER trg_incidence_resolutions_before_insert
    BEFORE INSERT ON public.incidence_resolutions
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_incidence_resolutions_before_insert();

-- ------------------------------------------------------------------------------
-- 12. VALIDACIÓN DIFERIDA DE INTEGRIDAD, CARDINALIDAD Y BALANCE (COMMIT)
-- ------------------------------------------------------------------------------

-- Función de validación atómica del asiento de diario completo
CREATE OR REPLACE FUNCTION public.fn_validate_journal_balance(p_journal_id pg_catalog.uuid)
RETURNS pg_catalog.bool
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_journal RECORD;
    v_fin_sum pg_catalog.int8;
    v_fin_count pg_catalog.int8;
    v_econ_sum pg_catalog.int8;
    v_econ_count pg_catalog.int8;
    v_total_count pg_catalog.int8;
    v_delta pg_catalog.int8;
    v_op RECORD;
    v_adm RECORD;
    v_res RECORD;
    v_count RECORD;
    v_inc_resource pg_catalog.uuid;
BEGIN
    -- 1. Verificar existencia del asiento cabecera (No omitir integridad si fue eliminado)
    SELECT j.id, j.entry_number, j.entry_type, j.business_id, j.source_entity, j.source_id
    INTO v_journal
    FROM public.journal_entries j
    WHERE j.id = p_journal_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Violación de integridad: El asiento contable con ID % referenciado en la transacción no existe o ha sido eliminado.', p_journal_id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    -- 2. Agregar sumas y conteos por separado para prevenir producto cartesiano (N x M)
    --    COALESCE es palabra clave de expresión SQL y no debe llevar prefijo de esquema.
    SELECT
        (SELECT COALESCE(pg_catalog.sum(fl.signed_amount_cents), 0) FROM public.financial_ledger_entries fl WHERE fl.journal_entry_id = p_journal_id),
        (SELECT pg_catalog.count(fl.id) FROM public.financial_ledger_entries fl WHERE fl.journal_entry_id = p_journal_id),
        (SELECT COALESCE(pg_catalog.sum(el.signed_amount_cents), 0) FROM public.economic_ledger_entries el WHERE el.journal_entry_id = p_journal_id),
        (SELECT pg_catalog.count(el.id) FROM public.economic_ledger_entries el WHERE el.journal_entry_id = p_journal_id)
    INTO v_fin_sum, v_fin_count, v_econ_sum, v_econ_count;

    v_total_count := v_fin_count + v_econ_count;

    -- 3. Validación de Asiento Vacío o Incompleto (< 2 líneas en total)
    IF v_total_count = 0 THEN
        RAISE EXCEPTION 'Violación contable: El asiento contable ID % (Número %, Tipo %) está vacío (0 líneas en financial_ledger_entries y economic_ledger_entries). Todo journal_entry debe tener líneas contables asociadas.',
            v_journal.id, v_journal.entry_number, v_journal.entry_type
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF v_total_count < 2 THEN
        RAISE EXCEPTION 'Violación contable: El asiento contable ID % (Número %, Tipo %) contiene solo % línea(s). La partida doble requiere al menos 2 líneas para balancearse.',
            v_journal.id, v_journal.entry_number, v_journal.entry_type, v_total_count
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    -- 4. Validación Semántica Estricta por Tipo y Subtipo de Hecho Contable

    -- 4.1 Operaciones de Clientes (customer_operation)
    IF v_journal.entry_type = 'customer_operation' THEN
        IF v_journal.source_entity != 'operations' THEN
            RAISE EXCEPTION 'Violación semántica: Los asientos customer_operation deben referenciar a operations (source_entity actual: %).',
                v_journal.source_entity
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        SELECT op.type, op.origin, op.status, op.amount_cents, op.commission_cents, op.total_cents, op.source_resource_id, op.destination_resource_id
        INTO v_op
        FROM public.operations op
        WHERE op.id = v_journal.source_id AND op.business_id = v_journal.business_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Violación de integridad: La operación de cliente origen (ID %) no existe o pertenece a otro negocio.',
                v_journal.source_id
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        -- Validar op.status
        IF v_op.status IN ('cancelled', 'corrected') THEN
            RAISE EXCEPTION 'Violación semántica: La operación de cliente está en estado % y no admite nuevos asientos directos.',
                v_op.status
                USING ERRCODE = 'integrity_constraint_violation';
        ELSIF v_op.status NOT IN ('completed', 'pending_cash_delivery') THEN
            RAISE EXCEPTION 'Violación semántica: Estado de operación de cliente no reconocido o no operativo: %.',
                v_op.status
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        -- Validar op.type y op.origin
        IF v_op.type NOT IN ('deposit', 'withdrawal') THEN
            RAISE EXCEPTION 'Violación semántica: Tipo de operación de cliente no reconocido: %.',
                v_op.type
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        IF v_op.origin NOT IN ('NORMAL', 'AUDIT_ADJUSTMENT', 'AUDIT_RECLASSIFICATION') THEN
            RAISE EXCEPTION 'Violación semántica: Origen de operación no reconocido: %.',
                v_op.origin
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        IF v_op.origin = 'AUDIT_RECLASSIFICATION' THEN
            -- Excepción legítima puramente económica: Efectivo ya contado previamente
            IF v_fin_count != 0 THEN
                RAISE EXCEPTION 'Violación semántica: Las operaciones AUDIT_RECLASSIFICATION no deben tener líneas de tesorería (N=0 obligatorio, detectadas: %). El efectivo ya fue arqueado previamente.',
                    v_fin_count
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            IF v_op.commission_cents > 0 THEN
                IF v_econ_count != 2 THEN
                    RAISE EXCEPTION 'Violación semántica: Las operaciones AUDIT_RECLASSIFICATION con comisión requieren exactamente 2 líneas económicas (M=2, detectadas: %).',
                        v_econ_count
                        USING ERRCODE = 'integrity_constraint_violation';
                END IF;

                -- Cuentas concretas, signos e importes (debe registrar la comisión, no el capital del cliente)
                IF NOT EXISTS (
                    SELECT 1 FROM public.economic_ledger_entries el
                    JOIN public.chart_of_accounts coa ON coa.id = el.account_id
                    WHERE el.journal_entry_id = p_journal_id
                      AND coa.code = 'CUSTODY_DISCREPANCY_SUSPENSE'
                      AND el.direction = 'DEBIT'
                      AND el.amount_cents = v_op.commission_cents
                ) THEN
                    RAISE EXCEPTION 'Violación semántica: AUDIT_RECLASSIFICATION exige DEBIT a CUSTODY_DISCREPANCY_SUSPENSE por la comisión ganada (% céntimos).',
                        v_op.commission_cents
                        USING ERRCODE = 'integrity_constraint_violation';
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM public.economic_ledger_entries el
                    JOIN public.chart_of_accounts coa ON coa.id = el.account_id
                    WHERE el.journal_entry_id = p_journal_id
                      AND (coa.code = 'REV_COMMISSIONS' OR coa.type = 'revenue')
                      AND el.direction = 'CREDIT'
                      AND el.amount_cents = v_op.commission_cents
                ) THEN
                    RAISE EXCEPTION 'Violación semántica: AUDIT_RECLASSIFICATION exige CREDIT a REV_COMMISSIONS por la comisión ganada (% céntimos).',
                        v_op.commission_cents
                        USING ERRCODE = 'integrity_constraint_violation';
                END IF;
            ELSE
                -- Sin comisión: ambos cortes ya reconocieron la realidad física y de banco, M=0
                IF v_econ_count != 0 THEN
                    RAISE EXCEPTION 'Violación semántica: AUDIT_RECLASSIFICATION con comisión cero no debe tener líneas económicas (M=0 obligatorio, detectadas: %).',
                        v_econ_count
                        USING ERRCODE = 'integrity_constraint_violation';
                END IF;
            END IF;

        ELSE
            -- Operaciones ordinarias (NORMAL, AUDIT_ADJUSTMENT):
            -- Validar cardinalidad financiera: exactamente 2 líneas de tesorería (entrada y salida)
            IF v_fin_count != 2 THEN
                RAISE EXCEPTION 'Violación semántica: Las operaciones ordinarias de cliente (% - %) requieren exactamente 2 líneas de tesorería (N=2, detectadas: %).',
                    v_op.type, v_op.origin, v_fin_count
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            -- Validar recurso origen (INFLOW de total_cents)
            IF NOT EXISTS (
                SELECT 1 FROM public.financial_ledger_entries fl
                WHERE fl.journal_entry_id = p_journal_id
                  AND fl.resource_id = v_op.source_resource_id
                  AND fl.direction = 'INFLOW'
                  AND fl.amount_cents = v_op.total_cents
            ) THEN
                RAISE EXCEPTION 'Violación semántica: La operación de cliente exige INFLOW en el recurso origen % por el total (% céntimos).',
                    v_op.source_resource_id, v_op.total_cents
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            -- Validar recurso destino (OUTFLOW de amount_cents)
            IF NOT EXISTS (
                SELECT 1 FROM public.financial_ledger_entries fl
                WHERE fl.journal_entry_id = p_journal_id
                  AND fl.resource_id = v_op.destination_resource_id
                  AND fl.direction = 'OUTFLOW'
                  AND fl.amount_cents = v_op.amount_cents
            ) THEN
                RAISE EXCEPTION 'Violación semántica: La operación de cliente exige OUTFLOW en el recurso destino % por el principal (% céntimos).',
                    v_op.destination_resource_id, v_op.amount_cents
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            -- Validar comisión económica
            IF v_op.commission_cents > 0 THEN
                IF v_econ_count != 1 THEN
                    RAISE EXCEPTION 'Violación semántica: Las operaciones de cliente con comisión (% céntimos) requieren exactamente 1 línea económica (M=1, detectadas: %).',
                        v_op.commission_cents, v_econ_count
                        USING ERRCODE = 'integrity_constraint_violation';
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM public.economic_ledger_entries el
                    JOIN public.chart_of_accounts coa ON coa.id = el.account_id
                    WHERE el.journal_entry_id = p_journal_id
                      AND (coa.code = 'REV_COMMISSIONS' OR coa.type = 'revenue')
                      AND el.direction = 'CREDIT'
                      AND el.amount_cents = v_op.commission_cents
                ) THEN
                    RAISE EXCEPTION 'Violación semántica: La operación exige CREDIT a cuenta de ingreso (REV_COMMISSIONS) por la comisión (% céntimos).',
                        v_op.commission_cents
                        USING ERRCODE = 'integrity_constraint_violation';
                END IF;
            ELSE
                -- Comisión cero (promocional / sin cobro de tarifa)
                IF v_econ_count != 0 THEN
                    RAISE EXCEPTION 'Violación semántica: Las operaciones de cliente con comisión cero no deben tener líneas económicas (M=0 obligatorio, detectadas: %).',
                        v_econ_count
                        USING ERRCODE = 'integrity_constraint_violation';
                END IF;
            END IF;
        END IF;

    -- 4.2 Movimientos Administrativos (administrative_movement)
    ELSIF v_journal.entry_type = 'administrative_movement' THEN
        IF v_journal.source_entity != 'administrative_movements' THEN
            RAISE EXCEPTION 'Violación semántica: Los asientos administrative_movement deben referenciar a administrative_movements (source_entity actual: %).',
                v_journal.source_entity
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        SELECT adm.category, adm.amount_cents, adm.origin_resource_id, adm.destination_resource_id
        INTO v_adm
        FROM public.administrative_movements adm
        WHERE adm.id = v_journal.source_id AND adm.business_id = v_journal.business_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Violación de integridad: El movimiento administrativo origen (ID %) no existe o pertenece a otro negocio.',
                v_journal.source_id
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        IF v_adm.category = 'transfer_internal' THEN
            -- Exige al menos dos líneas financieras y cero líneas económicas
            IF v_econ_count != 0 THEN
                RAISE EXCEPTION 'Violación semántica: Los traslados internos (transfer_internal) son puramente financieros y no deben tener líneas económicas (M=0 obligatorio, detectadas: %).',
                    v_econ_count
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF v_fin_count < 2 THEN
                RAISE EXCEPTION 'Violación semántica: Los traslados internos (transfer_internal) requieren al menos dos líneas financieras (detectadas: %).',
                    v_fin_count
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            -- Recursos distintos válidos del mismo negocio
            IF v_adm.origin_resource_id IS NULL OR v_adm.destination_resource_id IS NULL THEN
                RAISE EXCEPTION 'Violación semántica: Los traslados internos requieren recurso de origen y de destino obligatorios.'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF v_adm.origin_resource_id = v_adm.destination_resource_id THEN
                RAISE EXCEPTION 'Violación semántica: Los traslados internos requieren que el recurso de origen y destino sean distintos.'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            -- Salida e ingreso por el mismo importe
            DECLARE
                v_out_amount pg_catalog.int8;
                v_in_amount pg_catalog.int8;
            BEGIN
                SELECT fl.amount_cents INTO v_out_amount
                FROM public.financial_ledger_entries fl
                WHERE fl.journal_entry_id = p_journal_id 
                  AND fl.resource_id = v_adm.origin_resource_id 
                  AND fl.direction = 'OUTFLOW';

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Violación semántica: El traslado interno carece de la línea de salida (OUTFLOW) del recurso origen %.',
                        v_adm.origin_resource_id
                        USING ERRCODE = 'integrity_constraint_violation';
                END IF;

                SELECT fl.amount_cents INTO v_in_amount
                FROM public.financial_ledger_entries fl
                WHERE fl.journal_entry_id = p_journal_id 
                  AND fl.resource_id = v_adm.destination_resource_id 
                  AND fl.direction = 'INFLOW';

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Violación semántica: El traslado interno carece de la línea de entrada (INFLOW) al recurso destino %.',
                        v_adm.destination_resource_id
                        USING ERRCODE = 'integrity_constraint_violation';
                END IF;

                IF v_out_amount != v_in_amount OR v_out_amount != v_adm.amount_cents THEN
                    RAISE EXCEPTION 'Violación semántica: En un traslado interno la salida (% céntimos) y la entrada (% céntimos) deben ser idénticas y coincidir con el monto declarado (% céntimos).',
                        v_out_amount, v_in_amount, v_adm.amount_cents
                        USING ERRCODE = 'integrity_constraint_violation';
                END IF;
            END;

        ELSIF v_adm.category = 'funding_in' THEN
            -- Fondeo de tesorería: Entrada a destination_resource_id y contrapartida patrimonial o clearing
            IF v_fin_count != 1 OR v_econ_count != 1 THEN
                RAISE EXCEPTION 'Violación semántica: funding_in requiere exactamente 1 línea de tesorería (N=1) y 1 línea económica (M=1).'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF v_adm.destination_resource_id IS NULL THEN
                RAISE EXCEPTION 'Violación semántica: funding_in requiere destination_resource_id obligatorio.'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM public.financial_ledger_entries fl
                WHERE fl.journal_entry_id = p_journal_id
                  AND fl.resource_id = v_adm.destination_resource_id
                  AND fl.direction = 'INFLOW'
                  AND fl.amount_cents = v_adm.amount_cents
            ) THEN
                RAISE EXCEPTION 'Violación semántica: funding_in exige INFLOW al recurso destino % por % céntimos.',
                    v_adm.destination_resource_id, v_adm.amount_cents
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM public.economic_ledger_entries el
                JOIN public.chart_of_accounts coa ON coa.id = el.account_id
                WHERE el.journal_entry_id = p_journal_id
                  AND coa.type IN ('equity', 'clearing_control')
                  AND el.direction = 'CREDIT'
                  AND el.amount_cents = v_adm.amount_cents
            ) THEN
                RAISE EXCEPTION 'Violación semántica: funding_in exige CREDIT a cuenta de patrimonio o clearing por % céntimos.',
                    v_adm.amount_cents
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

        ELSIF v_adm.category = 'expense_out' THEN
            -- Gasto operativo pagado: Salida de origin_resource_id y contrapartida de gasto
            IF v_fin_count != 1 OR v_econ_count != 1 THEN
                RAISE EXCEPTION 'Violación semántica: expense_out requiere exactamente 1 línea de salida de tesorería (N=1) y 1 línea de gasto (M=1).'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF v_adm.origin_resource_id IS NULL THEN
                RAISE EXCEPTION 'Violación semántica: expense_out requiere origin_resource_id obligatorio.'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM public.financial_ledger_entries fl
                WHERE fl.journal_entry_id = p_journal_id
                  AND fl.resource_id = v_adm.origin_resource_id
                  AND fl.direction = 'OUTFLOW'
                  AND fl.amount_cents = v_adm.amount_cents
            ) THEN
                RAISE EXCEPTION 'Violación semántica: expense_out exige OUTFLOW del recurso origen % por % céntimos.',
                    v_adm.origin_resource_id, v_adm.amount_cents
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM public.economic_ledger_entries el
                JOIN public.chart_of_accounts coa ON coa.id = el.account_id
                WHERE el.journal_entry_id = p_journal_id
                  AND coa.type = 'expense'
                  AND el.direction = 'DEBIT'
                  AND el.amount_cents = v_adm.amount_cents
            ) THEN
                RAISE EXCEPTION 'Violación semántica: expense_out exige DEBIT a cuenta de gasto por % céntimos.',
                    v_adm.amount_cents
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

        ELSIF v_adm.category = 'owner_capital_injection' THEN
            -- Aportación de capital: Entrada a destination_resource_id y crédito a patrimonio (equity)
            IF v_fin_count != 1 OR v_econ_count != 1 THEN
                RAISE EXCEPTION 'Violación semántica: owner_capital_injection requiere exactamente 1 línea de tesorería (N=1) y 1 línea de patrimonio (M=1).'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF v_adm.destination_resource_id IS NULL THEN
                RAISE EXCEPTION 'Violación semántica: owner_capital_injection requiere destination_resource_id obligatorio.'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM public.financial_ledger_entries fl
                WHERE fl.journal_entry_id = p_journal_id
                  AND fl.resource_id = v_adm.destination_resource_id
                  AND fl.direction = 'INFLOW'
                  AND fl.amount_cents = v_adm.amount_cents
            ) THEN
                RAISE EXCEPTION 'Violación semántica: owner_capital_injection exige INFLOW al recurso destino % por % céntimos.',
                    v_adm.destination_resource_id, v_adm.amount_cents
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM public.economic_ledger_entries el
                JOIN public.chart_of_accounts coa ON coa.id = el.account_id
                WHERE el.journal_entry_id = p_journal_id
                  AND coa.type = 'equity'
                  AND el.direction = 'CREDIT'
                  AND el.amount_cents = v_adm.amount_cents
            ) THEN
                RAISE EXCEPTION 'Violación semántica: owner_capital_injection exige CREDIT a cuenta de patrimonio (equity) por % céntimos.',
                    v_adm.amount_cents
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

        ELSIF v_adm.category = 'owner_drawing_withdrawal' THEN
            -- Retiro de utilidades del dueño: Salida de origin_resource_id y débito a patrimonio (equity)
            IF v_fin_count != 1 OR v_econ_count != 1 THEN
                RAISE EXCEPTION 'Violación semántica: owner_drawing_withdrawal requiere exactamente 1 línea de tesorería (N=1) y 1 línea de patrimonio (M=1).'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF v_adm.origin_resource_id IS NULL THEN
                RAISE EXCEPTION 'Violación semántica: owner_drawing_withdrawal requiere origin_resource_id obligatorio.'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM public.financial_ledger_entries fl
                WHERE fl.journal_entry_id = p_journal_id
                  AND fl.resource_id = v_adm.origin_resource_id
                  AND fl.direction = 'OUTFLOW'
                  AND fl.amount_cents = v_adm.amount_cents
            ) THEN
                RAISE EXCEPTION 'Violación semántica: owner_drawing_withdrawal exige OUTFLOW del recurso origen % por % céntimos.',
                    v_adm.origin_resource_id, v_adm.amount_cents
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM public.economic_ledger_entries el
                JOIN public.chart_of_accounts coa ON coa.id = el.account_id
                WHERE el.journal_entry_id = p_journal_id
                  AND coa.type = 'equity'
                  AND el.direction = 'DEBIT'
                  AND el.amount_cents = v_adm.amount_cents
            ) THEN
                RAISE EXCEPTION 'Violación semántica: owner_drawing_withdrawal exige DEBIT a cuenta de patrimonio (equity) por % céntimos.',
                    v_adm.amount_cents
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

        ELSIF v_adm.category = 'reconciliation_adjustment' THEN
            IF v_fin_count != 1 OR v_econ_count != 1 THEN
                RAISE EXCEPTION 'Violación semántica: reconciliation_adjustment requiere exactamente N=1 y M=1.'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF v_adm.origin_resource_id IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.financial_ledger_entries fl
                    WHERE fl.journal_entry_id = p_journal_id
                      AND fl.resource_id = v_adm.origin_resource_id
                      AND fl.direction = 'OUTFLOW'
                      AND fl.amount_cents = v_adm.amount_cents
                ) THEN
                    RAISE EXCEPTION 'Violación semántica: reconciliation_adjustment de salida exige OUTFLOW de origin_resource_id por % céntimos.',
                        v_adm.amount_cents
                        USING ERRCODE = 'integrity_constraint_violation';
                END IF;
            ELSIF v_adm.destination_resource_id IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.financial_ledger_entries fl
                    WHERE fl.journal_entry_id = p_journal_id
                      AND fl.resource_id = v_adm.destination_resource_id
                      AND fl.direction = 'INFLOW'
                      AND fl.amount_cents = v_adm.amount_cents
                ) THEN
                    RAISE EXCEPTION 'Violación semántica: reconciliation_adjustment de entrada exige INFLOW a destination_resource_id por % céntimos.',
                        v_adm.amount_cents
                        USING ERRCODE = 'integrity_constraint_violation';
                END IF;
            END IF;
        ELSE
            RAISE EXCEPTION 'Violación semántica: Categoría administrativa no reconocida: %.',
                v_adm.category
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

    -- 4.3 Cortes y Conciliaciones (cut_reconciliation)
    ELSIF v_journal.entry_type = 'cut_reconciliation' THEN
        IF v_journal.source_entity != 'cuts' THEN
            RAISE EXCEPTION 'Violación semántica: Los asientos cut_reconciliation deben referenciar a cuts (source_entity actual: %).',
                v_journal.source_entity
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        DECLARE
            v_cut RECORD;
            v_expected_adjustments_count pg_catalog.int8 := 0;
        BEGIN
            SELECT c.status
            INTO v_cut
            FROM public.cuts c
            WHERE c.id = v_journal.source_id AND c.business_id = v_journal.business_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Violación de integridad: El corte origen (ID %) no existe o pertenece a otro negocio.',
                    v_journal.source_id
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            IF v_cut.status NOT IN ('completed', 'completed_with_issues') THEN
                RAISE EXCEPTION 'Violación semántica: Solo se permite emitir reconciliación para cortes con estado completed o completed_with_issues (estado actual: %).',
                    v_cut.status
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            IF v_fin_count < 1 OR v_econ_count < 1 THEN
                RAISE EXCEPTION 'Violación semántica: Los cortes (cut_reconciliation) requieren obligatoriamente ajustar un recurso de tesorería (N >= 1) contra la cuenta de suspenso (M >= 1).'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            -- Todas las líneas económicas deben imputarse a CUSTODY_DISCREPANCY_SUSPENSE
            IF EXISTS (
                SELECT 1 FROM public.economic_ledger_entries el
                JOIN public.chart_of_accounts coa ON coa.id = el.account_id
                WHERE el.journal_entry_id = p_journal_id
                  AND coa.code != 'CUSTODY_DISCREPANCY_SUSPENSE'
            ) THEN
                RAISE EXCEPTION 'Violación semántica: En cut_reconciliation todas las líneas económicas deben registrarse exclusivamente en la cuenta CUSTODY_DISCREPANCY_SUSPENSE.'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            -- Validar correspondencia con arqueos físicos (cut_cash_counts) y conciliaciones bancarias (bank_audits)
            FOR v_count IN (
                SELECT resource_id, difference_cents
                FROM public.cut_cash_counts
                WHERE cut_id = v_journal.source_id AND difference_cents != 0
                UNION ALL
                SELECT resource_id, difference_cents
                FROM public.bank_audits
                WHERE cut_id = v_journal.source_id AND difference_cents != 0
            ) LOOP
                v_expected_adjustments_count := v_expected_adjustments_count + 1;

                IF v_count.difference_cents < 0 THEN
                    IF NOT EXISTS (
                        SELECT 1 FROM public.financial_ledger_entries fl
                        WHERE fl.journal_entry_id = p_journal_id
                          AND fl.resource_id = v_count.resource_id
                          AND fl.direction = 'OUTFLOW'
                          AND fl.amount_cents = pg_catalog.abs(v_count.difference_cents)
                    ) THEN
                        RAISE EXCEPTION 'Violación semántica: El corte exige ajuste de salida (OUTFLOW) en el recurso % por el faltante de % céntimos.',
                            v_count.resource_id, pg_catalog.abs(v_count.difference_cents)
                            USING ERRCODE = 'integrity_constraint_violation';
                    END IF;
                ELSIF v_count.difference_cents > 0 THEN
                    IF NOT EXISTS (
                        SELECT 1 FROM public.financial_ledger_entries fl
                        WHERE fl.journal_entry_id = p_journal_id
                          AND fl.resource_id = v_count.resource_id
                          AND fl.direction = 'INFLOW'
                          AND fl.amount_cents = v_count.difference_cents
                    ) THEN
                        RAISE EXCEPTION 'Violación semántica: El corte exige ajuste de entrada (INFLOW) en el recurso % por el sobrante de % céntimos.',
                            v_count.resource_id, v_count.difference_cents
                            USING ERRCODE = 'integrity_constraint_violation';
                    END IF;
                END IF;
            END LOOP;

            -- Si hubo conteos con diferencias registradas, verificar que no existan líneas financieras espurias
            IF v_expected_adjustments_count > 0 AND v_fin_count != v_expected_adjustments_count THEN
                RAISE EXCEPTION 'Violación semántica: La cantidad de líneas de tesorería del corte (%) difiere de la cantidad de discrepancias auditadas (%).',
                    v_fin_count, v_expected_adjustments_count
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
        END;

    -- 4.4 Resoluciones de Incidencia (incidence_resolution)
    ELSIF v_journal.entry_type = 'incidence_resolution' THEN
        IF v_journal.source_entity != 'incidence_resolutions' THEN
            RAISE EXCEPTION 'Violación semántica: Los asientos incidence_resolution deben referenciar a incidence_resolutions (source_entity actual: %).',
                v_journal.source_entity
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        SELECT res.event_type, res.amount_resolved_cents, res.incidence_id
        INTO v_res
        FROM public.incidence_resolutions res
        WHERE res.id = v_journal.source_id AND res.business_id = v_journal.business_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Violación de integridad: La resolución de incidencia origen (ID %) no existe o pertenece a otro negocio.',
                v_journal.source_id
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        IF v_res.event_type = 'confirmed_loss' THEN
            IF v_fin_count != 0 THEN
                RAISE EXCEPTION 'Violación semántica: confirmed_loss no debe mover tesorería (N=0 obligatorio, detectadas: %).',
                    v_fin_count
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF v_econ_count != 2 THEN
                RAISE EXCEPTION 'Violación semántica: confirmed_loss requiere exactamente 2 líneas económicas (M=2, detectadas: %).',
                    v_econ_count
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM public.economic_ledger_entries el
                JOIN public.chart_of_accounts coa ON coa.id = el.account_id
                WHERE el.journal_entry_id = p_journal_id
                  AND (coa.code = 'EXP_CONFIRMED_LOSS' OR coa.type = 'expense')
                  AND el.direction = 'DEBIT'
                  AND el.amount_cents = v_res.amount_resolved_cents
            ) THEN
                RAISE EXCEPTION 'Violación semántica: confirmed_loss exige DEBIT a cuenta de gasto por % céntimos.',
                    v_res.amount_resolved_cents
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM public.economic_ledger_entries el
                JOIN public.chart_of_accounts coa ON coa.id = el.account_id
                WHERE el.journal_entry_id = p_journal_id
                  AND coa.code = 'CUSTODY_DISCREPANCY_SUSPENSE'
                  AND el.direction = 'CREDIT'
                  AND el.amount_cents = v_res.amount_resolved_cents
            ) THEN
                RAISE EXCEPTION 'Violación semántica: confirmed_loss exige CREDIT a CUSTODY_DISCREPANCY_SUSPENSE por % céntimos.',
                    v_res.amount_resolved_cents
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

        ELSIF v_res.event_type = 'confirmed_surplus' THEN
            IF v_fin_count != 0 THEN
                RAISE EXCEPTION 'Violación semántica: confirmed_surplus no debe mover tesorería (N=0 obligatorio, detectadas: %).',
                    v_fin_count
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF v_econ_count != 2 THEN
                RAISE EXCEPTION 'Violación semántica: confirmed_surplus requiere exactamente 2 líneas económicas (M=2, detectadas: %).',
                    v_econ_count
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM public.economic_ledger_entries el
                JOIN public.chart_of_accounts coa ON coa.id = el.account_id
                WHERE el.journal_entry_id = p_journal_id
                  AND coa.code = 'CUSTODY_DISCREPANCY_SUSPENSE'
                  AND el.direction = 'DEBIT'
                  AND el.amount_cents = v_res.amount_resolved_cents
            ) THEN
                RAISE EXCEPTION 'Violación semántica: confirmed_surplus exige DEBIT a CUSTODY_DISCREPANCY_SUSPENSE por % céntimos.',
                    v_res.amount_resolved_cents
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM public.economic_ledger_entries el
                JOIN public.chart_of_accounts coa ON coa.id = el.account_id
                WHERE el.journal_entry_id = p_journal_id
                  AND coa.type = 'revenue'
                  AND el.direction = 'CREDIT'
                  AND el.amount_cents = v_res.amount_resolved_cents
            ) THEN
                RAISE EXCEPTION 'Violación semántica: confirmed_surplus exige CREDIT a cuenta de ingreso por % céntimos.',
                    v_res.amount_resolved_cents
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

        ELSIF v_res.event_type IN ('reintegration_partial', 'reintegration_final') THEN
            IF v_fin_count != 1 OR v_econ_count != 1 THEN
                RAISE EXCEPTION 'Violación semántica: Los reintegros de faltantes requieren exactamente 1 línea de tesorería (N=1) y 1 línea económica (M=1).'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            -- Obtener el recurso original de la incidencia para validar que el dinero ingrese a la caja/banco correcta
            SELECT inc.origin_resource_id INTO v_inc_resource
            FROM public.incidences inc
            WHERE inc.id = v_res.incidence_id AND inc.business_id = v_journal.business_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Violación de integridad: La incidencia asociada (ID %) no existe o pertenece a otro negocio.',
                    v_res.incidence_id
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM public.financial_ledger_entries fl
                WHERE fl.journal_entry_id = p_journal_id
                  AND fl.resource_id = v_inc_resource
                  AND fl.direction = 'INFLOW'
                  AND fl.amount_cents = v_res.amount_resolved_cents
            ) THEN
                RAISE EXCEPTION 'Violación semántica: El reintegro exige INFLOW en el recurso original de la incidencia (%) por % céntimos.',
                    v_inc_resource, v_res.amount_resolved_cents
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM public.economic_ledger_entries el
                JOIN public.chart_of_accounts coa ON coa.id = el.account_id
                WHERE el.journal_entry_id = p_journal_id
                  AND coa.code = 'CUSTODY_DISCREPANCY_SUSPENSE'
                  AND el.direction = 'CREDIT'
                  AND el.amount_cents = v_res.amount_resolved_cents
            ) THEN
                RAISE EXCEPTION 'Violación semántica: El reintegro exige CREDIT a CUSTODY_DISCREPANCY_SUSPENSE por % céntimos.',
                    v_res.amount_resolved_cents
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

        ELSIF v_res.event_type = 'explained_by_operation' THEN
            RAISE EXCEPTION 'Violación semántica: Las resoluciones explained_by_operation no emiten asiento propio (el hecho contable corresponde a la operación explicativa).'
                USING ERRCODE = 'integrity_constraint_violation';
        ELSE
            RAISE EXCEPTION 'Violación semántica: Tipo de resolución de incidencia desconocido: %.',
                v_res.event_type
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

    -- 4.5 Correcciones de Operación (operation_correction)
    ELSIF v_journal.entry_type = 'operation_correction' THEN
        IF v_journal.source_entity != 'operation_corrections' THEN
            RAISE EXCEPTION 'Violación semántica: Los asientos operation_correction deben referenciar a operation_corrections (source_entity actual: %).',
                v_journal.source_entity
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        DECLARE
            v_corr RECORD;
            v_orig_journal RECORD;
            v_mismatch_count pg_catalog.int8;
            v_orig_fin_count pg_catalog.int8;
            v_orig_econ_count pg_catalog.int8;
        BEGIN
            SELECT corr.original_operation_id, corr.reversal_operation_id, corr.replacement_operation_id
            INTO v_corr
            FROM public.operation_corrections corr
            WHERE corr.id = v_journal.source_id AND corr.business_id = v_journal.business_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Violación de integridad: El registro de corrección origen (ID %) no existe o pertenece a otro negocio.',
                    v_journal.source_id
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            -- Localizar el asiento original
            SELECT j.id, j.entry_number, j.entry_type
            INTO v_orig_journal
            FROM public.journal_entries j
            WHERE j.source_entity = 'operations' 
              AND j.source_id = v_corr.original_operation_id 
              AND j.business_id = v_journal.business_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Violación de integridad: No se encontró el asiento de diario original correspondiente a la operación %.',
                    v_corr.original_operation_id
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            -- Impedir revertir dos veces el mismo asiento original
            SELECT pg_catalog.count(j.id)
            INTO v_mismatch_count
            FROM public.journal_entries j
            JOIN public.operation_corrections oc ON oc.id = j.source_id
            WHERE j.entry_type = 'operation_correction'
              AND j.business_id = v_journal.business_id
              AND oc.original_operation_id = v_corr.original_operation_id
              AND j.id != v_journal.id;

            IF v_mismatch_count > 0 THEN
                RAISE EXCEPTION 'Violación de integridad: El asiento original (Operación %) ya fue revertido por otro asiento. No se permite doble reversión.',
                    v_corr.original_operation_id
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            -- Reversión fiel espejo: misma cardinalidad total
            SELECT pg_catalog.count(fl.id) INTO v_orig_fin_count FROM public.financial_ledger_entries fl WHERE fl.journal_entry_id = v_orig_journal.id;
            SELECT pg_catalog.count(el.id) INTO v_orig_econ_count FROM public.economic_ledger_entries el WHERE el.journal_entry_id = v_orig_journal.id;

            IF v_fin_count != v_orig_fin_count OR v_econ_count != v_orig_econ_count THEN
                RAISE EXCEPTION 'Violación semántica: La reversión no es fiel. Cardinalidad original (Fin: %, Econ: %) difiere de reversión (Fin: %, Econ: %).',
                    v_orig_fin_count, v_orig_econ_count, v_fin_count, v_econ_count
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            -- Reversión fiel: cada línea financiera original con dirección invertida y misma multiplicidad (Multiconjunto Biyectivo)
            SELECT pg_catalog.count(*)
            INTO v_mismatch_count
            FROM (
                SELECT resource_id, amount_cents,
                       CASE WHEN direction = 'INFLOW' THEN 'OUTFLOW'::public.financial_direction ELSE 'INFLOW'::public.financial_direction END AS exp_direction,
                       pg_catalog.count(*) AS cnt
                FROM public.financial_ledger_entries
                WHERE journal_entry_id = v_orig_journal.id
                GROUP BY resource_id, amount_cents, direction
            ) o
            FULL OUTER JOIN (
                SELECT resource_id, amount_cents, direction, pg_catalog.count(*) AS cnt
                FROM public.financial_ledger_entries
                WHERE journal_entry_id = v_journal.id
                GROUP BY resource_id, amount_cents, direction
            ) r ON o.resource_id = r.resource_id
               AND o.amount_cents = r.amount_cents
               AND o.exp_direction = r.direction
            WHERE o.cnt IS DISTINCT FROM r.cnt;

            IF v_mismatch_count > 0 THEN
                RAISE EXCEPTION 'Violación semántica: La reversión financiera no es espejo multiconjunto exacto del asiento original (cardinalidades, montos, recursos o direcciones no coinciden).'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;

            -- Reversión fiel: cada línea económica original con dirección invertida y misma multiplicidad (Multiconjunto Biyectivo)
            SELECT pg_catalog.count(*)
            INTO v_mismatch_count
            FROM (
                SELECT account_id, amount_cents,
                       CASE WHEN direction = 'DEBIT' THEN 'CREDIT'::public.economic_direction ELSE 'DEBIT'::public.economic_direction END AS exp_direction,
                       pg_catalog.count(*) AS cnt
                FROM public.economic_ledger_entries
                WHERE journal_entry_id = v_orig_journal.id
                GROUP BY account_id, amount_cents, direction
            ) o
            FULL OUTER JOIN (
                SELECT account_id, amount_cents, direction, pg_catalog.count(*) AS cnt
                FROM public.economic_ledger_entries
                WHERE journal_entry_id = v_journal.id
                GROUP BY account_id, amount_cents, direction
            ) r ON o.account_id = r.account_id
               AND o.amount_cents = r.amount_cents
               AND o.exp_direction = r.direction
            WHERE o.cnt IS DISTINCT FROM r.cnt;

            IF v_mismatch_count > 0 THEN
                RAISE EXCEPTION 'Violación semántica: La reversión económica no es espejo multiconjunto exacto del asiento original (cardinalidades, montos, cuentas o direcciones no coinciden).'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
        END;

    ELSE
        RAISE EXCEPTION 'Violación semántica: Tipo de asiento no reconocido: %.',
            v_journal.entry_type
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    -- 5. Invariante Universal de Conservación: SUM(financial) + SUM(economic) = 0
    v_delta := v_fin_sum + v_econ_sum;
    IF v_delta != 0 THEN
        RAISE EXCEPTION 'Violación de balance contable: El asiento contable ID % (Número %, Tipo %) está desbalanceado. Suma tesorería: % céntimos, Suma económica: % céntimos, Descuadre neto: % céntimos (debe ser 0).',
            v_journal.id, v_journal.entry_number, v_journal.entry_type, v_fin_sum, v_econ_sum, v_delta
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN true;
END;
$$;
COMMENT ON FUNCTION public.fn_validate_journal_balance(pg_catalog.uuid) IS 'Valida atómicamente la existencia, subtipo, cardinalidad, cuentas contables y balance neto cero SUM(fin)+SUM(econ)=0 del asiento.';

-- Función disparadora para constraint triggers diferidos
CREATE OR REPLACE FUNCTION public.fn_trigger_validate_journal_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Disparador en journal_entries
    IF TG_TABLE_NAME = 'journal_entries' THEN
        IF TG_OP = 'INSERT' THEN
            PERFORM public.fn_validate_journal_balance(NEW.id);
        ELSIF TG_OP = 'UPDATE' THEN
            IF OLD.id != NEW.id THEN
                PERFORM public.fn_validate_journal_balance(OLD.id);
            END IF;
            PERFORM public.fn_validate_journal_balance(NEW.id);
        ELSIF TG_OP = 'DELETE' THEN
            -- Valida OLD.id (que disparará excepción por registro no encontrado)
            PERFORM public.fn_validate_journal_balance(OLD.id);
        END IF;
        RETURN NEW;
    END IF;

    -- Disparador en financial_ledger_entries o economic_ledger_entries
    IF TG_OP = 'INSERT' THEN
        PERFORM public.fn_validate_journal_balance(NEW.journal_entry_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.fn_validate_journal_balance(OLD.journal_entry_id);
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.journal_entry_id != NEW.journal_entry_id THEN
            -- Valida tanto el Journal anterior como el nuevo cuando cambie journal_entry_id
            PERFORM public.fn_validate_journal_balance(OLD.journal_entry_id);
        END IF;
        PERFORM public.fn_validate_journal_balance(NEW.journal_entry_id);
    END IF;

    RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.fn_trigger_validate_journal_balance() IS 'Disparador diferido que invoca la validación atómica al COMMIT.';

-- Constraint Triggers DEFERRABLE INITIALLY DEFERRED
CREATE CONSTRAINT TRIGGER trg_validate_journal_balance_header
    AFTER INSERT OR UPDATE ON public.journal_entries
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_trigger_validate_journal_balance();

CREATE CONSTRAINT TRIGGER trg_validate_journal_balance_financial
    AFTER INSERT OR UPDATE OR DELETE ON public.financial_ledger_entries
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_trigger_validate_journal_balance();

CREATE CONSTRAINT TRIGGER trg_validate_journal_balance_economic
    AFTER INSERT OR UPDATE OR DELETE ON public.economic_ledger_entries
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_trigger_validate_journal_balance();

-- ------------------------------------------------------------------------------
-- 13. BLINDAJE DE PRIVILEGIOS Y POLÍTICAS DE AISLAMIENTO RLS MULTI-EMPRESA
-- ------------------------------------------------------------------------------

-- 13.1 Función de validación de tenencia de negocio libre de recursión
-- Se marca STABLE y SECURITY DEFINER con search_path vacío para evaluar la pertenencia
-- del auth.uid() autenticado sin volver a invocar las políticas RLS sobre public.businesses.
CREATE OR REPLACE FUNCTION public.fn_is_business_owner(p_business_id pg_catalog.uuid)
RETURNS pg_catalog.bool
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.businesses b
        WHERE b.id = p_business_id
          AND b.owner_user_id = (SELECT auth.uid())
    );
$$;
COMMENT ON FUNCTION public.fn_is_business_owner(pg_catalog.uuid) IS 'Evalúa si el usuario autenticado (auth.uid()) es el propietario legal del negocio indicado. Utilizado por RLS para evitar recursión.';

-- Propietario controlado de las funciones de seguridad
ALTER FUNCTION public.fn_prevent_journal_mutation() OWNER TO postgres;
ALTER FUNCTION public.fn_prevent_ledger_line_mutation() OWNER TO postgres;
ALTER FUNCTION public.fn_incidence_resolutions_before_insert() OWNER TO postgres;
ALTER FUNCTION public.fn_validate_journal_balance(pg_catalog.uuid) OWNER TO postgres;
ALTER FUNCTION public.fn_trigger_validate_journal_balance() OWNER TO postgres;
ALTER FUNCTION public.fn_is_business_owner(pg_catalog.uuid) OWNER TO postgres;

-- Revocación total de permisos de ejecución directa a roles públicos, clientes y service_role.
-- Estas funciones son estrictamente internas (invocadas por disparadores y futuras RPCs SECURITY DEFINER).
REVOKE ALL ON FUNCTION public.fn_prevent_journal_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_prevent_ledger_line_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_incidence_resolutions_before_insert() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_validate_journal_balance(pg_catalog.uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_trigger_validate_journal_balance() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_is_business_owner(pg_catalog.uuid) TO authenticated, service_role;

-- 13.3 Habilitación obligatoria de Row Level Security (RLS) en todas las 23 entidades
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrative_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cut_audited_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cut_cash_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_audit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidence_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- 13.4 Políticas RLS de Aislamiento Multi-inquilino para el Dueño (authenticated)
-- Tabla businesses (raíz del tenant)
CREATE POLICY businesses_tenant_select ON public.businesses
    FOR SELECT TO authenticated
    USING (owner_user_id = (SELECT auth.uid()));

CREATE POLICY businesses_service_role ON public.businesses
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Políticas RLS sobre las 22 tablas hijas
CREATE POLICY business_members_tenant_select ON public.business_members
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY business_members_service_role ON public.business_members
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY workstations_tenant_select ON public.workstations
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY workstations_service_role ON public.workstations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY shifts_tenant_select ON public.shifts
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY shifts_service_role ON public.shifts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY shift_participants_tenant_select ON public.shift_participants
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY shift_participants_service_role ON public.shift_participants
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY custody_handovers_tenant_select ON public.custody_handovers
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY custody_handovers_service_role ON public.custody_handovers
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY commission_rules_tenant_select ON public.commission_rules
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY commission_rules_service_role ON public.commission_rules
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY treasury_resources_tenant_select ON public.treasury_resources
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY treasury_resources_service_role ON public.treasury_resources
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY chart_of_accounts_tenant_select ON public.chart_of_accounts
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY chart_of_accounts_service_role ON public.chart_of_accounts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY operations_tenant_select ON public.operations
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY operations_service_role ON public.operations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY operation_corrections_tenant_select ON public.operation_corrections
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY operation_corrections_service_role ON public.operation_corrections
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY administrative_movements_tenant_select ON public.administrative_movements
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY administrative_movements_service_role ON public.administrative_movements
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY journal_entries_tenant_select ON public.journal_entries
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY journal_entries_service_role ON public.journal_entries
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY financial_ledger_entries_tenant_select ON public.financial_ledger_entries
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY financial_ledger_entries_service_role ON public.financial_ledger_entries
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY economic_ledger_entries_tenant_select ON public.economic_ledger_entries
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY economic_ledger_entries_service_role ON public.economic_ledger_entries
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY cuts_tenant_select ON public.cuts
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY cuts_service_role ON public.cuts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY cut_audited_shifts_tenant_select ON public.cut_audited_shifts
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY cut_audited_shifts_service_role ON public.cut_audited_shifts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY cut_cash_counts_tenant_select ON public.cut_cash_counts
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY cut_cash_counts_service_role ON public.cut_cash_counts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY bank_audits_tenant_select ON public.bank_audits
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY bank_audits_service_role ON public.bank_audits
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY bank_audit_items_tenant_select ON public.bank_audit_items
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY bank_audit_items_service_role ON public.bank_audit_items
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY incidences_tenant_select ON public.incidences
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY incidences_service_role ON public.incidences
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY incidence_resolutions_tenant_select ON public.incidence_resolutions
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY incidence_resolutions_service_role ON public.incidence_resolutions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY audit_events_tenant_select ON public.audit_events
    FOR SELECT TO authenticated
    USING (public.fn_is_business_owner(business_id));
CREATE POLICY audit_events_service_role ON public.audit_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 13.5 Concesión de SELECT a authenticated amparado por RLS y revocación de escrituras directas
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
GRANT SELECT ON TABLE public.businesses TO authenticated;
GRANT SELECT ON TABLE public.business_members TO authenticated;
GRANT SELECT ON TABLE public.workstations TO authenticated;
GRANT SELECT ON TABLE public.shifts TO authenticated;
GRANT SELECT ON TABLE public.shift_participants TO authenticated;
GRANT SELECT ON TABLE public.custody_handovers TO authenticated;
GRANT SELECT ON TABLE public.commission_rules TO authenticated;
GRANT SELECT ON TABLE public.treasury_resources TO authenticated;
GRANT SELECT ON TABLE public.chart_of_accounts TO authenticated;
GRANT SELECT ON TABLE public.operations TO authenticated;
GRANT SELECT ON TABLE public.operation_corrections TO authenticated;
GRANT SELECT ON TABLE public.administrative_movements TO authenticated;
GRANT SELECT ON TABLE public.journal_entries TO authenticated;
GRANT SELECT ON TABLE public.financial_ledger_entries TO authenticated;
GRANT SELECT ON TABLE public.economic_ledger_entries TO authenticated;
GRANT SELECT ON TABLE public.cuts TO authenticated;
GRANT SELECT ON TABLE public.cut_audited_shifts TO authenticated;
GRANT SELECT ON TABLE public.cut_cash_counts TO authenticated;
GRANT SELECT ON TABLE public.bank_audits TO authenticated;
GRANT SELECT ON TABLE public.bank_audit_items TO authenticated;
GRANT SELECT ON TABLE public.incidences TO authenticated;
GRANT SELECT ON TABLE public.incidence_resolutions TO authenticated;
GRANT SELECT ON TABLE public.audit_events TO authenticated;

-- Service role retiene acceso administrativo a entidades maestras y de consulta, pero sin escritura directa en ledgers
GRANT ALL ON TABLE public.businesses TO service_role;
GRANT ALL ON TABLE public.business_members TO service_role;
GRANT ALL ON TABLE public.workstations TO service_role;
GRANT ALL ON TABLE public.shifts TO service_role;
GRANT ALL ON TABLE public.shift_participants TO service_role;
GRANT ALL ON TABLE public.custody_handovers TO service_role;
GRANT ALL ON TABLE public.commission_rules TO service_role;
GRANT ALL ON TABLE public.treasury_resources TO service_role;
GRANT ALL ON TABLE public.chart_of_accounts TO service_role;
GRANT ALL ON TABLE public.operations TO service_role;
GRANT ALL ON TABLE public.operation_corrections TO service_role;
GRANT ALL ON TABLE public.administrative_movements TO service_role;
GRANT SELECT ON TABLE public.journal_entries TO service_role;
GRANT SELECT ON TABLE public.financial_ledger_entries TO service_role;
GRANT SELECT ON TABLE public.economic_ledger_entries TO service_role;
GRANT ALL ON TABLE public.cuts TO service_role;
GRANT ALL ON TABLE public.cut_audited_shifts TO service_role;
GRANT ALL ON TABLE public.cut_cash_counts TO service_role;
GRANT ALL ON TABLE public.bank_audits TO service_role;
GRANT ALL ON TABLE public.bank_audit_items TO service_role;
GRANT ALL ON TABLE public.incidences TO service_role;
GRANT ALL ON TABLE public.incidence_resolutions TO service_role;
GRANT ALL ON TABLE public.audit_events TO service_role;

-- Blindaje absoluto de escritura directa:
-- Prohibir INSERT, UPDATE, DELETE a authenticated y service_role en los libros mayores
REVOKE INSERT, UPDATE, DELETE ON TABLE public.journal_entries FROM PUBLIC, anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.financial_ledger_entries FROM PUBLIC, anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.economic_ledger_entries FROM PUBLIC, anon, authenticated, service_role;

-- Blindaje de columnas críticas de saldo y secuencia (Invariantes 1 y 8)
REVOKE UPDATE (unresolved_amount_cents) ON TABLE public.incidences FROM PUBLIC, anon, authenticated, service_role;
REVOKE UPDATE (current_balance_cents, last_entry_sequence) ON TABLE public.treasury_resources FROM PUBLIC, anon, authenticated, service_role;

-- Revocación total para el rol anónimo (anon)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

