/**
 * Mock Data Generator for Horizon Dashboard
 *
 * Provides realistic sample data for local development and UI testing.
 * Enable by setting CONFIG.DEMO_MODE = true in config.js
 */

const MOCK_PROJECTS = [
  'horizon',
  'claude-mcp-tools',
  'personal-site',
  'api-gateway',
  'data-pipeline',
];

const MOCK_AGENTS = ['claude-code', 'copilot', 'kiro'];

const MOCK_MACHINES = ['MacBook-Pro', 'iMac-Studio'];

/**
 * Generate mock weekly statistics
 * @param {Date} weekStart - Monday of the week to generate data for
 * @returns {object} WeeklyStats object
 */
function generateMockWeeklyStats(weekStart) {
  const monday = weekStart || getMonday(new Date());
  const dailyBreakdown = generateDailyBreakdown(monday);

  const totalHours = dailyBreakdown.reduce((sum, d) => sum + d.hours, 0);
  const totalSessions = dailyBreakdown.reduce((sum, d) => sum + d.sessions, 0);

  // Aggregate projects from daily breakdown
  const projectMap = new Map();
  dailyBreakdown.forEach((day) => {
    day.projects.forEach((p) => {
      const existing = projectMap.get(p.name) || { hours: 0, sessions: 0 };
      existing.hours += p.hours;
      existing.sessions += p.sessions;
      projectMap.set(p.name, existing);
    });
  });

  const projects = Array.from(projectMap.entries())
    .map(([name, data]) => ({ name, hours: roundHours(data.hours), sessions: data.sessions }))
    .sort((a, b) => b.hours - a.hours);

  // Generate agent breakdown
  const agents = generateAgentBreakdown(totalHours);

  // Generate machine breakdown
  const machines = generateMachineBreakdown(totalHours);

  // Generate agent x project mapping
  const agentProjects = generateAgentProjects(projects, agents);

  // Calculate streak (random 1-7 for demo)
  const streakDays = Math.floor(Math.random() * 7) + 1;

  // Comparison to last week (-3 to +5 hours)
  const vsLastWeek = roundHours((Math.random() * 8) - 3);

  return {
    total_hours: roundHours(totalHours),
    total_sessions: totalSessions,
    streak_days: streakDays,
    daily_breakdown: dailyBreakdown,
    projects,
    agents,
    machines,
    agent_projects: agentProjects,
    comparison: {
      vs_last_week: vsLastWeek,
    },
  };
}

/**
 * Generate daily breakdown for a week
 * @param {Date} monday - Monday of the week
 * @returns {Array} Array of daily data
 */
function generateDailyBreakdown(monday) {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);

    // No data for future days
    if (date > today) {
      days.push({
        date: formatDateISO(date),
        hours: 0,
        sessions: 0,
        projects: [],
      });
      continue;
    }

    // Generate realistic hours (0-10 hours per day, weekends less)
    const isWeekend = i >= 5;
    const baseHours = isWeekend ? Math.random() * 4 : Math.random() * 8 + 1;
    const hours = roundHours(baseHours);

    // Generate sessions (roughly 1 session per 2 hours)
    const sessions = Math.max(1, Math.floor(hours / 2) + Math.floor(Math.random() * 2));

    // Distribute hours across 1-3 projects
    const projectCount = Math.min(MOCK_PROJECTS.length, Math.floor(Math.random() * 3) + 1);
    const dayProjects = generateDayProjects(hours, sessions, projectCount);

    days.push({
      date: formatDateISO(date),
      hours,
      sessions,
      projects: dayProjects,
    });
  }

  return days;
}

/**
 * Generate project breakdown for a single day
 */
function generateDayProjects(totalHours, totalSessions, count) {
  if (totalHours === 0) return [];

  const shuffled = [...MOCK_PROJECTS].sort(() => Math.random() - 0.5);
  const selectedProjects = shuffled.slice(0, count);

  // Distribute hours unevenly (first project gets more)
  const weights = selectedProjects.map((_, i) => 1 / (i + 1));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  return selectedProjects.map((name, i) => {
    const proportion = weights[i] / totalWeight;
    return {
      name,
      hours: roundHours(totalHours * proportion),
      sessions: Math.max(1, Math.round(totalSessions * proportion)),
    };
  });
}

/**
 * Generate agent breakdown
 */
