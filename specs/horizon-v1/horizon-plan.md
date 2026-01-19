# Horizon - Implementation Plan

A personal time tracking system for AI coding sessions, tracking which projects you work on, which agents you use, and for how long.

## Overview

### Goals

- Track coding session time across multiple projects and machines
- Record which AI agent (Claude Code, Cursor, Copilot, Aider, etc.) was used
- Derive sessions from interaction timestamps (30 min idle = new session)
- Provide a dashboard to visualize weekly activity, project breakdown, and agent usage

### Non-Goals

- Team/multi-user support
- Detailed tool/token tracking (other tools exist for this)
- Real-time collaboration features

## Architecture

Three deployment options are provided. All share the same API contract and hook implementation.

### Shared: TypeScript + Hono

All three deployments use the same language and web framework:

- **Language:** TypeScript
- **Framework:** Hono (lightweight, runs everywhere)
- **Shared code:** Routes, session calculation, validation

The only difference is the database adapter and deployment configuration.

### Option 1: AWS (Lambda + DynamoDB)

```
┌─────────────────┐     ┌─────────────────────────────────────┐
│  Claude Code    │     │              AWS                    │
│  (hooks)        │────▶│  ┌─────────────┐   ┌────────────┐  │
├─────────────────┤     │  │ API Gateway │──▶│   Lambda   │  │
│  Cursor         │────▶│  │ + API Key   │   │ (Node.js)  │  │
├─────────────────┤     │  └─────────────┘   └─────┬──────┘  │
│  Other agents   │────▶│                          │         │
└─────────────────┘     │                    ┌─────▼──────┐  │
                        │                    │  DynamoDB  │  │
┌─────────────────┐     │                    └────────────┘  │
│   Dashboard     │────▶│                                    │
│   (static)      │     └────────────────────────────────────┘
└─────────────────┘
```

| Component | Technology | Hosting |
|-----------|------------|---------|
| API | TypeScript + Hono + Lambda | AWS Lambda (Node.js 20) |
| API Gateway | REST API + API Key auth | AWS API Gateway |
| Database | DynamoDB | AWS DynamoDB |
| Infrastructure | SAM template | AWS CloudFormation |
| Dashboard | Static HTML/CSS/JS | S3 + CloudFront |

**Pros:** Highly available, scales automatically, familiar AWS tooling
**Cons:** Cold starts, vendor lock-in, slightly more complex setup

### Option 2: Cloudflare Workers (Workers + D1)

```
┌─────────────────┐     ┌─────────────────────────────────────┐
│  Claude Code    │     │           Cloudflare                │
│  (hooks)        │────▶│  ┌─────────────┐   ┌────────────┐  │
├─────────────────┤     │  │   Worker    │──▶│     D1     │  │
│  Cursor         │────▶│  │ (TypeScript)│   │  (SQLite)  │  │
├─────────────────┤     │  └─────────────┘   └────────────┘  │
│  Other agents   │────▶│                                    │
└─────────────────┘     │                                    │
                        │  ┌─────────────┐                   │
┌─────────────────┐     │  │   Pages     │                   │
│   Dashboard     │────▶│  │  (static)   │                   │
│   (static)      │     │  └─────────────┘                   │
└─────────────────┘     └────────────────────────────────────┘
```

| Component | Technology | Hosting |
|-----------|------------|---------|
| API | TypeScript + Hono + Workers | Cloudflare Workers |
| Auth | Custom header check | Hono middleware |
| Database | D1 (SQLite at edge) | Cloudflare D1 |
| Infrastructure | Wrangler | Cloudflare |
| Dashboard | Static HTML/CSS/JS | Cloudflare Pages |

**Pros:** No cold starts, edge deployment (fast globally), generous free tier, simple deployment
**Cons:** D1 is relatively new, 10ms CPU limit per request (usually fine)

### Option 3: Local (Bun + SQLite)

