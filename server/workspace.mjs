// Request-scoped workspace context.
//
// Every app row and meta key is partitioned by workspace. The HTTP layer sets
// the workspace from the session cookie (or the API key) once per request, and
// the stores read it from AsyncLocalStorage. The engine and trust modules stay
// unchanged because they call loadAll/put/getMeta without passing a workspace.
import { AsyncLocalStorage } from "node:async_hooks";

export const DEMO_WORKSPACE = "ws_demo";

const als = new AsyncLocalStorage();

export function currentWorkspaceId() {
  return als.getStore() || DEMO_WORKSPACE;
}

export function runWithWorkspace(workspaceId, fn) {
  return als.run(workspaceId || DEMO_WORKSPACE, fn);
}

// enterWith is used after the session or API key resolves mid-request. Node
// gives every inbound request its own async context, so this does not leak
// between concurrent requests.
export function setWorkspace(workspaceId) {
  als.enterWith(workspaceId || DEMO_WORKSPACE);
}
