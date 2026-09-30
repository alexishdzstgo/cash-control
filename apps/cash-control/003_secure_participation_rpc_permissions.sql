-- Restrict participation/workstation SECURITY DEFINER RPCs to the server-side service role.
-- These endpoints are called by Next.js API routes using the service-role Supabase client.
-- Browser-facing anon/authenticated roles must not call them directly.

ALTER FUNCTION public.get_workstation_active_participants(uuid) SET search_path TO '';

REVOKE ALL ON FUNCTION public.get_workstation_active_participants(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_workstation_active_participants(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.admin_start_participation(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_start_participation(text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_assign_participation_responsibility_with_pin(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_participation_responsibility_with_pin(text, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_transfer_shift_responsibility_with_pin(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transfer_shift_responsibility_with_pin(text, uuid, text) TO service_role;
