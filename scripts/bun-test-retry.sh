#!/usr/bin/env bash
# Run `bun test` and, if it fails due to the flaky Sequelize init error
# "Cannot access 'Model' before initialization", retry until the output
# no longer contains that error. Exit with the final run's status code.
#
# Usage:
#   scripts/bun-test-retry.sh [bun test args...]
# Example:
#   scripts/bun-test-retry.sh
#   scripts/bun-test-retry.sh src/store/models/Bump.test.ts
#
# Env:
#   MAX_RETRIES   - safety cap on retries (default 20)
#   SLEEP_SECS    - optional delay between retries (default 0)
#   STREAM_OUTPUT - if 1, stream output live via tee (default 0); colors preserved

set -u

PATTERN="Cannot access 'Model' before initialization"
MAX_RETRIES=${MAX_RETRIES:-20}
SLEEP_SECS=${SLEEP_SECS:-0}
STREAM_OUTPUT=${STREAM_OUTPUT:-1}

# Encourage colored output even when not attached to a TTY and keep Unicode intact
export CLICOLOR=${CLICOLOR:-1}
export CLICOLOR_FORCE=${CLICOLOR_FORCE:-1}
export FORCE_COLOR=${FORCE_COLOR:-3}
export TERM=${TERM:-xterm-256color}
export LC_ALL=${LC_ALL:-en_US.UTF-8}
export LANG=${LANG:-en_US.UTF-8}
# If NO_COLOR is set in the environment, unset to avoid suppressing colors
unset NO_COLOR 2>/dev/null || true

# Create a temp file to capture bun test output (stdout + stderr)
TMPFILE=""
cleanup() {
  [[ -n "$TMPFILE" && -f "$TMPFILE" ]] && rm -f "$TMPFILE" || true
}
trap cleanup EXIT

TMPFILE=$(mktemp -t bun-test-XXXXXX)

attempt=0
while :; do
  attempt=$((attempt + 1))

  if [[ "$STREAM_OUTPUT" == "1" ]]; then
    # Stream output live while capturing to file; preserve colors with FORCE_COLOR/CLICOLOR_FORCE
    # tee prints to stdout; capture bun's exit code via PIPESTATUS
    CLICOLOR=1 CLICOLOR_FORCE=1 FORCE_COLOR=3 TERM=${TERM:-xterm-256color} bun test "$@" 2>&1 | tee "$TMPFILE"
    status=${PIPESTATUS[0]}
  else
    # Capture output, print later with cat to preserve ANSI/unicode exactly
    CLICOLOR=1 CLICOLOR_FORCE=1 FORCE_COLOR=3 TERM=${TERM:-xterm-256color} bun test "$@" >"$TMPFILE" 2>&1
    status=$?
  fi

  # If success, print output and exit 0
  if [[ $status -eq 0 ]]; then
    if [[ "$STREAM_OUTPUT" != "1" ]]; then
      cat "$TMPFILE"
    fi
    exit 0
  fi

  # Only retry if it failed AND the specific flaky error is present
  if grep -Fq "$PATTERN" "$TMPFILE"; then
    echo "bun test failed with flaky Sequelize error: '$PATTERN' (attempt $attempt)" >&2
    if (( attempt >= MAX_RETRIES )); then
      echo "Reached MAX_RETRIES=$MAX_RETRIES; giving up." >&2
      if [[ "$STREAM_OUTPUT" != "1" ]]; then
        cat "$TMPFILE"
      fi
      exit $status
    fi
    # Optional short sleep before retrying
    if (( SLEEP_SECS > 0 )); then
      sleep "$SLEEP_SECS"
    fi
    continue
  fi

  # Otherwise, print output and exit with the same failure code
  if [[ "$STREAM_OUTPUT" != "1" ]]; then
    cat "$TMPFILE"
  fi
  exit "$status"

done
