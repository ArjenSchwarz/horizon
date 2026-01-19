# Decision Log: Horizon v1

## Decision 1: Primary Deployment Target

**Date**: 2026-01-19
**Status**: accepted

### Context

Horizon supports three deployment options: AWS (Lambda + DynamoDB), Cloudflare (Workers + D1), and Local (Bun + SQLite). For v1, we needed to decide which deployment to build and test first, as building all three simultaneously would increase complexity and delay delivery.

### Decision

Use Cloudflare Workers + D1 as the primary deployment target for v1.

### Rationale

Cloudflare offers the best balance of simplicity, performance, and cost:
- No cold starts (unlike AWS Lambda)
- Edge deployment provides low latency globally
- Generous free tier (100k requests/day, 5GB D1 storage)
- Simple deployment via Wrangler CLI
- D1 uses SQLite, making local development easier to mirror

### Alternatives Considered

- **AWS Lambda + DynamoDB**: More familiar tooling for some developers - Rejected because cold starts impact user experience for a hooks-based system where low latency matters
- **Local Bun + SQLite**: Zero cloud dependency, works offline - Rejected as primary because it limits accessibility to local machine only (can be added later)

### Consequences

**Positive:**
- Single deployment target simplifies v1 scope
- Fast global response times for hook calls
- No ongoing costs within free tier
- SQLite-based D1 aligns well with potential local deployment later

**Negative:**
- D1 is relatively new (though stable for this use case)
- 10ms CPU limit per request (sufficient for our operations)
- Users wanting AWS or local must wait for future versions

---

## Decision 2: Dashboard Scope

**Date**: 2026-01-19
**Status**: accepted

### Context

The horizon-mockup.html contains a full-featured dashboard with multiple panels: stats row, weekly activity timeline, projects list, session details, and agent breakdowns. We needed to decide whether to implement the full dashboard or a minimal version for v1.

### Decision

Implement the full dashboard as designed in the mockup for v1.

### Rationale

The dashboard is the primary user interface for Horizon. A minimal version would provide a degraded experience and require significant rework to expand later. The mockup is already complete with HTML/CSS, reducing implementation effort.

### Alternatives Considered

- **Minimal dashboard (stats + project list only)**: Faster to implement - Rejected because the mockup is already complete and the full version provides the intended user experience

### Consequences

**Positive:**
- Users get the complete intended experience from day one
- No future migration from minimal to full version
- Existing mockup reduces design decisions

**Negative:**
- Larger initial implementation scope
- More JavaScript code to maintain
- More API surface area to support

---

## Decision 3: Supported AI Agents

**Date**: 2026-01-19
**Status**: accepted

### Context

The original plan mentioned support for multiple AI agents: Claude Code, Cursor, Copilot, and Aider. Each agent has different hook mechanisms (or none at all). We needed to decide which agents to support in v1.

### Decision

Support Claude Code only for v1.

### Rationale

Claude Code has well-documented hooks (UserPromptSubmit, Stop, SessionEnd) that provide the event types needed for session tracking. Other agents either lack hooks or require different integration approaches. Starting with one agent allows us to validate the tracking model before expanding.

### Alternatives Considered

- **Claude Code + Cursor**: Two popular agents - Rejected because Cursor's hook mechanism (if any) would need research and potentially different implementation
- **All mentioned agents**: Maximum compatibility - Rejected because it would significantly expand scope and delay v1

### Consequences

**Positive:**
- Focused implementation effort
- Well-defined hook integration with Claude Code
- Validates the tracking model before adding complexity

**Negative:**
- Users of other agents cannot track their sessions in v1
- Dashboard will show agent breakdown but only have one agent initially

---

## Decision 4: Testing Strategy

**Date**: 2026-01-19
**Status**: accepted

### Context

Testing strategy options ranged from no tests to comprehensive unit + integration + E2E tests. We needed to balance confidence in code quality against implementation time.

### Decision

Include unit tests for core business logic only (session derivation, statistics calculation).

### Rationale

Session derivation is the core algorithm that determines the accuracy of time tracking. This logic is pure and easily unit-testable. Integration tests for database adapters and API endpoints can be added later as the system stabilizes.

### Alternatives Considered

- **No tests**: Faster initial implementation - Rejected because session derivation bugs would undermine the system's core value
- **Unit + Integration tests**: Higher confidence - Rejected to reduce v1 scope; can be added in v1.1

### Consequences

**Positive:**
- Core algorithm is validated
- Tests serve as documentation for session calculation rules
- Enables confident refactoring of session logic

**Negative:**
- Database adapter bugs may not be caught
- API integration issues require manual testing
- No automated E2E validation

---

## Decision 5: Session Identification Approach

**Date**: 2026-01-19
**Status**: accepted

### Context

The original plan mentioned "30 minutes of idle time marking the boundary between sessions." However, Claude Code provides a `session_id` directly via its hook input. We needed to decide whether to derive sessions from idle time or trust the agent's session identifier.

### Decision

Use the `session_id` provided by Claude Code to identify sessions, rather than deriving session boundaries from idle time.

### Rationale

Claude Code already manages session lifecycle and provides a stable `session_id`. Using this identifier is simpler and more accurate than attempting to infer session boundaries from timestamps. It also handles edge cases like resuming a session after a break naturally.

### Alternatives Considered

- **30-minute idle timeout**: Derive sessions from interaction timestamps - Rejected because it's more complex, less accurate, and ignores the session information Claude Code already provides
- **Hybrid approach**: Use both session_id and idle timeout - Rejected as unnecessarily complex

### Consequences

**Positive:**
- Simpler implementation
- More accurate session boundaries
- Works correctly when user resumes a session after a break
- Future agents can provide their own session IDs

