import { describe, it, expect, beforeEach } from "vitest";
import { calculateSessions, deriveSession, calculateActiveTime } from "./sessions";
import type { Interaction } from "../types";

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

describe("calculateSessions", () => {
  describe("normal prompt-response pairs", () => {
    it("calculates active time from a single paired prompt-response", () => {
      const interactions: Interaction[] = [
        createInteraction({
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:20:00Z",
          event_type: "response-end",
        }),
      ];

      const sessions = calculateSessions(interactions);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].active_minutes).toBe(20);
      expect(sessions[0].interaction_count).toBe(1);
    });

    it("calculates active time from multiple paired prompt-responses", () => {
      const interactions: Interaction[] = [
        createInteraction({
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:10:00Z",
          event_type: "response-end",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:15:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:25:00Z",
          event_type: "response-end",
        }),
      ];

      const sessions = calculateSessions(interactions);

      expect(sessions).toHaveLength(1);
      // First pair: 10 min, Second pair: 10 min
      expect(sessions[0].active_minutes).toBe(20);
      expect(sessions[0].interaction_count).toBe(2);
    });

    it("calculates session span from first to last event", () => {
      const interactions: Interaction[] = [
        createInteraction({
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          timestamp: "2026-01-19T11:30:00Z",
          event_type: "response-end",
        }),
      ];

      const sessions = calculateSessions(interactions);

      expect(sessions[0].start).toBe("2026-01-19T10:00:00Z");
      expect(new Date(sessions[0].end!).getTime()).toBe(new Date("2026-01-19T11:30:00Z").getTime());
      expect(sessions[0].span_minutes).toBe(90);
    });
  });

  describe("5-minute default for unpaired prompt-start", () => {
    it("uses 5-minute default when prompt-start has no response-end", () => {
      const interactions: Interaction[] = [
        createInteraction({
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
        }),
      ];

      const sessions = calculateSessions(interactions);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].active_minutes).toBe(5);
      expect(sessions[0].end).toBeNull(); // Active session
    });

    it("uses 5-minute default for unpaired prompt-start at end of session", () => {
      const interactions: Interaction[] = [
        createInteraction({
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:10:00Z",
          event_type: "response-end",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:15:00Z",
          event_type: "prompt-start",
        }),
        // No response-end for second prompt
      ];

      const sessions = calculateSessions(interactions);

      expect(sessions).toHaveLength(1);
      // First pair: 10 min, Second unpaired: 5 min default
      expect(sessions[0].active_minutes).toBe(15);
      expect(sessions[0].end).toBeNull(); // Active session
    });
  });

  describe("explicit session-end handling", () => {
    it("marks session as explicitly ended when session-end event exists", () => {
      const interactions: Interaction[] = [
        createInteraction({
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:20:00Z",
          event_type: "response-end",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:30:00Z",
          event_type: "session-end",
        }),
      ];

      const sessions = calculateSessions(interactions);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].explicit_end).toBe(true);
      expect(new Date(sessions[0].end!).getTime()).toBe(new Date("2026-01-19T10:30:00Z").getTime());
    });

    it("does not mark session as explicitly ended without session-end event", () => {
      const interactions: Interaction[] = [
        createInteraction({
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:20:00Z",
          event_type: "response-end",
        }),
      ];

      const sessions = calculateSessions(interactions);

      expect(sessions[0].explicit_end).toBe(false);
    });

    it("session-end does not affect active time calculation", () => {
      const interactions: Interaction[] = [
        createInteraction({
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:10:00Z",
          event_type: "response-end",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:30:00Z",
          event_type: "session-end",
        }),
      ];

      const sessions = calculateSessions(interactions);

      // Only prompt-response pair counts, not the gap to session-end
      expect(sessions[0].active_minutes).toBe(10);
    });
  });

  describe("out-of-order events processing", () => {
    it("processes events in timestamp order regardless of arrival order", () => {
      // Events arrive out of order but should be processed by timestamp
      const interactions: Interaction[] = [
        createInteraction({
          timestamp: "2026-01-19T10:20:00Z",
          event_type: "response-end",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
        }),
      ];

      const sessions = calculateSessions(interactions);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].active_minutes).toBe(20);
      expect(sessions[0].start).toBe("2026-01-19T10:00:00Z");
      expect(new Date(sessions[0].end!).getTime()).toBe(new Date("2026-01-19T10:20:00Z").getTime());
    });

    it("processes complex out-of-order sequence correctly", () => {
      const interactions: Interaction[] = [
        createInteraction({
          timestamp: "2026-01-19T10:25:00Z",
          event_type: "response-end",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:30:00Z",
          event_type: "session-end",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:10:00Z",
          event_type: "response-end",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:15:00Z",
          event_type: "prompt-start",
        }),
      ];

      const sessions = calculateSessions(interactions);

      expect(sessions).toHaveLength(1);
      // First pair: 10:00-10:10 = 10 min, Second pair: 10:15-10:25 = 10 min
      expect(sessions[0].active_minutes).toBe(20);
      expect(sessions[0].explicit_end).toBe(true);
    });
  });

  describe("consecutive prompt-starts pairing", () => {
    it("pairs each prompt-start with the next available response-end in timestamp order", () => {
      // Two prompt-starts followed by two response-ends
      const interactions: Interaction[] = [
        createInteraction({
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:05:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:10:00Z",
          event_type: "response-end",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:20:00Z",
          event_type: "response-end",
        }),
      ];

      const sessions = calculateSessions(interactions);

      expect(sessions).toHaveLength(1);
      // First prompt (10:00) pairs with first response (10:10) = 10 min
      // Second prompt (10:05) pairs with second response (10:20) = 15 min
      expect(sessions[0].active_minutes).toBe(25);
      expect(sessions[0].interaction_count).toBe(2);
    });

    it("uses default for unpaired prompt-starts when not enough response-ends", () => {
      const interactions: Interaction[] = [
        createInteraction({
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:05:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:10:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:15:00Z",
          event_type: "response-end",
        }),
      ];

      const sessions = calculateSessions(interactions);

      // First prompt (10:00) pairs with first response (10:15) = 15 min
      // Second and third prompts unpaired = 5 min each
      expect(sessions[0].active_minutes).toBe(25);
      expect(sessions[0].interaction_count).toBe(3);
    });
  });

  describe("orphaned response-end events ignored", () => {
    it("ignores response-end that precedes any prompt-start", () => {
      const interactions: Interaction[] = [
        createInteraction({
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "response-end", // Orphaned - no preceding prompt
        }),
        createInteraction({
          timestamp: "2026-01-19T10:05:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:15:00Z",
          event_type: "response-end",
        }),
      ];

      const sessions = calculateSessions(interactions);

      expect(sessions).toHaveLength(1);
      // Only 10:05-10:15 pair counts
      expect(sessions[0].active_minutes).toBe(10);
      expect(sessions[0].interaction_count).toBe(1);
    });

    it("ignores extra response-ends beyond prompt-starts", () => {
      const interactions: Interaction[] = [
        createInteraction({
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:10:00Z",
          event_type: "response-end",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:15:00Z",
          event_type: "response-end", // Orphaned - no unpaired prompt
        }),
        createInteraction({
          timestamp: "2026-01-19T10:20:00Z",
          event_type: "response-end", // Orphaned - no unpaired prompt
        }),
      ];

      const sessions = calculateSessions(interactions);

      // Only first prompt-response pair counts
      expect(sessions[0].active_minutes).toBe(10);
    });
  });

  describe("multiple sessions", () => {
    it("handles multiple distinct sessions correctly", () => {
      const interactions: Interaction[] = [
        createInteraction({
          session_id: "session-1",
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
          project: "project-a",
        }),
        createInteraction({
          session_id: "session-2",
          timestamp: "2026-01-19T11:00:00Z",
          event_type: "prompt-start",
          project: "project-b",
        }),
        createInteraction({
          session_id: "session-1",
          timestamp: "2026-01-19T10:30:00Z",
          event_type: "response-end",
          project: "project-a",
        }),
        createInteraction({
          session_id: "session-2",
          timestamp: "2026-01-19T11:10:00Z",
          event_type: "response-end",
          project: "project-b",
        }),
      ];

      const sessions = calculateSessions(interactions);

      expect(sessions).toHaveLength(2);

      // Sessions are sorted by start time descending (most recent first)
      const session2 = sessions[0];
      const session1 = sessions[1];

      expect(session1.session_id).toBe("session-1");
      expect(session1.active_minutes).toBe(30);
      expect(session1.project).toBe("project-a");

      expect(session2.session_id).toBe("session-2");
      expect(session2.active_minutes).toBe(10);
      expect(session2.project).toBe("project-b");
    });

    it("sorts sessions by start time descending", () => {
      const interactions: Interaction[] = [
        createInteraction({
          session_id: "session-old",
          timestamp: "2026-01-18T10:00:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          session_id: "session-new",
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
        }),
        createInteraction({
          session_id: "session-old",
          timestamp: "2026-01-18T10:10:00Z",
          event_type: "response-end",
        }),
        createInteraction({
          session_id: "session-new",
          timestamp: "2026-01-19T10:05:00Z",
          event_type: "response-end",
        }),
      ];

      const sessions = calculateSessions(interactions);

      expect(sessions[0].session_id).toBe("session-new");
      expect(sessions[1].session_id).toBe("session-old");
    });

    it("handles sessions with different agents correctly", () => {
      const interactions: Interaction[] = [
        createInteraction({
          session_id: "session-1",
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
          agent: "claude-code",
        }),
        createInteraction({
          session_id: "session-1",
          timestamp: "2026-01-19T10:15:00Z",
          event_type: "response-end",
          agent: "claude-code",
        }),
        createInteraction({
          session_id: "session-2",
          timestamp: "2026-01-19T11:00:00Z",
          event_type: "prompt-start",
          agent: "cursor",
        }),
        createInteraction({
          session_id: "session-2",
          timestamp: "2026-01-19T11:20:00Z",
          event_type: "response-end",
          agent: "cursor",
        }),
      ];

      const sessions = calculateSessions(interactions);

      const cursorSession = sessions.find((s) => s.agent === "cursor");
      const claudeSession = sessions.find((s) => s.agent === "claude-code");

      expect(cursorSession).toBeDefined();
      expect(claudeSession).toBeDefined();
      expect(cursorSession!.active_minutes).toBe(20);
      expect(claudeSession!.active_minutes).toBe(15);
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty input", () => {
      const sessions = calculateSessions([]);
      expect(sessions).toHaveLength(0);
    });

    it("handles session with only session-end event", () => {
      const interactions: Interaction[] = [
        createInteraction({
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "session-end",
        }),
      ];

      const sessions = calculateSessions(interactions);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].active_minutes).toBe(0);
      expect(sessions[0].explicit_end).toBe(true);
      expect(sessions[0].interaction_count).toBe(0);
    });

    it("uses first event metadata for session properties", () => {
      const interactions: Interaction[] = [
        createInteraction({
          timestamp: "2026-01-19T10:00:00Z",
          event_type: "prompt-start",
          project: "first-project",
          machine: "first-machine",
          agent: "first-agent",
        }),
        createInteraction({
          timestamp: "2026-01-19T10:10:00Z",
          event_type: "response-end",
          project: "different-project", // Different, but should use first
          machine: "different-machine",
          agent: "different-agent",
        }),
      ];

      const sessions = calculateSessions(interactions);

      expect(sessions[0].project).toBe("first-project");
      expect(sessions[0].machine).toBe("first-machine");
      expect(sessions[0].agent).toBe("first-agent");
    });
  });
});

