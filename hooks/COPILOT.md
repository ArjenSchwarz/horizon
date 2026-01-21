# GitHub Copilot CLI Integration

This guide covers setting up Horizon time tracking with GitHub Copilot CLI.

## Overview

GitHub Copilot CLI provides hooks that execute at specific lifecycle points during agent execution. Horizon uses these hooks to track your coding sessions and time spent on projects.

## Prerequisites

- GitHub Copilot CLI installed and configured
- Horizon API endpoint (local, Cloudflare, or AWS deployment)
- `jq` command-line tool installed
- `curl` installed

## Hook Limitations

**Important**: As of January 2026, there is a known issue ([#991](https://github.com/github/copilot-cli/issues/991)) where `sessionStart` and `sessionEnd` hooks fire per-prompt instead of per-session in interactive mode. This means:

- Each prompt/response cycle will create a separate session in Horizon
- Session grouping may not work as expected until this is fixed
- The hooks will still track time accurately, just with more granular sessions

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
cp hooks/horizon-hook-copilot ~/.local/bin/
chmod +x ~/.local/bin/horizon-hook-copilot
```

### 3. Configure Copilot Hooks

Create a `hooks.json` file in your project directory or a global location:

**Per-Project Setup** (recommended):

```bash
# In your project root
cp hooks/copilot-hooks.json.example hooks.json
```

**Global Setup**:

```bash
# Create a global hooks directory
mkdir -p ~/.config/copilot-cli
cp hooks/copilot-hooks.json.example ~/.config/copilot-cli/hooks.json
```

The `hooks.json` file should contain:

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      {
        "type": "command",
        "bash": "~/.local/bin/horizon-hook-copilot session-start"
      }
    ],
    "sessionEnd": [
      {
        "type": "command",
        "bash": "~/.local/bin/horizon-hook-copilot session-end"
      }
    ]
  }
}
```

### 4. Enable Hooks in Copilot CLI

When running Copilot CLI, use the `--hooks` flag to specify your hooks file:

```bash
# Per-project
copilot --hooks ./hooks.json

# Global
copilot --hooks ~/.config/copilot-cli/hooks.json
```

You can also set an environment variable to avoid typing this every time:

```bash
# Add to your ~/.bashrc or ~/.zshrc
export COPILOT_HOOKS_FILE=~/.config/copilot-cli/hooks.json
```

## How It Works

### Event Mapping

Copilot CLI hooks map to Horizon events as follows:

| Copilot Hook | Horizon Event | Description |
|-------------|---------------|-------------|
| `sessionStart` | `prompt-start` | User submits a prompt |
| `sessionEnd` | `response-end` | Agent completes response |

### Session Tracking

Each Copilot session generates a unique session ID in the format: `copilot-{timestamp}-{pid}`

The hook script automatically:
1. Detects the current project from git remote or directory name
2. Normalizes project names (lowercase, hyphenated)
3. Captures machine hostname
4. Sends events to Horizon API with 5-second timeout
5. Logs errors to `~/.config/horizon/error.log` without blocking Copilot

## Verification

### Test the Hook

Run this command to verify the hook works:

```bash
~/.local/bin/horizon-hook-copilot session-start
```

Check the error log for any issues:

```bash
tail -f ~/.config/horizon/error.log
```

If successful, you should see no errors. If there are issues, the log will show HTTP status codes and error details.

### Verify in Dashboard

1. Run a Copilot CLI session with hooks enabled
2. Check your Horizon dashboard
3. You should see interactions logged with `agent: copilot-cli`

## IDE Integration

GitHub Copilot in IDEs (VS Code, JetBrains, etc.) does not currently expose lifecycle hooks like the CLI does. Time tracking for IDE usage would require:

1. **Extension/Plugin Development**: Creating a custom extension that hooks into IDE events
2. **Manual Logging**: Using IDE terminal to run CLI commands at session start/end
3. **Alternative Tracking**: Using IDE activity tracking plugins that can call external APIs

Currently, only Copilot CLI is supported for automatic time tracking.

## Troubleshooting

### Hooks Not Firing

- Verify the `--hooks` flag is being used or `COPILOT_HOOKS_FILE` is set
- Check that the hooks.json path is correct and file exists
- Ensure the hook script has execute permissions: `ls -l ~/.local/bin/horizon-hook-copilot`

### API Errors

Check the error log:
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

## References

- [GitHub Copilot CLI Hooks Documentation](https://github.com/github/copilot-cli)
- [Known Issue #991: sessionStart/End behavior](https://github.com/github/copilot-cli/issues/991)
- [Copilot CLI Changelog](https://github.com/github/copilot-cli/blob/main/changelog.md)
