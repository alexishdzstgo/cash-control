const { spawn } = require("child_process");

console.log("Spawning persistent psql process...");
console.time("startup");

const proc = spawn("wsl.exe", [
  "-u",
  "root",
  "su",
  "-",
  "postgres",
  "-c",
  "psql -d cash_control_test -q -t -A",
]);

let buffer = "";
let resolveQuery = null;

proc.stdout.on("data", (data) => {
  buffer += data.toString();
  if (buffer.includes("__END_QUERY__")) {
    const parts = buffer.split("__END_QUERY__");
    const result = parts[0].trim();
    buffer = parts[1] || "";
    if (resolveQuery) {
      resolveQuery(result);
      resolveQuery = null;
    }
  }
});

proc.stderr.on("data", (data) => {
  console.error("STDERR:", data.toString());
});

function runQuery(sql) {
  return new Promise((resolve) => {
    resolveQuery = resolve;
    proc.stdin.write(`${sql};\n\\echo '__END_QUERY__'\n`);
  });
}

async function test() {
  // Wait for psql to be ready
  const warmup = await runQuery("SELECT 1");
  console.timeEnd("startup");
  console.log("Warmup response:", warmup);

  // Now measure individual queries!
  for (let i = 1; i <= 5; i++) {
    console.time(`query_${i}`);
    const res = await runQuery(`SELECT json_build_object('iter', ${i}, 'db', current_database(), 'time', clock_timestamp())::text`);
    console.timeEnd(`query_${i}`);
    console.log(`Result ${i}:`, res);
  }

  proc.stdin.end();
}

test();
