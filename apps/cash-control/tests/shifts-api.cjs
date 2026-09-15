const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

class ShiftOperationError extends Error {
  constructor(code) {
    super(`shift error: ${code}`);
    this.code = code;
  }
}

class WorkstationSessionError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

class OriginValidationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const state = {
  session: {
    workstationToken: "workstation-session-token",
    operatorToken: "operator-session-token",
  },
  calls: [],
  shift: {
    id: "44444444-4444-4444-8444-444444444444",
    folio: "TUR-000001",
    status: "open",
  },
  participants: [
    {
      memberId: "22222222-2222-4222-8222-222222222222",
      username: "owner",
      displayName: "Owner Test",
      role: "shift_responsible",
      status: "active",
    },
  ],
  errors: {},
};

function resetState() {
  state.calls = [];
  state.errors = {};
}

function serviceCall(name, input, result) {
  state.calls.push({ name, input });
  const error = state.errors[name];
  if (error) throw error;
  return result;
}

const serviceMock = {
  ShiftOperationError,
  async resolveOpenShift(session) {
    return serviceCall("resolveOpenShift", session, state.shift);
  },
  async listShiftParticipants(session) {
    return serviceCall("listShiftParticipants", session, state.participants);
  },
  async openShift(session) {
    return serviceCall("openShift", session, state.shift);
  },
  async addShiftParticipant(input) {
    return serviceCall("addShiftParticipant", input, {
      ...state.participants[0],
      memberId: input.memberId,
    });
  },
  async transferShiftResponsibility(input) {
    return serviceCall("transferShiftResponsibility", input, {
      shiftId: state.shift.id,
      responsibleMemberId: input.memberId,
    });
  },
  async leaveShift(session) {
    return serviceCall("leaveShift", session, {
      ...state.participants[0],
      status: "left",
    });
  },
};

function cookieValue(request, name) {
  if (name === "cash_control_workstation")
    return request.session?.workstationToken;
  if (name === "cash_control_operator") return request.session?.operatorToken;
  return undefined;
}

function fakeRequest({
  session = state.session,
  body = {},
  origin = "http://localhost:3000",
} = {}) {
  return {
    session,
    headers: { get: (name) => (name === "origin" ? origin : null) },
    cookies: { get: (name) => ({ value: cookieValue({ session }, name) }) },
    json: async () => body,
  };
}

const nextServerMock = {
  NextResponse: {
    json(body, init = {}) {
      return {
        body,
        status: init.status ?? 200,
        headers: init.headers ?? {},
      };
    },
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "next/server") return nextServerMock;
  if (request === "@/lib/shifts/server/shifts.mjs") return serviceMock;
  if (request === "@/lib/workstation/server/shared.mjs")
    return { WorkstationSessionError };
  if (request === "@/lib/workstation/server/csrf.mjs")
    return {
      OriginValidationError,
      assertMutationOrigin(request) {
        if (!request.headers?.get?.("origin"))
          throw new OriginValidationError("MISSING_ORIGIN");
      },
    };
  if (request === "@/lib/workstation/server/cookies.mjs")
    return {
      readSessionCookies(request) {
        return {
          workstationToken: request.session?.workstationToken ?? null,
          operatorToken: request.session?.operatorToken ?? null,
        };
      },
    };
  if (request.startsWith("@/"))
    request = path.resolve(__dirname, "../src", request.slice(2));
  return originalLoad.call(this, request, parent, isMain);
};

for (const extension of [".ts", ".tsx"]) {
  Module._extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(
      fs.readFileSync(filename, "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2020,
        },
      },
    );
    module._compile(outputText, filename);
  };
}

const shiftsRoute = require("../src/app/api/shifts/route.ts");
const participantsRoute = require("../src/app/api/shifts/participants/route.ts");
const responsibilityRoute = require("../src/app/api/shifts/responsibility/route.ts");
const leaveRoute = require("../src/app/api/shifts/leave/route.ts");

