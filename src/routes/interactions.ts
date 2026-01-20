import { Hono } from "hono";
import type { EventType } from "../types";

type Bindings = {
  DB: D1Database;
  API_KEY: string;
};

/**
 * Valid event types for interactions.
 */
const VALID_EVENT_TYPES: EventType[] = [
  "prompt-start",
  "response-end",
  "session-end",
];

const app = new Hono<{ Bindings: Bindings }>();

/**
 * POST /interactions - Record a new interaction
 *
 * Records an interaction from an AI coding agent.
 * Uses ON CONFLICT DO NOTHING for idempotent handling of duplicate submissions.
 *
 * Request body:
 * - project: string (required) - Project name
 * - timestamp: string (required) - ISO 8601 timestamp
 * - machine: string (required) - Machine hostname
 * - agent: string (required) - AI agent name
 * - session_id: string (required) - Session identifier
 * - event_type: string (required) - One of: prompt-start, response-end, session-end
 *
 * Responses:
 * - 201: {"status": "recorded"} - Interaction recorded successfully
 * - 400: {"error": "..."} - Validation error with details
 * - 500: {"error": "Internal server error"} - Unexpected error
 *
 * Requirements covered:
 * - [1.1] POST /api/interactions endpoint
 * - [1.2] Required fields validation
 * - [1.3] event_type validation
 * - [1.4] Returns 201 with status: recorded
 * - [1.5] Returns 400 with error message on validation failure
 * - [1.6] Stores with auto-generated id and created_at
 * - [1.7] Idempotent handling with ON CONFLICT DO NOTHING
 * - [18.1] JSON error responses
 * - [18.2] 400 for validation errors with field details
 * - [18.3] 500 for unexpected errors without internal details
 */
app.post("/interactions", async (c) => {
  let body: Record<string, unknown>;

  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  // Validate required fields (requirement 1.2)
  const requiredFields = [
    "project",
    "timestamp",
    "machine",
    "agent",
    "session_id",
    "event_type",
  ] as const;

  for (const field of requiredFields) {
    const value = body[field];
    if (value === undefined || value === null || value === "") {
      return c.json({ error: `Missing required field: ${field}` }, 400);
    }
  }

  const { project, timestamp, machine, agent, session_id, event_type } = body as {
    project: string;
    timestamp: string;
    machine: string;
    agent: string;
    session_id: string;
    event_type: string;
  };

  // Validate event_type (requirement 1.3)
  if (!VALID_EVENT_TYPES.includes(event_type as EventType)) {
    return c.json(
      {
        error: `Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(", ")}`,
      },
      400
    );
  }

  // Validate timestamp format - ISO 8601 (requirement 1.5)
  const parsedDate = Date.parse(timestamp);
  if (isNaN(parsedDate)) {
    return c.json({ error: "Invalid timestamp format. Use ISO 8601." }, 400);
  }

  // Insert with idempotency handling (requirements 1.6, 1.7)
  try {
    await c.env.DB.prepare(
      `
      INSERT INTO interactions (project, timestamp, machine, agent, session_id, event_type)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (session_id, timestamp, event_type) DO NOTHING
    `
    )
      .bind(project, timestamp, machine, agent, session_id, event_type)
      .run();

    return c.json({ status: "recorded" }, 201);
  } catch (error) {
    // Log error for debugging (requirement 18.4)
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        endpoint: c.req.path,
        error_type: error instanceof Error ? error.name : "Unknown",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    );

    // Return generic error without internal details (requirement 18.3)
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default app;
