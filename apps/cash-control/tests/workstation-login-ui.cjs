const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const ts = require("typescript");

let session;
let mode;
let routerCalls;
let fetchCalls;
let fetchBody;
let fetchOk;
let stores;
let currentStore;
let cursor;
let pendingEffects;

const react = {
  useState: (initial) => {
    const store = currentStore;
    const index = cursor++;
    if (!(index in store))
      store[index] = typeof initial === "function" ? initial() : initial;
    return [
      store[index],
      (value) => {
        store[index] =
          typeof value === "function" ? value(store[index]) : value;
      },
    ];
  },
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useEffect: (effect, deps) => {
    const store = currentStore;
    const index = cursor++;
    const key = `effect-${index}`;
    const previous = store[key];
    if (
      !previous ||
      deps.some((dep, position) => !Object.is(dep, previous[position]))
    ) {
      store[key] = deps;
      pendingEffects.push(effect);
    }
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "react") return react;
  if (request === "react/jsx-runtime") {
    const createNode = (type, props) => ({ type, props: props ?? {} });
    return { Fragment: "Fragment", jsx: createNode, jsxs: createNode };
  }
  if (request === "lucide-react")
    return new Proxy({}, { get: (_, name) => name });
  if (request === "next/navigation")
    return { useRouter: () => ({ push: (href) => routerCalls.push(href) }) };
  if (request === "@/components/session/RealAppSessionProvider")
    return { useRealWorkstationSession: () => session };
  if (request === "@/components/shared/UserAvatar")
    return { UserAvatar: "UserAvatar" };
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

const {
  RealPinLoginScreen,
} = require("../src/components/workstation/RealPinLoginScreen.tsx");
const {
  WorkstationPage,
} = require("../src/components/workstation/WorkstationPage.tsx");

const ana = {
  memberId: "member-ana",
  username: "ana",
  displayName: "Ana López",
  role: "employee",
};
const zeferino = {
  memberId: "member-zeferino",
  username: "zeferino",
  displayName: "Zeferino",
  role: "owner",
};

function reset({ candidates = [ana, zeferino], ok = true, body } = {}) {
  mode = "initial";
  routerCalls = [];
  globalThis.window = {
    location: { replace: (href) => routerCalls.push(href) },
  };
  fetchCalls = [];
  fetchOk = ok;
  fetchBody = body ?? { candidates };
  session = {
    state: "NO_WORKSTATION",
    operator: null,
    activatedMembers: [],
    error: null,
    startWithPin: async () => true,
  };
  stores = new Map();
  pendingEffects = [];
}

globalThis.fetch = async (url, options) => {
  fetchCalls.push({ url, options });
  return {
    ok: fetchOk,
    status: fetchOk ? 200 : 503,
    json: async () => fetchBody,
  };
};

function allNodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(allNodes);
  return [node, ...allNodes(node.props?.children)];
}

function nodeText(node) {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (typeof node !== "object") return String(node);
  return nodeText(node.props?.children);
}

function buttonByText(tree, text) {
  return allNodes(tree).find(
    (node) => node.type === "button" && nodeText(node) === text,
  );
}

/** User cards also show the role, so they are matched by display name. */
function cardByText(tree, text) {
  return allNodes(tree).find(
    (node) => node.type === "button" && nodeText(node).includes(text),
  );
}

function formOf(tree) {
  return allNodes(tree).find((node) => node.type === "form");
}

function pinInput(tree) {
  return allNodes(tree).find(
    (node) => node.type === "input" && node.props.name === "pin",
  );
}

