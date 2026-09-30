CREATE OR REPLACE FUNCTION public.admin_assign_participation_responsibility_with_pin(
    p_operator_token_hash text,
    p_new_responsible_member_id uuid,
    p_receiver_pin text
)
RETURNS TABLE (
    pin_verified boolean,
    journey_id uuid,
    responsible_member_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_actor record;
    v_journey private.participation_journeys%rowtype;
    v_new private.participation_participants%rowtype;
    v_verified boolean;
BEGIN
    IF p_receiver_pin IS NULL OR p_receiver_pin !~ '^[0-9]{4,6}$' THEN
        RAISE EXCEPTION 'Valid receiver PIN required.'
            USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_actor
    FROM private.resolve_shift_operator(p_operator_token_hash);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active operator session required.'
            USING ERRCODE = '22023';
    END IF;

    SELECT j.*
    INTO v_journey
    FROM private.participation_journeys AS j
    WHERE j.business_id = v_actor.business_id
      AND j.status = 'open'
    ORDER BY j.opened_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Open participation journey required.'
            USING ERRCODE = '22023';
    END IF;

    SELECT p.*
    INTO v_new
    FROM private.participation_participants AS p
    JOIN public.business_members AS m
      ON m.id = p.member_id
     AND m.business_id = v_journey.business_id
    WHERE p.journey_id = v_journey.id
      AND p.member_id = p_new_responsible_member_id
      AND p.status = 'active'
      AND m.status = 'active'
    ORDER BY p.joined_at DESC
    LIMIT 1
    FOR UPDATE OF p;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Responsible must be an active participant.'
            USING ERRCODE = '22023';
    END IF;

    v_verified := private.verify_member_pin(
        v_new.member_id,
        p_receiver_pin
    );

    IF NOT v_verified THEN
        RETURN QUERY SELECT false, NULL::uuid, NULL::uuid;
        RETURN;
    END IF;

    UPDATE private.participation_participants AS pp
    SET role = 'operator'
    WHERE pp.journey_id = v_journey.id
      AND pp.status = 'active'
      AND pp.member_id = v_journey.responsible_member_id
      AND pp.member_id <> v_new.member_id;

    UPDATE private.participation_participants AS pp
    SET role = 'shift_responsible'
    WHERE pp.id = v_new.id;

    UPDATE private.participation_journeys AS pj
    SET responsible_member_id = v_new.member_id
    WHERE pj.id = v_journey.id;

    RETURN QUERY SELECT true, v_journey.id, v_new.member_id;
END;
$function$;