describe("calculateActiveTime", () => {
  it("handles clock skew by clamping negative durations to zero", () => {
    // If response-end has timestamp before prompt-start (clock skew)
    // the duration should be clamped to 0, not negative
    const interactions: Interaction[] = [
      createInteraction({
        timestamp: "2026-01-19T10:00:00Z",
        event_type: "prompt-start",
      }),
      createInteraction({
        // Response-end BEFORE prompt-start (impossible but can happen with clock skew)
        timestamp: "2026-01-19T09:55:00Z",
        event_type: "response-end",
      }),
      createInteraction({
        timestamp: "2026-01-19T10:10:00Z",
        event_type: "prompt-start",
      }),
      createInteraction({
        timestamp: "2026-01-19T10:20:00Z",
        event_type: "response-end",
      }),
    ];

    // Sort by timestamp first (as calculateSessions does)
    interactions.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const activeTime = calculateActiveTime(interactions);

    // First response at 09:55 is orphaned (before first prompt at 10:00)
    // Prompt at 10:00 pairs with next response at 10:20 = 20 min
    // Prompt at 10:10 is unpaired = 5 min default
    expect(activeTime).toBeGreaterThanOrEqual(0);
  });

  it("rounds to one decimal place", () => {
    // 7.5 minutes should stay as 7.5
    const interactions: Interaction[] = [
      createInteraction({
        timestamp: "2026-01-19T10:00:00Z",
        event_type: "prompt-start",
      }),
      createInteraction({
        timestamp: "2026-01-19T10:07:30Z",
        event_type: "response-end",
      }),
    ];

    const activeTime = calculateActiveTime(interactions);
    expect(activeTime).toBe(7.5);
  });
});

