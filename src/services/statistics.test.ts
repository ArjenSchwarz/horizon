import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateWeeklyStats,
  calculateDailyBreakdown,
  calculateProjectBreakdown,
  calculateAgentBreakdown,
  calculateStreak,
  calculateProjectStats,
} from "./statistics";
import type { Interaction, Session } from "../types";

/**
 * Helper to create test interactions with default values.
 */
function createInteraction(overrides: Partial<Interaction>): Interaction {
  return {
    id: 1,
    project: "test-project",
    timestamp: "2026-01-19T10:00:00Z",
    machine: "test-machine",
    agent: "claude-code",
    session_id: "session-1",
    event_type: "prompt-start",
    created_at: "2026-01-19T10:00:00Z",
    ...overrides,
  };
}

/**
 * Helper to create test sessions with default values.
 */
function createSession(overrides: Partial<Session>): Session {
  return {
    session_id: "session-1",
    project: "test-project",
    start: "2026-01-19T10:00:00Z",
    end: "2026-01-19T11:00:00Z",
    span_minutes: 60,
    active_minutes: 30,
    machine: "test-machine",
    agent: "claude-code",
    interaction_count: 3,
    explicit_end: false,
    ...overrides,
  };
}

describe("calculateWeeklyStats", () => {
  describe("total hours and sessions", () => {
    it("calculates total_hours from session active time", () => {
      // Week starting Monday 2026-01-19
      const weekStart = new Date("2026-01-19T00:00:00Z");
      const interactions: Interaction[] = [
        // Session 1: 30 minutes active
        createInteraction({
          session_id: "s1",
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          session_id: "s1",
          timestamp: "2026-01-19T10:30:00Z",
          event_type: "response-end",
        }),
        // Session 2: 60 minutes active
        createInteraction({
          session_id: "s2",
          timestamp: "2026-01-20T14:00:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          session_id: "s2",
          timestamp: "2026-01-20T15:00:00Z",
          event_type: "response-end",
        }),
      ];

      const stats = calculateWeeklyStats(interactions, weekStart);

      // 30 + 60 = 90 minutes = 1.5 hours
      expect(stats.total_hours).toBe(1.5);
      expect(stats.total_sessions).toBe(2);
    });

    it("returns zero totals for empty interactions", () => {
      const weekStart = new Date("2026-01-19T00:00:00Z");
      const stats = calculateWeeklyStats([], weekStart);

      expect(stats.total_hours).toBe(0);
      expect(stats.total_sessions).toBe(0);
    });

    it("rounds total_hours to one decimal place", () => {
      const weekStart = new Date("2026-01-19T00:00:00Z");
      const interactions: Interaction[] = [
        createInteraction({
          session_id: "s1",
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
        }),
        // 7 minutes = 0.1167 hours, should round to 0.1
        createInteraction({
          session_id: "s1",
          timestamp: "2026-01-19T10:07:00Z",
          event_type: "response-end",
        }),
      ];

      const stats = calculateWeeklyStats(interactions, weekStart);
      expect(stats.total_hours).toBe(0.1);
    });
  });

  describe("comparison with last week", () => {
    it("includes vs_last_week in response", () => {
      const weekStart = new Date("2026-01-19T00:00:00Z");
      const stats = calculateWeeklyStats([], weekStart);

      expect(stats.comparison).toBeDefined();
      expect(stats.comparison.vs_last_week).toBeDefined();
    });

    it("returns 0 for vs_last_week when no previous week data", () => {
      const weekStart = new Date("2026-01-19T00:00:00Z");
      const stats = calculateWeeklyStats([], weekStart);

      // v1 returns 0 for vs_last_week (see design doc limitations)
      expect(stats.comparison.vs_last_week).toBe(0);
    });
  });
});

