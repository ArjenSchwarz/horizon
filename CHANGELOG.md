# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
