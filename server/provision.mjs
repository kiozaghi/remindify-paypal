// Create the first workspace for an account.
//
// New accounts get their own seeded copy of the demo register so the product is
// useful on first login, but every row stays inside that account's workspace.
import { getMeta, setMeta, seedDatabase } from "./db.mjs";
import { runWithWorkspace } from "./workspace.mjs";
import { ensureTrustDemo } from "./trust.mjs";

export function provisionWorkspace(user) {
  if (!user?.workspace_id) return user;
  runWithWorkspace(user.workspace_id, () => {
    if (getMeta("seeded", false)) return;
    seedDatabase(true);
    setMeta("workspace", `${user.name || "Your"}'s desk`);
    setMeta("user", user.name || "Operator");
    setMeta("plan", "Free");
    ensureTrustDemo();
  });
  return user;
}
