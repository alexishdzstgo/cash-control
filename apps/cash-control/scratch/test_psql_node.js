const { execFile } = require("child_process");

console.time("psql_no_login");
const sql = "SELECT json_build_object('db', current_database(), 'user', current_user, 'now', clock_timestamp())::text;";

execFile(
  "wsl.exe",
  ["-u", "root", "su", "postgres", "-c", `psql -d cash_control_test -t -A -c "${sql}"`],
  (error, stdout, stderr) => {
    console.timeEnd("psql_no_login");
    if (error) {
      console.error("ERROR:", error.message);
      console.error("STDERR:", stderr);
      process.exit(1);
    }
    console.log("SUCCESS:", JSON.parse(stdout.trim()));
  }
);