function renderOnce() {
  if (!stores.has(RealPinLoginScreen)) stores.set(RealPinLoginScreen, []);
  currentStore = stores.get(RealPinLoginScreen);
  cursor = 0;
  return RealPinLoginScreen({ mode });
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function settle() {
  const effects = pendingEffects;
  pendingEffects = [];
  for (const effect of effects) effect();
  await flush();
  await flush();
  return renderOnce();
}

async function render() {
  renderOnce();
  return settle();
}
test("carga los usuarios reales del negocio y los muestra como tarjetas", async () => {
  reset();
  const loading = renderOnce();
  assert.match(nodeText(loading), /Cargando usuarios…/);
  assert.equal(fetchCalls.length, 0);

  const tree = await settle();
  assert.equal(fetchCalls.length, 1);
  assert.equal(
    fetchCalls[0].url,
    "/api/workstation/candidates?businessSlug=cash-control",
  );
  assert.equal(fetchCalls[0].options.cache, "no-store");
  assert.equal(fetchCalls[0].options.credentials, "same-origin");
  assert.match(nodeText(tree), /Ana López/);
  assert.match(nodeText(tree), /Empleado/);
  assert.match(nodeText(tree), /Zeferino/);
  assert.match(nodeText(tree), /Dueño/);
  assert.equal(nodeText(tree).includes("cash-control"), false);
  assert.equal(nodeText(tree).includes("María López"), false);
  assert.equal(nodeText(tree).includes("Juan Pérez"), false);
  assert.ok(cardByText(tree, "Ana López"));
  assert.ok(cardByText(tree, "Zeferino"));
});

test("seleccionar una tarjeta muestra el PIN y ningún campo de usuario", async () => {
  reset();
  const tree = await render();
  cardByText(tree, "Ana López").props.onClick();
  const selected = await settle();

  assert.equal(cardByText(selected, "Ana López").props["aria-pressed"], true);
  assert.equal(cardByText(selected, "Zeferino").props["aria-pressed"], false);
  const form = formOf(selected);
  assert.ok(form);
  const inputs = allNodes(form).filter((node) => node.type === "input");
  assert.deepEqual(
    inputs.map((input) => input.props.name),
    ["pin"],
  );
  assert.equal(inputs[0].props.type, "password");
  assert.equal(inputs[0].props.autoComplete, "off");
  assert.equal(buttonByText(selected, "Entrar").props.disabled, true);

  buttonByText(selected, "Cambiar usuario").props.onClick();
  const cleared = await settle();
  assert.equal(formOf(cleared), undefined);
  assert.equal(cardByText(cleared, "Ana López").props["aria-pressed"], false);
});

test("el PIN se envía con el usuario seleccionado y se limpia al entrar", async () => {
  reset();
  const startCalls = [];
  session.startWithPin = async (input) => {
    startCalls.push(input);
    return true;
  };

  const tree = await render();
  cardByText(tree, "Zeferino").props.onClick();
  let selected = await settle();

  pinInput(selected).props.onChange({ target: { value: "12" } });
  selected = await settle();
  assert.equal(buttonByText(selected, "Entrar").props.disabled, true);

  pinInput(selected).props.onChange({ target: { value: "12ab" } });
  selected = await settle();
  assert.equal(pinInput(selected).props.value, "12");

  pinInput(selected).props.onChange({ target: { value: "1234" } });
  selected = await settle();
  assert.equal(buttonByText(selected, "Entrar").props.disabled, false);

  await formOf(selected).props.onSubmit({ preventDefault() {} });
  const after = await settle();

  assert.deepEqual(startCalls, [
    {
      businessSlug: "cash-control",
      username: "zeferino",
      pin: "1234",
      deferStateUpdate: true,
    },
  ]);
  assert.deepEqual(routerCalls, ["/"]);
  assert.equal(pinInput(after).props.value, "");
});

test("un PIN rechazado muestra el error de la sesión real y no entra", async () => {
  reset();
  session.startWithPin = async () => {
    session.error = "No se pudo desbloquear con ese PIN.";
    return false;
  };

  const tree = await render();
  cardByText(tree, "Ana López").props.onClick();
  let selected = await settle();
  pinInput(selected).props.onChange({ target: { value: "9999" } });
  selected = await settle();

  await formOf(selected).props.onSubmit({ preventDefault() {} });
  const after = await settle();

  assert.match(nodeText(after), /No se pudo desbloquear con ese PIN\./);
  assert.equal(pinInput(after).props.value, "");
  assert.equal(pinInput(after).props["aria-invalid"], true);
  assert.deepEqual(routerCalls, []);
});

test("si la consulta de usuarios falla se informa sin inventar tarjetas", async () => {
  reset({ ok: false, body: { error: "Servicio no disponible." } });
  const tree = await render();
  assert.match(
    nodeText(tree),
    /No se pudieron cargar los usuarios del negocio\./,
  );
  assert.equal(cardByText(tree, "Ana López"), undefined);
  assert.equal(formOf(tree), undefined);
});

test("una respuesta con candidatos inválidos no se muestra parcialmente", async () => {
  reset({
    body: {
      candidates: [
        ana,
        {
          memberId: 7,
          username: "roto",
          displayName: "Roto",
          role: "employee",
        },
      ],
    },
  });
  const tree = await render();
  assert.match(
    nodeText(tree),
    /No se pudieron cargar los usuarios del negocio\./,
  );
  assert.equal(nodeText(tree).includes("Roto"), false);
  assert.equal(cardByText(tree, "Ana López"), undefined);
});

test("sin usuarios activos no se ofrece el formulario de PIN", async () => {
  reset({ candidates: [] });
  const tree = await render();
  assert.match(nodeText(tree), /No hay usuarios activos en este negocio\./);
  assert.equal(formOf(tree), undefined);
});

for (const [state, expectedMode] of [
  ["NO_WORKSTATION", "initial"],
  ["INVALID_SESSION", "initial"],
  ["NO_OPERATOR", "unlock"],
  ["loading", null],
  ["ACTIVE", null],
]) {
  test(`WorkstationPage: ${state} muestra solo el flujo correspondiente`, () => {
    reset();
    session.state = state;
    currentStore = [];
    cursor = 0;
    const tree = WorkstationPage();
    const nodes = allNodes(tree);
    const login = nodes.find((node) => node.type === RealPinLoginScreen);
    assert.equal(login?.props.mode ?? null, expectedMode);
    assert.equal(
      nodes.some((node) => node.type?.name === "RealWorkstationPanel"),
      false,
    );
    assert.deepEqual(routerCalls, []);
    for (const effect of pendingEffects) effect();
    assert.deepEqual(routerCalls, state === "ACTIVE" ? ["/"] : []);
    if (state === "ACTIVE")
      assert.match(nodeText(tree), /Entrando a Cash Control/);
  });
}

for (const accepted of [true, false]) {
  test(`unlock usa solo miembros activados y unlock (PIN aceptado: ${accepted})`, async () => {
    reset({ body: { state: "ACTIVE", members: [zeferino] } });
    mode = "unlock";
    session.state = "NO_OPERATOR";
    session.startWithPin = async () =>
      assert.fail("No se debe crear otra estación");
    const calls = [];
    session.unlock = async (input) => {
      calls.push(input);
      if (!accepted) session.error = "PIN incorrecto.";
      return accepted;
    };
    const tree = await render();
    assert.deepEqual(
      fetchCalls.map((call) => call.url),
      ["/api/workstation/members"],
    );
    assert.match(nodeText(tree), /Desbloquear Cash Control/);
    assert.match(nodeText(tree), /Selecciona tu usuario e introduce tu PIN\./);
    assert.equal(cardByText(tree, "Ana López"), undefined);
    cardByText(tree, "Zeferino").props.onClick();
    let selected = await settle();
    pinInput(selected).props.onChange({ target: { value: "1234" } });
    selected = await settle();
    await formOf(selected).props.onSubmit({ preventDefault() {} });
    const after = await settle();
    assert.deepEqual(calls, [{ memberId: zeferino.memberId, pin: "1234" }]);
    assert.deepEqual(routerCalls, accepted ? ["/"] : []);
    assert.equal(pinInput(after).props.value, "");
    assert.equal(pinInput(after).props.disabled, accepted);
    assert.doesNotMatch(
      nodeText(after),
      /Sesión real de Workstation|Activar otro miembro|Cambiar operador/,
    );
    if (!accepted) assert.match(nodeText(after), /PIN incorrecto/);
  });
}

test("unlock sin activaciones no consulta candidates ni ofrece PIN", async () => {
  reset({ body: { state: "ACTIVE", members: [] } });
  mode = "unlock";
  const tree = await render();
  assert.equal(formOf(tree), undefined);
  assert.match(nodeText(tree), /No hay miembros activados en esta estación/);
  assert.deepEqual(
    fetchCalls.map((call) => call.url),
    ["/api/workstation/members"],
  );
});
