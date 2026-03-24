#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Frontier Digest — Setup Script
#
# Checks prerequisites, installs dependencies, and gets you running.
# Usage: ./setup.sh [--skip-checks] [--with-slack]
# ─────────────────────────────────────────────────────────────────────────────

BOLD="\033[1m"
DIM="\033[2m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
RESET="\033[0m"

ok()   { printf "  ${GREEN}✓${RESET} %s\n" "$1"; }
warn() { printf "  ${YELLOW}!${RESET} %s\n" "$1"; }
fail() { printf "  ${RED}✗${RESET} %s\n" "$1"; }
info() { printf "  ${DIM}%s${RESET}\n" "$1"; }
step() { printf "\n${BOLD}${CYAN}%s${RESET}\n" "$1"; }

SKIP_CHECKS=false
WITH_SLACK=false

for arg in "$@"; do
  case "$arg" in
    --skip-checks) SKIP_CHECKS=true ;;
    --with-slack)  WITH_SLACK=true ;;
    --help|-h)
      echo "Usage: ./setup.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-checks   Skip prerequisite checks (use if you know they're met)"
      echo "  --with-slack    Include Slack setup prompts"
      echo "  -h, --help      Show this help"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Run ./setup.sh --help for usage"
      exit 1
      ;;
  esac
done

printf "\n${BOLD}  Frontier Digest — Setup${RESET}\n"
printf "  ${DIM}Domain-configurable weekly research digests${RESET}\n"

# ── Prerequisites ────────────────────────────────────────────────────────────

errors=0

if [ "$SKIP_CHECKS" = false ]; then
  step "Checking prerequisites..."

  # Node.js
  if command -v node &>/dev/null; then
    node_version=$(node --version | sed 's/v//')
    node_major=$(echo "$node_version" | cut -d. -f1)
    if [ "$node_major" -ge 20 ]; then
      ok "Node.js $node_version"
    else
      fail "Node.js $node_version (need >= 20)"
      info "Install: brew install node  or  https://nodejs.org"
      errors=$((errors + 1))
    fi
  else
    fail "Node.js not found"
    info "Install: brew install node  or  https://nodejs.org"
    errors=$((errors + 1))
  fi

  # Bun
  if command -v bun &>/dev/null; then
    bun_version=$(bun --version)
    ok "Bun $bun_version"
  else
    fail "Bun not found"
    info "Install: curl -fsSL https://bun.sh/install | bash"
    errors=$((errors + 1))
  fi

  # pnpm
  if command -v pnpm &>/dev/null; then
    pnpm_version=$(pnpm --version)
    pnpm_major=$(echo "$pnpm_version" | cut -d. -f1)
    if [ "$pnpm_major" -ge 9 ]; then
      ok "pnpm $pnpm_version"
    else
      fail "pnpm $pnpm_version (need >= 9)"
      info "Install: npm install -g pnpm"
      errors=$((errors + 1))
    fi
  else
    fail "pnpm not found"
    info "Install: npm install -g pnpm"
    errors=$((errors + 1))
  fi

  # git
  if command -v git &>/dev/null; then
    ok "git $(git --version | awk '{print $3}')"
  else
    fail "git not found"
    errors=$((errors + 1))
  fi

  if [ "$errors" -gt 0 ]; then
    printf "\n${RED}  Missing $errors prerequisite(s). Install them and re-run ./setup.sh${RESET}\n\n"
    exit 1
  fi
fi

# ── Install dependencies ────────────────────────────────────────────────────

step "Installing dependencies..."
pnpm install
ok "Dependencies installed"

# ── Environment file ─────────────────────────────────────────────────────────

step "Setting up environment..."

if [ -f .env ]; then
  ok ".env file exists"
else
  if [ -f .env.example ]; then
    cp .env.example .env
    ok "Created .env from .env.example"
  else
    cat > .env <<'ENVEOF'
# Frontier Digest — Environment Variables
#
# Required for digest generation (LLM synthesis step)
ANTHROPIC_API_KEY=

# Required for Slack delivery (optional if not posting to Slack)
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=

# Optional
# SLACK_APP_TOKEN=
ENVEOF
    ok "Created .env template"
  fi
  warn "Edit .env to add your API keys"
fi

# ── API key check ────────────────────────────────────────────────────────────

