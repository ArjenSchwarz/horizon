import { Hono } from "hono";

type Bindings = {
  DB: D1Database;
  API_KEY: string;
  CORS_ORIGIN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  return c.text("Horizon API");
});

export default app;