```
┌─────────────────┐     ┌─────────────────────────────────────┐
│  Claude Code    │     │           Local Machine             │
│  (hooks)        │────▶│  ┌─────────────┐   ┌────────────┐  │
├─────────────────┤     │  │ Bun Server  │──▶│   SQLite   │  │
│  Cursor         │────▶│  │ (TypeScript)│   │   (.db)    │  │
├─────────────────┤     │  └─────────────┘   └────────────┘  │
│  Other agents   │────▶│        │                           │
└─────────────────┘     │        │ serves                    │
                        │        ▼                           │
┌─────────────────┐     │  ┌─────────────┐                   │
│   Dashboard     │────▶│  │  Dashboard  │                   │
│   (browser)     │     │  │  (static)   │                   │
└─────────────────┘     └─────────────────────────────────────┘
```

| Component | Technology | Hosting |
|-----------|------------|---------|
| API | TypeScript + Hono + Bun | Local process |
| Auth | Simple API key | Hono middleware |
| Database | SQLite (Bun native) | Local file |
| Dashboard | Static files | Served by Hono |

**Pros:** No cloud dependency, works offline, fast (Bun), full control, no ongoing costs
**Cons:** Only accessible on local network (or need tunneling), manual backup needed

### Deployment Comparison

| Aspect | AWS | Cloudflare | Local |
|--------|-----|------------|-------|
| Monthly cost | ~$0.20 | $0 (free tier) | $0 |
| Setup complexity | Medium | Low | Low |
| Cold starts | Yes | No | No |
| Global availability | Via CloudFront | Built-in edge | Local only* |
| Offline capable | No | No | Yes |
| Data portability | Export needed | Export needed | Direct file access |

*Local can be exposed via Tailscale, Cloudflare Tunnel, or similar for remote access.

## Data Model

All three implementations store the same data, just in different formats.

### AWS: DynamoDB Table

**Table:** `horizon-interactions`

**Primary Key:**
- Partition Key (PK): `PROJECT#<project-name>`
- Sort Key (SK): `INTERACTION#<timestamp>`

**Attributes:**

| Attribute | Type | Description |
|-----------|------|-------------|
| project | String | Project/repo name (e.g., "agentic-coding") |
| timestamp | String | ISO 8601 timestamp |
| machine | String | Hostname of the machine |
| agent | String | Agent identifier (e.g., "claude-code", "cursor") |
| session_id | String | Unique session identifier (from agent or generated) |
| event_type | String | "prompt-start", "response-end", or "session-end" |

Note: `session_id` allows multiple concurrent sessions on the same project to be tracked separately.

**Event Types:**
- `prompt-start` — User submitted a prompt (UserPromptSubmit hook)
- `response-end` — Agent finished responding (Stop hook)
- `session-end` — Session explicitly closed (SessionEnd hook)

This allows calculating both:
- **Active time** — Sum of (response-end - prompt-start) pairs
- **Session span** — First event to last event (or session-end)

**Global Secondary Index (GSI):**
- GSI1PK: `DATE#<YYYY-MM-DD>`
- GSI1SK: `TIMESTAMP#<ISO-timestamp>`

This allows efficient queries for "all interactions on a given day" across all projects.

### Cloudflare & Local: SQLite Schema

```sql
CREATE TABLE interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    timestamp TEXT NOT NULL,  -- ISO 8601
    machine TEXT NOT NULL,
    agent TEXT NOT NULL,
    session_id TEXT NOT NULL, -- Unique per session (from agent or generated)
    event_type TEXT NOT NULL DEFAULT 'interaction',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Index for project + time range queries
CREATE INDEX idx_interactions_project_timestamp
ON interactions(project, timestamp DESC);

-- Index for date-based queries across all projects
CREATE INDEX idx_interactions_date
ON interactions(date(timestamp), timestamp DESC);

-- Index for agent statistics
CREATE INDEX idx_interactions_agent
ON interactions(agent, timestamp DESC);

-- Index for session grouping
CREATE INDEX idx_interactions_session
ON interactions(session_id, timestamp ASC);
```

### Session Derivation Logic

With `session_id` and paired events, sessions are calculated as follows:

1. Group interactions by `session_id`
2. For each session:
   - **Session span** = last event timestamp - first event timestamp
   - **Active time** = sum of all (response-end - prompt-start) pairs
   - If a `prompt-start` has no matching `response-end`, use 5 min default
   - `session-end` marks explicit closure (vs timeout/abandoned)

**Example:**
```
prompt-start   1:00pm
response-end   1:20pm   → 20 min active
prompt-start   5:00pm
response-end   5:05pm   → 5 min active
session-end    10:00pm

Session span: 9 hours
Active time: 25 minutes
```

