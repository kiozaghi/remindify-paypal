import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

dotenv.config({ path: ".env.local" });
dotenv.config();

const url = process.env.NEON_DATABASE_URL;
if (!url) {
  console.error("No NEON_DATABASE_URL found. Run npm run db:check first to connect Neon.");
  process.exit(1);
}

const db = drizzle(neon(url));
await migrate(db, { migrationsFolder: "db/migrations" });
console.log("Migrations applied.");
