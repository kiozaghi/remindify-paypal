import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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