The dashboard should display **active time** as the primary metric, with session span available for context.

## API Design

### Base URL

```
https://<api-id>.execute-api.<region>.amazonaws.com/prod
```

### Authentication

All endpoints require `x-api-key` header with valid API Gateway API key.

### Endpoints

#### POST /interactions

Record a new interaction.

**Request:**
```json
{
  "project": "agentic-coding",
  "timestamp": "2026-01-19T16:22:00Z",
  "machine": "macbook-pro",
  "agent": "claude-code",
  "session_id": "abc123-def456",
  "event_type": "interaction"
}
```

**Response:** `201 Created`
```json
{
  "status": "recorded"
}
```

#### GET /stats/weekly

Get weekly statistics.

**Query Parameters:**
- `week_start` (optional): ISO date for week start, defaults to current week

**Response:**
```json
{
  "total_hours": 24.5,
  "total_sessions": 42,
  "streak_days": 7,
  "daily_breakdown": [
    { "date": "2026-01-13", "hours": 5.2, "sessions": 8 },
    { "date": "2026-01-14", "hours": 3.6, "sessions": 5 }
  ],
  "projects": [
    { "name": "agentic-coding", "hours": 12.3, "sessions": 18 }
  ],
  "agents": [
    { "name": "claude-code", "hours": 18.2, "percentage": 74 }
  ],
  "comparison": {
    "vs_last_week": 3.2
  }
}
```

#### GET /stats/projects

Get project statistics over a time period.

**Query Parameters:**
- `days` (optional): Number of days to include, default 30

**Response:**
```json
{
  "projects": [
    {
      "name": "agentic-coding",
      "total_hours": 45.2,
      "total_sessions": 82,
      "agents": {
        "claude-code": 38.5,
        "cursor": 6.7
      }
    }
  ]
}
```

#### GET /projects/{name}/sessions

Get individual sessions for a project.

**Query Parameters:**
- `days` (optional): Number of days to include, default 7

**Response:**
```json
{
  "project": "agentic-coding",
  "sessions": [
    {
      "session_id": "abc123-def456",
      "start": "2026-01-19T09:15:00Z",
      "end": "2026-01-19T10:42:00Z",
      "span_minutes": 87,
      "active_minutes": 42,
      "machine": "macbook-pro",
      "agent": "claude-code",
      "interaction_count": 12,
      "explicit_end": true
    }
  ]
}
```

**Note:** `active_minutes` is the sum of actual prompt→response time. `span_minutes` is the total elapsed time from session start to end.

## Hook Implementation

### Installation

1. Place hook script at `~/.local/bin/horizon-hook`
2. Make executable: `chmod +x ~/.local/bin/horizon-hook`
3. Create config at `~/.config/horizon/config.json`
4. Add hook configuration to `~/.claude/settings.json`

### Hook Script

**Location:** `~/.local/bin/horizon-hook`

Claude Code passes JSON to hooks via stdin containing `session_id`, `cwd`, and other fields. The hook reads this to extract the session ID.

