import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def _verification_html(verify_link: str) -> str:
    return f"""
    <html>
      <body style="font-family: sans-serif; line-height: 1.6; color: #1f1f1f;">
        <h2 style="color: #8b4cf6;">Welcome to Happiness Exchange</h2>
        <p>Please verify your email to start listing items, requesting items, chatting, and reviewing exchanges.</p>
        <div style="margin-top: 24px; margin-bottom: 24px;">
            <a href="{verify_link}" style="background-color: #8b4cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify Email</a>
        </div>
        <p style="font-size: 12px; color: #68766d;">This link expires in 24 hours.</p>
        <p style="font-size: 12px; color: #68766d;">If the button above does not work, copy and paste this link into your browser:<br/>{verify_link}</p>
      </body>
    </html>
    """


def send_verification_email(to_email: str, token: str) -> None:
    """Send a verification email via Resend.

    If RESEND_API_KEY is not configured, prints the verification link to the
    server terminal for local development (never exposed to the frontend).
    """
    verify_link = f"{settings.APP_BASE_URL.rstrip('/')}/verify-email?token={token}"

    if not settings.RESEND_API_KEY:
        logger.warning(
            "RESEND_API_KEY not configured. "
            "Verification link (copy and paste in browser):\n%s",
            verify_link,
        )
        print(f"\n[DEV] Email verification link for {to_email}:\n{verify_link}\n")
        return

    plain_text = (
        "Please verify your email to start listing items, requesting items, "
        "chatting, and reviewing exchanges.\n\n"
        f"{verify_link}\n\n"
        "This link expires in 24 hours."
    )

    payload = {
        "from": settings.EMAIL_FROM,
        "to": [to_email],
        "subject": "Verify your Happiness Exchange account",
        "html": _verification_html(verify_link),
        "text": plain_text,
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
        logger.info("Verification email sent via Resend to %s", to_email)
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Resend API error sending to %s: %s %s",
            to_email,
            exc.response.status_code,
            exc.response.text[:300],
        )
    except Exception as exc:
        logger.error("Failed to send verification email to %s: %s", to_email, exc)
