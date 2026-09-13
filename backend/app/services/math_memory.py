import sqlite3
import json
import hashlib
from typing import Optional, Dict, Any
from pathlib import Path

class MathMemoryStore:
    def __init__(self, db_path: str = "/root/projects/axioma-board/backend/data/boards.db"):
        self.db_path = db_path
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _hash_key(self, op: str, latex_str: str, extra: str = "") -> str:
        norm = f"{op.strip().lower()}:{latex_str.strip()}:{extra.strip()}"
        return hashlib.sha256(norm.encode("utf-8")).hexdigest()

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS math_solution_cache (
                    cache_key TEXT PRIMARY KEY,
                    operation TEXT NOT NULL,
                    latex TEXT NOT NULL,
                    result_json TEXT NOT NULL,
                    flagged_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS math_solution_reports (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cache_key TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    latex TEXT NOT NULL,
                    reason TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.commit()

    def get_cached_result(self, op: str, latex_str: str, extra: str = "") -> Optional[Dict[str, Any]]:
        key = self._hash_key(op, latex_str, extra)
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT result_json FROM math_solution_cache WHERE cache_key = ?",
                (key,)
            ).fetchone()
            if row:
                try:
                    return json.loads(row["result_json"])
                except Exception:
                    return None
        return None

    def save_cached_result(self, op: str, latex_str: str, result_dict: Dict[str, Any], extra: str = ""):
        # Only cache successful computations without errors
        if not result_dict.get("success"):
            return
        key = self._hash_key(op, latex_str, extra)
        result_json = json.dumps(result_dict, ensure_ascii=False)
        with self._get_conn() as conn:
            conn.execute("""
                INSERT INTO math_solution_cache (cache_key, operation, latex, result_json, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(cache_key) DO UPDATE SET
                    result_json = excluded.result_json,
                    updated_at = CURRENT_TIMESTAMP
            """, (key, op, latex_str, result_json))
            conn.commit()

    def flag_solution_for_review(self, op: str, latex_str: str, reason: str = "", extra: str = "") -> bool:
        """
        Invalidates cached computation and records a report for reconsideration.
        Next time this equation is computed, it will be reconsidered from scratch.
        """
        key = self._hash_key(op, latex_str, extra)
        with self._get_conn() as conn:
            # Delete or flag cache entry so it recomputes freshly
            conn.execute("DELETE FROM math_solution_cache WHERE cache_key = ?", (key,))
            conn.execute("""
                INSERT INTO math_solution_reports (cache_key, operation, latex, reason)
                VALUES (?, ?, ?, ?)
            """, (key, op, latex_str, reason))
            conn.commit()
        return True

math_memory = MathMemoryStore()
