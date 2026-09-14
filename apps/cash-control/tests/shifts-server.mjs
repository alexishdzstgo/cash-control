import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addShiftParticipant,
  leaveShift,
  listShiftParticipants,
  openShift,
  resolveOpenShift,
  transferShiftResponsibility,
} from "../src/lib/shifts/server/shifts.mjs";
import {
  generateSessionToken,
  hashSessionToken,
} from "../src/lib/workstation/server/tokens.mjs";

const businessId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";
const targetMemberId = "33333333-3333-4333-8333-333333333333";
const shiftId = "44444444-4444-4444-8444-444444444444";

function fixture() {
  const workstationToken = generateSessionToken();
  const operatorToken = generateSessionToken();
  const calls = [];
  const future = "2099-01-01T00:00:00.000Z";
  const rows = {
    admin_resolve_workstation_session: [
      {
        workstation_session_id: "55555555-5555-4555-8555-555555555555",
        business_id: businessId,
        business_slug: "test-business",
        workstation_expires_at: future,
      },
    ],
    admin_resolve_operator_session: [
      {
        operator_session_id: "66666666-6666-4666-8666-666666666666",
        workstation_session_id: "55555555-5555-4555-8555-555555555555",
        business_id: businessId,
        member_id: memberId,
        user_id: "77777777-7777-4777-8777-777777777777",
        username: "owner",
        display_name: "Owner Test",
        role: "owner",
        operator_expires_at: future,
        workstation_expires_at: future,
      },
    ],
    admin_open_shift: [
      {
        shift_id: shiftId,
        folio: "TUR-000001",
        status: "open",
        opened_at: "2099-01-01T01:00:00.000Z",
        responsible_member_id: memberId,
        token_hash: "must-not-leak",
      },
    ],
    admin_add_shift_participant: [
      {
        shift_id: shiftId,
        member_id: targetMemberId,
        role: "operator",
        status: "active",
        joined_at: "2099-01-01T01:01:00.000Z",
        left_at: null,
      },
    ],
    admin_leave_shift: [
      {
        shift_id: shiftId,
        member_id: memberId,
        role: "operator",
        status: "left",
        joined_at: "2099-01-01T01:00:00.000Z",
        left_at: "2099-01-01T02:00:00.000Z",
      },
    ],
    admin_transfer_shift_responsibility: [
      {
        shift_id: shiftId,
        previous_responsible_member_id: memberId,
        responsible_member_id: targetMemberId,
      },
    ],
    admin_resolve_open_shift: [],
    admin_list_shift_participants: [
      {
        member_id: memberId,
        username: "owner",
        display_name: "Owner Test",
        role: "shift_responsible",
        status: "active",
        joined_at: "2099-01-01T01:00:00.000Z",
        left_at: null,
        pin_hash: "must-not-leak",
      },
    ],
  };
  const admin = {
    async rpc(name, args) {
      calls.push([name, args]);
      return { data: rows[name] ?? [], error: null };
    },
  };
  const dependencies = {
    admin,
    createPasswordClient() {
      throw new Error("not used");
    },
  };
  return {
    dependencies,
    calls,
    session: { workstationToken, operatorToken },
  };
}

test("shift server service resolves the actor and sends only the operator hash", async () => {
  const { dependencies, calls, session } = fixture();
  const result = await openShift(session, dependencies);

  assert.deepEqual(result, {
    id: shiftId,
    folio: "TUR-000001",
    status: "open",
    openedAt: "2099-01-01T01:00:00.000Z",
    responsibleMemberId: memberId,
  });
  const call = calls.find(([name]) => name === "admin_open_shift");
  assert.deepEqual(call[1], {
    p_operator_token_hash: hashSessionToken(session.operatorToken),
  });
});

test("shift server mutations do not accept a client actor", async () => {
  const { dependencies, calls, session } = fixture();
  await addShiftParticipant(
    { ...session, memberId: targetMemberId, actorId: "client-controlled" },
    dependencies,
  );
  await leaveShift(session, dependencies);
  await transferShiftResponsibility(
    { ...session, memberId: targetMemberId, actorId: "client-controlled" },
    dependencies,
  );

  const addCall = calls.find(
    ([name]) => name === "admin_add_shift_participant",
  );
  assert.deepEqual(addCall[1], {
    p_operator_token_hash: hashSessionToken(session.operatorToken),
    p_member_id: targetMemberId,
  });
  assert.equal(Object.hasOwn(addCall[1], "p_actor_id"), false);
  assert.equal(Object.hasOwn(addCall[1], "p_business_id"), false);
});

test("shift server reads strictly project database rows", async () => {
  const { dependencies, session } = fixture();
  assert.equal(await resolveOpenShift(session, dependencies), null);
  assert.deepEqual(await listShiftParticipants(session, dependencies), [
    {
      memberId,
      username: "owner",
      displayName: "Owner Test",
      role: "shift_responsible",
      status: "active",
      joinedAt: "2099-01-01T01:00:00.000Z",
      leftAt: null,
    },
  ]);
});

test("shift server rejects malformed session input before reaching Supabase", async () => {
  const { dependencies, calls } = fixture();
  await assert.rejects(
    () =>
      openShift(
        { workstationToken: "bad", operatorToken: "bad" },
        dependencies,
      ),
    (error) => error?.code === "INVALID_SESSION",
  );
  assert.equal(calls.length, 0);
});
