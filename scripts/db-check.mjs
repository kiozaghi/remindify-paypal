import { existsSync, readFileSync, writeFileSync } from "node:fs";
import readline from "node:readline";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";

dotenv.config({ path: ".env.local" });
dotenv.config();

function hiddenPrompt(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = false;
    rl._writeToOutput = function (chunk) {
      if (rl.stdoutMuted) rl.output.write("*");
      else rl.output.write(chunk);
    };
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
    rl.stdoutMuted = true;
  });
}

function saveToEnvLocal(key, value) {
  const path = ".env.local";
  let content = existsSync(path) ? readFileSync(path, "utf8") : "";
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  content = re.test(content) ? content.replace(re, line) : content.replace(/\n?$/, "\n") + line + "\n";
  writeFileSync(path, content);
}

const GUIDE = `
No NEON_DATABASE_URL is configured, so the Web3 schema has no home yet.
(DATABASE_URL/POSTGRES_URL are left untouched — they belong to the app's
existing Vercel database.)

Create a Neon project and connect it:

  1. Open https://console.neon.tech and sign in (or create a free account).
  2. Click "New Project" — any name works; pick the region closest to you.
  3. On the project dashboard, click "Connect" (or "Connection Details").
  4. Copy the "Pooled connection" string. It looks like:
     postgresql://user:password@host-pooler.region.aws.neon.tech/dbname?sslmode=require
  5. Paste it below (input is hidden). It is saved as NEON_DATABASE_URL in
     .env.local, which is gitignored.
`;

let url = process.env.NEON_DATABASE_URL;

if (!url) {
  console.log(GUIDE);
  if (!process.stdin.isTTY) {
    console.error("Non-interactive shell: add the line below to .env.local, then re-run npm run db:check");
    console.error("  NEON_DATABASE_URL=postgresql://user:password@host-pooler...neon.tech/dbname?sslmode=require");
    process.exit(1);
  }
  const answer = await hiddenPrompt("Neon connection string: ");
  if (!/^postgres(ql)?:\/\//.test(answer)) {
    console.error("That does not look like a postgres:// connection string.");
    process.exit(1);
  }
  saveToEnvLocal("NEON_DATABASE_URL", answer);
  url = answer;
  console.log("\nSaved to .env.local (gitignored).");
}

const sql = neon(url);
try {
  const [row] = await sql`select current_database() as db, current_user as usr, version()`;
  console.log(`Connected to Neon database "${row.db}" as ${row.usr}.`);
  console.log(`Server: ${row.version.split(",")[0]}`);
  console.log("\nNext: npm run db:migrate  (or npm run db:setup to do both in one go)");
} catch (err) {
  console.error(`Connection failed: ${err.message}`);
  console.error("Check the string in .env.local and that the Neon project is active.");
  process.exit(1);
}
