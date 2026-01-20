# Horizon v1 - Requirements

## Introduction

Horizon is a personal time tracking system for AI coding sessions. It tracks which projects a developer works on, which AI agents they use (starting with Claude Code), and for how long. Sessions are identified by the `session_id` provided by the AI agent (Claude Code provides this automatically via hooks).

The system consists of:
- **API**: Records interactions and serves statistics via Hono on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite at edge) for persistent storage
- **Dashboard**: Static HTML/CSS/JS site displaying weekly activity, project breakdown, and session details
- **Hook Script**: Shell script that integrates with Claude Code lifecycle events

Key design principles:
- Single-user system (no multi-tenancy)
- Passive tracking via hooks (no manual time entry)
- Session derivation from paired events (prompt-start, response-end)
- Active time as primary metric (actual coding time vs wall clock time)

---

## Requirements

### 1. Interaction Recording

**User Story:** As a developer, I want my coding interactions to be automatically recorded when I use Claude Code, so that I don't have to manually track my time.

**Acceptance Criteria:**

1. <a name="1.1"></a>The system SHALL expose a `POST /api/interactions` endpoint that accepts interaction data
2. <a name="1.2"></a>The system SHALL require the following fields in the interaction payload: `project` (string), `timestamp` (ISO 8601 string), `machine` (string), `agent` (string), `session_id` (string), `event_type` (string)
3. <a name="1.3"></a>The system SHALL validate that `event_type` is one of: `prompt-start`, `response-end`, `session-end`
4. <a name="1.4"></a>The system SHALL return HTTP 201 with `{"status": "recorded"}` on successful recording
5. <a name="1.5"></a>The system SHALL return HTTP 400 with an error message when required fields are missing or invalid
6. <a name="1.6"></a>The system SHALL store interactions in the D1 database with auto-generated `id` and `created_at` fields
7. <a name="1.7"></a>The system SHALL treat interactions with identical (`session_id`, `timestamp`, `event_type`) as duplicates and ignore subsequent submissions

---

### 2. Session Derivation

**User Story:** As a developer, I want my coding sessions to be automatically derived from interaction patterns, so that I can see meaningful session boundaries without manual tracking.

**Acceptance Criteria:**

1. <a name="2.1"></a>The system SHALL group interactions by `session_id` to identify distinct sessions
2. <a name="2.2"></a>The system SHALL calculate session span as the time between the first and last event in a session
3. <a name="2.3"></a>The system SHALL calculate active time as the sum of durations between paired `prompt-start` and `response-end` events
4. <a name="2.4"></a>WHEN a `prompt-start` event has no matching `response-end`, the system SHALL use a default duration of 5 minutes
5. <a name="2.5"></a>The system SHALL mark a session as explicitly ended when a `session-end` event is recorded
6. <a name="2.6"></a>The system SHALL count interactions as the number of `prompt-start` events in a session
7. <a name="2.7"></a>The system SHALL process events in timestamp order regardless of arrival order; when multiple `prompt-start` events occur without intervening `response-end` events, each `prompt-start` SHALL be paired with the next available `response-end` in timestamp order
8. <a name="2.8"></a>The system SHALL ignore orphaned `response-end` events that have no preceding unpaired `prompt-start`

---

### 3. Weekly Statistics API

**User Story:** As a developer, I want to view my weekly coding statistics, so that I can understand my work patterns and productivity trends.

**Acceptance Criteria:**

1. <a name="3.1"></a>The system SHALL expose a `GET /api/stats/weekly` endpoint
2. <a name="3.2"></a>The endpoint SHALL accept an optional `week_start` query parameter (ISO date) defaulting to the current week's Monday
3. <a name="3.3"></a>The response SHALL include `total_hours` (number) representing total active time for the week
4. <a name="3.4"></a>The response SHALL include `total_sessions` (number) representing the count of distinct sessions
5. <a name="3.5"></a>The response SHALL include `streak_days` (number) representing consecutive days with at least one session
6. <a name="3.6"></a>The response SHALL include `daily_breakdown` (array) with each day's date, hours, and session count
7. <a name="3.7"></a>The response SHALL include `projects` (array) with each project's name, hours, and session count
8. <a name="3.8"></a>The response SHALL include `agents` (array) with each agent's name, hours, and percentage
9. <a name="3.9"></a>The response SHALL include `comparison.vs_last_week` (number) showing the hour difference from the previous week
10. <a name="3.10"></a>The system SHALL use UTC for all date-based calculations; the `week_start` parameter SHALL be interpreted as `YYYY-MM-DDT00:00:00Z` and daily boundaries SHALL be 00:00:00Z to 23:59:59Z UTC

