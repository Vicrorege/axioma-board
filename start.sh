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

pkill -9 -f "uvicorn.*app.main:app.*8200" 2>/dev/null || true
fuser -k -9 8200/tcp 2>/dev/null || true
sleep 0.5

nohup "$DIR/backend/.venv/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8200 > "$DIR/backend/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend started with PID $BACKEND_PID on http://0.0.0.0:8200"

# Wait for backend readiness
for i in {1..20}; do
    if curl -s http://127.0.0.1:8200/api/math/suggested-actions > /dev/null 2>&1 || curl -s http://127.0.0.1:8200/docs > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
    fi
    sleep 0.3
done

# 2. Start Frontend Preview on port 5173
cd "$DIR/frontend"
pkill -9 -f "vite.*preview.*5173" 2>/dev/null || true
fuser -k -9 5173/tcp 2>/dev/null || true
sleep 0.5

nohup npm run preview -- --host 0.0.0.0 --port 5173 > "$DIR/frontend/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend started with PID $FRONTEND_PID on http://0.0.0.0:5173"

for i in {1..20}; do
    if curl -s http://127.0.0.1:5173 > /dev/null 2>&1; then
        echo "Frontend is ready!"
        break
    fi
    sleep 0.3
done

echo "=== Services successfully launched and verified! ==="
