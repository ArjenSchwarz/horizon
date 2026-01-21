/**
 * Valid event types for interactions.
 * - prompt-start: User submitted a prompt to the AI agent
 * - response-end: AI agent completed its response
 * - session-end: Session was explicitly ended
 */
export type EventType = "prompt-start" | "response-end" | "session-end";

/**
 * Represents a single interaction recorded from an AI coding agent.
 * Interactions are paired (prompt-start -> response-end) to calculate active time.
 */
export interface Interaction {
  /** Auto-generated database ID */
  id?: number;
  /** Project name (normalized: lowercase, hyphens) */
  project: string;
  /** ISO 8601 timestamp of the interaction */
  timestamp: string;
  /** Machine hostname where the interaction occurred */
  machine: string;
  /** AI agent name (e.g., "claude-code") */
  agent: string;
  /** Session identifier provided by the AI agent */
  session_id: string;
  /** Type of event */
  event_type: EventType;
  /** Auto-generated creation timestamp */
  created_at?: string;
}

/**
 * Represents a derived coding session calculated from paired interactions.
 * A session groups all interactions with the same session_id.
 */
export interface Session {
  /** Session identifier from the AI agent */
  session_id: string;
  /** Project name (from first interaction in session) */
  project: string;
  /** ISO 8601 timestamp of session start (first event) */
  start: string;
  /** ISO 8601 timestamp of session end, or null if session is active */
  end: string | null;
  /** Total time from first to last event in minutes */
  span_minutes: number;
  /** Sum of paired prompt-response durations in minutes */
  active_minutes: number;
  /** Machine hostname (from first interaction) */
  machine: string;
  /** AI agent name (from first interaction) */
  agent: string;
  /** Number of prompt-start events in the session */
  interaction_count: number;
  /** Whether session was explicitly ended with session-end event */
  explicit_end: boolean;
}

/**
 * Daily breakdown entry for weekly statistics.
 */
export interface DailyBreakdown {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Total active hours for the day */
  hours: number;
  /** Number of sessions on this day */
  sessions: number;
  /** Projects worked on this day with their hours */
  projects: ProjectSummary[];
}

/**
 * Project summary for weekly statistics.
 */
export interface ProjectSummary {
  /** Project name */
  name: string;
  /** Total active hours */
  hours: number;
  /** Number of sessions */
  sessions: number;
}

/**
 * Agent summary for weekly statistics.
 */
export interface AgentSummary {
  /** Agent name (e.g., "claude-code") */
  name: string;
  /** Total active hours */
  hours: number;
  /** Percentage of total hours (0-100) */
  percentage: number;
}

/**
 * Machine summary for weekly statistics.
 */
export interface MachineSummary {
  /** Machine hostname */
  name: string;
  /** Total active hours */
  hours: number;
  /** Percentage of total hours (0-100) */
  percentage: number;
}

/**
 * Response from GET /api/stats/weekly endpoint.
 */
export interface WeeklyStats {
  /** Total active hours for the week */
  total_hours: number;
  /** Total number of distinct sessions */
  total_sessions: number;
  /** Consecutive days with at least one session */
  streak_days: number;
  /** Breakdown of activity by day (7 entries, Mon-Sun) */
  daily_breakdown: DailyBreakdown[];
  /** Projects sorted by hours descending */
  projects: ProjectSummary[];
  /** Agents sorted by hours descending */
  agents: AgentSummary[];
  /** Machines sorted by hours descending */
  machines: MachineSummary[];
  /** Comparison with previous period */
  comparison: {
    /** Hour difference from previous week */
    vs_last_week: number;
  };
}

/**
 * Project statistics for the project list API.
 * Used in GET /api/stats/projects response.
 */
export interface ProjectStats {
  /** Project name */
  name: string;
  /** Total active hours */
  total_hours: number;
  /** Total number of sessions */
  total_sessions: number;
  /** Hours spent per agent (agent name -> hours) */
  agents: Record<string, number>;
}

/**
 * Response from GET /api/projects/:name/sessions endpoint.
 */
export interface ProjectSessionsResponse {
  /** Project name */
  project: string;
  /** Sessions sorted by start time descending */
  sessions: Session[];
}

/**
 * Response from GET /api/stats/projects endpoint.
 */
export interface ProjectStatsResponse {
  /** Projects sorted by total_hours descending */
  projects: ProjectStats[];
}

/**
 * Payload for POST /api/interactions endpoint.
 */
export interface InteractionPayload {
  /** Project name */
  project: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Machine hostname */
  machine: string;
  /** AI agent name */
  agent: string;
  /** Session identifier */
  session_id: string;
  /** Event type */
  event_type: EventType;
}

/**
 * Standard API error response.
 */
export interface ApiError {
  /** Human-readable error message */
  error: string;
}

/**
 * Success response for POST /api/interactions.
 */
export interface InteractionRecordedResponse {
  /** Status indicator */
  status: "recorded";
}
