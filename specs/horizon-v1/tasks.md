---
references:
    - specs/horizon-v1/requirements.md
    - specs/horizon-v1/design.md
    - specs/horizon-v1/decision_log.md
---
# Horizon v1 Implementation Tasks

## Phase 1 - Project Setup

- [x] 1. Initialize project with TypeScript and Wrangler
  - Create package.json with TypeScript, Hono, Wrangler, and Vitest dependencies
  - Create tsconfig.json for Cloudflare Workers
  - Create wrangler.toml with D1 binding
  - Requirements: [16.1](requirements.md#16.1), [16.2](requirements.md#16.2), [16.3](requirements.md#16.3)

- [x] 2. Create database schema
  - Create schema.sql with interactions table and all indexes
  - Include unique constraint for idempotency
  - Requirements: [7.1](requirements.md#7.1), [7.2](requirements.md#7.2), [7.3](requirements.md#7.3), [7.4](requirements.md#7.4), [7.5](requirements.md#7.5), [7.6](requirements.md#7.6)

- [x] 3. Configure Vitest for Workers environment
  - Create vitest.config.ts with miniflare environment
  - Add test scripts to package.json
  - Requirements: [19.5](requirements.md#19.5)

## Phase 2 - TypeScript Types

- [x] 4. Create TypeScript type definitions
  - Create src/types.ts with EventType, Interaction, Session, WeeklyStats, and all other interfaces
  - Requirements: [1.2](requirements.md#1.2), [5.4](requirements.md#5.4)

## Phase 3 - Session Derivation (TDD)

- [x] 5. Write session derivation unit tests
  - Create src/services/sessions.test.ts
  - Test normal prompt-response pairs
  - Test 5-minute default for unpaired prompt-start
  - Test explicit session-end handling
  - Test out-of-order events processing
  - Test consecutive prompt-starts pairing
  - Test orphaned response-end events ignored
  - Test multiple sessions
  - Requirements: [19.1](requirements.md#19.1), [19.2](requirements.md#19.2)

- [x] 6. Implement session derivation service
  - Create src/services/sessions.ts
  - Implement calculateSessions function
  - Implement deriveSession function
  - Implement calculateActiveTime function with clock skew protection
  - Requirements: [2.1](requirements.md#2.1), [2.2](requirements.md#2.2), [2.3](requirements.md#2.3), [2.4](requirements.md#2.4), [2.5](requirements.md#2.5), [2.6](requirements.md#2.6), [2.7](requirements.md#2.7), [2.8](requirements.md#2.8)

## Phase 4 - Statistics Service (TDD)

- [x] 7. Write statistics calculation unit tests
  - Create src/services/statistics.test.ts
  - Test weekly totals calculation
  - Test daily breakdown generation
  - Test project aggregation
  - Test streak calculation
  - Requirements: [19.3](requirements.md#19.3), [19.4](requirements.md#19.4)

- [x] 8. Implement statistics service
  - Create src/services/statistics.ts
  - Implement calculateWeeklyStats function
  - Implement calculateDailyBreakdown function
  - Implement calculateProjectBreakdown function
  - Implement calculateAgentBreakdown function
  - Implement calculateStreak function
  - Requirements: [3.3](requirements.md#3.3), [3.4](requirements.md#3.4), [3.5](requirements.md#3.5), [3.6](requirements.md#3.6), [3.7](requirements.md#3.7), [3.8](requirements.md#3.8), [3.9](requirements.md#3.9)

## Phase 5 - API Middleware

- [x] 9. Implement authentication middleware
  - Create src/middleware/auth.ts
  - Validate x-api-key header presence
  - Validate API key against environment secret
  - Return 401 for missing key, 403 for invalid key
  - Requirements: [6.1](requirements.md#6.1), [6.2](requirements.md#6.2), [6.3](requirements.md#6.3), [6.4](requirements.md#6.4)

## Phase 6 - API Routes

- [x] 10. Implement interactions route
  - Create src/routes/interactions.ts
  - Validate required fields (project, timestamp, machine, agent, session_id, event_type)
  - Validate event_type is one of prompt-start, response-end, session-end
  - Validate ISO 8601 timestamp format
  - Insert with ON CONFLICT DO NOTHING for idempotency
  - Return 201 with {status: recorded} on success
  - Return 400 with error message on validation failure
  - Requirements: [1.1](requirements.md#1.1), [1.2](requirements.md#1.2), [1.3](requirements.md#1.3), [1.4](requirements.md#1.4), [1.5](requirements.md#1.5), [1.6](requirements.md#1.6), [1.7](requirements.md#1.7)

- [x] 11. Implement statistics routes
  - Create src/routes/stats.ts
  - Implement GET /api/stats/weekly with optional week_start parameter
  - Implement GET /api/stats/projects with optional days parameter
  - Implement GET /api/projects/:name/sessions with optional days parameter
  - Return 404 for non-existent project
  - Requirements: [3.1](requirements.md#3.1), [3.2](requirements.md#3.2), [3.10](requirements.md#3.10), [4.1](requirements.md#4.1), [4.2](requirements.md#4.2), [4.3](requirements.md#4.3), [4.4](requirements.md#4.4), [4.5](requirements.md#4.5), [5.1](requirements.md#5.1), [5.2](requirements.md#5.2), [5.3](requirements.md#5.3), [5.4](requirements.md#5.4), [5.5](requirements.md#5.5), [5.6](requirements.md#5.6), [5.7](requirements.md#5.7)

## Phase 7 - Worker Entry Point

- [x] 12. Implement Worker entry point
  - Create src/index.ts
  - Configure CORS middleware with configurable origin
  - Apply API key authentication to /api/* routes
  - Mount interactions and stats routes
  - Add error handling for unexpected errors
  - Requirements: [6.5](requirements.md#6.5), [17.1](requirements.md#17.1), [17.2](requirements.md#17.2), [17.3](requirements.md#17.3), [18.3](requirements.md#18.3), [18.4](requirements.md#18.4)

## Phase 8 - Dashboard

- [x] 13. Create dashboard HTML structure
  - Create dashboard/index.html with header, stats cards, weekly activity, projects panel, session detail, agents panels
  - Include meta tags and font imports for IBM Plex Mono and Outfit
  - Requirements: [8.1](requirements.md#8.1), [8.2](requirements.md#8.2), [8.3](requirements.md#8.3), [8.4](requirements.md#8.4), [9.1](requirements.md#9.1), [10.1](requirements.md#10.1), [11.1](requirements.md#11.1), [12.1](requirements.md#12.1), [12.3](requirements.md#12.3)

- [x] 14. Implement dashboard styles
  - Create dashboard/styles.css with Ground Control theme
  - Dark background (#0a0c10), amber accents (#e5a84b)
  - Style all panels, cards, bars, badges, and interactive elements
  - Style agent badges with distinct colors
  - Requirements: [8.5](requirements.md#8.5), [9.2](requirements.md#9.2), [9.3](requirements.md#9.3), [9.5](requirements.md#9.5), [9.6](requirements.md#9.6), [10.2](requirements.md#10.2), [10.4](requirements.md#10.4), [11.2](requirements.md#11.2), [11.4](requirements.md#11.4), [11.5](requirements.md#11.5), [12.2](requirements.md#12.2)

- [x] 15. Create dashboard configuration
  - Create dashboard/config.js with API_URL placeholder
  - Requirements: [13.5](requirements.md#13.5)

- [x] 16. Implement dashboard application logic
  - Create dashboard/app.js with state management
  - Implement API key setup flow (localStorage)
  - Implement data fetching with caching
  - Implement offline fallback
  - Implement auto-refresh every 5 minutes
  - Implement render functions for all panels
  - Implement project selection and session loading
  - Implement tooltips for weekly activity bars
  - Requirements: [13.1](requirements.md#13.1), [13.2](requirements.md#13.2), [13.3](requirements.md#13.3), [13.4](requirements.md#13.4), [9.4](requirements.md#9.4), [10.3](requirements.md#10.3), [10.5](requirements.md#10.5), [11.3](requirements.md#11.3)

## Phase 9 - Hook Script

- [x] 17. Create horizon-hook bash script
  - Create hooks/horizon-hook script
  - Read configuration from ~/.config/horizon/config.json
  - Extract session_id from stdin JSON, generate if missing
  - Determine project from git remote URL, fallback to directory basename
  - Normalize project name (lowercase, hyphens)
  - Build JSON payload and send to API with 5-second timeout
  - Log errors to ~/.config/horizon/error.log
  - Always exit 0 regardless of API failures
  - Requirements: [14.1](requirements.md#14.1), [14.2](requirements.md#14.2), [14.3](requirements.md#14.3), [14.4](requirements.md#14.4), [14.5](requirements.md#14.5), [14.6](requirements.md#14.6), [14.7](requirements.md#14.7), [14.8](requirements.md#14.8), [14.9](requirements.md#14.9), [14.10](requirements.md#14.10)

- [x] 18. Create hook configuration templates
  - Create hooks/config.example.json with placeholder values
  - Create hooks/settings.json.example with Claude Code hook configuration
  - Requirements: [15.1](requirements.md#15.1), [15.2](requirements.md#15.2), [15.3](requirements.md#15.3), [15.4](requirements.md#15.4)

## Phase 10 - Integration

- [ ] 19. Run all tests and verify coverage
  - Execute pnpm test
  - Verify session derivation tests pass
  - Verify statistics tests pass
  - Ensure all requirement test coverage

- [ ] 20. Create Makefile with development commands
  - Add test, dev, deploy targets
  - Add schema initialization target
