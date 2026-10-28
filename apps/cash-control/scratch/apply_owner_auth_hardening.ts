import { Pool } from "pg";

async function applyHardening() {
  const pool = new Pool({
    host: "172.30.48.235",
    port: 5433,
    database: "cash_control_test",
    user: "postgres",
    password: "postgres_local_v2",
  });

  try {
    console.log("Actualizando rpc_open_shift para exigir autenticación estricta del dueño...");
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.rpc_open_shift(
          p_business_id UUID,
          p_workstation_id UUID,
          p_operator_member_id UUID,
          p_pin TEXT,
          p_folio TEXT DEFAULT NULL
      )
      RETURNS JSONB
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = ''
      AS $$
      DECLARE
          v_auth_uid UUID := auth.uid();
          v_owner_user_id UUID;
          v_shift_id UUID;
          v_participant_id UUID;
          v_session_id UUID;
          v_folio TEXT;
          v_token TEXT;
          v_token_hash TEXT;
      BEGIN
          -- Validar pertenencia del negocio
          SELECT owner_user_id INTO v_owner_user_id
          FROM public.businesses WHERE id = p_business_id;
          IF NOT FOUND THEN
              RAISE EXCEPTION 'BUSINESS_NOT_FOUND: Empresa % no existe.', p_business_id;
          END IF;

          -- AUTENTICACIÓN ESTRICTA DEL DUEÑO: v_auth_uid NO puede ser NULL y DEBE coincidir con el dueño legal
          IF v_auth_uid IS NULL OR v_auth_uid != v_owner_user_id THEN
              RAISE EXCEPTION 'FORBIDDEN_BUSINESS_ACCESS: Usuario no autenticado o no es el dueño legal del negocio.';
          END IF;

          -- Validar PIN
          IF NOT public.fn_verify_member_pin(p_business_id, p_operator_member_id, p_pin) THEN
              RAISE EXCEPTION 'INVALID_OPERATOR_PIN: PIN de operador incorrecto o miembro inactivo.';
          END IF;

          -- Validar estación
          IF NOT EXISTS (SELECT 1 FROM public.workstations WHERE id = p_workstation_id AND business_id = p_business_id AND is_active = true) THEN
              RAISE EXCEPTION 'WORKSTATION_INACTIVE: Estación de trabajo inactiva o no existe.';
          END IF;

          -- Verificar que no haya turno abierto en la estación
          IF EXISTS (SELECT 1 FROM public.shifts WHERE business_id = p_business_id AND workstation_id = p_workstation_id AND status = 'open') THEN
              RAISE EXCEPTION 'WORKSTATION_ALREADY_HAS_OPEN_SHIFT: La estación ya tiene un turno abierto.';
          END IF;

          v_folio := COALESCE(p_folio, 'SH-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

          -- Crear turno
          INSERT INTO public.shifts (
              business_id, workstation_id, folio, status, opened_at, opened_by_member_id
          ) VALUES (
              p_business_id, p_workstation_id, v_folio, 'open', clock_timestamp(), p_operator_member_id
          ) RETURNING id INTO v_shift_id;

          -- Registrar participante responsable
          INSERT INTO public.shift_participants (
              business_id, shift_id, member_id, role_in_shift, joined_at, status
          ) VALUES (
              p_business_id, v_shift_id, p_operator_member_id, 'responsible', clock_timestamp(), 'active'
          ) RETURNING id INTO v_participant_id;

          -- Revocar cualquier sesión previa en la estación
          UPDATE public.terminal_operator_sessions
          SET revoked_at = clock_timestamp(), revoked_reason = 'SUPERSEDED_BY_NEW_SHIFT'
          WHERE workstation_id = p_workstation_id AND revoked_at IS NULL;

          -- Generar token de sesión operativa
          v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
          v_token_hash := pg_catalog.encode(pg_catalog.sha256(v_token::bytea), 'hex');

          INSERT INTO public.terminal_operator_sessions (
              business_id, workstation_id, shift_id, operator_member_id, session_token_hash,
              created_at, expires_at
          ) VALUES (
              p_business_id, p_workstation_id, v_shift_id, p_operator_member_id, v_token_hash,
              clock_timestamp(), clock_timestamp() + INTERVAL '16 hours'
          ) RETURNING id INTO v_session_id;

          RETURN jsonb_build_object(
              'shift_id', v_shift_id,
              'folio', v_folio,
              'status', 'open',
              'operator_member_id', p_operator_member_id,
              'session_token', v_token,
              'expires_at', clock_timestamp() + INTERVAL '16 hours'
          );
      END;
      $$;

      REVOKE ALL ON FUNCTION public.rpc_open_shift FROM PUBLIC, anon;
      GRANT EXECUTE ON FUNCTION public.rpc_open_shift TO authenticated, service_role, cash_control_app;
    `);

    console.log("✓ rpc_open_shift endurecido exitosamente en cash_control_test.");
  } finally {
    await pool.end();
  }
}

applyHardening().catch(console.error);
