-- Phase 6: Fondos de Negocio
-- Table constraint to store generic cash boxes/registers for the Physical Balance

CREATE TABLE IF NOT EXISTS cash_boxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    real_balance NUMERIC(10, 2) NOT NULL DEFAULT 0,
    low_balance_threshold NUMERIC(10, 2) DEFAULT 3000,
    critical_balance_threshold NUMERIC(10, 2) DEFAULT 1000,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security) (Opcional pero recomendado para Supabase)
ALTER TABLE cash_boxes ENABLE ROW LEVEL SECURITY;

-- Crear politicas publicas o restringidas
CREATE POLICY "Permitir select total en cash_boxes" ON cash_boxes FOR SELECT USING (true);
CREATE POLICY "Permitir insert autenticado en cash_boxes" ON cash_boxes FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir update autenticado en cash_boxes" ON cash_boxes FOR UPDATE USING (true);
CREATE POLICY "Permitir delete autenticado en cash_boxes" ON cash_boxes FOR DELETE USING (true);

-- Instanciar la primera Caja predeterminada
INSERT INTO cash_boxes (name, real_balance) 
VALUES ('Caja física', 0);