---

### 4. Project Statistics API

**User Story:** As a developer, I want to view statistics for all my projects over a time period, so that I can see which projects I spend the most time on.

**Acceptance Criteria:**

1. <a name="4.1"></a>The system SHALL expose a `GET /api/stats/projects` endpoint
2. <a name="4.2"></a>The endpoint SHALL accept an optional `days` query parameter (number) defaulting to 30
3. <a name="4.3"></a>The response SHALL include an array of projects, each with `name`, `total_hours`, `total_sessions`, and `agents` breakdown
4. <a name="4.4"></a>The `agents` field SHALL be an object mapping agent names to hours spent
5. <a name="4.5"></a>Projects SHALL be sorted by `total_hours` in descending order

---

### 5. Project Sessions API

**User Story:** As a developer, I want to view individual sessions for a specific project, so that I can drill down into my work history.

**Acceptance Criteria:**

1. <a name="5.1"></a>The system SHALL expose a `GET /api/projects/{name}/sessions` endpoint
2. <a name="5.2"></a>The endpoint SHALL accept an optional `days` query parameter (number) defaulting to 7
3. <a name="5.3"></a>The response SHALL include the `project` name and an array of `sessions`
4. <a name="5.4"></a>Each session SHALL include: `session_id`, `start` (ISO timestamp), `end` (ISO timestamp or null for active sessions), `span_minutes`, `active_minutes`, `machine`, `agent`, `interaction_count`, `explicit_end` (boolean)
5. <a name="5.5"></a>Sessions SHALL be sorted by `start` in descending order (most recent first)
6. <a name="5.6"></a>The system SHALL return HTTP 404 when the project name does not exist
7. <a name="5.7"></a>Sessions with a `prompt-start` event but no subsequent `response-end` or `session-end` event SHALL be returned with `end` set to null to indicate an active session

---

### 6. Authentication

**User Story:** As a developer, I want my time tracking data protected by an API key, so that only I can record and view my sessions.

**Acceptance Criteria:**

1. <a name="6.1"></a>The system SHALL require an `x-api-key` header on all `/api/*` endpoints
2. <a name="6.2"></a>The system SHALL validate the API key against the configured secret
3. <a name="6.3"></a>The system SHALL return HTTP 401 with `{"error": "Unauthorized"}` when the API key is missing
4. <a name="6.4"></a>The system SHALL return HTTP 403 with `{"error": "Forbidden"}` when the API key is invalid
5. <a name="6.5"></a>The API key SHALL be configurable via Cloudflare Worker environment variable or secret

---

### 7. Database Schema

**User Story:** As a developer, I want my interaction data stored efficiently, so that queries for statistics and sessions are performant.

**Acceptance Criteria:**

1. <a name="7.1"></a>The system SHALL create an `interactions` table with columns: `id` (auto-increment primary key), `project`, `timestamp`, `machine`, `agent`, `session_id`, `event_type`, `created_at`
2. <a name="7.2"></a>The system SHALL create an index on `(project, timestamp DESC)` for project time-range queries
3. <a name="7.3"></a>The system SHALL create an index on `(date(timestamp), timestamp DESC)` for date-based queries
4. <a name="7.4"></a>The system SHALL create an index on `(session_id, timestamp ASC)` for session grouping
5. <a name="7.5"></a>The system SHALL create an index on `(agent, timestamp DESC)` for agent statistics
6. <a name="7.6"></a>The system SHALL create a unique constraint on `(session_id, timestamp, event_type)` to enforce idempotency

---

### 8. Dashboard - Header and Stats

**User Story:** As a developer, I want to see a summary of my coding activity at a glance, so that I can quickly understand my current status.

**Acceptance Criteria:**

