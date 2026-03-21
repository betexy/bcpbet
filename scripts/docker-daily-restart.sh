#!/bin/bash
# Ежедневный перезапуск контейнеров docker-compose в 6:00
BM_DIR="/home/otrspw/bm"
LOG="$BM_DIR/scripts/docker-restart.log"

cd "$BM_DIR" || exit 1

if command -v docker-compose &>/dev/null; then
  docker-compose restart >> "$LOG" 2>&1
elif docker compose version &>/dev/null; then
  docker compose restart >> "$LOG" 2>&1
else
  echo "$(date -Iseconds): neither docker-compose nor docker compose found" >> "$LOG"
  exit 1
fi

echo "$(date -Iseconds): restart completed" >> "$LOG"
