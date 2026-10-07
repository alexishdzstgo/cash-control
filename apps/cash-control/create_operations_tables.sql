-- Tabla de Movimientos Administrativos (Entradas, Salidas Internas, Ajustes)
CREATE TABLE IF NOT EXISTS public.administrative_movements (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    shift_id uuid NULL REFERENCES public.shifts(id) ON DELETE SET NULL,
    movement_type text NOT NULL, -- 'income' o 'withdrawal'
    resource_type text NOT NULL, -- 'cash' o 'bank'
    resource_id text NOT NULL, -- UUID string o reservaciones
    resource_name text NOT NULL,
    amount_cents integer NOT NULL,
    balance_before_cents integer NOT NULL,
    balance_after_cents integer NOT NULL,
    explanation text NULL,
    status text NOT NULL DEFAULT 'active', -- 'active' o 'corrected'
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by_user_id text NOT NULL,
    created_by_user_name text NOT NULL,
    is_edited boolean NOT NULL DEFAULT false,
    edited_at timestamptz NULL,
    edited_by_user_id text NULL,
    edited_by_user_name text NULL,
    edit_reason text NULL,
    registered_resource_name text NULL,
    correction_balances jsonb NULL,
    previous_amount_cents integer NULL,
    previous_resource_id text NULL,
    previous_resource_name text NULL,
    previous_movement_type text NULL
);

-- Tabla de Operaciones de Clientes (Depósitos, Retiros)
CREATE TABLE IF NOT EXISTS public.operations (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    shift_id uuid NULL REFERENCES public.shifts(id) ON DELETE SET NULL,
    type text NOT NULL, -- 'deposito' o 'retiro'
    status text NOT NULL, -- 'completado', 'pendiente', 'entregado', 'cancelado'
    bank_folio text NULL,
    amount integer NOT NULL, -- Cents
    commission integer NOT NULL, -- Cents
    total integer NOT NULL, -- Cents
    
    -- Snapshot estático de la comisión calculada para auditoría inmodificable
    applied_commission_snapshot jsonb NULL,
    commission_location text NULL,
    commission_status text NULL,
    
    sender_name text NOT NULL,
    receiver_name text NOT NULL,
    
    bank_from text NULL,
    bank_to text NULL,
    bank_resource_id text NULL,
    
    destination_reference text NULL,
    destination_account_last4 text NULL,
    delivery_method text NULL, -- 'bank-transfer' o 'cash-deposit'
    withdrawal_commission_mode text NULL,
    customer_cash_received integer NULL,
    bank_movement_amount integer NULL,
    
    pending_reason text NULL,
    pending_reason_details text NULL,
    observations text NULL,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by text NOT NULL,
    created_by_user_id text NULL,
    pending_delivery jsonb NULL,
    
    is_edited boolean NOT NULL DEFAULT false,
    edited_at timestamptz NULL,
    edited_by text NULL,
    clarifications jsonb NULL,
    corrections jsonb NULL
);

-- Habilitar Row Level Security e ignorarla con true universal por ahora
ALTER TABLE public.administrative_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow ALL on administrative_movements"
    ON public.administrative_movements
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow ALL on operations"
    ON public.operations
    FOR ALL
    USING (true)
    WITH CHECK (true);