```bash
#!/bin/bash
set -euo pipefail

CONFIG_FILE="$HOME/.config/horizon/config.json"
LOG_FILE="$HOME/.config/horizon/error.log"
EVENT_TYPE="${1:-interaction}"

# Ensure config directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log_error() {
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) - $1" >> "$LOG_FILE"
}

# Read hook input from stdin (Claude Code provides JSON)
HOOK_INPUT=$(cat)

# Extract session_id from hook input (provided by Claude Code)
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // empty')
if [[ -z "$SESSION_ID" ]]; then
    # Fallback: generate a session ID if not provided (for other agents)
    SESSION_ID="generated-$(date +%s)-$$"
fi

# Check config exists
if [[ ! -f "$CONFIG_FILE" ]]; then
    log_error "Config file not found: $CONFIG_FILE"
    exit 0
fi

# Read config
API_URL=$(jq -r '.api_url // empty' "$CONFIG_FILE")
API_KEY=$(jq -r '.api_key // empty' "$CONFIG_FILE")

if [[ -z "$API_URL" || -z "$API_KEY" ]]; then
    log_error "Missing api_url or api_key in config"
    exit 0
fi

# Determine project name
# Primary: git remote URL, extract repo name (without org/user)
# Fallback: directory basename
PROJECT=""
if git rev-parse --git-dir > /dev/null 2>&1; then
    REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
    if [[ -n "$REMOTE_URL" ]]; then
        # Extract repo name from URL (handles both HTTPS and SSH)
        # https://github.com/user/repo.git -> repo
        # git@github.com:user/repo.git -> repo
        PROJECT=$(echo "$REMOTE_URL" | sed -E 's/.*[\/:]([^\/]+)(\.git)?$/\1/' | sed 's/\.git$//')
    fi
fi

# Fallback to directory name
if [[ -z "$PROJECT" ]]; then
    PROJECT=$(basename "$(pwd)")
fi

# Build payload
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
MACHINE=$(hostname -s)
AGENT="claude-code"

PAYLOAD=$(jq -n \
    --arg project "$PROJECT" \
    --arg timestamp "$TIMESTAMP" \
    --arg machine "$MACHINE" \
    --arg agent "$AGENT" \
    --arg session_id "$SESSION_ID" \
    --arg event_type "$EVENT_TYPE" \
    '{project: $project, timestamp: $timestamp, machine: $machine, agent: $agent, session_id: $session_id, event_type: $event_type}')

# Send to API (silent failure)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$API_URL/api/interactions" \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    --max-time 5 \
    2>/dev/null) || HTTP_CODE="000"

if [[ "$HTTP_CODE" != "201" && "$HTTP_CODE" != "200" ]]; then
    log_error "API request failed with HTTP $HTTP_CODE for project=$PROJECT session=$SESSION_ID event=$EVENT_TYPE"
fi

exit 0
```

**Hook Input from Claude Code (via stdin):**
```json
{
  "session_id": "abc123-def456",
  "cwd": "/Users/arjen/projects/agentic-coding",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "..."
}
```

### Config File

**Location:** `~/.config/horizon/config.json`

```json
{
  "api_url": "https://xxxxxx.execute-api.ap-southeast-2.amazonaws.com/prod",
  "api_key": "your-api-key-here"
}
```

### Claude Code Hook Configuration

**Location:** `~/.claude/settings.json`

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "command": "~/.local/bin/horizon-hook prompt-start",
        "timeout": 5000
      }
    ],
    "Stop": [
      {
        "command": "~/.local/bin/horizon-hook response-end",
        "timeout": 5000
      }
    ],
    "SessionEnd": [
      {
        "command": "~/.local/bin/horizon-hook session-end",
        "timeout": 5000
      }
    ]
  }
}
```

**Hook Events:**
- `UserPromptSubmit` → records `prompt-start` (user sent a prompt)
- `Stop` → records `response-end` (agent finished responding)
- `SessionEnd` → records `session-end` (session explicitly closed)

### Other Agent Hooks

For other agents, create similar hook configurations pointing to the same script but with a different `AGENT` value. This can be done by:

1. Creating agent-specific wrapper scripts, or
2. Adding an `--agent` flag to the hook script, or
3. Using environment variables

Example for Cursor (if it supports hooks):
```bash
#!/bin/bash
AGENT="cursor" ~/.local/bin/horizon-hook "$@"
```

## Dashboard

### Design

Uses the "Ground Control" aesthetic (see `horizon-mockup.html`):

- Dark theme with amber accents
- IBM Plex Mono + Outfit fonts
- Animated load-in effects

### Sections

1. **Header** - Logo, sync status, current machine
2. **Stats Row** - This week total, today total, top agent, streak
3. **Weekly Activity** - Stacked bar chart by day, colored by project
4. **Projects Panel** - Project list with session counts and hours
5. **Session Detail** - Individual sessions with agent badges
6. **Agents This Week** - Horizontal bar chart of agent usage
7. **Agent × Project** - Which agents used for which projects

### Hosting Options

1. **S3 + CloudFront** - Include in SAM template, serve via CloudFront
2. **Local file** - Just open the HTML file locally
3. **GitHub Pages** - If the repo is public

Recommendation: Start with local/S3, add CloudFront later if needed.

### Implementation

Single-page static site that:
1. Fetches data from the API on load
2. Renders charts and stats client-side
3. Auto-refreshes every 5 minutes (configurable)
4. Caches API responses in localStorage for offline viewing

## Project Structure

Monorepo with shared TypeScript core and platform-specific entry points.

```
horizon/
├── README.md
├── package.json                # Workspace root
├── tsconfig.base.json          # Shared TS config
│
├── packages/
│   ├── core/                   # Shared business logic
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── routes/         # Hono route handlers
│   │       │   ├── interactions.ts
│   │       │   └── stats.ts
│   │       ├── services/
│   │       │   └── sessions.ts # Session calculation logic
│   │       ├── middleware/
│   │       │   └── auth.ts     # API key middleware
│   │       └── types.ts        # Shared types
│   │
│   ├── db-dynamodb/            # DynamoDB adapter
│   │   ├── package.json
│   │   └── src/
│   │       └── index.ts
│   │
│   ├── db-d1/                  # Cloudflare D1 adapter
│   │   ├── package.json
│   │   └── src/
│   │       └── index.ts
│   │
│   └── db-sqlite/              # SQLite adapter (Bun/better-sqlite3)
│       ├── package.json
│       └── src/
│           └── index.ts
│
├── apps/
│   ├── aws/                    # AWS Lambda deployment
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── template.yaml       # SAM template
│   │   ├── samconfig.toml
│   │   └── src/
│   │       └── index.ts        # Lambda handler
│   │
│   ├── cloudflare/             # Cloudflare Workers deployment
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── wrangler.toml
│   │   ├── schema.sql
│   │   └── src/
│   │       └── index.ts        # Worker entry point
│   │
│   └── local/                  # Local Bun server
│       ├── package.json
│       ├── tsconfig.json
│       ├── schema.sql
│       └── src/
│           └── index.ts        # Bun server entry point
│
├── dashboard/                  # Static dashboard (all deployments)
│   ├── index.html
│   ├── styles.css
│   └── app.js
│
└── hooks/                      # Hook scripts
    ├── horizon-hook
    └── config.example.json
