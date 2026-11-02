import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const paypalEnv = {};

for (const name of [".env", ".env.local"]) {
  const path = join(root, name);
  if (!existsSync(path)) continue;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(path, "utf8")))) {
    if (key.startsWith("PAYPAL_")) paypalEnv[key] = value;
  }
}

for (const [key, value] of Object.entries(paypalEnv)) {
  if (process.env[key] === undefined) process.env[key] = value;
}
