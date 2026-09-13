import sqlite3
import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from app.models.board import Board, BoardSnapshot, MathBlockData, ArrowConnection

class BoardStore:
    def __init__(self, db_path: str = "/root/projects/axioma-board/backend/data/boards.db"):
        self.db_path = db_path
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS boards (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    user_id TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    snapshot_json TEXT NOT NULL
                )
            """)
            try:
                conn.execute("ALTER TABLE boards ADD COLUMN user_id TEXT")
            except Exception:
                pass
            conn.commit()

    def list_boards(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            if user_id:
                cursor = conn.execute(
                    "SELECT id, title, description, user_id, created_at, updated_at FROM boards WHERE user_id = ? ORDER BY updated_at DESC",
                    (user_id,)
                )
            else:
                cursor = conn.execute(
                    "SELECT id, title, description, user_id, created_at, updated_at FROM boards WHERE user_id IS NULL ORDER BY updated_at DESC"
                )
            return [dict(row) for row in cursor.fetchall()]

    def get_board(self, board_id: str) -> Optional[Board]:
        with self._get_conn() as conn:
            cursor = conn.execute("SELECT * FROM boards WHERE id = ?", (board_id,))
            row = cursor.fetchone()
            if not row:
                return None
            
            raw_snap = json.loads(row["snapshot_json"]) if row["snapshot_json"] else {}
            snapshot = BoardSnapshot(
                blocks=[MathBlockData(**b) for b in raw_snap.get("blocks", [])],
                arrows=[ArrowConnection(**a) for a in raw_snap.get("arrows", [])],
                canvas_state=raw_snap.get("canvas_state")
            )
            return Board(
                id=row["id"],
                title=row["title"],
                description=row["description"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                snapshot=snapshot
            )

    def create_board(
        self,
        title: str = "New Math Board",
        description: Optional[str] = None,
        initial_snapshot: Optional[BoardSnapshot] = None,
        user_id: Optional[str] = None
    ) -> Board:
        now = datetime.now(timezone.utc).isoformat()
        board_id = str(uuid.uuid4())
        snap = initial_snapshot or BoardSnapshot()
        
        # If blank, create a helpful starter block
        if not snap.blocks:
            snap.blocks = [
                MathBlockData(
                    id="block-starter-1",
                    x=150,
                    y=150,
                    title="Quadratic Formula",
                    latex=r"f(x) = x^2 - 5x + 6",
                    result_latex=None,
                    operation=None,
                    comment="Click Solve or Derivative to test!"
                )
            ]

        snap_json = snap.model_dump_json()
        with self._get_conn() as conn:
            conn.execute(
                "INSERT INTO boards (id, title, description, user_id, created_at, updated_at, snapshot_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (board_id, title, description, user_id, now, now, snap_json)
            )
            conn.commit()

        return self.get_board(board_id)

    def update_board(
        self,
        board_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        snapshot: Optional[BoardSnapshot] = None
    ) -> Optional[Board]:
        existing = self.get_board(board_id)
        if not existing:
            return None

        now = datetime.now(timezone.utc).isoformat()
        new_title = title if title is not None else existing.title
        new_desc = description if description is not None else existing.description
        new_snap = snapshot.model_dump_json() if snapshot is not None else existing.snapshot.model_dump_json()

        with self._get_conn() as conn:
            conn.execute(
                "UPDATE boards SET title = ?, description = ?, updated_at = ?, snapshot_json = ? WHERE id = ?",
                (new_title, new_desc, now, new_snap, board_id)
            )
            conn.commit()

        return self.get_board(board_id)

    def add_block_to_board(self, board_id: str, block: MathBlockData) -> Optional[Board]:
        board = self.get_board(board_id)
        if not board:
            return None
        existing_idx = next((i for i, b in enumerate(board.snapshot.blocks) if b.id == block.id), -1)
        if existing_idx >= 0:
            board.snapshot.blocks[existing_idx] = block
        else:
            board.snapshot.blocks.append(block)
        return self.update_board(board_id, snapshot=board.snapshot)

    def add_arrow_to_board(self, board_id: str, arrow: ArrowConnection) -> Optional[Board]:
        board = self.get_board(board_id)
        if not board:
            return None
        board.snapshot.arrows.append(arrow)
        return self.update_board(board_id, snapshot=board.snapshot)

    def delete_board(self, board_id: str, user_id: Optional[str] = None) -> bool:
        with self._get_conn() as conn:
            if user_id:
                cur = conn.execute("DELETE FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id))
            else:
                cur = conn.execute("DELETE FROM boards WHERE id = ?", (board_id,))
            conn.commit()
            return cur.rowcount > 0

board_store = BoardStore()