test("GET /api/shifts exige las dos cookies de sesión real", async () => {
  resetState();
  const response = await shiftsRoute.GET(fakeRequest({ session: {} }));
  assert.equal(response.status, 401);
  assert.equal(state.calls.length, 0);
});

test("GET /api/shifts devuelve turno y participantes sin confiar en actor del cliente", async () => {
  resetState();
  const response = await shiftsRoute.GET(
    fakeRequest({
      body: { actorId: "client-controlled", userId: "client-controlled" },
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    shift: state.shift,
    participants: state.participants,
  });
  assert.deepEqual(state.calls[0].input, state.session);
  assert.deepEqual(state.calls[1].input, state.session);
});

test("POST /api/shifts abre el turno y traduce un duplicado", async () => {
  resetState();
  const opened = await shiftsRoute.POST(fakeRequest());
  assert.equal(opened.status, 201);
  assert.deepEqual(state.calls[0], { name: "openShift", input: state.session });

  resetState();
  state.errors.openShift = new ShiftOperationError("DUPLICATE_OPEN_SHIFT");
  const duplicate = await shiftsRoute.POST(fakeRequest());
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, "DUPLICATE_OPEN_SHIFT");
});

test("POST /api/shifts/participants acepta únicamente memberId", async () => {
  resetState();
  const response = await participantsRoute.POST(
    fakeRequest({ body: { memberId: "33333333-3333-4333-8333-333333333333" } }),
  );
  assert.equal(response.status, 201);
  assert.deepEqual(state.calls[0].input, {
    ...state.session,
    memberId: "33333333-3333-4333-8333-333333333333",
  });

  resetState();
  const invalid = await participantsRoute.POST(
    fakeRequest({ body: { memberId: "member", actorId: "client-controlled" } }),
  );
  assert.equal(invalid.status, 400);
  assert.equal(state.calls.length, 0);
});

test("POST /api/shifts/participants expone fallos de negocio sin filtrar detalles", async () => {
  resetState();
  state.errors.addShiftParticipant = new ShiftOperationError("INVALID_MEMBER");
  const response = await participantsRoute.POST(
    fakeRequest({ body: { memberId: "33333333-3333-4333-8333-333333333333" } }),
  );
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: "shift error: INVALID_MEMBER",
    code: "INVALID_MEMBER",
  });
});

test("POST /api/shifts/responsibility no aparenta validar PIN ni ejecuta la RPC 0006", async () => {
  resetState();
  const noSession = await responsibilityRoute.POST(
    fakeRequest({
      session: {},
      body: {
        p_new_responsible_member_id: "33333333-3333-4333-8333-333333333333",
      },
    }),
  );
  assert.equal(noSession.status, 401);
  assert.equal(state.calls.length, 0);

  const response = await responsibilityRoute.POST(
    fakeRequest({
      body: {
        p_new_responsible_member_id: "33333333-3333-4333-8333-333333333333",
      },
    }),
  );
  assert.equal(response.status, 501);
  assert.deepEqual(response.body, {
    error:
      "La transferencia persistida requiere validación del PIN del receptor en una fase posterior.",
    code: "TRANSFER_PIN_UNSUPPORTED",
  });
  assert.equal(state.calls.length, 0);

  const invalid = await responsibilityRoute.POST(
    fakeRequest({
      body: {
        p_new_responsible_member_id: "33333333-3333-4333-8333-333333333333",
        userId: "client-controlled",
      },
    }),
  );
  assert.equal(invalid.status, 400);
  assert.equal(state.calls.length, 0);
});

test("POST /api/shifts/leave no acepta actor del cliente y traduce responsable activo", async () => {
  resetState();
  const response = await leaveRoute.POST(
    fakeRequest({
      body: { actorId: "client-controlled", memberId: "client-controlled" },
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(state.calls[0].input, state.session);

  resetState();
  state.errors.leaveShift = new ShiftOperationError("RESPONSIBLE_CANNOT_LEAVE");
  const blocked = await leaveRoute.POST(fakeRequest());
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, "RESPONSIBLE_CANNOT_LEAVE");
});
