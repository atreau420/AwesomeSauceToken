#!/usr/bin/env bash
set -euo pipefail

# Live launch script. Expects PRIVATE_KEY and POLYGON_RPC_URL already exported.
# Minimal safety: refuse to run if PRIVATE_KEY looks empty.
if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "ERROR: PRIVATE_KEY not set" >&2
  exit 1
fi

export ENABLE_REAL_TRADES=true
export FORCE_LIVE_ALL=true
export SKIP_ALL_DRY_RUNS=true
export NFT_DRY_RUN=false
export ENABLE_KNOWLEDGE_HUB=true
export ENABLE_AUTO_SIM_FALLBACK=true
export ENABLE_DUST_CONSOLIDATION=true
export ENABLE_GAS_RECOVERY=true
export ENABLE_NATIVE_BUFFER_MANAGER=true
export ENABLE_EMERGENCY_MODE=true

# Tighten profit bps minimally for live micro trades
export MIN_PROFIT_BPS=${MIN_PROFIT_BPS:-2}

# Start bot
node advanced-trading-bot.js
