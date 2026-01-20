import { Hono } from "hono";
import type { Interaction } from "../types";
import { calculateSessions } from "../services/sessions";
import {
  calculateWeeklyStats,
  calculateProjectStats,
} from "../services/statistics";

type Bindings = {
  DB: D1Database;
  API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * Gets the Monday (start of week) for a given date in UTC.
 */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  // Calculate days to subtract to get to Monday
  // Sunday is 0, so we need to go back 6 days
  // Monday is 1, so we need to go back 0 days, etc.
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * GET /stats/weekly - Get weekly statistics
 *
 * Returns weekly aggregated statistics including totals, daily breakdown,
 * project breakdown, agent breakdown, and streak.
 *
 * Query parameters:
 * - week_start: string (optional) - ISO date (YYYY-MM-DD) for week start, defaults to current week's Monday
 * - tz_offset: number (optional) - Timezone offset in minutes from UTC (e.g., -480 for PST, 600 for AEST)
 *
 * Response:
 * - total_hours: number - Total active hours for the week
 * - total_sessions: number - Total number of sessions
 * - streak_days: number - Consecutive days with sessions
 * - daily_breakdown: array - Each day's date, hours, session count (grouped by local date if tz_offset provided)
 * - projects: array - Each project's name, hours, session count
 * - agents: array - Each agent's name, hours, percentage
 * - comparison: object - { vs_last_week: number }
 *
 * Requirements covered:
 * - [3.1] GET /api/stats/weekly endpoint
 * - [3.2] Optional week_start parameter
 * - [3.3]-[3.9] Response structure
 * - [3.10] UTC for all calculations, with optional timezone offset for grouping
 */
app.get("/stats/weekly", async (c) => {
  const weekStartParam = c.req.query("week_start");
  const tzOffsetParam = c.req.query("tz_offset");

  // Parse timezone offset (default to 0 for UTC)
  const timezoneOffset = tzOffsetParam ? parseInt(tzOffsetParam, 10) : 0;

  // Parse week_start or default to current week's Monday (requirement 3.2, 3.10)
  let weekStart: Date;
  if (weekStartParam) {
    // Interpret as YYYY-MM-DDT00:00:00Z (requirement 3.10)
    weekStart = new Date(weekStartParam + "T00:00:00Z");
  } else {
    // Get Monday in the user's local timezone
    const now = new Date();
    const localNow = new Date(now.getTime() + timezoneOffset * 60000);
    weekStart = getMonday(localNow);
  }

  // Adjust query boundaries to account for timezone offset
  // For UTC+10, Monday 00:00 local = Sunday 14:00 UTC
  // So we need to query starting from Sunday 14:00 UTC
  const queryStart = new Date(weekStart.getTime() - timezoneOffset * 60000);
  const queryEnd = new Date(queryStart);
  queryEnd.setUTCDate(queryEnd.getUTCDate() + 7);

  // Query interactions for the week (adjusted for timezone)
  const { results: interactions } = await c.env.DB.prepare(
    `
    SELECT * FROM interactions
    WHERE timestamp >= ? AND timestamp < ?
    ORDER BY timestamp ASC
  `
  )
    .bind(queryStart.toISOString(), queryEnd.toISOString())
    .all<Interaction>();

  // Calculate statistics with timezone offset
  const stats = calculateWeeklyStats(interactions, weekStart, timezoneOffset);

  return c.json(stats);
});

/**
 * GET /stats/projects - Get project statistics
 *
 * Returns statistics for all projects over a time period.
 *
 * Query parameters:
 * - days: number (optional) - Number of days to look back, defaults to 30
 *
 * Response:
 * - projects: array - Each project's name, total_hours, total_sessions, agents breakdown
 *
 * Requirements covered:
 * - [4.1] GET /api/stats/projects endpoint
 * - [4.2] Optional days parameter (default 30)
 * - [4.3] Response includes name, total_hours, total_sessions, agents
 * - [4.4] agents maps agent names to hours
 * - [4.5] Sorted by total_hours descending
 */
app.get("/stats/projects", async (c) => {
  const days = parseInt(c.req.query("days") || "30", 10);

  // Calculate start date (set UTC time first to avoid off-by-one at day boundaries)
  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(startDate.getUTCDate() - days);

  // Query interactions
  const { results: interactions } = await c.env.DB.prepare(
    `
    SELECT * FROM interactions
    WHERE timestamp >= ?
    ORDER BY timestamp ASC
  `
  )
    .bind(startDate.toISOString())
    .all<Interaction>();

  // Calculate project statistics
  const projects = calculateProjectStats(interactions);

  return c.json({ projects });
});

/**
 * GET /projects/:name/sessions - Get sessions for a specific project
 *
 * Returns individual sessions for a project over a time period.
 *
 * Path parameters:
 * - name: string - Project name
 *
 * Query parameters:
 * - days: number (optional) - Number of days to look back, defaults to 7
 *
 * Response:
 * - project: string - Project name
 * - sessions: array - Each session's details
 *
 * Requirements covered:
 * - [5.1] GET /api/projects/:name/sessions endpoint
 * - [5.2] Optional days parameter (default 7)
 * - [5.3] Response includes project name and sessions array
 * - [5.4] Session structure with all required fields
 * - [5.5] Sessions sorted by start descending
 * - [5.6] 404 for non-existent project
 * - [5.7] Active sessions have null end
 */
app.get("/projects/:name/sessions", async (c) => {
  const projectName = c.req.param("name");
  const days = parseInt(c.req.query("days") || "7", 10);

  // Calculate start date (set UTC time first to avoid off-by-one at day boundaries)
  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(startDate.getUTCDate() - days);

  // Query interactions for this project
  const { results: interactions } = await c.env.DB.prepare(
    `
    SELECT * FROM interactions
    WHERE project = ? AND timestamp >= ?
    ORDER BY timestamp ASC
  `
  )
    .bind(projectName, startDate.toISOString())
    .all<Interaction>();

  // If no interactions in time period, check if project exists at all
  if (interactions.length === 0) {
    const { results: exists } = await c.env.DB.prepare(
      `
      SELECT 1 FROM interactions WHERE project = ? LIMIT 1
    `
    )
      .bind(projectName)
      .all();

    // Project doesn't exist at all - 404 (requirement 5.6)
    if (exists.length === 0) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Project exists but no recent sessions
    return c.json({ project: projectName, sessions: [] });
  }

  // Calculate sessions (already sorted by start descending)
  const sessions = calculateSessions(interactions);

  return c.json({ project: projectName, sessions });
});

export default app;