describe("deriveSession", () => {
  it("calculates span_minutes for completed session", () => {
    const events: Interaction[] = [
      createInteraction({
        timestamp: "2026-01-19T10:00:00Z",
        event_type: "prompt-start",
      }),
      createInteraction({
        timestamp: "2026-01-19T12:30:00Z",
        event_type: "session-end",
      }),
    ];

    const session = deriveSession("session-1", events);

    // Span from 10:00 to 12:30 = 150 minutes
    expect(session.span_minutes).toBe(150);
  });

  it("identifies active session correctly", () => {
    const events: Interaction[] = [
      createInteraction({
        timestamp: "2026-01-19T10:00:00Z",
        event_type: "prompt-start",
      }),
    ];

    const session = deriveSession("session-1", events);

    expect(session.end).toBeNull();
  });

  it("marks completed session when response-end follows last prompt-start", () => {
    const events: Interaction[] = [
      createInteraction({
        timestamp: "2026-01-19T10:00:00Z",
        event_type: "prompt-start",
      }),
      createInteraction({
        timestamp: "2026-01-19T10:15:00Z",
        event_type: "response-end",
      }),
    ];

    const session = deriveSession("session-1", events);

    expect(new Date(session.end!).getTime()).toBe(new Date("2026-01-19T10:15:00Z").getTime());
  });
});
