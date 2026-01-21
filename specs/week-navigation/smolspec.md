# Week Navigation

## Overview

Add navigation controls to the dashboard that allow viewing stats for any week, not just the current one. Users can navigate backward/forward through weeks and quickly return to the current week with a "Today" button.

## Requirements

- The dashboard MUST display the currently viewed week's date range in the Weekly Activity panel header (e.g., "Jan 13 - 19")
- The dashboard MUST provide previous/next week navigation buttons
- The dashboard MUST provide a "Today" button that returns to the current week
- The "Today" button MUST only be visible when viewing a past week
- The "Next" button MUST be disabled when viewing the current week (determined by local Monday)
- The dashboard MUST pass the `week_start` parameter to the API when viewing non-current weeks
- The dashboard MUST update the "This Week" stat card label to show the week date range when viewing historical weeks (e.g., "Jan 6 - 12")
- The dashboard MUST update the "Today" stat card label to show the day name when viewing historical weeks (e.g., "Monday" for the first day of that week)
- The dashboard SHOULD store the selected week in `sessionStorage` to persist across page refreshes within the browser tab
- The dashboard MAY allow navigation into weeks with no data (showing zero stats)

## Implementation Approach

**Files to modify:**
- `dashboard/index.html` — Add navigation controls to the Weekly Activity panel header
- `dashboard/app.js` — Add state management, navigation handlers, and week calculation logic
- `dashboard/styles.css` — Style the navigation controls

**Existing patterns to leverage:**
- State management: Add `currentWeekStart` to the existing `state` object (app.js:36-44)
- Date utilities: Extend existing `getTodayISO()` and `getTimezoneOffset()` patterns (app.js:760-773)
- API calls: Modify `loadWeeklyStats()` to include `week_start` parameter (app.js:191-231)
- Panel headers: Follow existing panel header styling (styles.css:333-346)

**Approach:**
1. Add navigation UI to the Weekly Activity panel header (left: prev button, center: week label, right: next + Today buttons)
2. Add `currentWeekStart` to state, initialized from `sessionStorage` or current week's Monday
3. Add week calculation helpers: `getMonday(date)`, `formatWeekRange(monday)`
4. Modify `loadWeeklyStats()` to pass `week_start` (local Monday as YYYY-MM-DD) when not viewing current week
5. Add click handlers for navigation that update state, save to `sessionStorage`, and trigger data reload
6. Update `renderStatsCards()` to adjust "This Week" and "Today" labels based on whether viewing current week

**Week calculation:**
- Calculate local Monday using `getDay()` and adjusting for Monday=1 (ISO week)
- Pass the local Monday date as `week_start` to API (API handles UTC conversion via `tz_offset`)
- "Current week" means the week containing today in local time

**Dependencies:**
- Existing `/api/stats/weekly` endpoint already supports `week_start` parameter
- No backend changes required

**Out of Scope:**
- Month/year navigation or calendar picker
- Per-week caching (single cache key remains; stale cache shows loading state)
- Keyboard shortcuts for navigation
- URL query parameter state (no bookmarkable URLs)
- Disabling "Previous" button based on data existence

## Risks and Assumptions

- **Assumption:** Weeks start on Monday (ISO 8601 week, consistent with existing API behavior)
- **Assumption:** The `week_start` parameter should be the local Monday date; the API's `tz_offset` parameter handles the UTC boundary adjustment
- **Risk:** Cache mismatch when navigating between weeks while offline | **Mitigation:** Show loading indicator during navigation; accept that cached data may be from a different week in offline mode
- **Assumption:** Users primarily navigate to recent weeks; deep historical navigation (years back) is not a priority
