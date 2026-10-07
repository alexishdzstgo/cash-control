DO $$
DECLARE
  max_dep_id integer;
BEGIN
  -- Calcular maximo consecutivo actual (usando regex para extraer el digito despues de DEP-)
  SELECT COALESCE(MAX(SUBSTRING(bank_folio FROM 'DEP\-([0-9]+)')::integer), 0)
  INTO max_dep_id
  FROM operations
  WHERE type = 'deposito' AND bank_folio LIKE 'DEP-%';

  -- Crear secuencia para depositos
  EXECUTE 'CREATE SEQUENCE IF NOT EXISTS operation_deposit_seq START WITH ' || (max_dep_id + 1);
END $$;

CREATE OR REPLACE FUNCTION set_operation_folio()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'deposito' THEN
    NEW.bank_folio := 'DEP-' || LPAD(nextval('operation_deposit_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Destruir trigger si existe (idempotencia)
DROP TRIGGER IF EXISTS trg_set_operation_folio ON operations;

-- Armar el Trigger de insercion atómica (El trigger fuerza sus propios calculos sin importar lo que contenga la payload entrante)
CREATE TRIGGER trg_set_operation_folio
BEFORE INSERT ON operations
FOR EACH ROW
EXECUTE FUNCTION set_operation_folio();
