import os
import sqlite3
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from app.services.email_service import send_verification_email

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)

class UserRegisterRequest(BaseModel):
    email: str = Field(..., min_length=5)
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)

class VerifyEmailRequest(BaseModel):
    email: str
    code: str = Field(..., min_length=4, max_length=10)

class ResendCodeRequest(BaseModel):
    email: str

class UserLoginRequest(BaseModel):
    login: str = Field(..., description="Email or Username")
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    is_verified: bool = True
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
                    email TEXT UNIQUE,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    is_verified INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL
                )
            """)

            # Safe column additions if table was created previously without them
            try:
                conn.execute("ALTER TABLE users ADD COLUMN email TEXT")
            except Exception:
                pass
            try:
                conn.execute("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0")
            except Exception:
                pass

            conn.execute("""
                CREATE TABLE IF NOT EXISTS email_verifications (
                    email TEXT PRIMARY KEY,
                    code TEXT NOT NULL,
                    username TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
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

    def request_registration(self, req: UserRegisterRequest) -> Dict[str, Any]:
        """Validates credentials, generates 6-digit OTP, stores pending registration, sends verification email."""
        email = req.email.strip().lower()
        username = req.username.strip()

        with self._get_conn() as conn:
            # Check if user already exists
            cur = conn.execute("SELECT id, is_verified FROM users WHERE email = ? OR username = ?", (email, username))
            existing = cur.fetchone()
            if existing and existing["is_verified"] == 1:
                return {
                    "success": False,
                    "error": "Пользователь с такой почтой или логином уже зарегистрирован"
                }

            # Generate 6-digit code
            code = f"{secrets.randbelow(900000) + 100000}"
            salt = secrets.token_hex(16)
            pwd_hash = self._hash_password(req.password, salt)
            now = datetime.now(timezone.utc)
            expires_at = (now + timedelta(minutes=15)).isoformat()
            now_iso = now.isoformat()

            conn.execute("""
                INSERT OR REPLACE INTO email_verifications
                (email, code, username, password_hash, salt, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (email, code, username, pwd_hash, salt, expires_at, now_iso))
            conn.commit()

        # Send confirmation email
        email_sent = send_verification_email(email, code, username)

        return {
            "success": True,
            "message": f"Код подтверждения отправлен на {email}",
            "email": email,
            "email_sent": email_sent
        }

    def verify_email_and_register(self, req: VerifyEmailRequest) -> Dict[str, Any]:
        """Checks OTP code and creates active verified user account with session token."""
        email = req.email.strip().lower()
        code = req.code.strip()

        with self._get_conn() as conn:
            cur = conn.execute("SELECT * FROM email_verifications WHERE email = ?", (email,))
            v_row = cur.fetchone()
            if not v_row:
                return {"success": False, "error": "Код подтверждения не найден. Запросите повторную отправку."}

            # Check expiration
            expires_at = datetime.fromisoformat(v_row["expires_at"])
            if datetime.now(timezone.utc) > expires_at:
                return {"success": False, "error": "Срок действия кода истёк. Запросите новый код."}

            if v_row["code"] != code:
                return {"success": False, "error": "Неверный код подтверждения"}

            now = datetime.now(timezone.utc).isoformat()
            user_id = f"user-{secrets.token_hex(8)}"
            username = v_row["username"]

            # Delete any unverified user with same email/username first
            conn.execute("DELETE FROM users WHERE (email = ? OR username = ?) AND is_verified = 0", (email, username))

            conn.execute("""
                INSERT INTO users (id, username, email, password_hash, salt, is_verified, created_at)
                VALUES (?, ?, ?, ?, ?, 1, ?)
            """, (user_id, username, email, v_row["password_hash"], v_row["salt"], now))

            token = secrets.token_hex(32)
            conn.execute("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)", (token, user_id, now))
            conn.execute("DELETE FROM email_verifications WHERE email = ?", (email,))
            conn.commit()

        return {
            "success": True,
            "data": AuthTokenResponse(
                token=token,
                user=UserResponse(id=user_id, username=username, email=email, is_verified=True, created_at=now)
            )
        }

    def resend_code(self, email: str) -> Dict[str, Any]:
        email = email.strip().lower()
        with self._get_conn() as conn:
            cur = conn.execute("SELECT * FROM email_verifications WHERE email = ?", (email,))
            v_row = cur.fetchone()
            if not v_row:
                return {"success": False, "error": "Регистрация для этой почты не найдена. Начните сначала."}

            code = f"{secrets.randbelow(900000) + 100000}"
            now = datetime.now(timezone.utc)
            expires_at = (now + timedelta(minutes=15)).isoformat()

            conn.execute("UPDATE email_verifications SET code = ?, expires_at = ? WHERE email = ?", (code, expires_at, email))
            conn.commit()

        send_verification_email(email, code, v_row["username"])
        return {"success": True, "message": f"Новый код отправлен на {email}"}

    def login(self, req: UserLoginRequest) -> Dict[str, Any]:
        login_val = req.login.strip().lower()

        with self._get_conn() as conn:
            cur = conn.execute("SELECT * FROM users WHERE lower(email) = ? OR lower(username) = ?", (login_val, login_val))
            user_row = cur.fetchone()
            if not user_row:
                return {"success": False, "error": "Неверный логин или пароль"}

            expected_hash = self._hash_password(req.password, user_row["salt"])
            if user_row["password_hash"] != expected_hash:
                return {"success": False, "error": "Неверный логин или пароль"}

            if not user_row["is_verified"]:
                # Send verification code
                code = f"{secrets.randbelow(900000) + 100000}"
                now = datetime.now(timezone.utc)
                expires_at = (now + timedelta(minutes=15)).isoformat()
                now_iso = now.isoformat()
                email = user_row["email"] or login_val

                conn.execute("""
                    INSERT OR REPLACE INTO email_verifications
                    (email, code, username, password_hash, salt, expires_at, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (email, code, user_row["username"], user_row["password_hash"], user_row["salt"], expires_at, now_iso))
                conn.commit()

                send_verification_email(email, code, user_row["username"])
                return {
                    "success": False,
                    "needs_verification": True,
                    "email": email,
                    "error": "Почта ещё не подтверждена. Мы отправили код на вашу почту."
                }

            now = datetime.now(timezone.utc).isoformat()
            token = secrets.token_hex(32)
            conn.execute("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)", (token, user_row["id"], now))
            conn.commit()

            return {
                "success": True,
                "data": AuthTokenResponse(
                    token=token,
                    user=UserResponse(
                        id=user_row["id"],
                        username=user_row["username"],
                        email=user_row["email"],
                        is_verified=bool(user_row["is_verified"]),
                        created_at=user_row["created_at"]
                    )
                )
            }

    def get_user_by_token(self, token: str) -> Optional[UserResponse]:
        with self._get_conn() as conn:
            cursor = conn.execute("""
                SELECT u.id, u.username, u.email, u.is_verified, u.created_at
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token = ?
            """, (token,))
            row = cursor.fetchone()
            if not row:
                return None
            return UserResponse(
                id=row["id"],
                username=row["username"],
                email=row["email"],
                is_verified=bool(row["is_verified"]),
                created_at=row["created_at"]
            )

    def logout(self, token: str) -> bool:
        with self._get_conn() as conn:
            cur = conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
            return cur.rowcount > 0

auth_store = AuthStore()
