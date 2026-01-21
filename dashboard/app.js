/**
 * Horizon Dashboard Application
 *
 * Requirements covered:
 * - [8.1]-[8.5] Header and stat cards
 * - [9.1]-[9.6] Weekly activity timeline
 * - [10.1]-[10.5] Projects panel
 * - [11.1]-[11.5] Session detail
 * - [12.1]-[12.4] Agents panels
 * - [13.1]-[13.5] Data loading and caching
 */

// Project colors for consistent styling
const PROJECT_COLORS = [
  '#e5a84b', // amber
  '#3b82f6', // blue
  '#10b981', // green
  '#8b5cf6', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
];

// Agent styling configuration
const AGENT_CONFIG = {
  'claude-code': { class: 'claude', initial: 'C', label: 'Claude' },
  claude: { class: 'claude', initial: 'C', label: 'Claude' },
  copilot: { class: 'copilot', initial: 'Co', label: 'Copilot' },
  'copilot-cli': { class: 'copilot', initial: 'Co', label: 'Copilot' },
  kiro: { class: 'kiro', initial: 'K', label: 'Kiro' },
  'kiro-cli': { class: 'kiro', initial: 'K', label: 'Kiro' },
};

// Session storage key for week navigation
const WEEK_STORAGE_KEY = 'horizon-current-week';

// Application state
const state = {
  weeklyStats: null,
  selectedProject: null,
  projectSessions: [],
  lastSync: null,
  isOffline: false,
  apiKey: localStorage.getItem(CONFIG.API_KEY_STORAGE_KEY),
  projectColorMap: new Map(),
  currentWeekStart: loadWeekFromStorage() || getMonday(new Date()),
};

// DOM element cache
const elements = {};

/**
 * Initialize the application
 */
async function init() {
  cacheElements();
  setupEventListeners();

  if (!state.apiKey) {
    showApiKeySetup();
    return;
  }

  showDashboard();
  await loadWeeklyStats();
  render();

  // Auto-refresh every 5 minutes, only for current week (requirement 13.4)
  setInterval(() => {
    if (isCurrentWeek()) {
      loadWeeklyStats();
    }
  }, CONFIG.REFRESH_INTERVAL);
}

/**
 * Cache frequently accessed DOM elements
 */
function cacheElements() {
  elements.apiKeySetup = document.getElementById('api-key-setup');
  elements.apiKeyForm = document.getElementById('api-key-form');
  elements.apiKeyInput = document.getElementById('api-key-input');
  elements.setupError = document.getElementById('setup-error');
  elements.dashboard = document.getElementById('dashboard');
  elements.syncStatus = document.getElementById('sync-status');
  elements.offlineIndicator = document.getElementById('offline-indicator');
  elements.tooltip = document.getElementById('tooltip');

  // Stats
  elements.statThisWeekLabel = document.querySelector('.stat-card:nth-child(1) .stat-label');
  elements.statThisWeek = document.getElementById('stat-this-week');
  elements.statComparison = document.getElementById('stat-comparison');
  elements.statTodayLabel = document.querySelector('.stat-card:nth-child(2) .stat-label');
  elements.statTodayHours = document.getElementById('stat-today-hours');
  elements.statTodaySessions = document.getElementById('stat-today-sessions');
  elements.statTopAgent = document.getElementById('stat-top-agent');
  elements.statTopAgentHours = document.getElementById('stat-top-agent-hours');
  elements.statStreak = document.getElementById('stat-streak');

  // Week navigation
  elements.weekNav = document.getElementById('week-nav');
  elements.weekLabel = document.getElementById('week-label');
  elements.weekPrev = document.getElementById('week-prev');
  elements.weekNext = document.getElementById('week-next');
  elements.weekToday = document.getElementById('week-today');

  // Panels
  elements.weeklyChart = document.getElementById('weekly-chart');
  elements.projectsList = document.getElementById('projects-list');
  elements.sessionDetailPanel = document.getElementById('session-detail-panel');
  elements.sessionDetailTitle = document.getElementById('session-detail-title');
  elements.sessionsList = document.getElementById('sessions-list');
  elements.agentsChart = document.getElementById('agents-chart');
  elements.agentProjectList = document.getElementById('agent-project-list');
  elements.devicesChart = document.getElementById('devices-chart');
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // API key form submission
  elements.apiKeyForm.addEventListener('submit', handleApiKeySubmit);

  // Tooltip for weekly activity bars
  document.addEventListener('mousemove', handleTooltipMove);

  // Week navigation
  elements.weekPrev.addEventListener('click', navigateToPreviousWeek);
  elements.weekNext.addEventListener('click', navigateToNextWeek);
  elements.weekToday.addEventListener('click', navigateToCurrentWeek);
}