```

### Shared Database Interface

All database adapters implement the same interface:

```typescript
// packages/core/src/types.ts
export type EventType = 'prompt-start' | 'response-end' | 'session-end';

export interface Interaction {
  project: string;
  timestamp: string;
  machine: string;
  agent: string;
  session_id: string;
  event_type: EventType;
}

export interface Session {
  session_id: string;
  project: string;
  agent: string;
  machine: string;
  start_time: string;
  end_time: string;
  span_minutes: number;      // Total time from first to last event
  active_minutes: number;    // Sum of prompt-start → response-end pairs
  interaction_count: number; // Number of prompt/response pairs
  explicit_end: boolean;     // Whether session-end event was recorded
}

export interface DatabaseAdapter {
  recordInteraction(interaction: Interaction): Promise<void>;
  getInteractions(project: string, startDate: string, endDate: string): Promise<Interaction[]>;
  getInteractionsByDate(date: string): Promise<Interaction[]>;
  getInteractionsBySession(sessionId: string): Promise<Interaction[]>;
  getAllProjects(): Promise<string[]>;
}
```

## Implementation Order

### Phase 1: Shared Components

1. Create shared hook script
2. Create shared dashboard (convert mockup to functional)
3. Define API contract (OpenAPI spec or similar)
4. Implement session derivation logic (shared algorithm)

### Phase 2: Local Deployment (Fastest to Iterate)

1. Set up Go project structure
2. Implement SQLite database layer
3. Implement POST /interactions endpoint
4. Implement GET stats endpoints
5. Embed dashboard with go:embed
6. Test end-to-end locally
7. Add Makefile for build/install

### Phase 3: Cloudflare Deployment

1. Set up Wrangler project
2. Create D1 database and schema
3. Implement Worker with all endpoints
4. Deploy and configure custom domain (optional)
5. Deploy dashboard to Cloudflare Pages

### Phase 4: AWS Deployment

1. Create SAM template with:
   - DynamoDB table + GSI
   - Lambda functions for each endpoint
   - API Gateway with API key
2. Deploy with `sam deploy`
3. Deploy dashboard to S3 + CloudFront

### Phase 5: Polish & Documentation

1. Create installation script for hooks
2. Write README with setup instructions for all three options
3. Add data export/import for migration between deployments
4. Add hooks/configs for other agents (Cursor, Copilot, Aider)

## Cost Estimate (Monthly)

For personal usage (~500 requests/day):

### AWS

| Service | Estimated Cost |
|---------|----------------|
| Lambda | $0.00 (free tier) |
| API Gateway | $0.02 - $0.10 |
| DynamoDB | $0.00 (free tier) |
| S3 | $0.01 |
| CloudFront | $0.00 - $0.05 |
| **Total** | **< $0.20/month** |

### Cloudflare

| Service | Estimated Cost |
|---------|----------------|
| Workers | $0.00 (100k requests/day free) |
| D1 | $0.00 (5GB free) |
| Pages | $0.00 (free) |
| **Total** | **$0.00/month** |

### Local

| Service | Estimated Cost |
|---------|----------------|
| Everything | $0.00 |
| **Total** | **$0.00/month** |

Note: Local requires a machine running. For remote access, you might use Tailscale (free for personal) or Cloudflare Tunnel (free).

## Security Considerations

1. **API Key** - Stored in local config file with restricted permissions (600)
2. **No sensitive data** - Only project names and timestamps, no code content
3. **HTTPS only** - All cloud deployments enforce HTTPS
4. **IAM roles** - Lambda uses least-privilege IAM role (AWS)
5. **No PII** - Machine names are just hostnames, no user identification

## Deployment-Specific Details

### Shared Core (packages/core)

```typescript
// packages/core/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { DatabaseAdapter } from './types';
import { createInteractionsRoutes } from './routes/interactions';
import { createStatsRoutes } from './routes/stats';
import { apiKeyAuth } from './middleware/auth';