describe("calculateDailyBreakdown", () => {
  it("generates breakdown for 7 days starting from weekStart", () => {
    const weekStart = new Date("2026-01-19T00:00:00Z");
    const sessions: Session[] = [];

    const breakdown = calculateDailyBreakdown(sessions, weekStart);

    expect(breakdown).toHaveLength(7);
    expect(breakdown[0].date).toBe("2026-01-19");
    expect(breakdown[6].date).toBe("2026-01-25");
  });

  it("aggregates session hours by day", () => {
    const weekStart = new Date("2026-01-19T00:00:00Z");
    const sessions: Session[] = [
      createSession({
        start: "2026-01-19T10:00:00Z",
        active_minutes: 60, // 1 hour
      }),
      createSession({
        session_id: "s2",
        start: "2026-01-19T14:00:00Z",
        active_minutes: 30, // 0.5 hours
      }),
      createSession({
        session_id: "s3",
        start: "2026-01-20T10:00:00Z",
        active_minutes: 90, // 1.5 hours
      }),
    ];

    const breakdown = calculateDailyBreakdown(sessions, weekStart);

    // Monday (Jan 19): 1.5 hours from 2 sessions
    expect(breakdown[0].date).toBe("2026-01-19");
    expect(breakdown[0].hours).toBe(1.5);
    expect(breakdown[0].sessions).toBe(2);

    // Tuesday (Jan 20): 1.5 hours from 1 session
    expect(breakdown[1].date).toBe("2026-01-20");
    expect(breakdown[1].hours).toBe(1.5);
    expect(breakdown[1].sessions).toBe(1);

    // Other days: 0 hours, 0 sessions
    expect(breakdown[2].hours).toBe(0);
    expect(breakdown[2].sessions).toBe(0);
  });

  it("uses session start date for daily attribution", () => {
    const weekStart = new Date("2026-01-19T00:00:00Z");
    // Session spans midnight but should be attributed to start date
    const sessions: Session[] = [
      createSession({
        start: "2026-01-19T23:30:00Z",
        end: "2026-01-20T00:30:00Z",
        active_minutes: 60,
      }),
    ];

    const breakdown = calculateDailyBreakdown(sessions, weekStart);

    expect(breakdown[0].hours).toBe(1); // Monday
    expect(breakdown[1].hours).toBe(0); // Tuesday
  });

  it("rounds hours to one decimal place", () => {
    const weekStart = new Date("2026-01-19T00:00:00Z");
    const sessions: Session[] = [
      createSession({
        start: "2026-01-19T10:00:00Z",
        active_minutes: 7, // 0.1167 hours
      }),
    ];

    const breakdown = calculateDailyBreakdown(sessions, weekStart);

    expect(breakdown[0].hours).toBe(0.1);
  });
});

describe("calculateProjectBreakdown", () => {
  it("aggregates hours and sessions by project", () => {
    const sessions: Session[] = [
      createSession({
        project: "project-a",
        active_minutes: 60,
      }),
      createSession({
        session_id: "s2",
        project: "project-a",
        active_minutes: 30,
      }),
      createSession({
        session_id: "s3",
        project: "project-b",
        active_minutes: 45,
      }),
    ];

    const projects = calculateProjectBreakdown(sessions);

    expect(projects).toHaveLength(2);

    const projectA = projects.find((p) => p.name === "project-a");
    expect(projectA).toBeDefined();
    expect(projectA!.hours).toBe(1.5); // 90 minutes
    expect(projectA!.sessions).toBe(2);

    const projectB = projects.find((p) => p.name === "project-b");
    expect(projectB).toBeDefined();
    expect(projectB!.hours).toBe(0.8); // 45 minutes, rounded
    expect(projectB!.sessions).toBe(1);
  });

  it("sorts projects by hours descending", () => {
    const sessions: Session[] = [
      createSession({
        project: "small-project",
        active_minutes: 30,
      }),
      createSession({
        session_id: "s2",
        project: "large-project",
        active_minutes: 120,
      }),
      createSession({
        session_id: "s3",
        project: "medium-project",
        active_minutes: 60,
      }),
    ];

    const projects = calculateProjectBreakdown(sessions);

    expect(projects[0].name).toBe("large-project");
    expect(projects[1].name).toBe("medium-project");
    expect(projects[2].name).toBe("small-project");
  });

  it("returns empty array for no sessions", () => {
    const projects = calculateProjectBreakdown([]);
    expect(projects).toHaveLength(0);
  });
});