/**
 * Navigate to the previous week
 */
function navigateToPreviousWeek() {
  const newMonday = new Date(state.currentWeekStart);
  newMonday.setDate(newMonday.getDate() - 7);
  state.currentWeekStart = newMonday;
  saveWeekToStorage(newMonday);
  loadWeeklyStats();
}

/**
 * Navigate to the next week
 */
function navigateToNextWeek() {
  if (isCurrentWeek()) return;

  const newMonday = new Date(state.currentWeekStart);
  newMonday.setDate(newMonday.getDate() + 7);
  state.currentWeekStart = newMonday;
  saveWeekToStorage(newMonday);
  loadWeeklyStats();
}

/**
 * Navigate to the current week
 */
function navigateToCurrentWeek() {
  state.currentWeekStart = getMonday(new Date());
  saveWeekToStorage(state.currentWeekStart);
  loadWeeklyStats();
}

/**
 * Handle API key form submission
 */
async function handleApiKeySubmit(e) {
  e.preventDefault();

  const apiKey = elements.apiKeyInput.value.trim();
  if (!apiKey) return;

  // Test the API key
  const button = elements.apiKeyForm.querySelector('button');
  button.disabled = true;
  button.textContent = 'Connecting...';

  try {
    const tzOffset = getTimezoneOffset();
    const response = await fetch(
      `${CONFIG.API_URL}/api/stats/weekly?tz_offset=${tzOffset}`,
      {
        headers: { 'x-api-key': apiKey },
      }
    );

    if (response.status === 401 || response.status === 403) {
      showSetupError('Invalid API key');
      return;
    }

    if (!response.ok) {
      showSetupError('Failed to connect to API');
      return;
    }

    // Save API key and load dashboard
    state.apiKey = apiKey;
    localStorage.setItem(CONFIG.API_KEY_STORAGE_KEY, apiKey);

    showDashboard();
    state.weeklyStats = await response.json();
    state.lastSync = new Date();
    cacheData();
    render();
  } catch (error) {
    showSetupError('Failed to connect to API');
  } finally {
    button.disabled = false;
    button.textContent = 'Connect';
  }
}

/**
 * Show setup error message
 */
function showSetupError(message) {
  elements.setupError.textContent = message;
  elements.setupError.hidden = false;
}

/**
 * Show API key setup screen
 */
function showApiKeySetup() {
  elements.apiKeySetup.hidden = false;
  elements.dashboard.hidden = true;
}

/**
 * Show dashboard
 */
function showDashboard() {
  elements.apiKeySetup.hidden = true;
  elements.dashboard.hidden = false;
}

/**
 * Load weekly statistics from API (requirement 13.1)
 */
async function loadWeeklyStats() {
  updateSyncStatus('syncing');

  try {
    const tzOffset = getTimezoneOffset();
    console.log('[Horizon Debug] Timezone offset:', tzOffset, 'minutes');
    console.log('[Horizon Debug] Local time:', new Date().toString());

    // Build API URL with optional week_start for historical weeks
    let url = `${CONFIG.API_URL}/api/stats/weekly?tz_offset=${tzOffset}`;
    if (!isCurrentWeek()) {
      const weekStart = formatDateISO(state.currentWeekStart);
      url += `&week_start=${weekStart}`;
      console.log('[Horizon Debug] Fetching week starting:', weekStart);
    }

    const response = await fetch(url, {
      headers: { 'x-api-key': state.apiKey },
    });

    if (!response.ok) {
      throw new Error('API error');
    }

    state.weeklyStats = await response.json();
    console.log('[Horizon Debug] Daily breakdown:', state.weeklyStats.daily_breakdown);

    state.lastSync = new Date();
    state.isOffline = false;

    // Cache in localStorage (requirement 13.2)
    cacheData();

    updateSyncStatus('synced');
    render();
  } catch (error) {
    // Fall back to cached data (requirement 13.3)
    loadCachedData();

    if (state.weeklyStats) {
      state.isOffline = true;
      updateSyncStatus('offline');
      render();
    }
  }
}

