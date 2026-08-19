# Demo MCP Server (headless)

MCP-only project — **no React UI**. Connect any React (or other) app over HTTP.

## Agents

| Folder | Id | Role |
|--------|-----|------|
| `src/agents/mongo/` | `agent-1-mongo` | MongoDB Atlas CRUD |
| `src/agents/excel/` | `agent-2-excel` | Local Excel `.xlsx` CRUD |

```
Any React app
   │  POST /api/login  { apiKey }
   │  Authorization: Bearer <token>
   ├─► POST /api/agent   (plain English)
   ├─► /api/*            (REST Mongo helpers)
   └─► /mcp              (MCP Streamable HTTP for agent hosts)
              │
              ▼
     demo-mcp-server
        ├── agents/mongo
        └── agents/excel
```

## Run

```bash
npm install
npm run api          # http://127.0.0.1:3000
npm run mcp          # stdio for Cursor
```

## Login (from any React app)

Set `CLIENT_API_KEY` in `.env`. Then:

```js
const login = await fetch('http://127.0.0.1:3000/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ apiKey: import.meta.env.VITE_MCP_API_KEY }),
}).then((r) => r.json());

const token = login.token;

const result = await fetch('http://127.0.0.1:3000/api/agent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ prompt: 'show rows in people' }),
}).then((r) => r.json());
```

Keep secrets out of the browser bundle when possible (proxy through your React app’s backend). For local demos only, a Vite env var is fine.

## CORS

`CORS_ORIGIN=*` allows any React origin. Or set a comma-separated list:

```
CORS_ORIGIN=http://localhost:5173,http://localhost:3001
```

## Layout

```
src/
  agents/
    mongo/          # Agent 1
    excel/          # Agent 2
    catalog.ts      # Public agent list
  orchestrator/     # Plain-English → tool calls (LLM or rules)
  mcp/              # MCP factory + stdio
  http/             # REST + /mcp + login auth
  shared/db/        # Mongo connection helpers
data/workbook.xlsx
```

## Cursor (stdio)

`.cursor/mcp.json` still points at `src/mcp/stdio.ts`.
