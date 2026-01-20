import type { Context, Next } from "hono";

type Env = {
  Bindings: {
    API_KEY: string;
  };
};

/**
 * API key authentication middleware.
 *
 * Validates the x-api-key header against the configured API_KEY environment secret.
 *
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * import { apiKeyAuth } from './middleware/auth';
 *
 * app.use('/api/*', apiKeyAuth());
 * ```
 *
 * Requirement coverage: [6.1], [6.2], [6.3], [6.4]
 */
export function apiKeyAuth() {
  return async (c: Context<Env>, next: Next) => {
    const apiKey = c.req.header("x-api-key");

    // Missing or empty API key - 401 Unauthorized
    if (!apiKey) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Invalid API key - 403 Forbidden
    if (apiKey !== c.env.API_KEY) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await next();
  };
}
