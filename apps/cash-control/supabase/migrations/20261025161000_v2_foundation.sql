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
        RAISE EXCEPTION 'Violación contable: El asiento contable ID % (Número %, Tipo %) no tiene ninguna línea en los libros mayores (asiento vacío no permitido).',
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

        SELECT op.type, op.origin, op.status
        INTO v_op
        FROM public.operations op
        WHERE op.id = v_journal.source_id AND op.business_id = v_journal.business_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Violación de integridad: La operación de cliente origen (ID %) no existe o pertenece a otro negocio.',
                v_journal.source_id
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        IF v_op.origin = 'AUDIT_RECLASSIFICATION' THEN
            -- Única excepción legítima puramente económica: El dinero ya estaba en el saldo anterior
            IF v_fin_count != 0 THEN
                RAISE EXCEPTION 'Violación semántica: Las operaciones AUDIT_RECLASSIFICATION no deben tener líneas de tesorería (N=0 obligatorio, detectadas: %). El efectivo ya fue arqueado previamente.',
                    v_fin_count
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF v_econ_count < 2 THEN
                RAISE EXCEPTION 'Violación semántica: Las operaciones AUDIT_RECLASSIFICATION requieren al menos 2 líneas económicas (M >= 2) para cancelar el suspenso y reconocer el ingreso.',
                    v_econ_count
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
        ELSE
            -- Operaciones ordinarias (NORMAL, AUDIT_ADJUSTMENT): Exigen obligatoriamente líneas en ambos libros
            IF v_fin_count < 1 THEN
                RAISE EXCEPTION 'Violación semántica: Las operaciones ordinarias de cliente (% - %) requieren obligatoriamente movimiento de tesorería (N >= 1 en financial_ledger_entries). Solo AUDIT_RECLASSIFICATION puede carecer de líneas financieras.',
                    v_op.type, v_op.origin
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF v_econ_count < 1 THEN
                RAISE EXCEPTION 'Violación semántica: Las operaciones ordinarias de cliente (% - %) requieren obligatoriamente registro económico de comisión o pasivo transitorio (M >= 1 en economic_ledger_entries).',
                    v_op.type, v_op.origin
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
        END IF;

    -- 4.2 Movimientos Administrativos (administrative_movement)
    ELSIF v_journal.entry_type = 'administrative_movement' THEN
        IF v_journal.source_entity != 'administrative_movements' THEN
            RAISE EXCEPTION 'Violación semántica: Los asientos administrative_movement deben referenciar a administrative_movements (source_entity actual: %).',
                v_journal.source_entity
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        SELECT adm.category
        INTO v_adm
        FROM public.administrative_movements adm
        WHERE adm.id = v_journal.source_id AND adm.business_id = v_journal.business_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Violación de integridad: El movimiento administrativo origen (ID %) no existe o pertenece a otro negocio.',
                v_journal.source_id
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        IF v_adm.category = 'transfer_internal' THEN
            -- Traslado interno entre recursos propios: puramente financiero
            IF v_fin_count < 2 THEN
                RAISE EXCEPTION 'Violación semántica: Los traslados internos (transfer_internal) requieren al menos 2 líneas de tesorería (origen y destino).',
                    v_fin_count
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
        ELSE
            -- Gastos, fondeos, aportaciones y retiros: exigen tesorería y contrapartida económica/patrimonial
            IF v_fin_count < 1 OR v_econ_count < 1 THEN
                RAISE EXCEPTION 'Violación semántica: Los movimientos administrativos de categoría % requieren obligatoriamente tesorería (N >= 1) y contrapartida económica/patrimonial (M >= 1).',
                    v_adm.category
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
        END IF;

    -- 4.3 Cortes y Conciliaciones (cut_reconciliation)
    ELSIF v_journal.entry_type = 'cut_reconciliation' THEN
        IF v_fin_count < 1 OR v_econ_count < 1 THEN
            RAISE EXCEPTION 'Violación semántica: Los cortes (cut_reconciliation) requieren obligatoriamente ajustar un recurso de tesorería (N >= 1) contra la cuenta de suspenso (M >= 1).'
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

    -- 4.4 Resoluciones de Incidencia (incidence_resolution)
    ELSIF v_journal.entry_type = 'incidence_resolution' THEN
        IF v_journal.source_entity != 'incidence_resolutions' THEN
            RAISE EXCEPTION 'Violación semántica: Los asientos incidence_resolution deben referenciar a incidence_resolutions.',
                v_journal.source_entity
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        SELECT res.event_type
        INTO v_res
        FROM public.incidence_resolutions res
        WHERE res.id = v_journal.source_id AND res.business_id = v_journal.business_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Violación de integridad: La resolución de incidencia origen (ID %) no existe o pertenece a otro negocio.',
                v_journal.source_id
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;

        IF v_res.event_type IN ('confirmed_loss', 'confirmed_surplus') THEN
            -- Pérdida o sobrante definitivo sin flujo de efectivo: puramente económico
            IF v_fin_count != 0 THEN
                RAISE EXCEPTION 'Violación semántica: Las resoluciones por pérdida/sobrante confirmado no deben mover tesorería (N=0 obligatorio). El ajuste físico ya ocurrió en el corte.',
                    v_fin_count
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
            IF v_econ_count < 2 THEN
                RAISE EXCEPTION 'Violación semántica: Las resoluciones por pérdida/sobrante confirmado requieren al menos 2 líneas económicas (M >= 2).',
                    v_econ_count
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
        ELSIF v_res.event_type IN ('reintegration_partial', 'reintegration_final') THEN
            -- Reintegro de dinero: entrada en tesorería y disminución de suspenso
            IF v_fin_count < 1 OR v_econ_count < 1 THEN
                RAISE EXCEPTION 'Violación semántica: Los reintegros de faltantes requieren ingreso a tesorería (N >= 1) y contrapartida en cuenta transitoria (M >= 1).'
                    USING ERRCODE = 'integrity_constraint_violation';
            END IF;
        END IF;
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
COMMENT ON FUNCTION public.fn_validate_journal_balance(pg_catalog.uuid) IS 'Valida atómicamente la existencia, subtipo, cardinalidad y balance neto cero SUM(fin)+SUM(econ)=0 del asiento.';

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
-- 13. BLINDAJE DE PRIVILEGIOS Y PROTECCIÓN CONTRA ESCRITURA DIRECTA
-- ------------------------------------------------------------------------------