export function createApp(db: DatabaseAdapter, apiKey: string) {
  const app = new Hono();

  app.use('/*', cors());
  app.use('/api/*', apiKeyAuth(apiKey));

  // Mount routes
  app.route('/api', createInteractionsRoutes(db));
  app.route('/api', createStatsRoutes(db));

  return app;
}

export * from './types';
export * from './services/sessions';
```

### Cloudflare Workers (apps/cloudflare)

**wrangler.toml:**
```toml
name = "horizon"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "horizon"
database_id = "<your-database-id>"

[vars]
API_KEY = "your-api-key-here"  # Or use: wrangler secret put API_KEY
```

**src/index.ts:**
```typescript
import { createApp } from '@horizon/core';
import { D1Adapter } from '@horizon/db-d1';

type Bindings = {
  DB: D1Database;
  API_KEY: string;
};

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const db = new D1Adapter(env.DB);
    const app = createApp(db, env.API_KEY);
    return app.fetch(request);
  },
};
```

**Deployment:**
```bash
cd apps/cloudflare
pnpm install
wrangler d1 create horizon
wrangler d1 execute horizon --file=schema.sql
wrangler deploy
```

### AWS Lambda (apps/aws)

**src/index.ts:**
```typescript
import { handle } from 'hono/aws-lambda';
import { createApp } from '@horizon/core';
import { DynamoDBAdapter } from '@horizon/db-dynamodb';

const db = new DynamoDBAdapter(process.env.TABLE_NAME!);
const app = createApp(db, process.env.API_KEY!);

export const handler = handle(app);
```

**template.yaml (SAM):**
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Horizon API

Globals:
  Function:
    Timeout: 30
    Runtime: nodejs20.x
    MemorySize: 256

Resources:
  SessionTrackerFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: dist/
      Handler: index.handler
      Environment:
        Variables:
          TABLE_NAME: !Ref InteractionsTable
          API_KEY: '{{resolve:ssm:/horizon/api-key}}'
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref InteractionsTable
      Events:
        Api:
          Type: Api
          Properties:
            Path: /{proxy+}
            Method: ANY

  InteractionsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: horizon-interactions
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: PK
          AttributeType: S
        - AttributeName: SK
          AttributeType: S
        - AttributeName: GSI1PK
          AttributeType: S
        - AttributeName: GSI1SK
          AttributeType: S
      KeySchema:
        - AttributeName: PK
          KeyType: HASH
        - AttributeName: SK
          KeyType: RANGE
      GlobalSecondaryIndexes:
        - IndexName: GSI1
          KeySchema:
            - AttributeName: GSI1PK
              KeyType: HASH
            - AttributeName: GSI1SK
              KeyType: RANGE
          Projection:
            ProjectionType: ALL

Outputs:
  ApiUrl:
    Description: API Gateway endpoint URL
    Value: !Sub "https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/Prod/"
```

