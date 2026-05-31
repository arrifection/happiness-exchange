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
        "admin_panel_url": settings.ADMIN_PANEL_URL.rstrip("/"),
        "resend_mode": get_resend_mode(),
    }


def build_admin_invite_link(token: str) -> str:
    """Build accept-invite URL on the admin panel (never the public app URL)."""
    return f"{settings.ADMIN_PANEL_URL.rstrip('/')}/accept-invite?token={token}"


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


ROLE_LABELS = {
    "courier": "Courier",
    "moderator": "Moderator",
    "admin": "Admin",
    "super_admin": "Super Admin",
}


def _post_resend_email(to_email: str, subject: str, html: str, plain_text: str) -> bool:
    """
    Send email via Resend.

    Returns True when Resend accepts the message, False when RESEND_API_KEY is
    not configured (dev terminal fallback). Raises EmailSendError on failure.
    """
    api_key = _clean_api_key(settings.RESEND_API_KEY)
    email_from = (settings.EMAIL_FROM or "").strip()
    normalized_to = to_email.strip().lower()

    if not api_key:
        logger.warning(
            "RESEND_API_KEY not configured (resend_key_configured=false). "
            "Email not sent to %s. Subject: %s",
            normalized_to,
            subject,
        )
        print(f"\n[DEV] Email to {normalized_to}\nSubject: {subject}\n{plain_text}\n")
        return False

    from_domain = parse_from_domain(email_from)
    if from_domain and from_domain != VERIFIED_SENDER_DOMAIN:
        logger.warning(
            "EMAIL_FROM domain '%s' does not match verified Resend domain '%s'. "
            "Resend may return 403. EMAIL_FROM=%s",
            from_domain,
            VERIFIED_SENDER_DOMAIN,
            email_from,
        )

    payload = {
        "from": email_from,
        "to": [normalized_to],
        "subject": subject,
        "html": html,
        "text": plain_text,
    }

    logger.info(
        "Sending Resend email to=%s from=%s subject=%s",
        normalized_to,
        email_from,
        subject,
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
            logger.info(
                "Resend email accepted for %s (status=%s subject=%s)",
                normalized_to,
                response.status_code,
                subject,
            )
            return True

        body = response.text
        logger.error(
            "Resend API failure: status=%s to=%s from=%s subject=%s body=%s",
            response.status_code,
            normalized_to,
            email_from,
            subject,
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
            "Resend HTTP transport error to=%s from=%s subject=%s error=%s",
            normalized_to,
            email_from,
            subject,
            exc,
        )
        raise EmailSendError(f"Could not reach Resend API: {exc}") from exc
    except Exception as exc:
        logger.error(
            "Unexpected email send error to=%s from=%s subject=%s error=%s",
            normalized_to,
            email_from,
            subject,
            exc,
        )
        raise EmailSendError(f"Unexpected email send error: {exc}") from exc


def _friendly_resend_error(status_code: int, body: str, from_address: str) -> str:
    body_lower = (body or "").lower()
    domain = parse_from_domain(from_address)

    if status_code == 401 or (status_code == 403 and ("api key" in body_lower or "invalid" in body_lower or "unauthorized" in body_lower)):
        return (
            "Resend rejected the API key (401). "
            "In Hugging Face Secrets, set RESEND_API_KEY to a valid re_... key from "
            "https://resend.com/api-keys — no quotes, no extra spaces, copy the full key."
        )

    if status_code == 403:
        if "domain" in body_lower or "not verified" in body_lower or "from" in body_lower:
            return (
                f"Resend rejected the sender address ({from_address}). "
                f"Use your verified domain: Happiness Exchange <verify@{VERIFIED_SENDER_DOMAIN}>. "
                f"Current domain: {domain or 'unknown'}."
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
    verify_link = f"{settings.APP_BASE_URL.rstrip('/')}/verify-email?token={token}"
    plain_text = (
        "Please verify your email to start listing items, requesting items, "
        "chatting, and reviewing exchanges.\n\n"
        f"{verify_link}\n\n"
        "This link expires in 24 hours."
    )
    _post_resend_email(
        to_email,
        "Verify your Happiness Exchange account",
        _verification_html(verify_link),
        plain_text,
    )


def _team_invite_html(
    *,
    recipient_name: str,
    inviter_name: str,
    role_label: str,
    action_url: str,
    action_label: str,
    intro_text: str,
) -> str:
    return f"""
    <html>
      <body style="font-family: sans-serif; line-height: 1.6; color: #1f1f1f;">
        <h2 style="color: #8b4cf6;">Admin team invitation</h2>
        <p>Hi {recipient_name},</p>
        <p>
          <strong>{inviter_name}</strong> has invited you to join the Happiness Exchange admin team
          as <strong>{role_label}</strong>.
        </p>
        <p>{intro_text}</p>
        <div style="margin-top: 24px; margin-bottom: 24px;">
            <a href="{action_url}" style="background-color: #8b4cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">{action_label}</a>
        </div>
        <p style="font-size: 12px; color: #68766d;">If the button above does not work, copy and paste this link into your browser:<br/>{action_url}</p>
      </body>
    </html>
    """


def send_team_invite_email(
    *,
    to_email: str,
    recipient_name: str,
    inviter_name: str,
    role: str,
    setup_link: str | None = None,
) -> bool:
    """
    Notify a user that they were invited to the admin team.

    When setup_link is provided, the email is for a newly created staff account
    and includes a password-setup link. Otherwise it points to the admin login page.

    Returns True when Resend accepts the message, False when email is not
    configured (dev fallback). Raises EmailSendError when configured but fails.
    """
    role_label = ROLE_LABELS.get(role, role.replace("_", " ").title())
    admin_panel_url = settings.ADMIN_PANEL_URL.rstrip("/")
    recipient = recipient_name.strip() or to_email
    inviter = inviter_name.strip() or "A super admin"

    if setup_link:
        action_url = setup_link
        action_label = "Accept invite & set password"
        intro_text = "Use the link below to set your password and open the admin panel. This link expires in 7 days."
        plain_text = (
            f"Hi {recipient},\n\n"
            f"{inviter} has invited you to the Happiness Exchange admin team as {role_label}.\n\n"
            f"Set your password and open the admin panel:\n{setup_link}\n\n"
            "This link expires in 7 days."
        )
    else:
        action_url = admin_panel_url
        action_label = "Open admin panel"
        intro_text = "Sign in with your existing Happiness Exchange account to open the admin panel."
        plain_text = (
            f"Hi {recipient},\n\n"
            f"{inviter} has added you to the Happiness Exchange admin team as {role_label}.\n\n"
            f"Open the admin panel:\n{admin_panel_url}\n"
        )

    return _post_resend_email(
        to_email,
        "You've been invited to the Happiness Exchange admin team",
        _team_invite_html(
            recipient_name=recipient,
            inviter_name=inviter,
            role_label=role_label,
            action_url=action_url,
            action_label=action_label,
            intro_text=intro_text,
        ),
        plain_text,
    )