/**
 * Cache data to localStorage
 */
function cacheData() {
  const cache = {
    weeklyStats: state.weeklyStats,
    cachedAt: state.lastSync.toISOString(),
  };
  localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(cache));
}

/**
 * Load cached data from localStorage
 */
function loadCachedData() {
  try {
    const cached = JSON.parse(localStorage.getItem(CONFIG.CACHE_KEY) || '{}');
    if (cached.weeklyStats) {
      state.weeklyStats = cached.weeklyStats;
      state.lastSync = new Date(cached.cachedAt);
    }
  } catch (error) {
    // Ignore cache errors
  }
}

/**
 * Update sync status indicator
 */
function updateSyncStatus(status) {
  const dot = elements.syncStatus.querySelector('.sync-dot');
  const text = elements.syncStatus.querySelector('.sync-text');

  dot.className = 'sync-dot';

  switch (status) {
    case 'syncing':
      dot.classList.add('syncing');
      text.textContent = 'Syncing...';
      break;
    case 'synced':
      text.textContent = formatRelativeTime(state.lastSync);
      break;
    case 'offline':
      dot.classList.add('offline');
      text.textContent = 'Offline';
      elements.offlineIndicator.hidden = false;
      break;
  }
}

/**
 * Main render function
 */
function render() {
  if (!state.weeklyStats) return;

  buildProjectColorMap();
  renderHeader();
  renderWeekNavigation();
  renderStatsCards();
  renderWeeklyActivity();
  renderProjectsList();
  renderSessionDetail();
  renderAgentsPanels();
  renderDevicesPanel();
  updateOfflineIndicator();
}

/**
 * Render week navigation controls
 */
function renderWeekNavigation() {
  // Update week label
  elements.weekLabel.textContent = formatWeekRange(state.currentWeekStart);

  // Update button states
  const onCurrentWeek = isCurrentWeek();

  // Disable next button when on current week
  elements.weekNext.disabled = onCurrentWeek;

  // Show/hide Today button based on whether viewing current week
  elements.weekToday.hidden = onCurrentWeek;
}

/**
 * Build color map for projects
 */
function buildProjectColorMap() {
  state.projectColorMap.clear();
  const projects = state.weeklyStats.projects || [];
  projects.forEach((project, index) => {
    state.projectColorMap.set(project.name, PROJECT_COLORS[index % PROJECT_COLORS.length]);
  });
}

/**
 * Render header (requirement 8.1, 8.2)
 */
function renderHeader() {
  // Update sync time
  if (state.lastSync && !state.isOffline) {
    const text = elements.syncStatus.querySelector('.sync-text');
    text.textContent = formatRelativeTime(state.lastSync);
  }
}

/**
 * Render stats cards (requirements 8.3, 8.4)
 */
function renderStatsCards() {
  const stats = state.weeklyStats;
  const onCurrentWeek = isCurrentWeek();

  // Update labels based on whether viewing current week
  if (onCurrentWeek) {
    elements.statThisWeekLabel.textContent = 'This Week';
    elements.statTodayLabel.textContent = 'Today';
  } else {
    elements.statThisWeekLabel.textContent = formatWeekRange(state.currentWeekStart);
    // For historical weeks, show the first day's name (Monday)
    elements.statTodayLabel.textContent = state.currentWeekStart.toLocaleDateString('en-US', { weekday: 'long' });
  }

  // This Week value
  elements.statThisWeek.textContent = formatHours(stats.total_hours);

  // Comparison to last week (requirement 8.4)
  const vsLastWeek = stats.comparison?.vs_last_week || 0;
  if (vsLastWeek !== 0) {
    const sign = vsLastWeek > 0 ? '+' : '';
    elements.statComparison.textContent = `${sign}${vsLastWeek.toFixed(1)}hrs vs last week`;
    elements.statComparison.className = vsLastWeek < 0 ? 'stat-comparison negative' : 'stat-comparison';
  } else {
    elements.statComparison.textContent = '--';
  }

  // Today / First day of week
  let dayData;
  if (onCurrentWeek) {
    const today = getTodayISO();
    dayData = stats.daily_breakdown?.find((d) => d.date === today);
  } else {
    // For historical weeks, show the first day (Monday)
    const firstDayISO = formatDateISO(state.currentWeekStart);
    dayData = stats.daily_breakdown?.find((d) => d.date === firstDayISO);
  }
  elements.statTodayHours.textContent = formatHours(dayData?.hours || 0);
  elements.statTodaySessions.textContent = `${dayData?.sessions || 0} sessions`;

  // Top Agent
  const topAgent = stats.agents?.[0];
  if (topAgent) {
    const config = getAgentConfig(topAgent.name);
    elements.statTopAgent.textContent = config.label;
    elements.statTopAgentHours.textContent = `${topAgent.hours.toFixed(1)} hrs`;
  } else {
    elements.statTopAgent.textContent = '--';
    elements.statTopAgentHours.textContent = '-- hrs';
  }

  // Streak
  elements.statStreak.textContent = stats.streak_days || 0;
}

