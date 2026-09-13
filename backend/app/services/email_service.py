import os
import smtplib
import ssl
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

logger = logging.getLogger("axioma.email")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", os.getenv("SMTP_USER", ""))
SMTP_SSL = os.getenv("SMTP_SSL", "true").lower() in ("true", "1", "yes")

def send_verification_email(to_email: str, code: str, username: str = "") -> bool:
    """Sends a 6-digit verification code email to verify user account."""
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured, skipping email send")
        return False

    subject = f"Код подтверждения Axioma: {code}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; }}
        .container {{ max-width: 480px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); }}
        .logo {{ font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }}
        .logo span {{ color: #3b82f6; }}
        .badge {{ display: inline-block; padding: 4px 10px; background: rgba(59, 130, 246, 0.15); border: 1px solid #3b82f6; border-radius: 9999px; color: #60a5fa; font-size: 11px; font-weight: bold; text-transform: uppercase; margin-bottom: 16px; }}
        h2 {{ font-size: 18px; margin-top: 0; color: #ffffff; font-weight: 700; }}
        p {{ color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 12px 0; }}
        .code-box {{ background: #0f172a; border: 2px dashed #3b82f6; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }}
        .code {{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; text-shadow: 0 0 12px rgba(56, 189, 248, 0.35); }}
        .footer {{ margin-top: 32px; border-top: 1px solid #334155; padding-top: 16px; font-size: 12px; color: #64748b; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">Axioma<span>Board</span></div>
        <div class="badge">Верификация аккаунта</div>
        <h2>Здравствуйте{f', {username}' if username else ''}!</h2>
        <p>Для завершения регистрации и входа в математическую платформу AxiomaBoard введите одноразовый код подтверждения:</p>
        
        <div class="code-box">
          <div class="code">{code}</div>
        </div>
        
        <p style="font-size: 12px; color: #64748b;">Код действителен в течение 15 минут. Если вы не запрашивали регистрацию на AxiomaBoard, просто проигнорируйте это письмо.</p>
        
        <div class="footer">
          &copy; AxiomaBoard &mdash; интерактивная математическая доска
        </div>
      </div>
    </body>
    </html>
    """

    text_content = f"""
AxiomaBoard - Код подтверждения

Здравствуйте{f', {username}' if username else ''}!
Ваш код подтверждения для входа в AxiomaBoard: {code}

Код действителен в течение 15 минут.
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"AxiomaBoard <{SMTP_FROM}>"
    msg["To"] = to_email

    msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        if SMTP_SSL or SMTP_PORT == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=12) as server:
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=12) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM, [to_email], msg.as_string())

        logger.info(f"Verification email successfully sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False
