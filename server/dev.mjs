import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Local runs keep the PayPal credentials in .env.local. Only the rail's own
// variables are loaded: the same file carries the production database URL, and
// a local run pointed at it would write demo data into the live workspace.
const envFile = join(root, ".env.local");
if (existsSync(envFile)) {
  const parsed = parseEnv(readFileSync(envFile, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (key.startsWith("PAYPAL_") && process.env[key] === undefined) process.env[key] = value;
  }
}

const api = spawn(process.execPath, [join(root, "server/index.mjs")], {
  stdio: ["ignore", "inherit", "inherit"],
  env: { ...process.env, PORT: "4178" },
});

const vite = spawn("npx", ["vite", "--port", "5173", "--strictPort"], {
  cwd: root,
  stdio: ["ignore", "inherit", "inherit"],
  env: { ...process.env, FORCE_COLOR: "1" },
});

function shutdown() {
  api.kill("SIGTERM");
  vite.kill("SIGTERM");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
api.on("exit", (code) => {
  if (code) shutdown();
});
vite.on("exit", (code) => {
  if (code) shutdown();
});