/**
 * Render weekly activity timeline (requirements 9.1-9.6)
 */
function renderWeeklyActivity() {
  const stats = state.weeklyStats;
  const dailyBreakdown = stats.daily_breakdown || [];

  // Find max hours for scaling
  const maxHours = Math.max(...dailyBreakdown.map((d) => d.hours), 1);

  const html = dailyBreakdown.map((day) => {
    const date = new Date(day.date + 'T00:00:00Z');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const dayNum = date.getUTCDate();
    const isToday = day.date === getTodayISO();

    // Build segments for each project
    const segments = buildDaySegments(day, maxHours);

    return `
      <div class="day-row">
        <div class="day-label${isToday ? ' today' : ''}">${dayName} ${dayNum}</div>
        <div class="day-bar-container">
          ${segments}
        </div>
        <div class="day-hours">${day.hours.toFixed(1)}h</div>
      </div>
    `;
  }).join('');

  elements.weeklyChart.innerHTML = html;
}

/**
 * Build bar segments for a day's activity
 */
function buildDaySegments(day, maxHours) {
  if (day.hours === 0) {
    return '';
  }

  const widthPercent = (day.hours / maxHours) * 100;
  const projects = day.projects || [];

  // Use the day's actual project breakdown
  const totalProjectHours = projects.reduce((sum, p) => sum + p.hours, 0) || 1;

  return projects.map((project) => {
    const projectPercent = (project.hours / totalProjectHours) * widthPercent;
    if (projectPercent < 0.5) return '';

    const color = state.projectColorMap.get(project.name) || PROJECT_COLORS[0];
    return `
      <div
        class="day-bar-segment"
        style="width: ${projectPercent}%; background-color: ${color};"
        data-project="${escapeHtml(project.name)}"
        data-hours="${project.hours.toFixed(1)}"
        data-date="${escapeHtml(day.date)}"
      ></div>
    `;
  }).join('');
}

/**
 * Render projects list (requirements 10.1-10.5)
 */
function renderProjectsList() {
  const projects = state.weeklyStats.projects || [];

  if (projects.length === 0) {
    elements.projectsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">-</div>
        <div>No projects this week</div>
      </div>
    `;
    return;
  }

  const html = projects.map((project) => {
    const color = state.projectColorMap.get(project.name) || PROJECT_COLORS[0];
    const isSelected = state.selectedProject === project.name;

    return `
      <div
        class="project-item${isSelected ? ' selected' : ''}"
        data-project="${escapeHtml(project.name)}"
        onclick="selectProject('${escapeHtml(project.name)}')"
      >
        <div class="project-color" style="background-color: ${color};"></div>
        <div class="project-name">${escapeHtml(project.name)}</div>
        <div class="project-sessions">${project.sessions} sessions</div>
        <div class="project-hours">${project.hours.toFixed(1)}h</div>
      </div>
    `;
  }).join('');

  elements.projectsList.innerHTML = html;
}

/**
 * Select a project and load its sessions
 */
async function selectProject(projectName) {
  // Toggle selection
  if (state.selectedProject === projectName) {
    state.selectedProject = null;
    state.projectSessions = [];
    elements.sessionDetailPanel.hidden = true;
    renderProjectsList();
    return;
  }

  state.selectedProject = projectName;
  renderProjectsList();

  // Load sessions for this project
  try {
    const response = await fetch(
      `${CONFIG.API_URL}/api/projects/${encodeURIComponent(projectName)}/sessions?days=7`,
      { headers: { 'x-api-key': state.apiKey } }
    );

    if (response.ok) {
      const data = await response.json();
      state.projectSessions = data.sessions || [];
    } else {
      state.projectSessions = [];
    }
  } catch (error) {
    state.projectSessions = [];
  }

  renderSessionDetail();
}

/**
 * Render session detail panel (requirements 11.1-11.5)
 */
function renderSessionDetail() {
  if (!state.selectedProject) {
    elements.sessionDetailPanel.hidden = true;
    return;
  }

  elements.sessionDetailPanel.hidden = false;
  elements.sessionDetailTitle.textContent = `Sessions - ${state.selectedProject}`;

  if (state.projectSessions.length === 0) {
    elements.sessionsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">-</div>
        <div>No recent sessions</div>
      </div>
    `;
    return;
  }

  const html = state.projectSessions.map((session) => {
    const startTime = formatDateTime(session.start);
    const endTime = session.end ? formatTime(session.end) : 'now';
    const duration = session.end
      ? `${Math.round(session.active_minutes)}m`
      : 'active';
    const durationClass = session.end ? '' : 'active';

    const agentConfig = getAgentConfig(session.agent);

    return `
      <div class="session-item">
        <div class="session-time">${startTime} - ${endTime}</div>
        <div class="agent-badge ${agentConfig.class}">${agentConfig.label}</div>
        <div class="session-duration ${durationClass}">${duration}</div>
        <div class="session-machine">${escapeHtml(session.machine)}</div>
      </div>
    `;
  }).join('');

  elements.sessionsList.innerHTML = html;
}

