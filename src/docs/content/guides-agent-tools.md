# Use Remindify with agent tools

Every framework below uses the same three operations:

1. list obligations,
2. create an obligation,
3. complete one with a proof reference.

The examples are recipes, not SDKs. Keep the key on the server side and treat every tool result as untrusted input for the next model step.

## Shared request helper

All machine calls need:

```http
Authorization: Bearer rfy_live_...
content-type: application/json
```

Create the key in **Agent access**. The examples read `REMINDIFY_URL` and `REMINDIFY_KEY` from the environment.

## OpenAI Agents SDK

```py
# pip install openai-agents requests
import os
import requests
from agents import Agent, Runner, function_tool

BASE = os.environ["REMINDIFY_URL"]
HEADERS = {
    "Authorization": f"Bearer {os.environ['REMINDIFY_KEY']}",
    "Content-Type": "application/json",
}

@function_tool
def list_obligations() -> list[dict]:
    """List every obligation in the register with risk and due date."""
    response = requests.get(f"{BASE}/api/v1/obligations", headers=HEADERS, timeout=20)
    response.raise_for_status()
    return response.json()["obligations"]

@function_tool
def complete_obligation(obligation_id: str, proof: str, note: str = "") -> dict:
    """File proof and close or reschedule an obligation."""
    response = requests.post(
        f"{BASE}/api/v1/obligations/{obligation_id}/complete",
        headers={**HEADERS, "Idempotency-Key": f"complete-{obligation_id}"},
        json={"proof": proof, "note": note},
        timeout=20,
    )
    response.raise_for_status()
    return response.json()

agent = Agent(
    name="Registrar",
    instructions=(
        "You work from the Remindify register. Read before writing. "
        "Never claim an obligation is complete unless the completion call returned ok."
    ),
    tools=[list_obligations, complete_obligation],
)

result = Runner.run_sync(agent, "What is due in the next seven days, and what needs approval?")
print(result.final_output)
```

## Claude Desktop and Cursor over MCP

Remindify ships a dependency-free stdio MCP server. Add it to the client config:

```json
{
  "mcpServers": {
    "remindify": {
      "command": "node",
      "args": ["/absolute/path/to/remindify/mcp/server.mjs"],
      "env": {
        "REMINDIFY_URL": "http://localhost:4178",
        "REMINDIFY_KEY": "rfy_live_..."
      }
    }
  }
}
```

For Claude Desktop this file is `claude_desktop_config.json`; Cursor uses its MCP settings panel. Restart the client after editing.

Tools exposed: `list_obligations`, `get_obligation`, `create_obligation`, `complete_obligation`, `portfolio_risk`, `list_agents`, `list_trust`.

A useful first prompt:

> List every obligation due in the next 14 days. For each one, show the risk band, the owner and the proof required. Do not complete anything.

If the server runs on another host, set `REMINDIFY_URL` accordingly. The key is read from the environment, not passed in the prompt.

## LangGraph and LangChain

```py
# pip install langgraph langchain-core requests
import os
import requests
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

BASE = os.environ["REMINDIFY_URL"]
HEADERS = {"Authorization": f"Bearer {os.environ['REMINDIFY_KEY']}"}

@tool
def remindify_list_obligations() -> list:
    """List obligations with risk, owner and due date."""
    response = requests.get(f"{BASE}/api/v1/obligations", headers=HEADERS, timeout=20)
    response.raise_for_status()
    return response.json()["obligations"]

@tool
def remindify_portfolio_risk() -> dict:
    """Read coverage, exposure and the highest-risk obligations."""
    response = requests.get(f"{BASE}/api/v1/risk", headers=HEADERS, timeout=20)
    response.raise_for_status()
    return response.json()

graph = create_react_agent(
    "openai:gpt-4.1",
    tools=[remindify_list_obligations, remindify_portfolio_risk],
)

graph.invoke({"messages": [("user", "Which obligations carry the most risk this week?")]})
```

Pass the same tools to any LangChain agent if you do not need a graph.

## CrewAI

```py
# pip install crewai requests
import os
import requests
from crewai import Agent, Crew, Task
from crewai.tools import tool

BASE = os.environ["REMINDIFY_URL"]
HEADERS = {"Authorization": f"Bearer {os.environ['REMINDIFY_KEY']}"}

@tool("List Remindify obligations")
def list_obligations() -> list:
    """Return every obligation with risk and due date."""
    response = requests.get(f"{BASE}/api/v1/obligations", headers=HEADERS, timeout=20)
    response.raise_for_status()
    return response.json()["obligations"]

registrar = Agent(
    role="Obligation registrar",
    goal="Keep the Remindify register accurate and current",
    backstory="You read before you write and you never invent a proof reference.",
    tools=[list_obligations],
)

crew = Crew(
    agents=[registrar],
    tasks=[Task(description="Summarise the five highest-risk obligations.", expected_output="A table", agent=registrar)],
)
print(crew.kickoff())
```

CrewAI's tool decorator import path has moved across versions. If `crewai.tools` is unavailable in your pinned version, wrap the same function with your version's tool class.

## n8n

No code required:

1. Add **HTTP Request**.
2. Method `GET`, URL `https://your-remindify-host/api/v1/obligations`.
3. Authentication: **Header Auth**. Name `Authorization`, value `Bearer rfy_live_...`.
4. Add a second HTTP Request for `POST /api/v1/obligations/{{ $json.id }}/complete` with a JSON body `{ "proof": "..." }` and an `Idempotency-Key` header.
5. Schedule the workflow hourly or trigger it from your own queue.

Store the key in n8n credentials, not in a node expression that appears in exports.

## Vercel AI SDK

```ts
// npm install ai zod
import { tool } from "ai";
import { z } from "zod";

const base = process.env.REMINDIFY_URL!;
const headers = { Authorization: `Bearer ${process.env.REMINDIFY_KEY}` };

export const listObligations = tool({
  description: "List obligations from the Remindify register.",
  inputSchema: z.object({}),
  execute: async () => {
    const response = await fetch(`${base}/api/v1/obligations`, { headers });
    if (!response.ok) throw new Error(`Remindify ${response.status}`);
    return response.json();
  },
});

export const completeObligation = tool({
  description: "File proof and complete an obligation.",
  inputSchema: z.object({
    obligationId: z.string(),
    proof: z.string().min(3),
    note: z.string().optional(),
  }),
  execute: async ({ obligationId, proof, note }) => {
    const response = await fetch(`${base}/api/v1/obligations/${obligationId}/complete`, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
        "Idempotency-Key": `complete-${obligationId}`,
      },
      body: JSON.stringify({ proof, note }),
    });
    if (!response.ok) throw new Error(`Remindify ${response.status}`);
    return response.json();
  },
});
```

`inputSchema` is the AI SDK 5+ name; older versions used `parameters`.

## Production rules for agents

- **Read before writing.** Give the model `obligations:read` even if it also has write access, and instruct it to fetch the row first.
- **Use idempotency keys.** Derive them from the operation: `complete-${obligationId}-${dueDate}`.
- **Never invent proof.** If the underlying action did not produce a reference, return a failure instead of completing.
- **Respect approval.** A model cannot approve its own action. `approve` obligations need a human decision in the app.
- **Do not log the key.** Redact `Authorization` in traces. Rotate a key the moment it appears in a log or a model prompt.
- **Constrain tools.** Four endpoints are enough for most agents. Do not expose a generic "call any URL" tool to a model with a live key.