**Negative:**
- If an agent doesn't provide session_id, the hook must generate one
- Session boundaries are only as good as the agent's session management

---

## Decision 6: Timezone Handling

**Date**: 2026-01-19
**Status**: accepted

### Context

Statistics APIs return daily breakdowns, streaks, and weekly aggregations. "Today" and "this week" are ambiguous without a defined timezone. The dashboard may be viewed from different locations.

### Decision

Use UTC for all date-based calculations in the API. Daily boundaries are 00:00:00Z to 23:59:59Z UTC.

### Rationale

UTC provides a consistent, unambiguous baseline. The hook script sends UTC timestamps. The dashboard can display times in local timezone if needed, but the API layer remains simple and predictable.

### Alternatives Considered

- **Local timezone (per-machine)**: Use each machine's timezone - Rejected because it would cause inconsistencies when tracking across machines in different timezones
- **Configurable timezone**: Allow user to set their timezone - Rejected as over-engineering for v1; can be added later if needed

### Consequences

**Positive:**
- Consistent behavior regardless of where dashboard is accessed
- Simple implementation
- No timezone configuration needed

**Negative:**
- Users in non-UTC timezones may see "today" not matching their local day
- Sessions spanning UTC midnight are attributed to the day they started

---

## Decision 7: Default Duration for Incomplete Interactions

**Date**: 2026-01-19
**Status**: accepted

### Context

When a `prompt-start` event has no matching `response-end` (e.g., Claude Code crashed, network issue, or session abandoned), the system needs to assign some duration to avoid losing all tracking data.

### Decision

Use a default duration of 5 minutes for `prompt-start` events without a matching `response-end`.

### Rationale

5 minutes represents a reasonable estimate for an interrupted interaction. It's long enough to capture meaningful work time but short enough not to significantly inflate totals. Most interactions that don't receive a response-end are either very short (quick question followed by crash) or abandoned (user walked away), making 5 minutes a reasonable middle ground.

### Alternatives Considered

- **Ignore incomplete interactions**: Don't count them at all - Rejected because it would lose tracking data for interrupted sessions
- **Use median of completed interactions**: More accurate but complex - Rejected as over-engineering for v1
- **Configurable default**: Allow user to set the value - Rejected as unnecessary complexity

### Consequences

**Positive:**
- Incomplete interactions are tracked rather than lost
- Simple implementation
- Consistent behavior

**Negative:**
- May undercount long interactions that were interrupted
- May overcount very short interactions that were interrupted
- The 5-minute value is somewhat arbitrary

---

## Decision 8: Dashboard Technology

**Date**: 2026-01-19
**Status**: accepted

### Context

The dashboard needs to display statistics, charts, and handle user interactions. We needed to decide between vanilla JavaScript, a lightweight library (Preact, Alpine.js), or a full framework.

### Decision

Use vanilla JavaScript for the dashboard with a simple state object pattern.

### Rationale

The dashboard has straightforward data flow (fetch API → render lists → handle click selection) that doesn't justify framework overhead. The mockup already uses vanilla JS, and the estimated ~500 lines of JavaScript is manageable without a framework. This also means zero build step and simpler deployment to Cloudflare Pages.

### Alternatives Considered

- **Preact + HTM**: Lightweight React-like library - Rejected because component-based architecture adds complexity without significant benefit for this scope
- **Alpine.js**: Declarative attributes in HTML - Rejected because it's still a dependency to manage and doesn't align with the existing mockup approach

### Consequences

**Positive:**
- No dependencies to manage or update
- No build step needed
- Smaller bundle size
- Easier to understand for future maintenance
- Matches existing mockup implementation

**Negative:**
- More manual DOM manipulation
- No component reusability if dashboard grows significantly
- May need refactoring if features expand substantially

---

## Decision 9: Testing Framework

**Date**: 2026-01-19
**Status**: accepted

### Context

We need a testing framework compatible with Cloudflare Workers runtime for unit testing the session derivation and statistics logic.

### Decision

Use Vitest with miniflare environment for unit testing.

### Rationale

Vitest is fast, has excellent TypeScript support, and integrates with miniflare to simulate Cloudflare Workers environment. It's compatible with the Workers runtime and provides a familiar Jest-like API.

### Alternatives Considered

- **Jest**: Popular but requires more configuration for Workers compatibility - Rejected for complexity
- **Node test runner**: Built-in but lacks Workers environment simulation - Rejected for compatibility

### Consequences

**Positive:**
- Fast test execution
- Native TypeScript support
- Workers-compatible via miniflare
- Familiar API

**Negative:**
- Additional devDependency
- Miniflare environment may not perfectly match production

---

## Decision 10: Project Structure (Flat vs Monorepo)

**Date**: 2026-01-19
**Status**: accepted

### Context

The original plan proposed a monorepo with separate packages (core, db-dynamodb, db-d1, db-sqlite). For v1 targeting only Cloudflare, we needed to decide whether to maintain this structure or simplify.

### Decision

Use a flat project structure for v1 with all code in a single `src/` directory.

### Rationale

With only Cloudflare deployment in scope, the monorepo structure adds unnecessary complexity. A flat structure is easier to navigate, requires no workspace configuration, and can be refactored into a monorepo later if AWS/Local deployments are added.

### Alternatives Considered

- **Full monorepo**: As specified in original plan - Rejected because we're only building one deployment target
- **packages/ structure without workspaces**: Partial organization - Rejected as it's the worst of both worlds

### Consequences

**Positive:**
- Simpler project setup
- Easier to navigate
- No workspace configuration needed
- Faster to implement

**Negative:**
- Will need restructuring if other deployment targets are added
- Database adapter is tightly coupled to D1

---
