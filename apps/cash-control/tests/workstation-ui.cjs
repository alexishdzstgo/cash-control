const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");

let currentStore;
let cursor = 0;
let stores = new Map();
let session;
let unlockCalls;

const react = {
  useEffect: () => {},
  useMemo: (fn) => fn(),
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
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "react") return react;
  if (request === "react/jsx-runtime") {
    const createNode = (type, props) => {
      const resolvedProps = props ?? {};
      return typeof type === "function"
        ? type(resolvedProps)
        : { type, props: resolvedProps };
    };
    return {
      jsx: createNode,
      jsxs: createNode,
    };
  }
  if (request === "lucide-react")
    return new Proxy({}, { get: (_, name) => name });
  if (request === "@/components/shared/UserAvatar")
    return { UserAvatar: "UserAvatar" };
  if (request.includes("RealWorkstationSessionProvider"))
    return { useRealWorkstationSession: () => session };
  return originalLoad.call(this, request, parent, isMain);
};

Module._extensions[".tsx"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
    },
  });
  module._compile(outputText, filename);
};

const {
  RealWorkstationPanel,
} = require("../src/components/workstation/RealWorkstationPanel.tsx");

function makeMember(memberId, displayName, username, role) {
  return { memberId, displayName, username, role };
}

function resetSession({ members = true } = {}) {
  unlockCalls = [];
  session = {
    state: "ACTIVE",
    operator: {
      identity: {
        memberId: "member-a",
        displayName: "Alexis Hernández",
        username: "alexis",
        role: "owner",
      },
    },
    activatedMembers: members
      ? [
          makeMember("member-a", "Alexis Hernández", "alexis", "owner"),
          makeMember("member-b", "Juan Pérez", "juan", "employee"),
        ]
      : [],
    error: null,
    start: async () => true,
    startWithPin: async () => true,
    activate: async () => true,
    unlock: async (input) => {
      unlockCalls.push(input);
      return true;
    },
    lock: async () => {
      session.state = "NO_OPERATOR";
      session.operator = null;
      return true;
    },
    close: async () => {
      session.state = "NO_WORKSTATION";
      session.operator = null;
      session.activatedMembers = [];
      return true;
    },
  };
  stores = new Map();
}

function render() {
  if (!stores.has(RealWorkstationPanel)) stores.set(RealWorkstationPanel, []);
  currentStore = stores.get(RealWorkstationPanel);
  cursor = 0;
  return RealWorkstationPanel();
}

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

function memberButton(tree, displayName) {
  return allNodes(tree).find(
    (node) => node.type === "button" && nodeText(node).includes(displayName),
  );
}

function pinForm(tree) {
  return allNodes(tree).find(
    (node) =>
      node.type === "form" && nodeText(node).includes("Cambiar operador"),
  );
}

test("renders activated members without exposing their member IDs", () => {
  resetSession();
  const tree = render();
  const serialized = JSON.stringify(tree);
  assert.match(nodeText(tree), /Alexis Hernández/);
  assert.match(nodeText(tree), /alexis/);
  assert.match(nodeText(tree), /Owner/);
  assert.match(nodeText(tree), /Juan Pérez/);
  assert.match(nodeText(tree), /juan/);
  assert.match(nodeText(tree), /Employee/);
  assert.equal(serialized.includes("member-a"), false);
  assert.equal(serialized.includes("member-b"), false);
});

test("selecting a member changes the accessible selected state", () => {
  resetSession();
  const tree = render();
  const button = memberButton(tree, "Juan Pérez");
  assert.equal(button.props["aria-pressed"], false);
  button.props.onClick();
  assert.equal(
    memberButton(render(), "Juan Pérez").props["aria-pressed"],
    true,
  );
});

test("marks the current operator and keeps unlock disabled before selection", () => {
  resetSession();
  const tree = render();
  assert.match(nodeText(tree), /Actual/);
  assert.equal(buttonByText(tree, "Cambiar operador").props.disabled, true);
});

test("submit sends the selected member ID and clears PIN/selection after success", async () => {
  resetSession();
  const firstTree = render();
  memberButton(firstTree, "Juan Pérez").props.onClick();
  const tree = render();
  const form = pinForm(tree);
  const pinInput = allNodes(form).find(
    (node) => node.type === "input" && node.props.name === "pin",
  );
  pinInput.props.onChange({ target: { value: "2345" } });
  await pinForm(render()).props.onSubmit({ preventDefault() {} });
  assert.deepEqual(unlockCalls, [{ memberId: "member-b", pin: "2345" }]);
  const after = render();
  assert.equal(memberButton(after, "Juan Pérez").props["aria-pressed"], false);
  assert.equal(
    allNodes(after).find(
      (node) => node.type === "input" && node.props.name === "pin",
    ).props.value,
    "",
  );
});

test("without activated members the PIN unlock form is unavailable", () => {
  resetSession({ members: false });
  const tree = render();
  assert.match(nodeText(tree), /No hay miembros activados en esta estación/);
  assert.equal(pinForm(tree), undefined);
  assert.equal(unlockCalls.length, 0);
});

test("lock preserves the activated member list while removing the current operator", async () => {
  resetSession();
  const tree = render();
  await buttonByText(tree, "Bloquear operador").props.onClick();
  const after = render();
  assert.match(nodeText(after), /Alexis Hernández/);
  assert.match(nodeText(after), /Juan Pérez/);
  assert.doesNotMatch(nodeText(after), /Operador resuelto en servidor/);
});

test("close clears the activated member list", async () => {
  resetSession();
  const tree = render();
  await buttonByText(tree, "Cerrar estación").props.onClick();
  const after = render();
  assert.match(nodeText(after), /Entrar a Cash Control/);
  assert.doesNotMatch(nodeText(after), /Alexis Hernández/);
  assert.doesNotMatch(nodeText(after), /Juan Pérez/);
});

test("first real station accepts business, username and PIN", async () => {
  resetSession({ members: false });
  session.state = "NO_WORKSTATION";
  session.operator = null;
  const startCalls = [];
  session.startWithPin = async (input) => {
    startCalls.push(input);
    session.state = "ACTIVE";
    return true;
  };

  const tree = render();
  const form = allNodes(tree).find(
    (node) =>
      node.type === "form" && nodeText(node).includes("Entrar a Cash Control"),
  );
  const inputs = allNodes(form).filter((node) => node.type === "input");
  for (const [index, value] of ["cash-control", "zeferino", "1234"].entries())
    inputs[index].props.onChange({ target: { value } });
  const updatedForm = allNodes(render()).find(
    (node) =>
      node.type === "form" && nodeText(node).includes("Entrar a Cash Control"),
  );
  await updatedForm.props.onSubmit({ preventDefault() {} });

  assert.deepEqual(startCalls, [
    { businessSlug: "cash-control", username: "zeferino", pin: "1234" },
  ]);
});
