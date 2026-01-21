import type {
  Interaction,
  Session,
  WeeklyStats,
  DailyBreakdown,
  ProjectSummary,
  AgentSummary,
  MachineSummary,
  AgentProjectSummary,
  ProjectStats,
} from "../types";
import { calculateSessions } from "./sessions";

/**
 * Calculates weekly statistics from interactions.
 *
 * Requirements covered:
 * - [3.3] total_hours - total active time for the week
 * - [3.4] total_sessions - count of distinct sessions
 * - [3.5] streak_days - consecutive days with sessions
 * - [3.6] daily_breakdown - each day's date, hours, session count
 * - [3.7] projects - each project's name, hours, session count
 * - [3.8] agents - each agent's name, hours, percentage
 * - [3.9] comparison.vs_last_week - hour difference (returns 0 in v1)
 * - [3.10] Uses UTC for all date calculations, with optional timezone offset for display grouping
 *
 * @param timezoneOffset - Optional timezone offset in minutes from UTC (e.g., -480 for PST, 600 for AEST)
 */
export function calculateWeeklyStats(
  interactions: Interaction[],
  weekStart: Date,
  timezoneOffset: number = 0
): WeeklyStats {
  const sessions = calculateSessions(interactions);

  // Total active hours from all sessions
  const totalMinutes = sessions.reduce((sum, s) => sum + s.active_minutes, 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  // Daily breakdown for 7 days
  const dailyBreakdown = calculateDailyBreakdown(sessions, weekStart, timezoneOffset);

  // Project breakdown
  const projects = calculateProjectBreakdown(sessions);

  // Agent breakdown
  const agents = calculateAgentBreakdown(sessions, totalHours);

  // Machine breakdown
  const machines = calculateMachineBreakdown(sessions, totalHours);

  // Agent-project breakdown
  const agentProjects = calculateAgentProjectBreakdown(sessions);

  // Streak calculation
  const streakDays = calculateStreak(interactions, timezoneOffset);

  return {
    total_hours: totalHours,
    total_sessions: sessions.length,
    streak_days: streakDays,
    daily_breakdown: dailyBreakdown,
    projects,
    agents,
    machines,
    agent_projects: agentProjects,
    comparison: {
      // v1 returns 0 for vs_last_week (see design doc limitations)
      vs_last_week: 0,
    },
  };
}

/**
 * Calculates daily breakdown of sessions for a 7-day period.
 *
 * Each entry contains the date, total hours, session count, and per-project breakdown.
 * Sessions are attributed to the day of their start timestamp.
 *
 * Requirements covered:
 * - [3.6] daily_breakdown with date, hours, sessions
 * - [3.10] UTC date boundaries with optional timezone offset for local grouping
 *
 * @param timezoneOffset - Timezone offset in minutes from UTC (e.g., -480 for PST, 600 for AEST)
 */
export function calculateDailyBreakdown(
  sessions: Session[],
  weekStart: Date,
  timezoneOffset: number = 0
): DailyBreakdown[] {
  const breakdown: DailyBreakdown[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setUTCDate(date.getUTCDate() + i);
    const dateStr = date.toISOString().split("T")[0];

    // Filter sessions that started on this day (accounting for timezone offset)
    const daySessions = sessions.filter((s) => {
      // Parse the session start timestamp
      const sessionDate = new Date(s.start);
      // Apply timezone offset to get local time
      const localDate = new Date(sessionDate.getTime() + timezoneOffset * 60000);
      // Extract local date string
      const localDateStr = localDate.toISOString().split("T")[0];
      return localDateStr === dateStr;
    });

    // Sum active minutes
    const totalMinutes = daySessions.reduce(
      (sum, s) => sum + s.active_minutes,
      0
    );
    const hours = Math.round((totalMinutes / 60) * 10) / 10;

    // Calculate per-project breakdown for this day
    const projects = calculateProjectBreakdown(daySessions);

    breakdown.push({
      date: dateStr,
      hours,
      sessions: daySessions.length,
      projects,
    });
  }

  return breakdown;
}

/**
 * Calculates project breakdown from sessions.
 *
 * Groups sessions by project name and aggregates hours and session count.
 * Returns projects sorted by hours descending.
 *
 * Requirements covered:
 * - [3.7] projects array with name, hours, sessions
 * - [4.5] sorted by total_hours descending
 */
export function calculateProjectBreakdown(sessions: Session[]): ProjectSummary[] {
  const projectMap = new Map<string, { hours: number; sessions: number }>();

  for (const session of sessions) {
    const existing = projectMap.get(session.project) || {
      hours: 0,
      sessions: 0,
    };
    existing.hours += session.active_minutes / 60;
    existing.sessions += 1;
    projectMap.set(session.project, existing);
  }

  return Array.from(projectMap.entries())
    .map(([name, data]) => ({
      name,
      hours: Math.round(data.hours * 10) / 10,
      sessions: data.sessions,
    }))
    .sort((a, b) => b.hours - a.hours);
}

/**
 * Calculates agent breakdown from sessions.
 *
 * Groups sessions by agent name, calculates hours and percentage of total.
 * Returns agents sorted by hours descending.
 *
 * Requirements covered:
 * - [3.8] agents array with name, hours, percentage
 */
export function calculateAgentBreakdown(
  sessions: Session[],
  totalHours: number
): AgentSummary[] {
  const agentMap = new Map<string, number>();

  for (const session of sessions) {
    const existing = agentMap.get(session.agent) || 0;
    agentMap.set(session.agent, existing + session.active_minutes / 60);
  }

  return Array.from(agentMap.entries())
    .map(([name, hours]) => ({
      name,
      hours: Math.round(hours * 10) / 10,
      percentage:
        totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0,
    }))
    .sort((a, b) => b.hours - a.hours);
}

/**
 * Calculates machine breakdown from sessions.
 *
 * Groups sessions by machine hostname, calculates hours and percentage of total.
 * Returns machines sorted by hours descending.
 */
export function calculateMachineBreakdown(
  sessions: Session[],
  totalHours: number
): MachineSummary[] {
  const machineMap = new Map<string, number>();

  for (const session of sessions) {
    const existing = machineMap.get(session.machine) || 0;
    machineMap.set(session.machine, existing + session.active_minutes / 60);
  }

  return Array.from(machineMap.entries())
    .map(([name, hours]) => ({
      name,
      hours: Math.round(hours * 10) / 10,
      percentage:
        totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0,
    }))
    .sort((a, b) => b.hours - a.hours);
}

/**
 * Calculates agent-project breakdown from sessions.
 *
 * Groups sessions by agent, collecting the projects each agent worked on
 * and the total hours for that agent.
 * Returns agents sorted by hours descending.
 */
export function calculateAgentProjectBreakdown(
  sessions: Session[]
): AgentProjectSummary[] {
  const agentMap = new Map<string, { projects: Set<string>; minutes: number }>();

  for (const session of sessions) {
    const existing = agentMap.get(session.agent) || {
      projects: new Set<string>(),
      minutes: 0,
    };
    existing.projects.add(session.project);
    existing.minutes += session.active_minutes;
    agentMap.set(session.agent, existing);
  }

  return Array.from(agentMap.entries())
    .map(([agent, data]) => ({
      agent,
      projects: Array.from(data.projects).sort(),
      hours: Math.round((data.minutes / 60) * 10) / 10,
    }))
    .sort((a, b) => b.hours - a.hours);
}

/**
 * Calculates the streak of consecutive days with at least one interaction.
 *
 * Counts backwards from today (or yesterday if no activity today).
 * A day is counted if it has at least one interaction.
 *
 * Requirements covered:
 * - [3.5] streak_days - consecutive days with sessions
 * - [3.10] UTC date boundaries with optional timezone offset for local grouping
 *
 * @param timezoneOffset - Timezone offset in minutes from UTC (e.g., -480 for PST, 600 for AEST)
 */
export function calculateStreak(interactions: Interaction[], timezoneOffset: number = 0): number {
  if (interactions.length === 0) {
    return 0;
  }

  // Get unique dates with interactions (in local timezone)
  const datesWithActivity = new Set<string>();
  for (const interaction of interactions) {
    const interactionDate = new Date(interaction.timestamp);
    const localDate = new Date(interactionDate.getTime() + timezoneOffset * 60000);
    datesWithActivity.add(localDate.toISOString().split("T")[0]);
  }

  // Count consecutive days going backwards from today (in local timezone)
  const today = new Date();
  const localToday = new Date(today.getTime() + timezoneOffset * 60000);
  localToday.setUTCHours(0, 0, 0, 0);

  let streak = 0;

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(localToday);
    checkDate.setUTCDate(checkDate.getUTCDate() - i);
    const dateStr = checkDate.toISOString().split("T")[0];

    if (datesWithActivity.has(dateStr)) {
      streak++;
    } else if (i > 0) {
      // Allow today to be missing (not yet coded today)
      // But if a day after today is missing, break the streak
      break;
    }
  }

  return streak;
}

