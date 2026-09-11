#!/usr/bin/env bash
echo "Stopping AxiomaBoard..."
pkill -f "uvicorn.*app.main:app.*8200" || true
pkill -f "vite.*preview.*5173" || true
echo "AxiomaBoard stopped."
