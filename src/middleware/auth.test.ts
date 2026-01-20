import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { apiKeyAuth } from "./auth";

type Bindings = {
  API_KEY: string;
};

describe("apiKeyAuth middleware", () => {
  let app: Hono<{ Bindings: Bindings }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Bindings }>();
    app.use("/api/*", apiKeyAuth());
    app.get("/api/test", (c) => c.json({ message: "success" }));
    app.get("/public", (c) => c.json({ message: "public" }));
  });

  describe("missing API key", () => {
    it("returns 401 when x-api-key header is missing", async () => {
      const res = await app.request("/api/test", {}, { API_KEY: "test-secret" });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when x-api-key header is empty", async () => {
      const res = await app.request(
        "/api/test",
        { headers: { "x-api-key": "" } },
        { API_KEY: "test-secret" }
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });
  });

  describe("invalid API key", () => {
    it("returns 403 when API key does not match", async () => {
      const res = await app.request(
        "/api/test",
        { headers: { "x-api-key": "wrong-key" } },
        { API_KEY: "test-secret" }
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({ error: "Forbidden" });
    });

    it("returns 403 when API key differs by case", async () => {
      const res = await app.request(
        "/api/test",
        { headers: { "x-api-key": "TEST-SECRET" } },
        { API_KEY: "test-secret" }
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({ error: "Forbidden" });
    });
  });

  describe("valid API key", () => {
    it("allows request when API key matches", async () => {
      const res = await app.request(
        "/api/test",
        { headers: { "x-api-key": "test-secret" } },
        { API_KEY: "test-secret" }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ message: "success" });
    });

    it("allows request with long API key", async () => {
      const longKey = "a".repeat(64);
      const res = await app.request(
        "/api/test",
        { headers: { "x-api-key": longKey } },
        { API_KEY: longKey }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ message: "success" });
    });
  });

  describe("routes without middleware", () => {
    it("does not affect routes outside /api/*", async () => {
      const res = await app.request("/public", {}, { API_KEY: "test-secret" });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ message: "public" });
    });
  });
});
