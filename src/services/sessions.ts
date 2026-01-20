import type { Interaction, Session } from "../types";

/**
 * Default duration in minutes for unpaired prompt-start events.
 * Used when a prompt-start has no matching response-end (e.g., crash, network issue).
 * See Decision 7 in decision_log.md for rationale.
 */
const DEFAULT_DURATION_MINUTES = 5;

/**
 * Calculates derived sessions from a list of interactions.
 *
 * Groups interactions by session_id, then derives session metadata including
 * active time, span, and whether the session was explicitly ended.
 *
 * Requirements covered:
 * - [2.1] Groups interactions by session_id
 * - [2.7] Processes events in timestamp order
 * - [5.5] Returns sessions sorted by start time descending
 */
export function calculateSessions(interactions: Interaction[]): Session[] {
  if (interactions.length === 0) {
    return [];
  }

  // Group interactions by session_id
  const grouped = new Map<string, Interaction[]>();
  for (const interaction of interactions) {
    const existing = grouped.get(interaction.session_id) || [];
    existing.push(interaction);
    grouped.set(interaction.session_id, existing);
  }

  const sessions: Session[] = [];

  for (const [sessionId, events] of grouped) {
    // Sort events by timestamp (requirement 2.7)
    events.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const session = deriveSession(sessionId, events);
    sessions.push(session);
  }

  // Sort sessions by start time descending (most recent first, requirement 5.5)
  sessions.sort(
    (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()
  );

  return sessions;
}

/**
 * Derives a single session from its events.
 *
 * Calculates:
 * - Session start (first event timestamp)
 * - Session end (last event timestamp, or null if active)
 * - Active time (sum of prompt-response pair durations)
 * - Whether session was explicitly ended
 *
 * Requirements covered:
 * - [2.2] Session span = first to last event
 * - [2.3] Active time = sum of paired prompt-response durations
 * - [2.5] Marks explicit end when session-end event exists
 * - [2.6] Interaction count = number of prompt-start events
 * - [5.7] Returns null end for active sessions
 */
export function deriveSession(
  sessionId: string,
  events: Interaction[]
): Session {
  if (events.length === 0) {
    throw new Error("Cannot derive session from empty events");
  }

  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];

  // Check if session was explicitly ended
  const hasSessionEnd = events.some((e) => e.event_type === "session-end");

  // Find the last prompt-start to determine if session is active
  const lastPromptStart = [...events]
    .reverse()
    .find((e) => e.event_type === "prompt-start");

  // Session is active if:
  // - No session-end event AND
  // - There's a prompt-start without a following response-end
  const hasMatchingResponseEnd = lastPromptStart
    ? events.some(
        (e) =>
          e.event_type === "response-end" &&
          new Date(e.timestamp) > new Date(lastPromptStart.timestamp)
      )
    : true;

  // Active session: has unpaired prompt-start and no explicit session-end
  const isActive = !hasSessionEnd && !hasMatchingResponseEnd;

  // Calculate active time from paired events
  const activeMinutes = calculateActiveTime(events);

  // Session times
  const startTime = new Date(firstEvent.timestamp);
  const endTime = isActive ? null : new Date(lastEvent.timestamp);

  // Span is calculated differently for active vs completed sessions
  // For active sessions, we still calculate span to the last event we have
  const spanMinutes = endTime
    ? Math.round((endTime.getTime() - startTime.getTime()) / 60000)
    : Math.round((new Date(lastEvent.timestamp).getTime() - startTime.getTime()) / 60000);

  // Count prompt-start events (requirement 2.6)
  const interactionCount = events.filter(
    (e) => e.event_type === "prompt-start"
  ).length;

  return {
    session_id: sessionId,
    project: firstEvent.project,
    start: firstEvent.timestamp,
    end: endTime?.toISOString() ?? null,
    span_minutes: spanMinutes,
    active_minutes: activeMinutes,
    machine: firstEvent.machine,
    agent: firstEvent.agent,
    interaction_count: interactionCount,
    explicit_end: hasSessionEnd,
  };
}

/**
 * Calculates total active time from paired prompt-start and response-end events.
 *
 * Uses a FIFO queue to pair prompt-starts with response-ends:
 * - Each prompt-start is added to a queue
 * - Each response-end pairs with and removes the oldest unpaired prompt-start
 * - Unpaired prompt-starts get the default duration (5 minutes)
 * - Orphaned response-ends (no unpaired prompt-start) are ignored
 *
 * Requirements covered:
 * - [2.3] Sum of paired prompt-response durations
 * - [2.4] 5-minute default for unpaired prompt-start
 * - [2.7] FIFO pairing for consecutive prompt-starts
 * - [2.8] Orphaned response-end events are ignored
 */
export function calculateActiveTime(events: Interaction[]): number {
  let totalMinutes = 0;
  const promptStarts: Interaction[] = [];

  for (const event of events) {
    if (event.event_type === "prompt-start") {
      promptStarts.push(event);
    } else if (event.event_type === "response-end") {
      // Pair with earliest unpaired prompt-start (FIFO, requirement 2.7)
      const promptStart = promptStarts.shift();
      if (promptStart) {
        const start = new Date(promptStart.timestamp).getTime();
        const end = new Date(event.timestamp).getTime();
        // Clamp to zero to handle potential clock skew
        totalMinutes += Math.max(0, (end - start) / 60000);
      }
      // If no prompt-start to pair, response-end is orphaned and ignored (requirement 2.8)
    }
    // session-end events don't affect active time calculation
  }

  // Unpaired prompt-starts get default duration (requirement 2.4)
  totalMinutes += promptStarts.length * DEFAULT_DURATION_MINUTES;

  // Round to 1 decimal place
  return Math.round(totalMinutes * 10) / 10;
}