1. <a name="8.1"></a>The dashboard SHALL display a header with the Horizon logo and current machine name
2. <a name="8.2"></a>The dashboard SHALL display a sync status indicator showing time since last data refresh
3. <a name="8.3"></a>The dashboard SHALL display four stat cards: "This Week" (total hours), "Today" (hours and session count), "Top Agent" (name and hours), "Streak" (consecutive days)
4. <a name="8.4"></a>The "This Week" card SHALL show comparison to last week (e.g., "+3.2hrs vs last week")
5. <a name="8.5"></a>The dashboard SHALL use the "Ground Control" aesthetic: dark theme (#0a0c10 background), amber accents (#e5a84b), IBM Plex Mono and Outfit fonts

---

### 9. Dashboard - Weekly Activity

**User Story:** As a developer, I want to see my weekly activity as a visual timeline, so that I can identify patterns in my work schedule.

**Acceptance Criteria:**

1. <a name="9.1"></a>The dashboard SHALL display a "Weekly Activity" panel showing 7 days (Monday through Sunday)
2. <a name="9.2"></a>Each day SHALL show a horizontal bar divided into colored segments representing projects
3. <a name="9.3"></a>Each segment's width SHALL be proportional to hours spent on that project
4. <a name="9.4"></a>Hovering over a segment SHALL display a tooltip with project name, hours, and agent used
5. <a name="9.5"></a>Each day row SHALL display the day label (e.g., "Mon 13"), the bar chart, and total hours
6. <a name="9.6"></a>The current day SHALL be visually highlighted (amber text for day label)

---

### 10. Dashboard - Projects Panel

**User Story:** As a developer, I want to see a list of my projects with session counts, so that I can understand my project distribution.

**Acceptance Criteria:**

1. <a name="10.1"></a>The dashboard SHALL display a "Projects" panel listing all projects from the current week
2. <a name="10.2"></a>Each project item SHALL show: color indicator, project name, session count, and total hours
3. <a name="10.3"></a>Clicking a project SHALL select it and display its sessions in a detail section below
4. <a name="10.4"></a>The selected project SHALL be visually indicated with an amber border
5. <a name="10.5"></a>Projects SHALL be sorted by total hours in descending order

---

### 11. Dashboard - Session Detail

**User Story:** As a developer, I want to see individual sessions for a selected project, so that I can review my recent work history.

**Acceptance Criteria:**

1. <a name="11.1"></a>WHEN a project is selected, the dashboard SHALL display a "sessions today" section
2. <a name="11.2"></a>Each session entry SHALL show: time range (e.g., "09:15 - 10:42"), agent badge with color, duration, and machine name
3. <a name="11.3"></a>Active sessions (no end time) SHALL display "now" as the end time and "active" as duration
4. <a name="11.4"></a>Agent badges SHALL use distinct colors: Claude (#d97706), Cursor (#8b5cf6), Copilot (#3b82f6), Aider (#10b981)
5. <a name="11.5"></a>The session list SHALL be scrollable with a maximum height of 200px

---

### 12. Dashboard - Agents Panel

**User Story:** As a developer, I want to see which AI agents I use and how much, so that I can understand my tooling preferences.

**Acceptance Criteria:**

1. <a name="12.1"></a>The dashboard SHALL display an "Agents This Week" panel with a horizontal bar chart
2. <a name="12.2"></a>Each agent SHALL show: name, colored progress bar proportional to hours, hour value, and percentage
3. <a name="12.3"></a>The dashboard SHALL display an "Agent x Project" panel showing which agents are used for which projects
4. <a name="12.4"></a>Each agent-project row SHALL show: agent icon with color, agent name, project list, and total hours

---

### 13. Dashboard - Data Loading

**User Story:** As a developer, I want the dashboard to load quickly and work offline when possible, so that I can always review my data.

**Acceptance Criteria:**

1. <a name="13.1"></a>The dashboard SHALL fetch data from the API on initial load
2. <a name="13.2"></a>The dashboard SHALL cache API responses in localStorage
3. <a name="13.3"></a>WHEN the API is unavailable, the dashboard SHALL display cached data with an offline indicator
4. <a name="13.4"></a>The dashboard SHALL auto-refresh data every 5 minutes
5. <a name="13.5"></a>The dashboard SHALL read API URL from a `config.js` file; the API key SHALL be stored in browser localStorage after initial setup and SHALL NOT be passed via URL parameters

---

### 14. Claude Code Hook Integration

**User Story:** As a developer using Claude Code, I want my interactions automatically tracked via hooks, so that tracking is seamless and requires no manual action.

**Acceptance Criteria:**

1. <a name="14.1"></a>The hook script SHALL be installable at `~/.local/bin/horizon-hook`
2. <a name="14.2"></a>The hook script SHALL read configuration from `~/.config/horizon/config.json` containing `api_url` and `api_key`
3. <a name="14.3"></a>The hook script SHALL extract `session_id` from Claude Code's stdin JSON input
4. <a name="14.4"></a>The hook script SHALL determine the project name from git remote URL (repo name without org), falling back to directory basename
5. <a name="14.5"></a>The hook script SHALL send interactions to the API with a 5-second timeout
6. <a name="14.6"></a>The hook script SHALL log errors to `~/.config/horizon/error.log` without interrupting Claude Code
7. <a name="14.7"></a>The hook script SHALL accept an event type argument: `prompt-start`, `response-end`, or `session-end`
8. <a name="14.8"></a>The hook script SHALL exit with code 0 even on API failures to prevent blocking Claude Code
9. <a name="14.9"></a>The hook script SHALL determine the machine name using `hostname -s`
10. <a name="14.10"></a>The hook script SHALL normalize project names to lowercase, replacing spaces and special characters with hyphens

---

### 15. Claude Code Hook Configuration

**User Story:** As a developer, I want clear instructions to configure Claude Code hooks, so that I can set up tracking quickly.

**Acceptance Criteria:**

1. <a name="15.1"></a>The system SHALL provide a hook configuration template for `~/.claude/settings.json`
2. <a name="15.2"></a>The configuration SHALL register hooks for `UserPromptSubmit` (prompt-start), `Stop` (response-end), and `SessionEnd` (session-end)
3. <a name="15.3"></a>Each hook SHALL have a 5000ms timeout configured
4. <a name="15.4"></a>The system SHALL provide an example `config.json` file with placeholder values

---

### 16. Cloudflare Deployment

**User Story:** As a developer, I want to deploy Horizon to Cloudflare Workers, so that I have a globally available, low-latency tracking system.

**Acceptance Criteria:**

1. <a name="16.1"></a>The system SHALL provide a `wrangler.toml` configuration file
2. <a name="16.2"></a>The configuration SHALL define a D1 database binding named `DB`
3. <a name="16.3"></a>The configuration SHALL support API key via environment variable or Wrangler secret
4. <a name="16.4"></a>The system SHALL provide a `schema.sql` file for D1 database initialization
5. <a name="16.5"></a>The deployment SHALL be executable via `wrangler deploy`
6. <a name="16.6"></a>The dashboard SHALL be deployable to Cloudflare Pages

---

### 17. CORS Support

**User Story:** As a developer, I want the API to support cross-origin requests, so that the dashboard can be hosted separately from the API.

**Acceptance Criteria:**

1. <a name="17.1"></a>The API SHALL include CORS headers allowing requests from the configured dashboard origin (configurable via environment variable, defaulting to `*` for development)
2. <a name="17.2"></a>The API SHALL respond to OPTIONS preflight requests with appropriate CORS headers
3. <a name="17.3"></a>The CORS configuration SHALL allow the `x-api-key` header

---

### 18. Error Handling

**User Story:** As a developer, I want clear error messages from the API, so that I can diagnose issues with my tracking setup.

**Acceptance Criteria:**

1. <a name="18.1"></a>The API SHALL return JSON error responses with an `error` field containing a human-readable message
2. <a name="18.2"></a>The API SHALL return HTTP 400 for validation errors with details about which field failed
3. <a name="18.3"></a>The API SHALL return HTTP 500 for unexpected errors without exposing internal details
4. <a name="18.4"></a>The API SHALL log errors with sufficient context for debugging (timestamp, endpoint, error type)

---

### 19. Unit Testing

**User Story:** As a developer, I want the core business logic tested, so that I can refactor with confidence.

**Acceptance Criteria:**

1. <a name="19.1"></a>The system SHALL include unit tests for session derivation logic
2. <a name="19.2"></a>The session tests SHALL cover: normal prompt-response pairs, missing response-end events, explicit session-end events, multiple sessions in sequence, out-of-order events, consecutive prompt-starts, orphaned response-end events
3. <a name="19.3"></a>The system SHALL include unit tests for statistics calculation logic
4. <a name="19.4"></a>The statistics tests SHALL cover: weekly totals, daily breakdown, project aggregation, streak calculation
5. <a name="19.5"></a>Tests SHALL be runnable via a standard npm/pnpm script
