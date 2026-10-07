-- 1. Tabla Principal: turnos (shifts)
CREATE TABLE IF NOT EXISTS public.shifts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    folio text NOT NULL,
    status text NOT NULL CHECK (status IN ('open', 'closed', 'closed_review_required')),
    opened_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    
    responsible_user_id text NOT NULL,
    responsible_user_name text NOT NULL,
    
    -- Apertura
    opening_cash_physical integer NOT NULL DEFAULT 0,
    opening_cash_reserved integer NOT NULL DEFAULT 0,
    opening_bank_balances jsonb NOT NULL DEFAULT '[]'::jsonb,
    
    -- Cierre
    closing_status text CHECK (closing_status IN ('balanced', 'shortage', 'surplus', null)),
    closing_expected_cash integer,
    closing_counted_cash integer,
    closing_expected_reserved integer,
    closing_counted_reserved integer,
    closing_total_difference integer,
    closing_bank_balances jsonb,
    closing_observations text,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabla Secundaria: Participantes de Turno
CREATE TABLE IF NOT EXISTS public.shift_participants (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    
    user_id text NOT NULL,
    user_name text NOT NULL,
    system_role text NOT NULL CHECK (system_role IN ('owner', 'employee')),
    shift_role text NOT NULL CHECK (shift_role IN ('shift_responsible', 'operator')),
    status text NOT NULL CHECK (status IN ('active', 'left')),
    
    joined_at timestamptz NOT NULL DEFAULT now(),
    left_at timestamptz,
    
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Tabla Secundaria: Bitácora de Eventos (Eventos puros de auditoría)
CREATE TABLE IF NOT EXISTS public.shift_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    
    event_type text NOT NULL,
    description text NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    
    performed_by_id text NOT NULL,
    performed_by_name text NOT NULL
);
