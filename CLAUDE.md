# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Horizon is a personal time tracking system for AI coding sessions. It tracks which projects you work on, which agents (Claude Code, Cursor, Copilot, Aider, etc.) you use, and for how long. Sessions are derived from interaction timestamps (30 min idle = new session).

## Architecture

Monorepo with shared TypeScript core and three deployment options:

```
packages/
├── core/           # Shared Hono routes, session logic, middleware, types
├── db-dynamodb/    # AWS DynamoDB adapter
├── db-d1/          # Cloudflare D1 adapter
└── db-sqlite/      # SQLite adapter (Bun/better-sqlite3)

apps/
├── aws/            # Lambda + API Gateway + DynamoDB (SAM)
├── cloudflare/     # Workers + D1 (Wrangler)
└── local/          # Bun server + SQLite

dashboard/          # Static HTML/CSS/JS dashboard
hooks/              # Shell scripts for agent integration
```

All deployments share the same API contract and core business logic. Only the database adapter and entry point differ.

### Database Adapters

All adapters implement the `DatabaseAdapter` interface from `packages/core/src/types.ts`. The interface includes:
- `recordInteraction(interaction)` - Store a new interaction
- `getInteractions(project, startDate, endDate)` - Query by project and date range
- `getInteractionsByDate(date)` - Query all projects for a day (uses GSI in DynamoDB)
- `getInteractionsBySession(sessionId)` - Query interactions for session calculation
- `getAllProjects()` - List all tracked projects

### Session Derivation

Sessions are calculated from paired events, not raw timestamps:
- `prompt-start` → `response-end` pairs measure active coding time
- `session-end` marks explicit session closure
- Active time = sum of all prompt→response durations
- Session span = first event to last event timestamp

## API Endpoints

All endpoints require `x-api-key` header.

- `POST /api/interactions` - Record interaction (project, timestamp, machine, agent, session_id, event_type)
- `GET /api/stats/weekly` - Weekly totals, daily breakdown, project/agent stats
- `GET /api/stats/projects?days=30` - Project statistics over time period
- `GET /api/projects/{name}/sessions?days=7` - Individual sessions for a project

## Deployment Commands

### Local (Bun)
```bash
cd apps/local
pnpm install
pnpm dev          # Development with hot reload
pnpm start        # Production
```

### Cloudflare
```bash
cd apps/cloudflare
pnpm install
wrangler d1 create horizon
wrangler d1 execute horizon --file=schema.sql
wrangler deploy
```

### AWS
```bash
cd apps/aws
pnpm install
pnpm build
sam deploy --guided
```

## Dashboard

Static site using "Ground Control" aesthetic (dark theme, amber accents, IBM Plex Mono + Outfit fonts). Fetches from API on load, caches in localStorage, auto-refreshes every 5 minutes.

## Hook Integration

Hooks send events to the API on Claude Code lifecycle events:
- `UserPromptSubmit` → `prompt-start`
- `Stop` → `response-end`
- `SessionEnd` → `session-end`

Config location: `~/.config/horizon/config.json` (api_url, api_key)
Hook script: `~/.local/bin/horizon-hook`
