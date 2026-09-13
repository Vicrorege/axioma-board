import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Request

logger = logging.getLogger("axioma.telemetry")

router = APIRouter(prefix="/api/telemetry", tags=["Client Telemetry & Debugging"])

LOG_FILE = "/root/projects/axioma-board/backend/data/client_errors.log"

@router.post("/log", summary="Record a client-side runtime error or event")
async def record_client_log(request: Request):
    try:
        body = await request.body()
        raw_text = body.decode("utf-8", errors="replace")
        try:
            data = json.loads(raw_text)
        except Exception:
            data = {"message": raw_text}
    except Exception as e:
        data = {"message": f"Failed to read payload: {e}"}

    level = str(data.get("level", "error")).upper()
    url = str(data.get("url", ""))
    message = str(data.get("message", ""))
    stack = data.get("stack")
    comp_stack = data.get("component_stack")
    ctx = data.get("context")

    now = datetime.now(timezone.utc).isoformat()
    log_entry = f"[{now}] [{level}]\nURL: {url}\nMessage: {message}\n"
    if stack:
        log_entry += f"Stack:\n{stack}\n"
    if comp_stack:
        log_entry += f"React Component Stack:\n{comp_stack}\n"
    if ctx:
        log_entry += f"Context: {ctx}\n"
    log_entry += "-" * 60 + "\n"

    # Also log to server stdout/stderr
    if level in ("ERROR", "FATAL", "CRITICAL"):
        logger.error(f"[CLIENT {level}] {message} | URL: {url}")
        if stack:
            logger.error(f"[CLIENT STACK] {stack}")
        if comp_stack:
            logger.error(f"[CLIENT COMPONENT STACK] {comp_stack}")
    else:
        logger.info(f"[CLIENT {level}] {message}")

    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(log_entry)

    return {"success": True, "logged_at": now}

@router.get("/errors", summary="Get recent client errors for debugging")
async def get_recent_errors(limit: int = 50):
    if not os.path.exists(LOG_FILE):
        return {"errors": [], "count": 0}
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    # Return last entries
    return {"raw_log_tail": "".join(lines[-limit*10:]), "total_lines": len(lines)}
