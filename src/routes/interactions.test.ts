import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import interactionsRoutes from "./interactions";

// Mock D1 database
const mockRun = vi.fn();
const mockPrepare = vi.fn(() => ({
  bind: vi.fn(() => ({
    run: mockRun,
  })),
}));

type Bindings = {
  DB: { prepare: typeof mockPrepare };
  API_KEY: string;
};

// Type for API error responses
interface ApiErrorResponse {
  error: string;
}

// Type for success response
interface ApiSuccessResponse {
  status: string;
}

describe("POST /interactions", () => {
  let app: Hono<{ Bindings: Bindings }>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockResolvedValue({ success: true });

    app = new Hono<{ Bindings: Bindings }>();
    app.route("/", interactionsRoutes);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validPayload = {
    project: "horizon",
    timestamp: "2026-01-19T10:00:00Z",
    machine: "macbook",
    agent: "claude-code",
    session_id: "sess-123",
    event_type: "prompt-start",
  };

  // Requirement [1.1]: POST /api/interactions endpoint accepts interaction data
  // Requirement [1.4]: Returns HTTP 201 with {"status": "recorded"} on success
  it("returns 201 with status recorded on valid payload", async () => {
    const res = await app.request("/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

    expect(res.status).toBe(201);
    const body = await res.json() as ApiSuccessResponse;
    expect(body).toEqual({ status: "recorded" });
  });

  // Requirement [1.2]: Required fields validation
  describe("validates required fields", () => {
    const requiredFields = [
      "project",
      "timestamp",
      "machine",
      "agent",
      "session_id",
      "event_type",
    ];

    for (const field of requiredFields) {
      it(`returns 400 when ${field} is missing`, async () => {
        const payload: Record<string, string> = { ...validPayload };
        delete payload[field];

        const res = await app.request("/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

        expect(res.status).toBe(400);
        const body = await res.json() as ApiErrorResponse;
        expect(body.error).toContain(field);
      });

      it(`returns 400 when ${field} is empty string`, async () => {
        const payload = { ...validPayload, [field]: "" };

        const res = await app.request("/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

        expect(res.status).toBe(400);
        const body = await res.json() as ApiErrorResponse;
        expect(body.error).toContain(field);
      });
    }
  });

  // Requirement [1.3]: Validate event_type is one of the valid types
  describe("validates event_type", () => {
    it("accepts prompt-start", async () => {
      const res = await app.request("/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, event_type: "prompt-start" }),
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      expect(res.status).toBe(201);
    });

    it("accepts response-end", async () => {
      const res = await app.request("/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, event_type: "response-end" }),
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      expect(res.status).toBe(201);
    });

    it("accepts session-end", async () => {
      const res = await app.request("/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, event_type: "session-end" }),
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      expect(res.status).toBe(201);
    });

    it("returns 400 for invalid event_type", async () => {
      const res = await app.request("/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, event_type: "invalid-type" }),
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      expect(res.status).toBe(400);
      const body = await res.json() as ApiErrorResponse;
      expect(body.error).toContain("event_type");
      expect(body.error).toContain("prompt-start");
      expect(body.error).toContain("response-end");
      expect(body.error).toContain("session-end");
    });
  });

  // Requirement [1.5]: Validates ISO 8601 timestamp format
  describe("validates timestamp format", () => {
    it("accepts valid ISO 8601 timestamp", async () => {
      const res = await app.request("/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, timestamp: "2026-01-19T10:30:00.000Z" }),
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      expect(res.status).toBe(201);
    });

    it("returns 400 for invalid timestamp format", async () => {
      const res = await app.request("/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, timestamp: "not-a-date" }),
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      expect(res.status).toBe(400);
      const body = await res.json() as ApiErrorResponse;
      expect(body.error).toContain("timestamp");
      expect(body.error).toContain("ISO 8601");
    });

    it("returns 400 for unparseable timestamp", async () => {
      const res = await app.request("/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validPayload, timestamp: "yesterday at noon" }),
      }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

      expect(res.status).toBe(400);
      const body = await res.json() as ApiErrorResponse;
      expect(body.error).toContain("timestamp");
    });
  });

  // Requirement [1.6]: Stores with auto-generated id and created_at
  it("calls database insert with correct values", async () => {
    await app.request("/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

    expect(mockPrepare).toHaveBeenCalled();
    const calls = mockPrepare.mock.calls as unknown[][];
    expect(calls.length).toBeGreaterThan(0);
    const prepareCall = calls[0][0] as string;
    expect(prepareCall).toContain("INSERT INTO interactions");
    expect(prepareCall).toContain("project");
    expect(prepareCall).toContain("timestamp");
    expect(prepareCall).toContain("machine");
    expect(prepareCall).toContain("agent");
    expect(prepareCall).toContain("session_id");
    expect(prepareCall).toContain("event_type");
  });

  // Requirement [1.7]: Treats duplicates with ON CONFLICT DO NOTHING
  it("uses ON CONFLICT DO NOTHING for idempotency", async () => {
    await app.request("/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

    const calls = mockPrepare.mock.calls as unknown[][];
    expect(calls.length).toBeGreaterThan(0);
    const prepareCall = calls[0][0] as string;
    expect(prepareCall).toContain("ON CONFLICT");
    expect(prepareCall).toContain("DO NOTHING");
  });

  // Requirement [18.3]: Returns 500 for unexpected errors
  it("returns 500 on database error", async () => {
    mockRun.mockRejectedValueOnce(new Error("Database error"));

    const res = await app.request("/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

    expect(res.status).toBe(500);
    const body = await res.json() as ApiErrorResponse;
    expect(body.error).toBe("Internal server error");
  });

  // Requirement [18.1]: Returns JSON error responses
  it("returns JSON error responses with error field", async () => {
    const payload: Record<string, string> = { ...validPayload };
    delete payload.project;

    const res = await app.request("/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, { DB: { prepare: mockPrepare }, API_KEY: "test-key" });

    expect(res.headers.get("Content-Type")).toContain("application/json");
    const body = await res.json() as ApiErrorResponse;
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });
});
