---
references:
    - specs/week-navigation/smolspec.md
---
# Week Navigation

- [x] 1. Navigation UI renders in Weekly Activity panel header
  - Add prev/next buttons
  - week label
  - and Today button to the Weekly Activity panel. Today button only visible when viewing past weeks. Next button disabled when on current week.

- [x] 2. Week state management tracks selected week
  - Add currentWeekStart to state object. Initialize from sessionStorage or current Monday. Persist to sessionStorage on navigation. Include helper functions: getMonday(date)
  - formatWeekRange(monday)
  - isCurrentWeek().

- [x] 3. API requests include week_start parameter
  - Modify loadWeeklyStats() to pass week_start (YYYY-MM-DD format) when not viewing current week. Verify data loads correctly for past weeks.

- [x] 4. Navigation buttons trigger data reload
  - Click handlers for prev/next/today update state.currentWeekStart
  - save to sessionStorage
  - and call loadWeeklyStats(). Verify navigation works forward and backward through weeks.

- [x] 5. Stat card labels adapt to selected week
  - Update renderStatsCards() to change This Week label to week date range (e.g.
  - Jan 6 - 12) and Today label to day name (e.g.
  - Monday) when viewing historical weeks.

- [x] 6. Navigation controls styled consistently with dashboard
  - Style nav buttons following existing button patterns. Week label uses text-secondary color. Disabled state for Next button. Ensure responsive layout in panel header.

- [x] 7. Week persistence survives page refresh
  - Verify sessionStorage persistence: refresh page while viewing past week
  - confirm same week loads. Open new tab
  - confirm it starts on current week (sessionStorage is per-tab).
