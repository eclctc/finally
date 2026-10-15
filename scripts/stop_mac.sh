#!/usr/bin/env bash
# Stop and remove the FinAlly container. The data volume is kept.
set -euo pipefail

CONTAINER="${FINALLY_CONTAINER:-finally}"

if docker ps -aq --filter "name=^${CONTAINER}$" | grep -q .; then
  docker stop "$CONTAINER" >/dev/null
  docker rm "$CONTAINER" >/dev/null
  echo "FinAlly stopped."
else
  echo "FinAlly is not running."
fi
