import { Pool } from "pg";

export async function seedTestFixtures() {
  const pool = new Pool({
    host: "172.30.48.235",
    port: 5433,
    database: "cash_control_test",
    user: "postgres",
    password: "postgres_local_v2",
  });

  try {
    const BIZ_ID = "b9000000-0000-0000-0000-000000000001";
    const OWNER_AUTH = "a9000000-0000-0000-0000-000000000001";
    const OWNER_MEMBER = "ba900000-0000-0000-0000-000000000001";
    const OPERATOR_ID = "ba900000-0000-0000-0000-000000000002";
    const WORKSTATION_ID = "ca900000-0000-0000-0000-000000000001";
    const SOURCE_RES = "cc900000-0000-0000-0000-000000000001";
    const DEST_RES = "cc900000-0000-0000-0000-000000000002";
    const REV_ACCOUNT = "cd900000-0000-0000-0000-000000000001";

    // Empresa B para pruebas de aislamiento multi-inquilino
    const BIZ_B_ID = "b9000000-0000-0000-0000-000000000002";
    const OWNER_B_AUTH = "a9000000-0000-0000-0000-000000000002";
    const OWNER_B_MEMBER = "ba900000-0000-0000-0000-000000000003";
    const WORKSTATION_B_ID = "ca900000-0000-0000-0000-000000000002";

    console.log("Sembrando usuarios auth...");
    await pool.query(`
      INSERT INTO auth.users (id, email) VALUES 
        ('${OWNER_AUTH}'::uuid, 'dueno1@test.com'),
        ('${OWNER_B_AUTH}'::uuid, 'dueno2@test.com')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log("Sembrando empresas...");
    await pool.query(`
      INSERT INTO public.businesses (id, legal_name, commercial_name, owner_user_id, status) VALUES 
        ('${BIZ_ID}'::uuid, 'Empresa A S.A.', 'Sucursal A', '${OWNER_AUTH}'::uuid, 'active'),
        ('${BIZ_B_ID}'::uuid, 'Empresa B S.A.', 'Sucursal B', '${OWNER_B_AUTH}'::uuid, 'active')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log("Sembrando miembros de negocio...");
    await pool.query(`
      INSERT INTO public.business_members (id, business_id, auth_user_id, full_name, role, pin_hash, status) VALUES
        ('${OWNER_MEMBER}'::uuid, '${BIZ_ID}'::uuid, '${OWNER_AUTH}'::uuid, 'Dueño Empresa A', 'owner', 'hash_pin_0000', 'active'),
        ('${OPERATOR_ID}'::uuid, '${BIZ_ID}'::uuid, NULL, 'Cajero Uno Empresa A', 'cashier', 'hash_pin_1111', 'active'),
        ('${OWNER_B_MEMBER}'::uuid, '${BIZ_B_ID}'::uuid, '${OWNER_B_AUTH}'::uuid, 'Dueño Empresa B', 'owner', 'hash_pin_0000', 'active')
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log("Sembrando estaciones de trabajo...");
    await pool.query(`
      INSERT INTO public.workstations (id, business_id, code, name, is_active) VALUES
        ('${WORKSTATION_ID}'::uuid, '${BIZ_ID}'::uuid, 'WS-TEST-A', 'Ventanilla A', true),
        ('${WORKSTATION_B_ID}'::uuid, '${BIZ_B_ID}'::uuid, 'WS-TEST-B', 'Ventanilla B', true)
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log("Sembrando recursos de tesorería...");
    await pool.query(`
      INSERT INTO public.treasury_resources (id, business_id, code, name, type, current_balance_cents, last_entry_sequence) VALUES
        ('${SOURCE_RES}'::uuid, '${BIZ_ID}'::uuid, 'CAJA-FISICA-01', 'Caja Efectivo Ventanilla', 'cash_box', 5000000, 0),
        ('${DEST_RES}'::uuid, '${BIZ_ID}'::uuid, 'BANCO-BBVA-01', 'Cuenta Bancaria Operativa', 'bank_account', 10000000, 0)
      ON CONFLICT (id) DO UPDATE SET current_balance_cents = EXCLUDED.current_balance_cents, last_entry_sequence = 0;
    `);

    console.log("Sembrando plan de cuentas (COA)...");
    await pool.query(`
      INSERT INTO public.chart_of_accounts (id, business_id, code, name, type, is_active) VALUES
        ('${REV_ACCOUNT}'::uuid, '${BIZ_ID}'::uuid, 'REV_COMMISSIONS', 'Ingresos por Comisiones', 'revenue', true),
        ('cd900000-0000-0000-0000-000000000002'::uuid, '${BIZ_ID}'::uuid, 'EXP_OPERATIONAL', 'Gastos Operativos', 'expense', true),
        ('cd900000-0000-0000-0000-000000000003'::uuid, '${BIZ_ID}'::uuid, 'EQUITY_OWNER', 'Capital y Patrimonio del Dueño', 'equity', true),
        ('cd900000-0000-0000-0000-000000000004'::uuid, '${BIZ_ID}'::uuid, 'CLEARING_FUNDING', 'Fondeo de Tesorería en Tránsito', 'clearing_control', true)
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log("Sembrando reglas de comisión...");
    await pool.query(`
      INSERT INTO public.commission_rules (
        business_id, operation_type, min_amount_cents, max_amount_cents,
        fixed_fee_cents, percentage_fee_bps, effective_from, is_active
      ) VALUES (
        '${BIZ_ID}'::uuid, 'deposit', 100, 10000000, 1000, 100, clock_timestamp() - INTERVAL '1 day', true
      ) ON CONFLICT DO NOTHING;
    `);

    console.log("✓ Fixtures de prueba sembradas exitosamente.");
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seedTestFixtures().catch(console.error);
}