if [ -f .env ]; then
  # Source .env to check values (without modifying current shell permanently)
  anthropic_key=$(grep -E '^ANTHROPIC_API_KEY=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
  if [ -n "$anthropic_key" ] && [ "$anthropic_key" != "sk-ant-..." ]; then
    ok "ANTHROPIC_API_KEY is set"
  else
    warn "ANTHROPIC_API_KEY is not set in .env"
    info "Required for: frontier-digest init (wizard mode), digest generation"
    info "Get one at: https://console.anthropic.com/"
    info "Templates work without an API key: frontier-digest init --template ai-frontier"
  fi
fi

# ── LLM Provider Detection ──────────────────────────────────────────────────

step "Detecting LLM providers..."

ollama_available=false
openai_available=false
google_available=false
anthropic_available=false

# Ollama (local, free)
if command -v ollama &>/dev/null; then
  if curl -s --max-time 2 http://localhost:11434/api/tags &>/dev/null; then
    model_count=$(curl -s http://localhost:11434/api/tags | grep -o '"name"' | wc -l | tr -d ' ')
    ok "Ollama running ($model_count models available) — free, local, no API key needed"
    ollama_available=true
  else
    warn "Ollama installed but not running"
    info "Start it with: ollama serve"
    info "Then pull a model: ollama pull llama3.1"
  fi
else
  info "Ollama not installed (optional — free local LLM)"
  info "Install: https://ollama.com/download"
fi

# Check for cloud API keys
if [ -n "$anthropic_key" ] && [ "$anthropic_key" != "sk-ant-..." ]; then
  anthropic_available=true
fi

openai_key=$(grep -E '^OPENAI_API_KEY=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
if [ -n "$openai_key" ]; then
  ok "OPENAI_API_KEY is set"
  openai_available=true
fi

google_key=$(grep -E '^GOOGLE_GENERATIVE_AI_API_KEY=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
if [ -n "$google_key" ]; then
  ok "GOOGLE_GENERATIVE_AI_API_KEY is set"
  google_available=true
fi

# Summary
if [ "$ollama_available" = true ] || [ "$anthropic_available" = true ] || [ "$openai_available" = true ] || [ "$google_available" = true ]; then
  ok "At least one LLM provider available"
else
  warn "No LLM provider detected"
  info "You need one of:"
  info "  - Ollama (free, local): https://ollama.com/download"
  info "  - Anthropic API key: https://console.anthropic.com/"
  info "  - OpenAI API key: https://platform.openai.com/api-keys"
  info "  - Google API key: https://aistudio.google.com/apikey"
fi

# ── Slack setup (optional) ──────────────────────────────────────────────────

if [ "$WITH_SLACK" = true ]; then
  step "Slack setup..."
  slack_token=$(grep -E '^SLACK_BOT_TOKEN=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
  slack_secret=$(grep -E '^SLACK_SIGNING_SECRET=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)

  if [ -n "$slack_token" ] && [ "$slack_token" != "xoxb-..." ]; then
    ok "SLACK_BOT_TOKEN is set"
  else
    warn "SLACK_BOT_TOKEN is not set"
    info "To set up Slack:"
    info "  1. Go to https://api.slack.com/apps"
    info "  2. Create New App → From Scratch"
    info "  3. Add Bot Token Scopes: chat:write, channels:read"
    info "  4. Install to workspace"
    info "  5. Copy Bot Token to .env as SLACK_BOT_TOKEN"
  fi

  if [ -n "$slack_secret" ]; then
    ok "SLACK_SIGNING_SECRET is set"
  else
    warn "SLACK_SIGNING_SECRET is not set"
    info "Find it under Basic Information → App Credentials in your Slack app settings"
  fi
fi

# ── Validate installation ───────────────────────────────────────────────────

step "Validating installation..."

if bun run packages/cli/src/index.ts --version &>/dev/null; then
  version=$(bun run packages/cli/src/index.ts --version 2>/dev/null || echo "0.1.0")
  ok "CLI is working (v${version})"
else
  # citty may not support --version; try --help instead
  if bun run packages/cli/src/index.ts --help &>/dev/null; then
    ok "CLI is working"
  else
    warn "CLI smoke test failed — dependencies may need rebuilding"
    info "Try: pnpm install && bun run packages/cli/src/index.ts --help"
  fi
fi

# Check sample configs exist
if [ -f configs/domains/ai-frontier.yaml ]; then
  ok "Sample domain configs present"
else
  warn "No domain configs found in configs/domains/"
  info "Create one with: frontier-digest init --template ai-frontier"
fi

# ── Done ─────────────────────────────────────────────────────────────────────

step "Setup complete!"
echo ""
printf "  ${BOLD}Next steps:${RESET}\n"
echo ""

if [ "$ollama_available" = true ]; then
  info "Ollama detected! You can run without any API keys:"
  info "  bun run packages/cli/src/index.ts init --template ai-frontier"
  info "  # Edit the domain config to set llm.provider: ollama"
  echo ""
  info "Or use the interactive wizard:"
  info "  bun run packages/cli/src/index.ts init"
elif [ "$anthropic_available" = true ] || [ "$openai_available" = true ] || [ "$google_available" = true ]; then
  info "API key detected. Create a domain config:"
  info "  bun run packages/cli/src/index.ts init"
  echo ""
  info "Or use a template:"
  info "  bun run packages/cli/src/index.ts init --template ai-frontier"
else
  info "1. Set up an LLM provider:"
  info "   Easiest: Install Ollama (free, local): https://ollama.com/download"
  info "   Or add an API key to .env (Anthropic, OpenAI, or Google)"
  echo ""
  info "2. Create a domain config:"
  info "   bun run packages/cli/src/index.ts init --template ai-frontier"
fi

echo ""
info "3. Run your first digest:"
info "   bun run packages/cli/src/index.ts run weekly --domain configs/domains/ai-frontier.yaml"
echo ""
printf "  ${DIM}Full docs: README.md | CLI help: frontier-digest --help${RESET}\n"
echo ""
