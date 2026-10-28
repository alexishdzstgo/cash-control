import { Pool } from "pg";

async function grantD4TableSelects() {
  const adminPool = new Pool({
    host: "172.30.48.235",
    port: 5433,
    database: "cash_control_test",
    user: "postgres",
    password: "postgres_local_v2",
  });

  try {
    console.log("Concediendo SELECT y RLS policies a cash_control_app para D4...");

    await adminPool.query(`
      GRANT SELECT ON TABLE public.administrative_movements TO cash_control_app;
      GRANT SELECT ON TABLE public.operation_corrections TO cash_control_app;
      GRANT SELECT ON TABLE public.commission_rules TO cash_control_app;
      GRANT SELECT ON TABLE public.business_operational_limits TO cash_control_app;

      REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.administrative_movements FROM cash_control_app;
      REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.operation_corrections FROM cash_control_app;
    `);

    // Crear políticas RLS para cash_control_app si no existen
    for (const tbl of ['administrative_movements', 'operation_corrections', 'commission_rules', 'business_operational_limits']) {
      await adminPool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = '${tbl}' AND policyname = '${tbl}_app_select'
          ) THEN
            CREATE POLICY ${tbl}_app_select ON public.${tbl} 
            FOR SELECT TO cash_control_app USING (true);
          END IF;
        END
        $$;
      `);
      console.log(` - Política RLS SELECT creada para ${tbl}`);
    }

    console.log("✓ Permisos y políticas de D4 configurados con éxito.");
  } finally {
    await adminPool.end();
  }
}

grantD4TableSelects().catch(console.error);
