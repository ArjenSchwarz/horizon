# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Session derivation service (`src/services/sessions.ts`) with:
  - `calculateSessions` function to derive sessions from interactions grouped by session_id
  - `deriveSession` function to calculate session metadata (start, end, span, active time)
  - `calculateActiveTime` function using FIFO pairing of prompt-start/response-end events
  - Clock skew protection (negative durations clamped to zero)
  - 5-minute default duration for unpaired prompt-start events
  - Sessions sorted by start time descending
- Unit tests for session derivation (`src/services/sessions.test.ts`) covering:
  - Normal prompt-response pairs
  - 5-minute default for unpaired prompt-start
  - Explicit session-end handling
  - Out-of-order events processing
  - Consecutive prompt-starts pairing (FIFO)
  - Orphaned response-end events ignored
  - Multiple sessions with different projects/agents

- TypeScript type definitions (`src/types.ts`) covering:
  - `EventType` union type for interaction events
  - `Interaction` interface for recorded AI agent events
  - `Session` interface for derived coding sessions
  - `WeeklyStats`, `DailyBreakdown`, `ProjectSummary`, `AgentSummary` interfaces for statistics API
  - `ProjectStats`, `ProjectSessionsResponse`, `ProjectStatsResponse` for project-related endpoints
  - `InteractionPayload`, `ApiError`, `InteractionRecordedResponse` for API request/response types
- Project setup with TypeScript and Cloudflare Workers tooling:
  - `package.json` with Hono, Wrangler, Vitest, and TypeScript dependencies
  - `tsconfig.json` configured for Cloudflare Workers
  - `wrangler.toml` with D1 database binding
  - `vitest.config.ts` with @cloudflare/vitest-pool-workers for Workers environment testing
- Database schema (`schema.sql`) with:
  - `interactions` table for storing all event data
  - Unique index on (session_id, timestamp, event_type) for idempotency
  - Indexes for project+timestamp, date, session, and agent queries
- Minimal Worker entry point (`src/index.ts`)
- Placeholder test file to verify Vitest setup

- Complete specification documents for Horizon v1:
  - Requirements document (`specs/horizon-v1/requirements.md`) with 19 user stories and 87 acceptance criteria in EARS format
  - Technical design document (`specs/horizon-v1/design.md`) covering architecture, components, data models, and testing strategy
  - Decision log (`specs/horizon-v1/decision_log.md`) documenting 10 architectural decisions
  - Implementation tasks (`specs/horizon-v1/tasks.md`) with 20 tasks across 10 phases
- Key design decisions documented:
  - Cloudflare Workers + D1 as primary deployment target
  - Claude Code only for v1 (other agents deferred)
  - Vanilla JavaScript for dashboard (no framework)
  - Session identification via agent-provided session_id
  - UTC for all date-based calculations
  - 5-minute default duration for incomplete interactions
  - Vitest with miniflare for testing
  - Flat project structure (no monorepo for v1)

- Initial project setup with Horizon specification documents
- Implementation plan (`specs/horizon-v1/horizon-plan.md`) covering:
  - Three deployment options: AWS (Lambda + DynamoDB), Cloudflare (Workers + D1), Local (Bun + SQLite)
  - Shared TypeScript + Hono architecture
  - API design with endpoints for interactions and statistics
  - Session derivation logic using paired events (prompt-start, response-end, session-end)
  - Hook implementation for Claude Code integration
  - Data model for DynamoDB and SQLite
- Dashboard mockup (`specs/horizon-v1/horizon-mockup.html`) with "Ground Control" aesthetic
- Claude Code configuration (`.claude/settings.json`, `CLAUDE.md`)
