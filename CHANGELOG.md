# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Devices widget in dashboard (`dashboard/index.html`, `dashboard/app.js`, `dashboard/styles.css`):
  - New "Devices" panel displaying machine/hostname usage statistics
  - Positioned next to Projects panel in 2-column grid layout
  - Bar chart visualization showing hours and percentage per device
  - Empty state handling when no device data is available
  - Styling matching Ground Control aesthetic with amber accent color
- Machine breakdown in weekly statistics API (`src/services/statistics.ts`, `src/types.ts`, `src/routes/stats.test.ts`):
  - `MachineSummary` interface with machine name, hours, and percentage
  - `calculateMachineBreakdown()` function to aggregate sessions by machine hostname
  - `machines` array included in WeeklyStats response, sorted by hours descending
  - Test coverage for machines field in API response
- Dashboard deployment configuration (`dashboard/wrangler.toml`):
  - Dedicated wrangler.toml for Cloudflare Pages deployment
  - Eliminates warning about missing `pages_build_output_dir`
  - Separates Pages config from Worker's wrangler.toml

### Fixed

- CI workflow now creates wrangler.toml from wrangler-sample.toml before running tests and typecheck
  - Required because wrangler.toml is gitignored
  - Prevents test failures in GitHub Actions

### Changed

- Dashboard layout (`dashboard/index.html`):
  - Projects and Devices panels now share a 2-column row
  - Session Detail panel moved to full-width below when project is selected
- Claude Code hook configuration format updated to new matcher-based format:
  - `hooks/settings.json.example` now uses `hooks` array with `type: "command"` objects
  - README.md hook setup section updated with new format (lines 169-192)
  - Timeout values changed from milliseconds (5000) to seconds (5)
  - `.claude/settings.json` cleaned up by removing unnecessary empty `matcher` field
- Dashboard configuration (`dashboard/config.js`):
  - API_URL updated to production endpoint

### Added

- GitHub Actions validation workflow (`.github/workflows/validate.yml`):
  - Type check job using `make typecheck`
  - Test job running all tests with `make test`
  - ShellCheck job for linting bash scripts in `hooks/` directory
  - Runs on push to `main`, `develop`, `feature/**` branches
  - Runs on pull requests to `main` and `develop`

### Fixed

- UTC timezone in database schema (`schema.sql`):
  - Fixed `created_at` column to use UTC timezone with `datetime('now', 'utc')`
  - Ensures consistency with requirement [3.10] that all date calculations use UTC

- XSS vulnerability in dashboard agent rendering (`dashboard/app.js`):
  - Agent name, initial, and class now properly escaped with `escapeHtml()`
  - Prevents potential script injection if malicious agent names reach the database

- Empty project name edge case in hook script (`hooks/horizon-hook`):
  - Added fallback to `unknown-project` when normalization results in empty string
  - Logs error for debugging when fallback is used

- Date handling in statistics routes (`src/routes/stats.ts`):
  - Fixed off-by-one error at UTC day boundaries
  - Now sets `setUTCHours(0,0,0,0)` before `setUTCDate()` to ensure correct date calculation

### Added

- README.md with deployment and configuration documentation:
  - Prerequisites and installation steps
  - D1 database setup instructions
  - Worker deployment guide
  - Dashboard deployment options
  - Claude Code hook integration setup
  - API endpoint reference
  - Development commands
  - Troubleshooting guide
  - Security notes

- Makefile with development commands (Phase 10):
  - `make dev` - Start development server with hot reload
  - `make test` - Run all tests
  - `make test-watch` - Run tests in watch mode
  - `make typecheck` / `make lint` - Run TypeScript type checking
  - `make deploy` - Deploy to Cloudflare Workers
  - `make db-create` - Create D1 database
  - `make schema-init` - Initialize database schema
  - `make schema-init-local` - Initialize schema for local development
  - `make setup` - Install dependencies
  - `make clean` - Remove generated files

- Hook script and configuration templates (Phase 9):
  - `hooks/horizon-hook` - Bash script for Claude Code integration with:
    - Configuration reading from `~/.config/horizon/config.json`
    - Session ID extraction from Claude Code's stdin JSON, with fallback generation
    - Project name detection from git remote URL (supports SSH and HTTPS formats)
    - Fallback to directory basename when not in a git repository
    - Project name normalization (lowercase, hyphens for special characters)
    - Machine name detection using `hostname -s`
    - JSON payload construction with jq
    - API request with 5-second timeout via curl
    - Error logging to `~/.config/horizon/error.log`
    - Always exits 0 to prevent blocking Claude Code
    - Covers requirements [14.1]-[14.10]
  - `hooks/config.example.json` - Example configuration file with:
    - `api_url` placeholder for Horizon API endpoint
    - `api_key` placeholder for authentication
    - Covers requirement [15.4]
  - `hooks/settings.json.example` - Claude Code hook configuration template with:
    - `UserPromptSubmit` hook for `prompt-start` events
    - `Stop` hook for `response-end` events
    - `SessionEnd` hook for `session-end` events
    - 5000ms timeout configured for each hook
    - Covers requirements [15.1]-[15.3]

