#!/usr/bin/env node
// Remindify MCP server — zero dependencies, stdio transport.
// Exposes the obligation register to Claude, Cursor, or any MCP client.
//
//   REMINDIFY_URL=http://localhost:4178 \
//   REMINDIFY_KEY=rfy_live_... node mcp/server.mjs
//
// The key comes from Access → Agent access → Issue key. The default below is
// the seeded demo key, so `npm run mcp` works on a fresh checkout.

import { createInterface } from "node:readline";

const BASE = (process.env.REMINDIFY_URL || "http://localhost:4178").replace(/\/$/, "");
const KEY = process.env.REMINDIFY_KEY || "rfy_live_7c2a91f4d0e8b6a3c5d2";
const PROTOCOL = "2024-11-05";

const TOOLS = [
  {
    name: "list_obligations",
    description:
      "List recurring obligations in the register with due date, owner, autonomy, proof requirement and live risk. Use this before deciding what needs attention.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "done", "archived", "all"], description: "Default active." },
        category: { type: "string", description: "finance, work, home, health, identity, people or other." },
        owner: { type: "string", description: "Filter by owner name (case-insensitive substring)." },
        risk: { type: "string", enum: ["critical", "high", "watch", "guarded"], description: "Filter by risk band." },
        limit: { type: "number", description: "Max rows. Default 20, max 100." },
      },
    },
  },
  {
    name: "get_obligation",
    description: "Read one obligation in full, including its risk breakdown, checklist, proof requirement and recent history.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Obligation ID, e.g. ob_insurance." } },
      required: ["id"],
    },
  },
  {
    name: "create_obligation",
    description:
      "Create an obligation in the register. Dates must be ISO 8601. Choose autonomy honestly: notify, prepare, approve or autopilot. Money-moving and legal work should stay at approve.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        due_at: { type: "string", description: "ISO date, e.g. 2026-12-15T10:00:00.000Z." },
        category: { type: "string", enum: ["finance", "work", "home", "health", "identity", "people", "other"] },
        provider: { type: "string" },
        amount: { type: "number" },
        currency: { type: "string" },
        owner: { type: "string" },
        backup: { type: "string" },
        autonomy: { type: "string", enum: ["notify", "prepare", "approve", "autopilot"] },
        recurrence: {
          type: "object",
          properties: { unit: { type: "string", enum: ["day", "week", "month", "quarter", "year"] }, interval: { type: "number" } },
          required: ["unit", "interval"],
        },
        proof_required: { type: "string" },
        notes: { type: "string" },
      },
      required: ["title", "due_at"],
    },
  },
  {
    name: "complete_obligation",
    description:
      "File an outcome against an obligation. Always include the proof you actually have — a receipt number, confirmation ID, or a precise description. This advances recurring obligations to their next date.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        proof: { type: "string", description: "Receipt, confirmation or evidence reference." },
        note: { type: "string" },
      },
      required: ["id", "proof"],
    },
  },
  {
    name: "portfolio_risk",
    description: "Portfolio-level exposure: coverage, money at risk, critical/high counts and the highest-risk obligations.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_agents",
    description: "Discover the agent roster, their scopes, trust and autonomy ceilings. Use this to decide which agent should own a new obligation.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function api(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.error || body.hint || `HTTP ${response.status}`;
    throw new Error(`${message} (${response.status})`);
  }
  return body;
}

async function callTool(name, args = {}) {
  if (name === "list_obligations") {
    const data = await api("/api/v1/obligations");
    const limit = Math.min(100, Math.max(1, Number(args.limit) || 20));
    let rows = data.obligations || [];
    if (args.status && args.status !== "all") rows = rows.filter((o) => o.status === args.status);
    if (args.category) rows = rows.filter((o) => o.category === args.category);
    if (args.owner) rows = rows.filter((o) => String(o.owner).toLowerCase().includes(String(args.owner).toLowerCase()));
    if (args.risk) rows = rows.filter((o) => o.risk?.band === args.risk);
    return {
      clock: data.clock,
      count: rows.length,
      obligations: rows.slice(0, limit).map((o) => ({
        id: o.id,
        title: o.title,
        due_at: o.due_at,
        category: o.category,
        provider: o.provider,
        owner: o.owner,
        owner_kind: o.owner_kind,
        autonomy: o.autonomy,
        status: o.status,
        proof_required: o.proof_required,
        recurrence: o.recurrence,
        risk: o.risk,
        days_until: o.days_until,
      })),
    };
  }

  if (name === "get_obligation") {
    if (!args.id) throw new Error("id is required");
    const data = await api(`/api/v1/obligations/${encodeURIComponent(args.id)}`);
    return data.obligation;
  }

  if (name === "create_obligation") {
    if (!args.title) throw new Error("title is required");
    if (!args.due_at) throw new Error("due_at is required");
    const data = await api("/api/v1/obligations", {
      method: "POST",
      body: JSON.stringify({
        ...args,
        source: "mcp",
        autonomy: args.autonomy || "approve",
      }),
    });
    return data.obligation;
  }

  if (name === "complete_obligation") {
    if (!args.id) throw new Error("id is required");
    if (!args.proof) throw new Error("proof is required — an outcome without evidence is just a claim");
    const data = await api(`/api/v1/obligations/${encodeURIComponent(args.id)}/complete`, {
      method: "POST",
      body: JSON.stringify({ proof: args.proof, note: args.note || "" }),
    });
    return {
      obligation: data.obligation,
      next_due: data.next_due,
      archived: data.archived,
      message: data.message,
    };
  }

  if (name === "portfolio_risk") {
    return api("/api/v1/risk");
  }

  if (name === "list_agents") {
    return api("/api/v1/agents");
  }

  throw new Error(`Unknown tool: ${name}`);
}

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function fail(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}

async function handle(message) {
  const { id, method, params } = message;
  if (!method) return;

  if (method === "initialize") {
    return reply(id, {
      protocolVersion: PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "remindify", version: "1.0.0" },
      instructions:
        "Remindify is an obligation register. Read before writing. File proof with every completion. Money-moving and legal actions require human approval.",
    });
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") return;
  if (method === "ping") return reply(id, {});
  if (method === "tools/list") return reply(id, { tools: TOOLS });

  if (method === "tools/call") {
    const name = params?.name;
    try {
      const result = await callTool(name, params?.arguments || {});
      return reply(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
        isError: false,
      });
    } catch (error) {
      return reply(id, {
        content: [{ type: "text", text: `Remindify error: ${error.message}` }],
        isError: true,
      });
    }
  }

  if (id !== undefined) fail(id, -32601, `Method not found: ${method}`);
}

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return fail(null, -32700, "Parse error");
  }
  try {
    await handle(message);
  } catch (error) {
    fail(message.id, -32603, error.message);
  }
});
