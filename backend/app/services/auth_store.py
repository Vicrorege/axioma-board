import os
import sqlite3
import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)

class UserRegister(UserBase):
    password: str = Field(..., min_length=4)

class UserLogin(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    created_at: str

class AuthTokenResponse(BaseModel):
    token: str
    user: UserResponse

class AuthStore:
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
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            """)
            conn.commit()

    def _hash_password(self, password: str, salt: str) -> str:
        return hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        ).hex()

    def register(self, req: UserRegister) -> Optional[AuthTokenResponse]:
        username = req.username.strip().lower()
        salt = secrets.token_hex(16)
        pwd_hash = self._hash_password(req.password, salt)
        user_id = f"user-{secrets.token_hex(8)}"
        now = datetime.now(timezone.utc).isoformat()

        try:
            with self._get_conn() as conn:
                conn.execute(
                    "INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)",
                    (user_id, username, pwd_hash, salt, now)
                )
                token = secrets.token_hex(32)
                conn.execute(
                    "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
                    (token, user_id, now)
                )
                conn.commit()
        except sqlite3.IntegrityError:
            return None

        return AuthTokenResponse(
            token=token,
            user=UserResponse(id=user_id, username=username, created_at=now)
        )

    def login(self, req: UserLogin) -> Optional[AuthTokenResponse]:
        username = req.username.strip().lower()
        with self._get_conn() as conn:
            cursor = conn.execute("SELECT * FROM users WHERE username = ?", (username,))
            user_row = cursor.fetchone()
            if not user_row:
                return None

            expected_hash = self._hash_password(req.password, user_row["salt"])
            if user_row["password_hash"] != expected_hash:
                return None

            now = datetime.now(timezone.utc).isoformat()
            token = secrets.token_hex(32)
            conn.execute(
                "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
                (token, user_row["id"], now)
            )
            conn.commit()

            return AuthTokenResponse(
                token=token,
                user=UserResponse(
                    id=user_row["id"],
                    username=user_row["username"],
                    created_at=user_row["created_at"]
                )
            )

    def get_user_by_token(self, token: str) -> Optional[UserResponse]:
        with self._get_conn() as conn:
            cursor = conn.execute("""
                SELECT u.id, u.username, u.created_at
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token = ?
            """, (token,))
            row = cursor.fetchone()
            if not row:
                return None
            return UserResponse(id=row["id"], username=row["username"], created_at=row["created_at"])

    def logout(self, token: str) -> bool:
        with self._get_conn() as conn:
            cur = conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
            return cur.rowcount > 0

auth_store = AuthStore()
