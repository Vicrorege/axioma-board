#!/usr/bin/env bash
echo "Stopping AxiomaBoard..."
pkill -9 -f "uvicorn.*app.main:app.*8200" 2>/dev/null || true
pkill -9 -f "vite.*preview.*5173" 2>/dev/null || true
fuser -k -9 8200/tcp 2>/dev/null || true
fuser -k -9 5173/tcp 2>/dev/null || true
sleep 1
echo "AxiomaBoard stopped."