- Dashboard implementation (Phase 8):
  - `dashboard/index.html` - Main HTML structure with:
    - Header with logo, machine name, and sync status indicator
    - API key setup form for initial configuration
    - Stats cards row (This Week, Today, Top Agent, Streak)
    - Weekly Activity panel with daily bar chart
    - Projects panel with selectable list
    - Session Detail panel showing sessions for selected project
    - Agents This Week bar chart panel
    - Agent x Project breakdown panel
    - Offline indicator and tooltip components
    - Font imports for IBM Plex Mono and Outfit
    - Covers requirements [8.1]-[8.5], [9.1]-[9.6], [10.1]-[10.5], [11.1]-[11.5], [12.1]-[12.4]
  - `dashboard/styles.css` - Ground Control theme with:
    - Dark background (#0a0c10) and amber accents (#e5a84b)
    - IBM Plex Mono for body/code, Outfit for headings
    - Agent badge colors: Claude (#d97706), Cursor (#8b5cf6), Copilot (#3b82f6), Aider (#10b981)
    - Project colors for weekly activity bar segments
    - Responsive layout for tablet and mobile viewports
    - Styled panels, cards, bars, badges, and interactive elements
    - Custom scrollbar styling
  - `dashboard/config.js` - Configuration file with:
    - API_URL placeholder for deployment configuration
    - Auto-refresh interval constant (5 minutes)
    - Cache and API key storage keys for localStorage
    - Covers requirement [13.5]
  - `dashboard/app.js` - Application logic with:
    - State management for weekly stats, selected project, sessions, sync status
    - API key setup flow with validation and localStorage storage
    - Data fetching with caching to localStorage
    - Offline fallback displaying cached data with indicator
    - Auto-refresh every 5 minutes
    - Render functions for all dashboard panels
    - Project selection and session loading
    - Tooltips for weekly activity bar segments
    - XSS protection via HTML escaping
    - Covers requirements [13.1]-[13.5]

- Worker entry point (`src/index.ts`) with full implementation (Phase 7):
  - CORS middleware with configurable origin (defaults to `*` for development)
  - Allows `Content-Type` and `x-api-key` headers
  - Supports GET, POST, OPTIONS methods
  - API key authentication applied to all `/api/*` routes
  - Route mounting for interactions and stats endpoints
  - Global error handler returning 500 without internal details
  - Error logging with timestamp, endpoint, method, and error type
  - Covers requirements [6.1]-[6.5], [17.1]-[17.3], [18.3]-[18.4]
- Unit tests for Worker entry point (`src/index.test.ts`) covering:
  - Root endpoint health check
  - CORS with configured origin and default `*`
  - OPTIONS preflight requests
  - API key authentication (missing, invalid, valid)
  - Route mounting verification for all endpoints
  - Global error handling (500 response, error logging)

- API routes for interactions and statistics (Phase 6):
  - `src/routes/interactions.ts` - POST /interactions endpoint with:
    - Required field validation (project, timestamp, machine, agent, session_id, event_type)
    - Event type validation (prompt-start, response-end, session-end)
    - ISO 8601 timestamp format validation
    - Idempotent handling with ON CONFLICT DO NOTHING
    - Returns 201 with {status: "recorded"} on success
    - Returns 400 with detailed error messages on validation failure
    - Returns 500 for database errors without exposing internal details
    - Covers requirements [1.1]-[1.7], [18.1]-[18.3]
  - `src/routes/stats.ts` - Statistics endpoints with:
    - GET /stats/weekly with optional week_start parameter (defaults to current week's Monday)
    - GET /stats/projects with optional days parameter (defaults to 30)
    - GET /projects/:name/sessions with optional days parameter (defaults to 7)
    - Returns 404 for non-existent projects
    - All date calculations use UTC
    - Covers requirements [3.1]-[3.10], [4.1]-[4.5], [5.1]-[5.7]
- Unit tests for API routes:
  - `src/routes/interactions.test.ts` (24 tests) covering all validation and error scenarios
  - `src/routes/stats.test.ts` (18 tests) covering weekly stats, project stats, and session endpoints

- Authentication middleware (`src/middleware/auth.ts`) with:
  - `apiKeyAuth` function to validate x-api-key header against environment secret
  - Returns 401 Unauthorized when API key is missing or empty
  - Returns 403 Forbidden when API key is invalid
  - Case-sensitive comparison for security
  - Covers requirements [6.1], [6.2], [6.3], [6.4]
- Unit tests for authentication middleware (`src/middleware/auth.test.ts`) covering:
  - Missing and empty API key returns 401
  - Invalid API key returns 403
  - Case-sensitive key comparison
  - Valid API key allows request
  - Middleware only applies to /api/* routes

- Statistics service (`src/services/statistics.ts`) with:
  - `calculateWeeklyStats` function for weekly totals, daily breakdown, project/agent breakdowns
  - `calculateDailyBreakdown` function for 7-day activity breakdown by day
  - `calculateProjectBreakdown` function to aggregate hours and sessions per project
  - `calculateAgentBreakdown` function to aggregate hours and percentages per agent
  - `calculateStreak` function to count consecutive days with activity
  - `calculateProjectStats` function for project statistics with agent breakdown
  - All calculations use UTC date boundaries
- Unit tests for statistics service (`src/services/statistics.test.ts`) covering:
  - Weekly totals calculation (hours, sessions, rounding)
  - Daily breakdown generation (7 days, session aggregation)
  - Project aggregation (hours, sessions, sorting by hours)
  - Agent breakdown (hours, percentages, division by zero handling)
  - Streak calculation (consecutive days, UTC boundaries, gap handling)
  - Project statistics with agent breakdown

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
