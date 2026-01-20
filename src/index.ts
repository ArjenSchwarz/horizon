import { Hono } from "hono";
import { cors } from "hono/cors";
import { apiKeyAuth } from "./middleware/auth";
import interactionsRoutes from "./routes/interactions";
import statsRoutes from "./routes/stats";

type Bindings = {
  DB: D1Database;
  API_KEY: string;
  CORS_ORIGIN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * Root endpoint - health check
 */
app.get("/", (c) => {
  return c.text("Horizon API");
});

/**
 * CORS middleware for /api/* routes
 *
 * Configures CORS with:
 * - Origin from CORS_ORIGIN env var (defaults to "*" for development)
 * - Allowed headers including x-api-key
 * - Allowed methods: GET, POST, OPTIONS
 *
 * Requirements covered:
 * - [17.1] CORS headers allowing requests from configured origin
 * - [17.2] Responds to OPTIONS preflight requests
 * - [17.3] Allows x-api-key header
 */
app.use("/api/*", async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN || "*",
    allowHeaders: ["Content-Type", "x-api-key"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  });
  return corsMiddleware(c, next);
});

/**
 * API key authentication for /api/* routes
 *
 * Validates x-api-key header against API_KEY environment secret.
 *
 * Requirements covered:
 * - [6.1] Requires x-api-key header on all /api/* endpoints
 * - [6.2] Validates against configured secret
 * - [6.3] Returns 401 when missing
 * - [6.4] Returns 403 when invalid
 * - [6.5] API key configurable via env var/secret
 */
app.use("/api/*", apiKeyAuth());

/**
 * Mount routes under /api
 *
 * - POST /api/interactions - Record interaction (from interactions routes)
 * - GET /api/stats/weekly - Weekly statistics (from stats routes)
 * - GET /api/stats/projects - Project statistics (from stats routes)
 * - GET /api/projects/:name/sessions - Project sessions (from stats routes)
 */
app.route("/api", interactionsRoutes);
app.route("/api", statsRoutes);

/**
 * Global error handler
 *
 * Catches unexpected errors and returns a generic error response
 * without exposing internal details.
 *
 * Requirements covered:
 * - [18.3] Returns HTTP 500 for unexpected errors without internal details
 * - [18.4] Logs errors with context for debugging
 */
app.onError((err, c) => {
  // Log error for debugging (requirement 18.4)
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      endpoint: c.req.path,
      method: c.req.method,
      error_type: err.name,
      message: err.message,
    })
  );

  // Return generic error without internal details (requirement 18.3)
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