-- Propietario controlado de las funciones de seguridad
ALTER FUNCTION public.fn_prevent_journal_mutation() OWNER TO postgres;
ALTER FUNCTION public.fn_prevent_ledger_line_mutation() OWNER TO postgres;
ALTER FUNCTION public.fn_validate_journal_balance(pg_catalog.uuid) OWNER TO postgres;
ALTER FUNCTION public.fn_trigger_validate_journal_balance() OWNER TO postgres;

-- Revocación total de permisos de ejecución directa a roles públicos, clientes y service_role.
-- Estas funciones son estrictamente internas (invocadas por disparadores y futuras RPCs SECURITY DEFINER).
REVOKE ALL ON FUNCTION public.fn_prevent_journal_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_prevent_ledger_line_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_validate_journal_balance(pg_catalog.uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_trigger_validate_journal_balance() FROM PUBLIC, anon, authenticated, service_role;

-- Blindaje absoluto de las tablas del libro mayor:
-- Prohibir INSERT, UPDATE, DELETE y TRUNCATE a PUBLIC, anon, authenticated y service_role.
-- Ningún rol de aplicación ni cliente API puede escribir directamente en los ledgers.
-- La única vía legítima es la ejecución de RPCs transaccionales SECURITY DEFINER ejecutadas por postgres.
REVOKE ALL ON TABLE public.journal_entries FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.financial_ledger_entries FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.economic_ledger_entries FROM PUBLIC, anon, authenticated, service_role;

-- Lectura (SELECT) restringida:
-- service_role retiene SELECT para consultas analíticas del servidor.
-- Los roles de cliente (authenticated, anon) tienen REVOKE total hasta que se implementen y prueben
-- las políticas RLS definitivas libres de recursión.
GRANT SELECT ON TABLE public.journal_entries TO service_role;
GRANT SELECT ON TABLE public.financial_ledger_entries TO service_role;
GRANT SELECT ON TABLE public.economic_ledger_entries TO service_role;

