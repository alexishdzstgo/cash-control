-- Migration: 001_get_workstation_active_participants.sql
-- Propósito: Obtener los participantes activos de la jornada abierta del negocio sin exigir sesión de operador.

CREATE OR REPLACE FUNCTION public.get_workstation_active_participants(
    p_business_id uuid
)
RETURNS TABLE (
    member_id uuid,
    display_name text,
    role text,
    status text,
    joined_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT pp.member_id,
        COALESCE(p.display_name, p.first_name || ' ' || p.last_name) AS display_name,
        pp.role::text,
        pp.status::text,
        pp.joined_at
    FROM private.participation_participants pp
    JOIN private.participation_journeys pj ON pj.id = pp.journey_id
    JOIN public.business_members bm ON bm.id = pp.member_id
    JOIN public.profiles p ON p.id = bm.user_id
    WHERE pj.business_id = p_business_id
      AND pj.status = 'open'
      AND pp.status = 'active';
END;
$$;
