<p align="center">
  <img src="dashboard/horizon-180.png" alt="Horizon" width="120">
</p>

# Horizon

Personal time tracking system for AI coding sessions. Tracks which projects you work on, which agents (Claude Code, Copilot, Kiro, etc.) you use, and for how long.

Sessions are derived from interaction timestamps - 30 minutes of idle time starts a new session.

## Features

- Track coding time across multiple projects
- Support for multiple AI agents
- Session derivation from paired events (prompt-start → response-end)
- Weekly statistics dashboard
- Streak tracking for consecutive coding days

## Architecture

Cloudflare Workers + D1 database with a static HTML/CSS/JS dashboard.

```
src/
├── index.ts              # Worker entry point, CORS, routing
├── types.ts              # TypeScript type definitions
├── middleware/
│   └── auth.ts           # API key authentication
├── routes/
│   ├── interactions.ts   # POST /api/interactions
│   └── stats.ts          # GET /api/stats/weekly, projects, sessions
└── services/
    ├── sessions.ts       # Session derivation logic
    └── statistics.ts     # Statistics calculations

dashboard/
├── index.html            # Dashboard HTML
├── styles.css            # Ground Control theme
├── config.js             # API URL configuration
└── app.js                # Dashboard application logic

hooks/
├── horizon-hook          # Claude Code hook script
├── config.example.json   # Hook configuration template
└── settings.json.example # Claude Code settings template

schema.sql                # D1 database schema
```

## Deployment

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers enabled
- Wrangler CLI (`npm install -g wrangler`)

### 1. Clone and Install

```bash
git clone <repo-url>
cd horizon
make setup  # or: npm install
```

### 2. Configure Wrangler

Copy the sample configuration file:

```bash
cp wrangler-sample.toml wrangler.toml
```

### 3. Create D1 Database

```bash
wrangler d1 create horizon
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "horizon"
database_id = "your-database-id-here"
```

### 4. Initialize Schema

```bash
make schema-init  # or: wrangler d1 execute horizon --file=schema.sql
```

### 5. Set API Key Secret

Generate a secure API key (e.g., `openssl rand -hex 32`) and set it:

```bash
wrangler secret put API_KEY
```

### 6. Deploy Worker

```bash
make deploy  # or: wrangler deploy
```

Note the deployed URL (e.g., `https://horizon-api.your-subdomain.workers.dev`).

### 7. Deploy Dashboard

Update `dashboard/config.js` with your Worker URL:

```javascript
const CONFIG = {
  API_URL: 'https://horizon-api.your-subdomain.workers.dev',
  // ...
};
```

Deploy to Cloudflare Pages:

```bash
cd dashboard
wrangler pages deploy
```

The `wrangler.toml` in the dashboard directory configures the deployment. Or host the static files anywhere (GitHub Pages, Netlify, etc.).

### 8. Configure CORS (Production)

Update `wrangler.toml` to restrict CORS to your dashboard URL:

```toml
[vars]
CORS_ORIGIN = "https://horizon-dashboard.pages.dev"
```

Redeploy the Worker after changing.

## Claude Code Integration

### 1. Install Hook Script

```bash
mkdir -p ~/.local/bin
cp hooks/horizon-hook ~/.local/bin/
chmod +x ~/.local/bin/horizon-hook
```

### 2. Create Configuration

```bash
mkdir -p ~/.config/horizon
cp hooks/config.example.json ~/.config/horizon/config.json
chmod 600 ~/.config/horizon/config.json
```

Edit `~/.config/horizon/config.json`:

```json
{
  "api_url": "https://horizon-api.your-subdomain.workers.dev",
  "api_key": "your-api-key-here"
}
```

### 3. Configure Claude Code Hooks

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/.local/bin/horizon-hook prompt-start",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/.local/bin/horizon-hook response-end",
            "timeout": 5
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/.local/bin/horizon-hook session-end",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

Or copy the example:

```bash
cp hooks/settings.json.example ~/.claude/settings.json
```

### Verify Integration

After your next Claude Code session, check:

1. **Error log**: `~/.config/horizon/error.log` (should be empty or show only startup info)
2. **Dashboard**: Open your dashboard URL and enter your API key

## API Endpoints

All endpoints require `x-api-key` header.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/interactions` | POST | Record an interaction event |
| `/api/stats/weekly` | GET | Weekly statistics with daily breakdown |
| `/api/stats/projects` | GET | Project statistics (default: last 30 days) |
| `/api/projects/:name/sessions` | GET | Sessions for a specific project |

### Record Interaction

```bash
curl -X POST https://horizon-api.your-subdomain.workers.dev/api/interactions \
  -H "x-api-key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "project": "my-project",
    "timestamp": "2026-01-20T10:30:00Z",
    "machine": "macbook",
    "agent": "claude-code",
    "session_id": "abc123",
    "event_type": "prompt-start"
  }'
```

### Get Weekly Stats

```bash
curl https://horizon-api.your-subdomain.workers.dev/api/stats/weekly \
  -H "x-api-key: your-api-key"
```

## Development

```bash
make dev          # Start local dev server
make test         # Run tests
make test-watch   # Run tests in watch mode
make lint         # Type check
```

### Local Database

```bash
make schema-init-local  # Initialize local D1 database
```

## Troubleshooting

### Hook not sending data

1. Check error log: `cat ~/.config/horizon/error.log`
2. Verify config exists: `cat ~/.config/horizon/config.json`
3. Test manually: `echo '{}' | ~/.local/bin/horizon-hook prompt-start`

### Dashboard shows "Invalid API key"

1. Verify the API key matches what you set with `wrangler secret put API_KEY`
2. Clear localStorage and re-enter the key

### CORS errors in dashboard

1. Check `CORS_ORIGIN` in `wrangler.toml` matches your dashboard URL
2. Redeploy after changing: `make deploy`

## Security Notes

- API keys are stored in plaintext in `~/.config/horizon/config.json` and browser localStorage
- This is acceptable for a personal tool but not suitable for shared environments
- Use unique API keys per machine
- Rotate keys if compromise is suspected
- The API has no rate limiting in v1

## License

MIT
