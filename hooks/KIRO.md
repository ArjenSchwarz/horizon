# Kiro CLI Integration

This guide covers setting up Horizon time tracking with Kiro CLI.

## Overview

Kiro CLI provides hooks at multiple lifecycle points during agent execution. Horizon uses these hooks to track your coding sessions and time spent on projects.

## Prerequisites

- Kiro CLI installed and configured
- Horizon API endpoint (local, Cloudflare, or AWS deployment)
- `jq` command-line tool installed
- `curl` installed

## Hook Points

Kiro provides several lifecycle hooks:

| Hook | When It Fires | Used by Horizon |
|------|---------------|-----------------|
| `agentSpawn` | When an agent is spawned | ❌ Skipped |
| `userPromptSubmit` | User submits a prompt | ✅ `prompt-start` |
| `preToolUse` | Before tool execution | ❌ Not used |
| `postToolUse` | After tool execution | ❌ Not used |
| `stop` | Agent stops | ✅ `response-end` |

## Installation

### 1. Configure Horizon API

Create the config file at `~/.config/horizon/config.json`:

```bash
mkdir -p ~/.config/horizon
cat > ~/.config/horizon/config.json <<EOF
{
  "api_url": "https://your-horizon-api.example.com",
  "api_key": "your-api-key-here"
}
EOF
chmod 600 ~/.config/horizon/config.json
```

Replace with your actual API URL and key:
- Local: `http://localhost:3000`
- Cloudflare: `https://horizon-api.your-subdomain.workers.dev`
- AWS: Your API Gateway URL

### 2. Install Hook Script

Copy the hook script to your local bin directory:

```bash
mkdir -p ~/.local/bin
cp hooks/horizon-hook-kiro ~/.local/bin/
chmod +x ~/.local/bin/horizon-hook-kiro
```

### 3. Configure Kiro Hooks

Kiro supports two methods for configuring hooks:

#### Method A: Agent Configuration (Recommended)

Edit your Kiro agent configuration file. This is typically located at:
- `~/.config/kiro/agents/default.json` (global)
- `.kiro/agents/custom.json` (project-specific)

Add or modify the `hooks` section:

```json
{
  "name": "default-with-horizon",
  "model": "claude-sonnet-4-5",
  "hooks": {
    "userPromptSubmit": {
      "command": "~/.local/bin/horizon-hook-kiro prompt-start",
      "timeout_ms": 5000
    },
    "stop": {
      "command": "~/.local/bin/horizon-hook-kiro response-end",
      "timeout_ms": 5000
    }
  }
}
```

You can use the example file as a starting point:

```bash
# For global setup
mkdir -p ~/.config/kiro/agents
cp hooks/kiro-agent-config.json.example ~/.config/kiro/agents/horizon.json

# For project-specific setup
mkdir -p .kiro/agents
cp hooks/kiro-agent-config.json.example .kiro/agents/horizon.json
```

Then use the agent with:

```bash
kiro --agent horizon
```

#### Method B: Standalone Hooks (Alternative)

Create standalone hook files in the Kiro hooks directory:

```bash
mkdir -p ~/.config/kiro/hooks

# Create userPromptSubmit hook
cat > ~/.config/kiro/hooks/userPromptSubmit.json <<EOF
{
  "command": "~/.local/bin/horizon-hook-kiro prompt-start",
  "timeout_ms": 5000
}
EOF

# Create stop hook
cat > ~/.config/kiro/hooks/stop.json <<EOF
{
  "command": "~/.local/bin/horizon-hook-kiro response-end",
  "timeout_ms": 5000
}
EOF
```

These standalone hooks will apply to all Kiro sessions.

## How It Works

### Event Mapping

Kiro hooks map to Horizon events as follows:

| Kiro Hook | Horizon Event | Description |
|-----------|---------------|-------------|
| `userPromptSubmit` | `prompt-start` | User submits a prompt |
| `stop` | `response-end` | Agent stops processing |

The `agentSpawn` event is intentionally skipped as it doesn't represent active coding time.

### Session Tracking

