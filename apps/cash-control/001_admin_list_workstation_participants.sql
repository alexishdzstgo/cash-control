-- Migration: admin_list_workstation_participants.sql
-- Proposito: Permitir a la estacion (workstation) consultar los participantes activos sin necesidad de una sesion de operador.

CREATE OR REPLACE FUNCTION public.admin_list_workstation_participants(
    p_workstation_token_hash text
)
RETURNS TABLE (
    member_id uuid,
    username text,
    display_name text,
    role text,
    status text,
    joined_at timestamp with time zone,
    left_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_workstation record;
BEGIN
    -- 1. Validar la sesion de la estacion (Workstation)
    SELECT * INTO v_workstation
    FROM public.admin_resolve_workstation_session(p_workstation_token_hash)
    LIMIT 1;

    IF v_workstation IS NULL THEN
        RAISE EXCEPTION 'Invalid workstation session' USING ERRCODE = '42501';
    END IF;

    -- 2. Devolver las participaciones activas del negocio al que pertenece la estación
    -- (Asumiendo que utilizamos la vista de shift_participations o participation_journeys dependiendo 
    -- de la arquitectura interna de base de datos)
    
    RETURN QUERY
    SELECT 
        pj.member_id,
        bm.username,
        -- Construir el display name basado en profiles
        COALESCE(p.display_name, p.first_name || ' ' || p.last_name) AS display_name,
        pj.role::text,
        pj.status::text,
        pj.joined_at,
        pj.left_at
    FROM public.participation_journeys pj
    JOIN public.business_members bm ON bm.id = pj.member_id
    JOIN public.profiles p ON p.id = bm.user_id
    WHERE bm.business_id = v_workstation.business_id
      AND pj.status = 'active';

END;
$$;
