import logging
import re
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"
VERIFIED_SENDER_DOMAIN = "mail.happyexchange.net"


class EmailSendError(Exception):
    """Raised when verification email delivery fails."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        resend_body: str | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.resend_body = resend_body


def _clean_api_key(raw: str) -> str:
    """Strip whitespace/quotes that often break Bearer auth in hosted envs."""
    key = (raw or "").strip()
    if len(key) >= 2 and key[0] == key[-1] and key[0] in "\"'":
        key = key[1:-1].strip()
    return key


def parse_from_domain(email_from: str) -> str:
    """Extract domain from 'Name <user@domain.com>' or plain address."""
    value = (email_from or "").strip()
    match = re.search(r"<([^>]+)>", value)
    address = match.group(1).strip() if match else value
    if "@" not in address:
        return ""
    return address.split("@", 1)[1].strip().lower()


def get_resend_mode() -> str:
    return "resend" if _clean_api_key(settings.RESEND_API_KEY) else "terminal_fallback"


def get_email_diagnostics() -> dict[str, Any]:
    """Safe email config snapshot — never exposes secrets."""
    email_from = (settings.EMAIL_FROM or "").strip()
    domain = parse_from_domain(email_from)
    key_configured = bool(_clean_api_key(settings.RESEND_API_KEY))
    return {
        "resend_key_configured": key_configured,
        "email_from": email_from,
        "email_from_domain": domain,
        "expected_sender_domain": VERIFIED_SENDER_DOMAIN,
        "sender_domain_matches_verified": domain == VERIFIED_SENDER_DOMAIN,
        "app_base_url": settings.APP_BASE_URL.rstrip("/"),
        "resend_mode": get_resend_mode(),
    }


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


def _friendly_resend_error(status_code: int, body: str, from_address: str) -> str:
    body_lower = (body or "").lower()
    domain = parse_from_domain(from_address)

    if status_code == 403:
        if "domain" in body_lower or "not verified" in body_lower or "from" in body_lower:
            return (
                f"Resend rejected the sender address ({from_address}). "
                f"Use your verified domain: Happiness Exchange <verify@{VERIFIED_SENDER_DOMAIN}>. "
                f"Current domain: {domain or 'unknown'}."
            )
        if "api key" in body_lower or "invalid" in body_lower or "unauthorized" in body_lower:
            return (
                "Resend rejected the API key (403). "
                "Check RESEND_API_KEY in Hugging Face Secrets — no quotes, no extra spaces, full re_... key."
            )
        return (
            f"Resend returned 403 Forbidden. Sender: {from_address}. "
            f"Verify RESEND_API_KEY and that EMAIL_FROM uses @{VERIFIED_SENDER_DOMAIN}."
        )

    if status_code == 422:
        return f"Resend rejected the email payload (422). Sender: {from_address}. Response: {body[:200]}"

    return f"Resend email failed (HTTP {status_code}). Sender: {from_address}."


def send_verification_email(to_email: str, token: str) -> None:
    """Send a verification email via Resend.

    If RESEND_API_KEY is not configured, prints the verification link to the
    server terminal for local development (never exposed to the frontend).

    Raises EmailSendError when Resend is configured but delivery fails.
    """
    api_key = _clean_api_key(settings.RESEND_API_KEY)
    email_from = (settings.EMAIL_FROM or "").strip()
    verify_link = f"{settings.APP_BASE_URL.rstrip('/')}/verify-email?token={token}"

    if not api_key:
        logger.warning(
            "RESEND_API_KEY not configured (resend_key_configured=false). "
            "Verification link for %s:\n%s",
            to_email,
            verify_link,
        )
        print(f"\n[DEV] Email verification link for {to_email}:\n{verify_link}\n")
        return

    from_domain = parse_from_domain(email_from)
    if from_domain and from_domain != VERIFIED_SENDER_DOMAIN:
        logger.warning(
            "EMAIL_FROM domain '%s' does not match verified Resend domain '%s'. "
            "Resend may return 403. EMAIL_FROM=%s",
            from_domain,
            VERIFIED_SENDER_DOMAIN,
            email_from,
        )

    plain_text = (
        "Please verify your email to start listing items, requesting items, "
        "chatting, and reviewing exchanges.\n\n"
        f"{verify_link}\n\n"
        "This link expires in 24 hours."
    )

    payload = {
        "from": email_from,
        "to": [to_email.strip().lower()],
        "subject": "Verify your Happiness Exchange account",
        "html": _verification_html(verify_link),
        "text": plain_text,
    }

    logger.info(
        "Sending Resend verification email to=%s from=%s resend_key_configured=true app_base_url=%s",
        to_email,
        email_from,
        settings.APP_BASE_URL,
    )

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

        if response.is_success:
            logger.info("Resend verification email accepted for %s (status=%s)", to_email, response.status_code)
            return

        body = response.text
        logger.error(
            "Resend API failure: status=%s to=%s from=%s resend_key_configured=true body=%s",
            response.status_code,
            to_email,
            email_from,
            body[:500],
        )
        raise EmailSendError(
            _friendly_resend_error(response.status_code, body, email_from),
            status_code=response.status_code,
            resend_body=body,
        )

    except EmailSendError:
        raise
    except httpx.HTTPError as exc:
        logger.error(
            "Resend HTTP transport error to=%s from=%s resend_key_configured=true error=%s",
            to_email,
            email_from,
            exc,
        )
        raise EmailSendError(
            f"Could not reach Resend API: {exc}",
        ) from exc
    except Exception as exc:
        logger.error(
            "Unexpected email send error to=%s from=%s resend_key_configured=true error=%s",
            to_email,
            email_from,
            exc,
        )
        raise EmailSendError(f"Unexpected email send error: {exc}") from exc
