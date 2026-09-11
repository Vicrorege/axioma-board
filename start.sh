#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=== Starting AxiomaBoard Services ==="

# 1. Start Backend on port 8200
cd "$DIR/backend"
if [ ! -d ".venv" ]; then
    echo "Virtual environment missing, setting up..."
    uv venv
    uv pip install fastapi "uvicorn[standard]" sympy antlr4-python3-runtime pydantic
fi

pkill -f "uvicorn.*app.main:app.*8200" || true
nohup "$DIR/backend/.venv/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8200 > "$DIR/backend/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend started with PID $BACKEND_PID on http://0.0.0.0:8200 (Docs: http://localhost:8200/docs)"

# 2. Start Frontend Preview on port 5173
cd "$DIR/frontend"
pkill -f "vite.*preview.*5173" || true
nohup npm run preview -- --host 0.0.0.0 --port 5173 > "$DIR/frontend/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend started with PID $FRONTEND_PID on http://0.0.0.0:5173"

echo "=== Services successfully launched! ==="
