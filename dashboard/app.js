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
  cursor: { class: 'cursor', initial: 'Cu', label: 'Cursor' },
  copilot: { class: 'copilot', initial: 'Co', label: 'Copilot' },
  aider: { class: 'aider', initial: 'A', label: 'Aider' },
};

// Application state
const state = {
  weeklyStats: null,
  selectedProject: null,
  projectSessions: [],
  lastSync: null,
  isOffline: false,
  apiKey: localStorage.getItem(CONFIG.API_KEY_STORAGE_KEY),
  projectColorMap: new Map(),
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

  // Auto-refresh every 5 minutes (requirement 13.4)
  setInterval(loadWeeklyStats, CONFIG.REFRESH_INTERVAL);
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
  elements.machineName = document.getElementById('machine-name');
  elements.syncStatus = document.getElementById('sync-status');
  elements.offlineIndicator = document.getElementById('offline-indicator');
  elements.tooltip = document.getElementById('tooltip');

  // Stats
  elements.statThisWeek = document.getElementById('stat-this-week');
  elements.statComparison = document.getElementById('stat-comparison');
  elements.statTodayHours = document.getElementById('stat-today-hours');
  elements.statTodaySessions = document.getElementById('stat-today-sessions');
  elements.statTopAgent = document.getElementById('stat-top-agent');
  elements.statTopAgentHours = document.getElementById('stat-top-agent-hours');
  elements.statStreak = document.getElementById('stat-streak');

  // Panels
  elements.weeklyChart = document.getElementById('weekly-chart');
  elements.projectsList = document.getElementById('projects-list');
  elements.sessionDetailPanel = document.getElementById('session-detail-panel');
  elements.sessionDetailTitle = document.getElementById('session-detail-title');
  elements.sessionsList = document.getElementById('sessions-list');
  elements.agentsChart = document.getElementById('agents-chart');
  elements.agentProjectList = document.getElementById('agent-project-list');
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // API key form submission
  elements.apiKeyForm.addEventListener('submit', handleApiKeySubmit);

  // Tooltip for weekly activity bars
  document.addEventListener('mousemove', handleTooltipMove);
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
    const response = await fetch(`${CONFIG.API_URL}/api/stats/weekly`, {
      headers: { 'x-api-key': apiKey },
    });

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
    const response = await fetch(`${CONFIG.API_URL}/api/stats/weekly`, {
      headers: { 'x-api-key': state.apiKey },
    });

    if (!response.ok) {
      throw new Error('API error');
    }

    state.weeklyStats = await response.json();
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
  renderStatsCards();
  renderWeeklyActivity();
  renderProjectsList();
  renderSessionDetail();
  renderAgentsPanels();
  updateOfflineIndicator();
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
  // Machine name from first session if available
  if (state.weeklyStats.projects && state.weeklyStats.projects.length > 0) {
    elements.machineName.textContent = state.weeklyStats.machine_name || '--';
  }

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

  // This Week
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

  // Today
  const today = getTodayISO();
  const todayData = stats.daily_breakdown?.find((d) => d.date === today);
  elements.statTodayHours.textContent = formatHours(todayData?.hours || 0);
  elements.statTodaySessions.textContent = `${todayData?.sessions || 0} sessions`;

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
  // For now, show full bar since we don't have per-day project breakdown
  // In a real implementation, we'd need additional API data
  if (day.hours === 0) {
    return '';
  }

  const widthPercent = (day.hours / maxHours) * 100;
  const projects = state.weeklyStats.projects || [];

  // Distribute the bar proportionally across projects based on overall hours
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
        data-agent="${escapeHtml(projects[0]?.name || '')}"
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
    const startTime = formatTime(session.start);
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
  const agents = state.weeklyStats.agents || [];
  const projects = state.weeklyStats.projects || [];

  if (agents.length === 0) {
    elements.agentProjectList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">-</div>
        <div>No data</div>
      </div>
    `;
    return;
  }

  // Build agent-to-projects mapping from available data
  // Note: Full implementation would require additional API data
  const html = agents.map((agent) => {
    const config = getAgentConfig(agent.name);

    // For now, show all projects since we don't have per-agent project data
    const projectNames = projects.map((p) => p.name).join(', ');

    return `
      <div class="agent-project-row">
        <div class="agent-project-icon ${escapeHtml(config.class)}">${escapeHtml(config.initial)}</div>
        <div class="agent-project-name">${escapeHtml(config.label)}</div>
        <div class="agent-project-projects">${escapeHtml(projectNames) || '--'}</div>
        <div class="agent-project-hours">${agent.hours.toFixed(1)}h</div>
      </div>
    `;
  }).join('');

  elements.agentProjectList.innerHTML = html;
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
function getTodayISO() {
  const now = new Date();
  return now.toISOString().split('T')[0];
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
