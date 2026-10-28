const { spawn } = require("child_process");

const proc = spawn("wsl.exe", [
  "-u",
  "root",
  "su",
  "-",
  "postgres",
  "-c",
  "psql -d cash_control_test -q -t -A -v ON_ERROR_STOP=0",
]);

let buffer = "";
let pending = null;

proc.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  checkDelimiter();
});

proc.stderr.on("data", (chunk) => {
  buffer += chunk.toString();
  checkDelimiter();
});

function checkDelimiter() {
  if (buffer.includes("__DELIM__")) {
    const idx = buffer.indexOf("__DELIM__");
    const output = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + "__DELIM__".length);
    if (pending) {
      const { resolve, reject } = pending;
      pending = null;
      if (output.startsWith("ERROR:")) {
        reject(new Error(output));
      } else {
        resolve(output);
      }
    }
  }
}

function executeRpc(fnName, params = []) {
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    // Format params for SQL
    const formattedParams = params.map((p) => {
      if (p === null || p === undefined) return "NULL";
      if (typeof p === "number" || typeof p === "boolean") return p.toString();
      // string/uuid: escape single quotes
      return `'${p.toString().replace(/'/g, "''")}'`;
    });
    const sql = `SELECT public.${fnName}(${formattedParams.join(", ")})::text;\n\\echo '__DELIM__'\n`;
    proc.stdin.write(sql);
  });
}

async function run() {
  // 1. Warmup
  await new Promise((resolve, reject) => {
    pending = { resolve, reject };
    proc.stdin.write(`SELECT 1;\n\\echo '__DELIM__'\n`);
  });

  // 2. Test invalid PIN call to rpc_open_shift
  try {
    const dummyBiz = "b0000000-0000-0000-0000-000000000001";
    const dummyWs = "w0000000-0000-0000-0000-000000000001";
    const dummyMember = "m0000000-0000-0000-0000-000000000001";
    console.log("Calling rpc_open_shift with wrong PIN...");
    const res = await executeRpc("rpc_open_shift", [dummyBiz, dummyWs, dummyMember, "9999"]);
    console.log("Unexpected success:", res);
  } catch (err) {
    console.log("Caught expected error:", err.message);
  }

  proc.stdin.end();
}

run();
