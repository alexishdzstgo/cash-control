-- 1. Crear tabla de comisión
CREATE TABLE IF NOT EXISTS public.commission_rules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    operation_type text NOT NULL CHECK (operation_type IN ('deposito', 'retiro')),
    min_amount_cents integer NOT NULL,
    max_amount_cents integer,
    calculation_type text NOT NULL DEFAULT 'fixed',
    fixed_amount_cents integer NOT NULL,
    status text NOT NULL CHECK (status IN ('active', 'inactive', 'scheduled', 'expired')),
    version integer NOT NULL DEFAULT 1,
    valid_from timestamptz NOT NULL DEFAULT now(),
    valid_to timestamptz,
    created_by text,
    replaced_by_rule_id uuid REFERENCES public.commission_rules(id),
    has_been_applied boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Habilitar Seguridad de Nivel de Fila (RLS) opcional (sino todos tienen acceso)
-- Si la DB de Supabase usa RLS universal, agregamos la políca para permitir lectura y escritura web temporal
-- Puedes saltar esto si no usas RLS estricto pero es recomendado.
ALTER TABLE public.commission_rules DISABLE ROW LEVEL SECURITY;

-- 3. Insertar el catálogo de prueba preaprobado (Mock) 
INSERT INTO public.commission_rules (operation_type, min_amount_cents, max_amount_cents, fixed_amount_cents, status, created_by)
VALUES 
    -- Depósitos
    ('deposito', 1500, 5099, 500, 'active', 'Sistema'),
    ('deposito', 5100, 10099, 800, 'active', 'Sistema'),
    ('deposito', 10100, 50099, 1000, 'active', 'Sistema'),
    ('deposito', 50100, 100099, 1200, 'active', 'Sistema'),
    ('deposito', 100100, 300099, 1500, 'active', 'Sistema'),
    ('deposito', 300100, 400099, 1800, 'active', 'Sistema'),
    ('deposito', 400100, 500099, 2000, 'active', 'Sistema'),
    ('deposito', 500100, 700099, 2400, 'active', 'Sistema'),
    ('deposito', 700100, 900099, 2700, 'active', 'Sistema'),
    ('deposito', 900100, 1100099, 3800, 'active', 'Sistema'),
    ('deposito', 1100100, 1300099, 4500, 'active', 'Sistema'),
    ('deposito', 1300100, 1500099, 4800, 'active', 'Sistema'),
    ('deposito', 1500100, 1700099, 5800, 'active', 'Sistema'),
    ('deposito', 1700100, 1900099, 6500, 'active', 'Sistema'),
    ('deposito', 1900100, 2100099, 7000, 'active', 'Sistema'),
    ('deposito', 2100100, 2300099, 8000, 'active', 'Sistema'),
    ('deposito', 2300100, 2500000, 9000, 'active', 'Sistema'),
    
    -- Retiros
    ('retiro', 1500, 5099, 500, 'active', 'Sistema'),
    ('retiro', 5100, 10099, 800, 'active', 'Sistema'),
    ('retiro', 10100, 50099, 1000, 'active', 'Sistema'),
    ('retiro', 50100, 100099, 1200, 'active', 'Sistema'),
    ('retiro', 100100, 300099, 1500, 'active', 'Sistema'),
    ('retiro', 300100, 400099, 1800, 'active', 'Sistema'),
    ('retiro', 400100, 500099, 2000, 'active', 'Sistema'),
    ('retiro', 500100, 700099, 2400, 'active', 'Sistema'),
    ('retiro', 700100, 900099, 2700, 'active', 'Sistema'),
    ('retiro', 900100, 1100099, 3800, 'active', 'Sistema'),
    ('retiro', 1100100, 1300099, 4500, 'active', 'Sistema'),
    ('retiro', 1300100, 1500099, 4800, 'active', 'Sistema'),
    ('retiro', 1500100, 1700099, 5800, 'active', 'Sistema'),
    ('retiro', 1700100, 1900099, 6500, 'active', 'Sistema'),
    ('retiro', 1900100, 2100099, 7000, 'active', 'Sistema'),
    ('retiro', 2100100, 2300099, 8000, 'active', 'Sistema'),
    ('retiro', 2300100, 2500000, 9000, 'active', 'Sistema');
