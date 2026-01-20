-- Horizon Database Schema
-- Cloudflare D1 (SQLite)

-- Interactions table
CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    machine TEXT NOT NULL,
    agent TEXT NOT NULL,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('prompt-start', 'response-end', 'session-end')),
    created_at TEXT DEFAULT (datetime('now', 'utc'))
);

-- Unique constraint for idempotency (requirement 7.6)
CREATE UNIQUE INDEX IF NOT EXISTS idx_interactions_unique
ON interactions(session_id, timestamp, event_type);

-- Index for project + time range queries (requirement 7.2)
CREATE INDEX IF NOT EXISTS idx_interactions_project_timestamp
ON interactions(project, timestamp DESC);

-- Index for date-based queries (requirement 7.3)
CREATE INDEX IF NOT EXISTS idx_interactions_date
ON interactions(date(timestamp), timestamp DESC);

-- Index for session grouping (requirement 7.4)
CREATE INDEX IF NOT EXISTS idx_interactions_session
ON interactions(session_id, timestamp ASC);

-- Index for agent statistics (requirement 7.5)
CREATE INDEX IF NOT EXISTS idx_interactions_agent
ON interactions(agent, timestamp DESC);
