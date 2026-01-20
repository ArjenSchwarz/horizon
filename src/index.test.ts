import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import app from "./index";

type Bindings = {
  DB: D1Database;
  API_KEY: string;
  CORS_ORIGIN: string;
};

/**
 * Creates a mock D1Database for testing.
 */
function createMockDB() {
  const mockStatement = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: [] }),
    run: vi.fn().mockResolvedValue({ success: true }),
  };

  return {
    prepare: vi.fn().mockReturnValue(mockStatement),
    _mockStatement: mockStatement,
  };
}

describe("Worker entry point (index.ts)", () => {
  let mockDB: ReturnType<typeof createMockDB>;
  let bindings: Bindings;

  beforeEach(() => {
    mockDB = createMockDB();
    bindings = {
      DB: mockDB as unknown as D1Database,
      API_KEY: "test-api-key",
      CORS_ORIGIN: "https://dashboard.example.com",
    };
  });

  describe("root endpoint", () => {
    it("returns health check response", async () => {
      const res = await app.request("/", {}, bindings);

      expect(res.status).toBe(200);
      expect(await res.text()).toBe("Horizon API");
    });

    it("does not require API key", async () => {
      const res = await app.request("/", {}, bindings);

      expect(res.status).toBe(200);
    });
  });

  describe("CORS middleware", () => {
    it("includes CORS headers with configured origin", async () => {
      const res = await app.request(
        "/api/stats/weekly",
        {
          method: "GET",
          headers: {
            "x-api-key": "test-api-key",
            Origin: "https://dashboard.example.com",
          },
        },
        bindings
      );

      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://dashboard.example.com"
      );
    });

    it("defaults to * when CORS_ORIGIN is not set", async () => {
      const bindingsWithoutCors = {
        ...bindings,
        CORS_ORIGIN: "",
      };

      const res = await app.request(
        "/api/stats/weekly",
        {
          method: "GET",
          headers: {
            "x-api-key": "test-api-key",
            Origin: "https://any-origin.com",
          },
        },
        bindingsWithoutCors
      );

      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("responds to OPTIONS preflight requests", async () => {
      const res = await app.request(
        "/api/interactions",
        {
          method: "OPTIONS",
          headers: {
            Origin: "https://dashboard.example.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "x-api-key, content-type",
          },
        },
        bindings
      );

      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
      expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
        "x-api-key"
      );
    });

    it("allows x-api-key header in CORS", async () => {
      const res = await app.request(
        "/api/interactions",
        {
          method: "OPTIONS",
          headers: {
            Origin: "https://dashboard.example.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "x-api-key",
          },
        },
        bindings
      );

      expect(res.status).toBe(204);
      const allowedHeaders = res.headers.get("Access-Control-Allow-Headers");
      expect(allowedHeaders?.toLowerCase()).toContain("x-api-key");
    });
  });

  describe("API key authentication", () => {
    it("requires x-api-key header on /api/* routes", async () => {
      const res = await app.request(
        "/api/stats/weekly",
        { method: "GET" },
        bindings
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns 403 for invalid API key", async () => {
      const res = await app.request(
        "/api/stats/weekly",
        {
          method: "GET",
          headers: { "x-api-key": "wrong-key" },
        },
        bindings
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({ error: "Forbidden" });
    });

    it("allows requests with valid API key", async () => {
      const res = await app.request(
        "/api/stats/weekly",
        {
          method: "GET",
          headers: { "x-api-key": "test-api-key" },
        },
        bindings
      );

      expect(res.status).toBe(200);
    });
  });

  describe("route mounting", () => {
    it("mounts interactions route at POST /api/interactions", async () => {
      const res = await app.request(
        "/api/interactions",
        {
          method: "POST",
          headers: {
            "x-api-key": "test-api-key",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            project: "test-project",
            timestamp: "2026-01-20T10:00:00Z",
            machine: "test-machine",
            agent: "claude-code",
            session_id: "session-123",
            event_type: "prompt-start",
          }),
        },
        bindings
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toEqual({ status: "recorded" });
    });

    it("mounts stats/weekly route at GET /api/stats/weekly", async () => {
      const res = await app.request(
        "/api/stats/weekly",
        {
          method: "GET",
          headers: { "x-api-key": "test-api-key" },
        },
        bindings
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("total_hours");
      expect(body).toHaveProperty("total_sessions");
    });

    it("mounts stats/projects route at GET /api/stats/projects", async () => {
      const res = await app.request(
        "/api/stats/projects",
        {
          method: "GET",
          headers: { "x-api-key": "test-api-key" },
        },
        bindings
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("projects");
    });

    it("mounts project sessions route at GET /api/projects/:name/sessions", async () => {
      // Set up mock to return no results (project doesn't exist)
      mockDB._mockStatement.all.mockResolvedValue({ results: [] });

      const res = await app.request(
        "/api/projects/test-project/sessions",
        {
          method: "GET",
          headers: { "x-api-key": "test-api-key" },
        },
        bindings
      );

      // 404 is expected because project doesn't exist in our mock
      expect(res.status).toBe(404);
    });
  });

  describe("error handling", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("returns 500 for unexpected errors without internal details", async () => {
      // Make the DB throw an error
      mockDB.prepare.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const res = await app.request(
        "/api/stats/weekly",
        {
          method: "GET",
          headers: { "x-api-key": "test-api-key" },
        },
        bindings
      );

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body).toEqual({ error: "Internal server error" });
      // Should not expose internal error message
      expect(JSON.stringify(body)).not.toContain("Database connection failed");
    });

    it("logs errors with context for debugging", async () => {
      // Make the DB throw an error
      const testError = new Error("Test database error");
      mockDB.prepare.mockImplementation(() => {
        throw testError;
      });

      await app.request(
        "/api/stats/weekly",
        {
          method: "GET",
          headers: { "x-api-key": "test-api-key" },
        },
        bindings
      );

      expect(consoleSpy).toHaveBeenCalled();
      const loggedMessage = consoleSpy.mock.calls[0][0] as string;
      const loggedData = JSON.parse(loggedMessage);

      expect(loggedData).toHaveProperty("timestamp");
      expect(loggedData).toHaveProperty("endpoint", "/api/stats/weekly");
      expect(loggedData).toHaveProperty("method", "GET");
      expect(loggedData).toHaveProperty("error_type", "Error");
      expect(loggedData).toHaveProperty("message", "Test database error");
    });
  });
});
