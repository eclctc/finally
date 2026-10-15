#!/usr/bin/env bash
# Build (if needed) and run the FinAlly container.
# Usage: scripts/start_mac.sh [--build] [--no-open]
set -euo pipefail

IMAGE="${FINALLY_IMAGE:-finally}"
CONTAINER="${FINALLY_CONTAINER:-finally}"
PORT="${FINALLY_PORT:-8000}"
VOLUME="${FINALLY_VOLUME:-finally-data}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
URL="http://localhost:${PORT}"

BUILD=false
OPEN=true
for arg in "$@"; do
  case "$arg" in
    --build) BUILD=true ;;
    --no-open) OPEN=false ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

if $BUILD || ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "Building image $IMAGE..."
  docker build -t "$IMAGE" "$ROOT_DIR"
fi

if [ -n "$(docker ps -q --filter "name=^${CONTAINER}$")" ] && ! $BUILD; then
  echo "FinAlly is already running."
else
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  ENV_ARGS=()
  if [ -f "$ROOT_DIR/.env" ]; then
    ENV_ARGS=(--env-file "$ROOT_DIR/.env")
  fi
  docker run -d --name "$CONTAINER" \
    -p "${PORT}:8000" \
    -v "${VOLUME}:/app/db" \
    ${ENV_ARGS[@]+"${ENV_ARGS[@]}"} \
    "$IMAGE" >/dev/null
  echo "FinAlly started."
fi

echo "Open $URL"
if $OPEN; then
  open "$URL" 2>/dev/null || xdg-open "$URL" >/dev/null 2>&1 || true
fi
