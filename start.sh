#!/usr/bin/env bash
# Start backend and frontend together for a demo.
# Usage: ./start.sh            (backend on 8000)
#        BACKEND_PORT=8010 ./start.sh   (if port 8000 is already in use)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${BACKEND_PORT:-8000}"

if [ ! -x "$ROOT/backend/.venv/bin/python" ]; then
  echo "Backend virtualenv missing. Run the installation steps in README.md first." >&2; exit 1
fi
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Frontend dependencies missing. Run 'npm install' in frontend/ first." >&2; exit 1
fi

cd "$ROOT/backend"
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT" &
BACKEND_PID=$!
trap 'kill $BACKEND_PID 2>/dev/null' EXIT

cd "$ROOT/frontend"
echo "Backend:  http://127.0.0.1:$PORT  (API docs: http://127.0.0.1:$PORT/docs)"
echo "Frontend: http://127.0.0.1:5173"
BACKEND_URL="http://127.0.0.1:$PORT" npx vite --host 127.0.0.1 --port 5173