function generateAgentBreakdown(totalHours) {
  // Claude gets 60-80%, rest split among others
  const claudePercent = 60 + Math.floor(Math.random() * 20);
  const remaining = 100 - claudePercent;

  const agents = [
    {
      name: 'claude-code',
      hours: roundHours(totalHours * claudePercent / 100),
      percentage: claudePercent,
    },
  ];

  // Add 1-2 other agents
  const otherAgents = MOCK_AGENTS.filter(a => a !== 'claude-code');
  const otherCount = Math.floor(Math.random() * 2) + 1;

  if (otherCount === 1) {
    agents.push({
      name: otherAgents[0],
      hours: roundHours(totalHours * remaining / 100),
      percentage: remaining,
    });
  } else {
    const split = Math.floor(remaining / 2);
    otherAgents.forEach((agent, i) => {
      const pct = i === 0 ? split : remaining - split;
      agents.push({
        name: agent,
        hours: roundHours(totalHours * pct / 100),
        percentage: pct,
      });
    });
  }

  return agents.sort((a, b) => b.hours - a.hours);
}

/**
 * Generate machine breakdown
 */
function generateMachineBreakdown(totalHours) {
  // Usually one machine dominates
  const primaryPercent = 80 + Math.floor(Math.random() * 20);

  if (primaryPercent >= 95 || MOCK_MACHINES.length === 1) {
    return [{
      name: MOCK_MACHINES[0],
      hours: roundHours(totalHours),
      percentage: 100,
    }];
  }

  return [
    {
      name: MOCK_MACHINES[0],
      hours: roundHours(totalHours * primaryPercent / 100),
      percentage: primaryPercent,
    },
    {
      name: MOCK_MACHINES[1],
      hours: roundHours(totalHours * (100 - primaryPercent) / 100),
      percentage: 100 - primaryPercent,
    },
  ];
}

/**
 * Generate agent x project mapping
 */
function generateAgentProjects(projects, agents) {
  return agents.map((agent) => {
    // Each agent works on 1-3 projects
    const count = Math.min(projects.length, Math.floor(Math.random() * 3) + 1);
    const agentProjectNames = projects.slice(0, count).map(p => p.name);

    return {
      agent: agent.name,
      projects: agentProjectNames,
      hours: agent.hours,
    };
  });
}

/**
 * Generate mock sessions for a project
 * @param {string} projectName - Name of the project
 * @param {Date} weekStart - Monday of the week
 * @returns {object} Sessions response
 */
function generateMockSessions(projectName, weekStart) {
  const monday = weekStart || getMonday(new Date());
  const sessions = [];
  const today = new Date();

  // Generate 3-8 sessions for the past 7 days
  const sessionCount = Math.floor(Math.random() * 6) + 3;

  for (let i = 0; i < sessionCount; i++) {
    // Random day within the week (0-6, but not future)
    const dayOffset = Math.floor(Math.random() * 7);
    const sessionDate = new Date(monday);
    sessionDate.setDate(monday.getDate() + dayOffset);

    if (sessionDate > today) continue;

    // Random start time (8am - 8pm)
    const startHour = 8 + Math.floor(Math.random() * 12);
    const startMinute = Math.floor(Math.random() * 60);
    sessionDate.setHours(startHour, startMinute, 0, 0);

    // Session duration (15-180 minutes active time)
    const activeMinutes = 15 + Math.floor(Math.random() * 165);
    const spanMinutes = activeMinutes + Math.floor(Math.random() * 30); // span >= active

    const endDate = new Date(sessionDate.getTime() + spanMinutes * 60 * 1000);

    // Most sessions are completed, some might be "active"
    const isActive = i === 0 && Math.random() > 0.8;

    sessions.push({
      session_id: `mock-${projectName}-${i}-${Date.now()}`,
      project: projectName,
      start: sessionDate.toISOString(),
      end: isActive ? null : endDate.toISOString(),
      span_minutes: spanMinutes,
      active_minutes: activeMinutes,
      machine: MOCK_MACHINES[Math.floor(Math.random() * MOCK_MACHINES.length)],
      agent: MOCK_AGENTS[Math.floor(Math.random() * MOCK_AGENTS.length)],
      interaction_count: Math.floor(activeMinutes / 5) + Math.floor(Math.random() * 10),
      explicit_end: !isActive && Math.random() > 0.3,
    });
  }

  // Sort by start time descending (most recent first)
  sessions.sort((a, b) => new Date(b.start) - new Date(a.start));

  return {
    project: projectName,
    sessions,
  };
}

/**
 * Helper: Round hours to 1 decimal place
 */
function roundHours(hours) {
  return Math.round(hours * 10) / 10;
}

/**
 * Helper: Format date as YYYY-MM-DD (duplicated for standalone use)
 */
function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper: Get Monday of the week (duplicated for standalone use)
 */
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