**Deployment:**
```bash
cd apps/aws
pnpm install
pnpm build
sam deploy --guided
```

### Local Bun Server (apps/local)

**src/index.ts:**
```typescript
import { createApp } from '@horizon/core';
import { SQLiteAdapter } from '@horizon/db-sqlite';
import { serveStatic } from 'hono/bun';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Load config
const configPath = process.env.CONFIG_PATH ||
  join(process.env.HOME!, '.config/horizon/server.json');

interface Config {
  listen_addr?: string;
  api_key: string;
  database_path: string;
}

let config: Config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch {
  console.error(`Failed to load config from ${configPath}`);
  process.exit(1);
}

// Ensure database directory exists
const dbDir = join(process.env.HOME!, '.local/share/horizon');
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Initialize
const dbPath = config.database_path.replace('~', process.env.HOME!);
const db = new SQLiteAdapter(dbPath);
const app = createApp(db, config.api_key);

// Serve dashboard at root
app.use('/*', serveStatic({ root: './dashboard' }));

const port = parseInt(config.listen_addr?.replace(':', '') || '8080');

console.log(`Starting server on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
```

**Server Config (~/.config/horizon/server.json):**
```json
{
  "listen_addr": ":8080",
  "api_key": "your-api-key-here",
  "database_path": "~/.local/share/horizon/data.db"
}
```

**Running:**
```bash
cd apps/local
pnpm install
pnpm dev        # Development with hot reload
pnpm start      # Production
```

**package.json scripts:**
```json
{
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun"
  }
}
```

**Running as a Service (macOS launchd):**

Create `~/Library/LaunchAgents/com.horizon.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.horizon</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/bun</string>
        <string>/path/to/horizon/apps/local/src/index.ts</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/horizon/apps/local</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/horizon.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/horizon.err</string>
</dict>
</plist>
```

Load with: `launchctl load ~/Library/LaunchAgents/com.horizon.plist`

## Data Migration Between Deployments

Since all three deployments share the same API contract, data can be exported from one and imported to another.

### Export Format (JSON Lines)

```json
{"project":"agentic-coding","timestamp":"2026-01-19T09:15:00Z","machine":"macbook-pro","agent":"claude-code","event_type":"interaction"}
{"project":"agentic-coding","timestamp":"2026-01-19T09:20:00Z","machine":"macbook-pro","agent":"claude-code","event_type":"interaction"}
```

### Export Commands

**From Local (SQLite):**
```bash
sqlite3 ~/.local/share/horizon/data.db \
  "SELECT json_object('project', project, 'timestamp', timestamp, 'machine', machine, 'agent', agent, 'event_type', event_type) FROM interactions;" \
  > export.jsonl
```

**From Cloudflare D1:**
```bash
wrangler d1 execute horizon \
  --command="SELECT json_object('project', project, 'timestamp', timestamp, 'machine', machine, 'agent', agent, 'event_type', event_type) FROM interactions;" \
  > export.jsonl
```

**From AWS DynamoDB:**
```bash
aws dynamodb scan --table-name horizon-interactions \
  --projection-expression "project, #ts, machine, agent, event_type" \
  --expression-attribute-names '{"#ts": "timestamp"}' \
  | jq -c '.Items[] | {project: .project.S, timestamp: .timestamp.S, machine: .machine.S, agent: .agent.S, event_type: .event_type.S}' \
  > export.jsonl
```

### Import Commands

**To any deployment via API:**
```bash
API_URL="http://localhost:8080"  # or your cloud URL
API_KEY="your-api-key"

while read -r line; do
  curl -s -X POST "$API_URL/api/interactions" \
    -H "x-api-key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$line"
done < export.jsonl
```

## Future Enhancements (Out of Scope)

- Mobile-friendly dashboard
- Weekly email summaries
- GitHub integration (link sessions to commits)
- VS Code extension for non-agent coding
- Multiple API keys for different machines
- Real-time sync between deployments