/**
 * Render agents panels (requirements 12.1-12.4)
 */
function renderAgentsPanels() {
  renderAgentsChart();
  renderAgentProjectList();
}

/**
 * Render agents bar chart (requirements 12.1, 12.2)
 */
function renderAgentsChart() {
  const agents = state.weeklyStats.agents || [];

  if (agents.length === 0) {
    elements.agentsChart.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">-</div>
        <div>No agent data</div>
      </div>
    `;
    return;
  }

  const maxHours = Math.max(...agents.map((a) => a.hours), 1);

  const html = agents.map((agent) => {
    const config = getAgentConfig(agent.name);
    const widthPercent = (agent.hours / maxHours) * 100;

    return `
      <div class="agent-bar-row">
        <div class="agent-bar-name">${escapeHtml(config.label)}</div>
        <div class="agent-bar-container">
          <div class="agent-bar ${config.class}" style="width: ${widthPercent}%;"></div>
        </div>
        <div class="agent-bar-value">${agent.hours.toFixed(1)}h</div>
        <div class="agent-bar-percent">${agent.percentage}%</div>
      </div>
    `;
  }).join('');

  elements.agentsChart.innerHTML = html;
}

/**
 * Render agent x project list (requirements 12.3, 12.4)
 */
function renderAgentProjectList() {
  const agentProjects = state.weeklyStats.agent_projects || [];

  if (agentProjects.length === 0) {
    elements.agentProjectList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">-</div>
        <div>No data</div>
      </div>
    `;
    return;
  }

  const html = agentProjects.map((entry) => {
    const config = getAgentConfig(entry.agent);
    const projectNames = entry.projects.join(', ');

    return `
      <div class="agent-project-row">
        <div class="agent-project-icon ${escapeHtml(config.class)}">${escapeHtml(config.initial)}</div>
        <div class="agent-project-name">${escapeHtml(config.label)}</div>
        <div class="agent-project-projects">${escapeHtml(projectNames) || '--'}</div>
        <div class="agent-project-hours">${entry.hours.toFixed(1)}h</div>
      </div>
    `;
  }).join('');

  elements.agentProjectList.innerHTML = html;
}

/**
 * Render devices panel
 */
