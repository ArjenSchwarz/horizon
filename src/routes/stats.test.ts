import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import statsRoutes from "./stats";
import type { Session, WeeklyStats, ProjectStats } from "../types";

// Mock D1 database results
const mockAll = vi.fn();
const mockPrepare = vi.fn(() => ({
  bind: vi.fn(() => ({
    all: mockAll,
  })),
}));

type Bindings = {
  DB: { prepare: typeof mockPrepare };
  API_KEY: string;
};

// Type for project sessions response
interface ProjectSessionsResponse {
  project: string;
  sessions: Session[];
}

// Type for projects response
interface ProjectsResponse {
  projects: ProjectStats[];
}

// Type for API error response
interface ApiErrorResponse {
  error: string;
}

// Helper to create mock interactions
function createInteraction(overrides: Partial<{
  id: number;
  project: string;
  timestamp: string;
  machine: string;
  agent: string;
  session_id: string;
  event_type: string;
}> = {}) {
  return {
    id: 1,
    project: "horizon",
    timestamp: "2026-01-19T10:00:00Z",
    machine: "macbook",
    agent: "claude-code",
    session_id: "sess-123",
    event_type: "prompt-start",
    ...overrides,
  };
}

describe("Statistics Routes", () => {
  let app: Hono<{ Bindings: Bindings }>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAll.mockResolvedValue({ results: [] });

    app = new Hono<{ Bindings: Bindings }>();
    app.route("/", statsRoutes);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // GET /stats/weekly tests
  // Requirements: [3.1], [3.2], [3.3]-[3.10]
  describe("GET /stats/weekly", () => {
    // Requirement [3.1]: Exposes GET /api/stats/weekly endpoint
    it("returns 200 with weekly stats structure", async () => {
      const res = await app.request("/stats/weekly", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      expect(res.status).toBe(200);
      const body = await res.json() as WeeklyStats;
      expect(body).toHaveProperty("total_hours");
      expect(body).toHaveProperty("total_sessions");
      expect(body).toHaveProperty("streak_days");
      expect(body).toHaveProperty("daily_breakdown");
      expect(body).toHaveProperty("projects");
      expect(body).toHaveProperty("agents");
      expect(body).toHaveProperty("machines");
      expect(body).toHaveProperty("comparison");
    });

    // Requirement [3.2]: Accepts optional week_start parameter
    it("accepts week_start query parameter", async () => {
      const res = await app.request("/stats/weekly?week_start=2026-01-13", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      expect(res.status).toBe(200);
      // Verify the query was made with the correct date range
      expect(mockPrepare).toHaveBeenCalled();
    });

    // Requirement [3.6]: daily_breakdown has 7 entries
    it("returns 7 days in daily_breakdown", async () => {
      const res = await app.request("/stats/weekly", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      const body = await res.json() as WeeklyStats;
      expect(body.daily_breakdown).toHaveLength(7);
    });

    // Requirement [3.9]: comparison.vs_last_week
    it("includes vs_last_week comparison", async () => {
      const res = await app.request("/stats/weekly", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      const body = await res.json() as WeeklyStats;
      expect(body.comparison).toHaveProperty("vs_last_week");
      expect(typeof body.comparison.vs_last_week).toBe("number");
    });

    it("calculates statistics from interactions", async () => {
      const weekStart = "2026-01-13";
      mockAll.mockResolvedValueOnce({
        results: [
          createInteraction({
            timestamp: "2026-01-13T10:00:00Z",
            event_type: "prompt-start",
          }),
          createInteraction({
            timestamp: "2026-01-13T10:30:00Z",
            event_type: "response-end",
          }),
        ],
      });

      const res = await app.request(`/stats/weekly?week_start=${weekStart}`, {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      expect(res.status).toBe(200);
      const body = await res.json() as WeeklyStats;
      expect(body.total_sessions).toBe(1);
      expect(body.total_hours).toBeGreaterThan(0);
    });
  });

  // GET /stats/projects tests
  // Requirements: [4.1], [4.2], [4.3], [4.4], [4.5]
  describe("GET /stats/projects", () => {
    // Requirement [4.1]: Exposes GET /api/stats/projects endpoint
    it("returns 200 with projects array", async () => {
      const res = await app.request("/stats/projects", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      expect(res.status).toBe(200);
      const body = await res.json() as ProjectsResponse;
      expect(body).toHaveProperty("projects");
      expect(Array.isArray(body.projects)).toBe(true);
    });

    // Requirement [4.2]: Accepts optional days parameter (defaults to 30)
    it("accepts days query parameter", async () => {
      const res = await app.request("/stats/projects?days=7", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      expect(res.status).toBe(200);
    });

    // Requirement [4.3]: Each project has name, total_hours, total_sessions, agents
    it("returns project stats with correct structure", async () => {
      mockAll.mockResolvedValueOnce({
        results: [
          createInteraction({
            project: "horizon",
            timestamp: "2026-01-19T10:00:00Z",
            event_type: "prompt-start",
          }),
          createInteraction({
            project: "horizon",
            timestamp: "2026-01-19T10:30:00Z",
            event_type: "response-end",
          }),
        ],
      });

      const res = await app.request("/stats/projects", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      const body = await res.json() as ProjectsResponse;
      expect(body.projects.length).toBeGreaterThan(0);
      const project = body.projects[0];
      expect(project).toHaveProperty("name");
      expect(project).toHaveProperty("total_hours");
      expect(project).toHaveProperty("total_sessions");
      expect(project).toHaveProperty("agents");
    });

    // Requirement [4.4]: agents field maps agent names to hours
    it("includes agents breakdown as object mapping names to hours", async () => {
      mockAll.mockResolvedValueOnce({
        results: [
          createInteraction({
            project: "horizon",
            agent: "claude-code",
            timestamp: "2026-01-19T10:00:00Z",
            event_type: "prompt-start",
          }),
          createInteraction({
            project: "horizon",
            agent: "claude-code",
            timestamp: "2026-01-19T10:30:00Z",
            event_type: "response-end",
          }),
        ],
      });

      const res = await app.request("/stats/projects", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      const body = await res.json() as ProjectsResponse;
      const project = body.projects[0];
      expect(typeof project.agents).toBe("object");
      expect(project.agents).toHaveProperty("claude-code");
      expect(typeof project.agents["claude-code"]).toBe("number");
    });

    // Requirement [4.5]: Sorted by total_hours descending
    it("returns projects sorted by total_hours descending", async () => {
      mockAll.mockResolvedValueOnce({
        results: [
          // Project A: 30 min (less time)
          createInteraction({
            project: "project-a",
            session_id: "sess-a",
            timestamp: "2026-01-19T10:00:00Z",
            event_type: "prompt-start",
          }),
          createInteraction({
            project: "project-a",
            session_id: "sess-a",
            timestamp: "2026-01-19T10:30:00Z",
            event_type: "response-end",
          }),
          // Project B: 60 min (more time)
          createInteraction({
            project: "project-b",
            session_id: "sess-b",
            timestamp: "2026-01-19T11:00:00Z",
            event_type: "prompt-start",
          }),
          createInteraction({
            project: "project-b",
            session_id: "sess-b",
            timestamp: "2026-01-19T12:00:00Z",
            event_type: "response-end",
          }),
        ],
      });

      const res = await app.request("/stats/projects", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      const body = await res.json() as ProjectsResponse;
      expect(body.projects.length).toBe(2);
      expect(body.projects[0].name).toBe("project-b");
      expect(body.projects[1].name).toBe("project-a");
    });
  });

  // GET /projects/:name/sessions tests
  // Requirements: [5.1], [5.2], [5.3], [5.4], [5.5], [5.6], [5.7]
  describe("GET /projects/:name/sessions", () => {
    // Requirement [5.1]: Exposes GET /api/projects/:name/sessions endpoint
    it("returns 200 with project and sessions", async () => {
      mockAll.mockResolvedValueOnce({
        results: [
          createInteraction({ project: "horizon" }),
        ],
      });

      const res = await app.request("/projects/horizon/sessions", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      expect(res.status).toBe(200);
      const body = await res.json() as ProjectSessionsResponse;
      expect(body).toHaveProperty("project");
      expect(body).toHaveProperty("sessions");
    });

    // Requirement [5.2]: Accepts optional days parameter (defaults to 7)
    it("accepts days query parameter", async () => {
      mockAll.mockResolvedValueOnce({
        results: [
          createInteraction({ project: "horizon" }),
        ],
      });

      const res = await app.request("/projects/horizon/sessions?days=14", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      expect(res.status).toBe(200);
    });

    // Requirement [5.3]: Response includes project name and sessions array
    it("includes project name in response", async () => {
      mockAll.mockResolvedValueOnce({
        results: [
          createInteraction({ project: "horizon" }),
        ],
      });

      const res = await app.request("/projects/horizon/sessions", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      const body = await res.json() as ProjectSessionsResponse;
      expect(body.project).toBe("horizon");
    });

    // Requirement [5.4]: Each session includes required fields
    it("returns sessions with correct structure", async () => {
      mockAll.mockResolvedValueOnce({
        results: [
          createInteraction({
            project: "horizon",
            timestamp: "2026-01-19T10:00:00Z",
            event_type: "prompt-start",
          }),
          createInteraction({
            project: "horizon",
            timestamp: "2026-01-19T10:30:00Z",
            event_type: "response-end",
          }),
        ],
      });

      const res = await app.request("/projects/horizon/sessions", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      const body = await res.json() as ProjectSessionsResponse;
      expect(body.sessions.length).toBeGreaterThan(0);
      const session = body.sessions[0];
      expect(session).toHaveProperty("session_id");
      expect(session).toHaveProperty("start");
      expect(session).toHaveProperty("end");
      expect(session).toHaveProperty("span_minutes");
      expect(session).toHaveProperty("active_minutes");
      expect(session).toHaveProperty("machine");
      expect(session).toHaveProperty("agent");
      expect(session).toHaveProperty("interaction_count");
      expect(session).toHaveProperty("explicit_end");
    });

    // Requirement [5.5]: Sessions sorted by start descending
    it("returns sessions sorted by start descending", async () => {
      mockAll.mockResolvedValueOnce({
        results: [
          // Earlier session
          createInteraction({
            project: "horizon",
            session_id: "sess-early",
            timestamp: "2026-01-19T09:00:00Z",
            event_type: "prompt-start",
          }),
          createInteraction({
            project: "horizon",
            session_id: "sess-early",
            timestamp: "2026-01-19T09:30:00Z",
            event_type: "response-end",
          }),
          // Later session
          createInteraction({
            project: "horizon",
            session_id: "sess-late",
            timestamp: "2026-01-19T14:00:00Z",
            event_type: "prompt-start",
          }),
          createInteraction({
            project: "horizon",
            session_id: "sess-late",
            timestamp: "2026-01-19T14:30:00Z",
            event_type: "response-end",
          }),
        ],
      });

      const res = await app.request("/projects/horizon/sessions", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      const body = await res.json() as ProjectSessionsResponse;
      expect(body.sessions.length).toBe(2);
      // Later session should be first (descending order)
      expect(body.sessions[0].session_id).toBe("sess-late");
      expect(body.sessions[1].session_id).toBe("sess-early");
    });

    // Requirement [5.6]: Returns 404 for non-existent project
    it("returns 404 for non-existent project", async () => {
      // First query returns no results for the time period
      mockAll.mockResolvedValueOnce({ results: [] });
      // Second query also returns no results (project doesn't exist at all)
      mockAll.mockResolvedValueOnce({ results: [] });

      const res = await app.request("/projects/nonexistent/sessions", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      expect(res.status).toBe(404);
      const body = await res.json() as ApiErrorResponse;
      expect(body.error).toContain("not found");
    });

    // Requirement [5.7]: Active sessions have null end
    it("returns null end for active sessions", async () => {
      mockAll.mockResolvedValueOnce({
        results: [
          // Only a prompt-start, no response-end (active session)
          createInteraction({
            project: "horizon",
            timestamp: "2026-01-19T10:00:00Z",
            event_type: "prompt-start",
          }),
        ],
      });

      const res = await app.request("/projects/horizon/sessions", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      const body = await res.json() as ProjectSessionsResponse;
      expect(body.sessions.length).toBe(1);
      expect(body.sessions[0].end).toBeNull();
    });

    it("returns empty sessions array if project exists but no recent sessions", async () => {
      // First query: no sessions in time period
      mockAll.mockResolvedValueOnce({ results: [] });
      // Second query: project exists (has at least one interaction)
      mockAll.mockResolvedValueOnce({
        results: [{ id: 1 }],
      });

      const res = await app.request("/projects/horizon/sessions", {
        method: "GET",
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      expect(res.status).toBe(200);
      const body = await res.json() as ProjectSessionsResponse;
      expect(body.project).toBe("horizon");
      expect(body.sessions).toEqual([]);
    });
  });
});
