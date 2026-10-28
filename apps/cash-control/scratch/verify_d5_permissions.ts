import { Pool } from "pg";

async function verifyAndGrantD5() {
  const adminPool = new Pool({
    host: "172.30.48.235",
    port: 5433,
    database: "cash_control_test",
    user: "postgres",
    password: "postgres_local_v2",
  });

  try {
    console.log("=== VERIFICANDO Y PREPARANDO PERMISOS D5 ===");

    // 1. Conceder EXECUTE a cash_control_app sobre las RPCs de corte e incidencia
    await adminPool.query(`
      GRANT EXECUTE ON FUNCTION public.rpc_perform_cut_reconciliation TO cash_control_app;
      GRANT EXECUTE ON FUNCTION public.rpc_resolve_incidence TO cash_control_app;
    `);
    console.log("✓ EXECUTE concedido a cash_control_app en rpc_perform_cut_reconciliation y rpc_resolve_incidence.");

    // 2. Conceder SELECT sobre las tablas que lee/consulta cash_control_app
    const d5Tables = [
      "cuts",
      "cut_audited_shifts",
      "cut_cash_counts",
      "bank_audits",
      "bank_audit_items",
      "incidences",
      "incidence_resolutions"
    ];

    for (const tbl of d5Tables) {
      await adminPool.query(`GRANT SELECT ON TABLE public.${tbl} TO cash_control_app;`);
      await adminPool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = '${tbl}' AND policyname = '${tbl}_app_select'
          ) THEN
            CREATE POLICY ${tbl}_app_select ON public.${tbl} FOR SELECT TO cash_control_app USING (true);
          END IF;
        END $$;
      `);
      console.log(`✓ SELECT y RLS policy configurada para ${tbl}.`);
    }

    // 3. Verificar cuenta EXP_CONFIRMED_LOSS en chart_of_accounts por si se usa en confirmed_loss
    const BIZ_ID = "b9000000-0000-0000-0000-000000000001";
    await adminPool.query(`
      INSERT INTO public.chart_of_accounts (id, business_id, code, name, type)
      VALUES ('cd900000-0000-0000-0000-000000000006', $1, 'EXP_CONFIRMED_LOSS', 'Pérdidas Operativas Confirmadas', 'expense')
      ON CONFLICT (business_id, code) DO NOTHING;
    `, [BIZ_ID]);
    console.log("✓ Cuenta EXP_CONFIRMED_LOSS verificada en catálogo.");

  } finally {
    await adminPool.end();
  }
}

verifyAndGrantD5().catch(console.error);