function renderDevicesPanel() {
  const machines = state.weeklyStats.machines || [];

  if (machines.length === 0) {
    elements.devicesChart.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">-</div>
        <div>No device data</div>
      </div>
    `;
    return;
  }

  const maxHours = Math.max(...machines.map((m) => m.hours), 1);

  const html = machines.map((machine) => {
    const widthPercent = (machine.hours / maxHours) * 100;

    return `
      <div class="device-bar-row">
        <div class="device-bar-name">${escapeHtml(machine.name)}</div>
        <div class="device-bar-container">
          <div class="device-bar" style="width: ${widthPercent}%;"></div>
        </div>
        <div class="device-bar-value">${machine.hours.toFixed(1)}h</div>
        <div class="device-bar-percent">${machine.percentage}%</div>
      </div>
    `;
  }).join('');

  elements.devicesChart.innerHTML = html;
}

/**
 * Update offline indicator visibility
 */
function updateOfflineIndicator() {
  elements.offlineIndicator.hidden = !state.isOffline;
}

/**
 * Handle tooltip movement for weekly activity segments
 */
function handleTooltipMove(e) {
  const segment = e.target.closest('.day-bar-segment');

  if (!segment) {
    elements.tooltip.hidden = true;
    return;
  }

  const project = segment.dataset.project;
  const hours = segment.dataset.hours;

  const content = elements.tooltip.querySelector('.tooltip-content');
  content.innerHTML = `
    <div class="tooltip-project">${escapeHtml(project)}</div>
    <div class="tooltip-details">${hours}h</div>
  `;

  elements.tooltip.hidden = false;
  elements.tooltip.style.left = `${e.pageX + 12}px`;
  elements.tooltip.style.top = `${e.pageY - 10}px`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the Monday of the week containing the given date (ISO 8601 week)
 * @param {Date} date
 * @returns {Date} Monday at midnight in local time
 */
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  // day 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  // For ISO week, Monday = 0, so adjust: Sunday becomes -6, others subtract (day - 1)
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format a week range for display (e.g., "Jan 13 - 19" or "Jan 27 - Feb 2")
 * @param {Date} monday - The Monday starting the week
 * @returns {string}
 */
function formatWeekRange(monday) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startMonth = monday.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = sunday.toLocaleDateString('en-US', { month: 'short' });
  const startDay = monday.getDate();
  const endDay = sunday.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

/**
 * Check if the current state is viewing the current week
 * Compares by date components to avoid DST offset issues
 * @returns {boolean}
 */
function isCurrentWeek() {
  const currentMonday = getMonday(new Date());
  const stateMonday = state.currentWeekStart;
  return (
    stateMonday.getFullYear() === currentMonday.getFullYear() &&
    stateMonday.getMonth() === currentMonday.getMonth() &&
    stateMonday.getDate() === currentMonday.getDate()
  );
}

/**
 * Load week from sessionStorage
 * @returns {Date|null}
 */
function loadWeekFromStorage() {
  try {
    const stored = sessionStorage.getItem(WEEK_STORAGE_KEY);
    if (stored) {
      const date = new Date(stored);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  } catch (e) {
    // Ignore storage errors
  }
  return null;
}

/**
 * Save week to sessionStorage
 * @param {Date} monday
 */
function saveWeekToStorage(monday) {
  try {
    sessionStorage.setItem(WEEK_STORAGE_KEY, monday.toISOString());
  } catch (e) {
    // Ignore storage errors
  }
}

/**
 * Format date as YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get agent configuration
 */
function getAgentConfig(agentName) {
  const normalized = (agentName || '').toLowerCase().replace(/[^a-z]/g, '');
  return AGENT_CONFIG[normalized] || AGENT_CONFIG[agentName] || {
    class: 'default',
    initial: (agentName || '?')[0].toUpperCase(),
    label: agentName || 'Unknown',
  };
}

/**
 * Format hours for display
 */
function formatHours(hours) {
  if (hours === undefined || hours === null) return '--';
  return `${hours.toFixed(1)}h`;
}

/**
 * Format time from ISO string (HH:MM)
 */
function formatTime(isoString) {
  if (!isoString) return '--';
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format date and time from ISO string (e.g., "Mon 14:30")
 */
function formatDateTime(isoString) {
  if (!isoString) return '--';
  const date = new Date(isoString);
  const day = date.toLocaleDateString('en-US', { weekday: 'short' });
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day} ${time}`;
}

/**
 * Format relative time (e.g., "2m ago")
 */
function formatRelativeTime(date) {
  if (!date) return '--';

  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
/**
 * Get the user's timezone offset in minutes from UTC
 * (e.g., -480 for PST, 600 for AEST)
 */
function getTimezoneOffset() {
  return -new Date().getTimezoneOffset();
}

/**
 * Get today's date in YYYY-MM-DD format using local calendar date
 */
function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================================
// Initialize
// ============================================================================

document.addEventListener('DOMContentLoaded', init);
