-- Performance indexes for the foreign keys introduced by 0003.
-- 0001, 0002, and 0003 are immutable and must already be applied.
begin;

create index operator_sessions_member_idx
  on private.operator_sessions(member_id);

create index operator_sessions_workstation_member_idx
  on private.operator_sessions(workstation_session_id, member_id);

create index workstation_member_activations_member_idx
  on private.workstation_member_activations(member_id);

create index workstation_sessions_business_idx
  on private.workstation_sessions(business_id);

create index workstation_sessions_created_by_member_idx
  on private.workstation_sessions(created_by_member_id);

-- The composite index above has workstation_session_id as its leading column,
-- so the old single-column index is redundant. Keep the partial unique index
-- operator_sessions_current_station_key: it enforces one active operator per
-- workstation and remains useful for revoked_at IS NULL lookups.
drop index private.operator_sessions_workstation_idx;

commit;
