const net = require("net");

const client = new net.Socket();
console.time("tcp_localhost");

client.connect(5432, "127.0.0.1", () => {
  console.timeEnd("tcp_localhost");
  console.log("Connected to 127.0.0.1:5432!");
  client.destroy();
});

client.on("error", (err) => {
  console.timeEnd("tcp_localhost");
  console.error("127.0.0.1 error:", err.message);
  
  // Try localhost
  console.time("tcp_localhost_name");
  const c2 = new net.Socket();
  c2.connect(5432, "localhost", () => {
    console.timeEnd("tcp_localhost_name");
    console.log("Connected to localhost:5432!");
    c2.destroy();
  });
  c2.on("error", (err2) => {
    console.timeEnd("tcp_localhost_name");
    console.error("localhost error:", err2.message);
  });
});