describe("calculateAgentBreakdown", () => {
  it("aggregates hours by agent with percentages", () => {
    const sessions: Session[] = [
      createSession({
        agent: "claude-code",
        active_minutes: 60,
      }),
      createSession({
        session_id: "s2",
        agent: "claude-code",
        active_minutes: 60,
      }),
      createSession({
        session_id: "s3",
        agent: "cursor",
        active_minutes: 60,
      }),
    ];

    const totalHours = 3; // 180 minutes = 3 hours
    const agents = calculateAgentBreakdown(sessions, totalHours);

    expect(agents).toHaveLength(2);

    const claude = agents.find((a) => a.name === "claude-code");
    expect(claude).toBeDefined();
    expect(claude!.hours).toBe(2);
    expect(claude!.percentage).toBe(67); // 2/3 = 66.67%, rounded

    const cursor = agents.find((a) => a.name === "cursor");
    expect(cursor).toBeDefined();
    expect(cursor!.hours).toBe(1);
    expect(cursor!.percentage).toBe(33);
  });

  it("sorts agents by hours descending", () => {
    const sessions: Session[] = [
      createSession({
        agent: "aider",
        active_minutes: 30,
      }),
      createSession({
        session_id: "s2",
        agent: "claude-code",
        active_minutes: 120,
      }),
      createSession({
        session_id: "s3",
        agent: "cursor",
        active_minutes: 60,
      }),
    ];

    const totalHours = 3.5;
    const agents = calculateAgentBreakdown(sessions, totalHours);

    expect(agents[0].name).toBe("claude-code");
    expect(agents[1].name).toBe("cursor");
    expect(agents[2].name).toBe("aider");
  });

  it("handles zero total hours without division by zero", () => {
    const sessions: Session[] = [];
    const agents = calculateAgentBreakdown(sessions, 0);

    expect(agents).toHaveLength(0);
  });

  it("rounds percentages to whole numbers", () => {
    const sessions: Session[] = [
      createSession({
        agent: "claude-code",
        active_minutes: 100,
      }),
      createSession({
        session_id: "s2",
        agent: "cursor",
        active_minutes: 200,
      }),
    ];

    const totalHours = 5; // 300 minutes = 5 hours
    const agents = calculateAgentBreakdown(sessions, totalHours);

    const claude = agents.find((a) => a.name === "claude-code");
    const cursor = agents.find((a) => a.name === "cursor");

    // 100/300 = 33.33% -> 33
    // 200/300 = 66.67% -> 67
    expect(claude!.percentage).toBe(33);
    expect(cursor!.percentage).toBe(67);
  });
});