/**
 * Calculates project statistics with agent breakdown.
 *
 * Used by GET /api/stats/projects endpoint.
 * Returns projects sorted by total_hours descending.
 *
 * Requirements covered:
 * - [4.1] GET /api/stats/projects response format
 * - [4.3] name, total_hours, total_sessions, agents breakdown
 * - [4.4] agents field maps agent names to hours
 * - [4.5] sorted by total_hours descending
 */
export function calculateProjectStats(interactions: Interaction[]): ProjectStats[] {
  if (interactions.length === 0) {
    return [];
  }

  const sessions = calculateSessions(interactions);

  // Group sessions by project
  const projectMap = new Map<
    string,
    {
      sessions: Session[];
      totalMinutes: number;
      agentMinutes: Map<string, number>;
    }
  >();

  for (const session of sessions) {
    const existing = projectMap.get(session.project) || {
      sessions: [],
      totalMinutes: 0,
      agentMinutes: new Map<string, number>(),
    };

    existing.sessions.push(session);
    existing.totalMinutes += session.active_minutes;

    const currentAgentMinutes = existing.agentMinutes.get(session.agent) || 0;
    existing.agentMinutes.set(
      session.agent,
      currentAgentMinutes + session.active_minutes
    );

    projectMap.set(session.project, existing);
  }

  // Convert to ProjectStats array
  const projectStats: ProjectStats[] = Array.from(projectMap.entries()).map(
    ([name, data]) => {
      // Convert agent minutes to hours
      const agents: Record<string, number> = {};
      for (const [agentName, minutes] of data.agentMinutes) {
        agents[agentName] = Math.round((minutes / 60) * 10) / 10;
      }

      return {
        name,
        total_hours: Math.round((data.totalMinutes / 60) * 10) / 10,
        total_sessions: data.sessions.length,
        agents,
      };
    }
  );

  // Sort by total_hours descending
  return projectStats.sort((a, b) => b.total_hours - a.total_hours);
}
