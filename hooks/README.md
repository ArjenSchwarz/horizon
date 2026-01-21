# Horizon Hooks

This directory contains hook scripts and configuration examples for integrating various AI coding assistants with Horizon time tracking.

## Overview

Horizon tracks your coding sessions by receiving events from AI coding assistants. Each assistant has different hook mechanisms, and this directory provides ready-to-use scripts for:

- **Claude Code** - Official Anthropic CLI
- **GitHub Copilot CLI** - GitHub's command-line coding assistant
- **Kiro** - Agentic AI development tool (CLI and IDE)

## Supported Assistants

| Assistant | CLI Support | IDE Support | Documentation |
|-----------|-------------|-------------|---------------|
| Claude Code | ✅ Full | ❌ N/A | [claude-settings.json.example](claude-settings.json.example) |
| GitHub Copilot CLI | ✅ Full | ⚠️ Limited | [COPILOT.md](COPILOT.md) |
| Kiro | ✅ Full | ✅ Full | [KIRO.md](KIRO.md) |

## Quick Start

### 1. Configure Horizon API

All hooks require a configuration file at `~/.config/horizon/config.json`:

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

Use the appropriate URL for your deployment:
- Local: `http://localhost:3000`
- Cloudflare: `https://horizon-api.your-subdomain.workers.dev`
- AWS: Your API Gateway URL

You can use the provided example as a template:
```bash
cp config.example.json ~/.config/horizon/config.json
# Edit the file with your actual API URL and key
```

### 2. Install Hook Scripts

**Option A: Using Make (Recommended)**

From the repository root, run:

```bash
make install-hooks
```

This installs all hook scripts to `~/.local/bin/` and makes them executable.

**Option B: Manual Installation**

Copy individual hook scripts to your local bin directory:

```bash
mkdir -p ~/.local/bin

# For Claude Code
cp hooks/horizon-hook-claude ~/.local/bin/
chmod +x ~/.local/bin/horizon-hook-claude

# For GitHub Copilot CLI
cp hooks/horizon-hook-copilot ~/.local/bin/
chmod +x ~/.local/bin/horizon-hook-copilot

# For Kiro
cp hooks/horizon-hook-kiro ~/.local/bin/
chmod +x ~/.local/bin/horizon-hook-kiro
```

### 3. Configure Your Assistant

Follow the specific guide for your coding assistant:

- **Claude Code**: Copy `claude-settings.json.example` to `~/.claude/settings.json` (or merge with existing settings)
- **GitHub Copilot CLI**: See [COPILOT.md](COPILOT.md) for detailed setup
- **Kiro**: See [KIRO.md](KIRO.md) for CLI and IDE configuration

## How It Works

### Event Flow

1. You interact with your AI coding assistant (prompt, response, etc.)
2. The assistant triggers hooks at specific lifecycle points
3. Hook scripts capture context (project, timestamp, session ID)
4. Scripts send events to Horizon API
5. Horizon calculates sessions and tracks time

### Session Derivation

Horizon derives coding sessions from event pairs:
- `prompt-start` + `response-end` = active coding time
- Multiple pairs in sequence (within 30 min) = single session
- `session-end` marks explicit session closure

### Tracked Information

Each interaction records:
- **Project**: Detected from git remote or directory name
- **Timestamp**: ISO 8601 UTC format
- **Machine**: Hostname (for multi-machine tracking)
- **Agent**: Which coding assistant was used
- **Session ID**: Groups related interactions
- **Event Type**: prompt-start, response-end, or session-end

## Files in This Directory

### Hook Scripts
- `horizon-hook-claude` - Claude Code hook script
- `horizon-hook-copilot` - GitHub Copilot CLI hook script
- `horizon-hook-kiro` - Kiro hook script

### Configuration Examples
- `config.example.json` - Horizon API configuration template
- `claude-settings.json.example` - Claude Code hooks configuration
- `copilot-hooks.json.example` - Copilot CLI hooks configuration
- `kiro-agent-config.json.example` - Kiro agent configuration with hooks

### Documentation
- `README.md` - This file
- `COPILOT.md` - GitHub Copilot CLI integration guide
- `KIRO.md` - Kiro integration guide (CLI and IDE)

## Troubleshooting

### Common Issues

**Hooks not firing:**
- Check hook activity log: `tail ~/.config/horizon/hook.log`
- Verify the hook script is executable: `ls -l ~/.local/bin/horizon-hook*`
- Check configuration files are in the right location
- Review assistant-specific documentation

**API errors:**
- Check hook activity log: `tail ~/.config/horizon/hook.log`
- Check error log: `tail ~/.config/horizon/error.log`
- Verify API URL and key in `~/.config/horizon/config.json`
- Test API connectivity: `curl -H "x-api-key: YOUR_KEY" YOUR_API_URL/api/projects`

**Project detection issues:**
- Ensure you're in a git repository: `git remote -v`
- Hook scripts use repo name from remote URL
- Falls back to directory name if not a git repo

### Logging

All hook scripts provide two types of logging:

**Hook Activity Log** (`~/.config/horizon/hook.log`)
- Records all hook invocations and their outcomes
- Shows session IDs, project detection, and API responses
- Useful for verifying hooks are being triggered

```bash
tail -f ~/.config/horizon/hook.log
```

**Error Log** (`~/.config/horizon/error.log`)
- Records only errors and failures
- API connection issues, config problems, etc.

```bash
tail -f ~/.config/horizon/error.log
```

Each log entry includes a timestamp and agent identifier (claude, copilot, kiro) for easy filtering.

The hooks are designed to fail silently (always exit 0) to avoid blocking your coding assistant.

## Adding New Assistants

To add support for a new coding assistant:

1. Create a hook script following the existing patterns:
   - Accept event type as argument
   - Read config from `~/.config/horizon/config.json`
   - Extract or generate session ID
   - Detect project name
   - Map assistant events to Horizon events (prompt-start, response-end, session-end)
   - Send to API with timeout
   - Log errors without blocking

2. Create configuration examples for the assistant

3. Write documentation explaining setup and limitations

4. Update this README with the new assistant

## References

- [Claude Code Documentation](https://docs.anthropic.com/claude/docs/claude-code)
- [GitHub Copilot CLI](https://github.com/github/copilot-cli)
- [Kiro Documentation](https://kiro.dev/docs/)
- [Horizon API Documentation](../README.md)

## Support

For issues specific to:
- **Horizon**: Open an issue in this repository
- **Claude Code**: See Claude Code documentation or support channels
- **Copilot CLI**: See [github/copilot-cli](https://github.com/github/copilot-cli)
- **Kiro**: See [Kiro documentation](https://kiro.dev/docs/)