describe("calculateStreak", () => {
  beforeEach(() => {
    // Mock Date to control "today"
    const mockDate = new Date("2026-01-19T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts consecutive days with sessions going backwards from today", () => {
    // Today is 2026-01-19
    const interactions: Interaction[] = [
      createInteraction({
        timestamp: "2026-01-19T10:00:00Z", // Today
      }),
      createInteraction({
        timestamp: "2026-01-18T10:00:00Z", // Yesterday
      }),
      createInteraction({
        timestamp: "2026-01-17T10:00:00Z", // Day before
      }),
    ];

    const streak = calculateStreak(interactions);
    expect(streak).toBe(3);
  });

  it("streak breaks when a day is missing", () => {
    // Today is 2026-01-19
    const interactions: Interaction[] = [
      createInteraction({
        timestamp: "2026-01-19T10:00:00Z", // Today
      }),
      createInteraction({
        timestamp: "2026-01-18T10:00:00Z", // Yesterday
      }),
      // Jan 17 missing
      createInteraction({
        timestamp: "2026-01-16T10:00:00Z", // 3 days ago
      }),
    ];

    const streak = calculateStreak(interactions);
    expect(streak).toBe(2); // Only today and yesterday count
  });

  it("allows today to be missing (not yet coded today)", () => {
    // Today is 2026-01-19
    const interactions: Interaction[] = [
      // No interaction today
      createInteraction({
        timestamp: "2026-01-18T10:00:00Z", // Yesterday
      }),
      createInteraction({
        timestamp: "2026-01-17T10:00:00Z", // Day before
      }),
    ];

    const streak = calculateStreak(interactions);
    expect(streak).toBe(2);
  });

  it("returns 0 for no interactions", () => {
    const streak = calculateStreak([]);
    expect(streak).toBe(0);
  });

  it("returns 0 when oldest interaction is not recent", () => {
    // Today is 2026-01-19
    const interactions: Interaction[] = [
      createInteraction({
        timestamp: "2026-01-10T10:00:00Z", // Over a week ago
      }),
    ];

    const streak = calculateStreak(interactions);
    expect(streak).toBe(0); // Gap too large
  });

  it("counts each date only once regardless of multiple interactions", () => {
    // Today is 2026-01-19
    const interactions: Interaction[] = [
      createInteraction({
        timestamp: "2026-01-19T09:00:00Z",
      }),
      createInteraction({
        timestamp: "2026-01-19T10:00:00Z",
      }),
      createInteraction({
        timestamp: "2026-01-19T11:00:00Z",
      }),
      createInteraction({
        timestamp: "2026-01-18T10:00:00Z",
      }),
    ];

    const streak = calculateStreak(interactions);
    expect(streak).toBe(2); // 2 unique days
  });

  it("uses UTC date boundaries", () => {
    // Today is 2026-01-19
    const interactions: Interaction[] = [
      // Near midnight UTC - should count as Jan 19
      createInteraction({
        timestamp: "2026-01-19T23:59:00Z",
      }),
      // Early morning UTC - should count as Jan 18
      createInteraction({
        timestamp: "2026-01-18T00:01:00Z",
      }),
    ];

    const streak = calculateStreak(interactions);
    expect(streak).toBe(2);
  });
});

describe("calculateProjectStats", () => {
  it("returns project statistics with agent breakdown", () => {
    const interactions: Interaction[] = [
      // Project A - claude-code session
      createInteraction({
        session_id: "s1",
        project: "project-a",
        agent: "claude-code",
        timestamp: "2026-01-19T10:00:00Z",
        event_type: "prompt-start",
      }),
      createInteraction({
        session_id: "s1",
        project: "project-a",
        agent: "claude-code",
        timestamp: "2026-01-19T10:30:00Z",
        event_type: "response-end",
      }),
      // Project A - cursor session
      createInteraction({
        session_id: "s2",
        project: "project-a",
        agent: "cursor",
        timestamp: "2026-01-19T11:00:00Z",
        event_type: "prompt-start",
      }),
      createInteraction({
        session_id: "s2",
        project: "project-a",
        agent: "cursor",
        timestamp: "2026-01-19T12:00:00Z",
        event_type: "response-end",
      }),
      // Project B - claude-code session
      createInteraction({
        session_id: "s3",
        project: "project-b",
        agent: "claude-code",
        timestamp: "2026-01-19T14:00:00Z",
        event_type: "prompt-start",
      }),
      createInteraction({
        session_id: "s3",
        project: "project-b",
        agent: "claude-code",
        timestamp: "2026-01-19T14:45:00Z",
        event_type: "response-end",
      }),
    ];

    const projectStats = calculateProjectStats(interactions);

    expect(projectStats).toHaveLength(2);

    // Project A: 30 min claude + 60 min cursor = 1.5 hours, 2 sessions
    const projectA = projectStats.find((p) => p.name === "project-a");
    expect(projectA).toBeDefined();
    expect(projectA!.total_hours).toBe(1.5);
    expect(projectA!.total_sessions).toBe(2);
    expect(projectA!.agents["claude-code"]).toBe(0.5);
    expect(projectA!.agents["cursor"]).toBe(1);

    // Project B: 45 min claude = 0.8 hours (rounded), 1 session
    const projectB = projectStats.find((p) => p.name === "project-b");
    expect(projectB).toBeDefined();
    expect(projectB!.total_hours).toBe(0.8);
    expect(projectB!.total_sessions).toBe(1);
    expect(projectB!.agents["claude-code"]).toBe(0.8);
  });

  it("sorts projects by total_hours descending", () => {
    const interactions: Interaction[] = [
      createInteraction({
        session_id: "s1",
        project: "small",
        timestamp: "2026-01-19T10:00:00Z",
        event_type: "prompt-start",
      }),
      createInteraction({
        session_id: "s1",
        project: "small",
        timestamp: "2026-01-19T10:15:00Z",
        event_type: "response-end",
      }),
      createInteraction({
        session_id: "s2",
        project: "large",
        timestamp: "2026-01-19T11:00:00Z",
        event_type: "prompt-start",
      }),
      createInteraction({
        session_id: "s2",
        project: "large",
        timestamp: "2026-01-19T13:00:00Z",
        event_type: "response-end",
      }),
    ];

    const projectStats = calculateProjectStats(interactions);

    expect(projectStats[0].name).toBe("large");
    expect(projectStats[1].name).toBe("small");
  });

  it("returns empty array for no interactions", () => {
    const projectStats = calculateProjectStats([]);
    expect(projectStats).toHaveLength(0);
  });
});