Each Kiro session generates a unique session ID. The hook script:
1. Attempts to extract `session_id` from stdin JSON if provided by Kiro
2. Falls back to generating: `kiro-{timestamp}-{pid}`

The hook script automatically:
1. Detects the current project from git remote or directory name
2. Normalizes project names (lowercase, hyphenated)
3. Captures machine hostname
4. Sends events to Horizon API with 5-second timeout
5. Logs all activity to `~/.config/horizon/hook.log` for debugging
6. Logs errors to `~/.config/horizon/error.log` without blocking Kiro

## Verification

### Test the Hook

Run this command to verify the hook works:

```bash
~/.local/bin/horizon-hook-kiro prompt-start
```

Check the hook activity log to verify it's working:

```bash
tail -f ~/.config/horizon/hook.log
```

You should see log entries showing the hook invocation, session ID, project detection, and API response. If there are issues, also check the error log:

```bash
tail -f ~/.config/horizon/error.log
```

### Verify in Dashboard

1. Run a Kiro CLI session with hooks configured
2. Check your Horizon dashboard
3. You should see interactions logged with `agent: kiro-cli`

## IDE Integration

Kiro also provides an IDE extension/plugin with similar hook capabilities. The setup is similar:

### VS Code Extension

If using the Kiro VS Code extension:

1. Open VS Code Settings (JSON)
2. Add Kiro hook configuration:

```json
{
  "kiro.hooks": {
    "userPromptSubmit": {
      "command": "~/.local/bin/horizon-hook-kiro prompt-start",
      "timeout_ms": 5000
    },
    "stop": {
      "command": "~/.local/bin/horizon-hook-kiro response-end",
      "timeout_ms": 5000
    }
  }
}
```

### JetBrains IDEs

For JetBrains IDE plugin:

1. Go to Settings → Tools → Kiro
2. Navigate to Hooks configuration
3. Add the same hook commands as shown above

The hook script will work the same way for both CLI and IDE usage.

## Advanced Configuration

### Custom Session IDs

If you want to track continuous coding sessions across multiple Kiro invocations, you can pass a custom session ID via environment variable:

```bash
export HORIZON_SESSION_ID="my-feature-session"
kiro --agent horizon
```

Modify the hook script to use this environment variable if set.

### Filtering Projects

You can modify the hook script to skip certain projects by adding filtering logic:

```bash
# In horizon-hook-kiro, after PROJECT is determined:
if [[ "$PROJECT" == "test-project" || "$PROJECT" == "scratch" ]]; then
    exit 0
fi
```

## Troubleshooting

### Hooks Not Firing

First, check the hook activity log to see if hooks are being invoked:
```bash
tail ~/.config/horizon/hook.log
```

- Verify hooks are configured in your agent config: `cat ~/.config/kiro/agents/horizon.json`
- Check you're using the correct agent: `kiro --agent horizon`
- Ensure the hook script has execute permissions: `ls -l ~/.local/bin/horizon-hook-kiro`

### API Errors

Check the hook activity log for API response codes:
```bash
tail ~/.config/horizon/hook.log
```

Or check the error log for detailed error messages:
```bash
tail ~/.config/horizon/error.log
```

Common issues:
- `Config file not found`: Create `~/.config/horizon/config.json`
- `HTTP 401/403`: Check your API key is correct
- `HTTP 000`: Network timeout or API unreachable

### Project Name Issues

If the project name isn't detected correctly:
- Ensure you're in a git repository with a remote: `git remote -v`
- The script uses the repo name from the remote URL
- Falls back to directory name if not in a git repo

### Hook Timeouts

The default timeout is 5 seconds (5000ms). If you experience timeouts:
- Increase `timeout_ms` in your hook configuration
- Check network connectivity to your Horizon API
- Consider using a local deployment for faster response times

## References

- [Kiro CLI Hooks Documentation](https://kiro.dev/docs/cli/hooks/)
- [Kiro IDE Hooks Documentation](https://kiro.dev/docs/hooks/)
- [Kiro Agent Configuration Reference](https://kiro.dev/docs/cli/custom-agents/configuration-reference/)
- [Kiro Settings Reference](https://kiro.dev/docs/cli/reference/settings/)
