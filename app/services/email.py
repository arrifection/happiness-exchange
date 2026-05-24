import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_verification_email(to_email: str, token: str) -> None:
    """Send an email verification link to the user.
    If SMTP credentials are not set, it prints the link to the console for local development.
    """
    verify_link = f"{settings.APP_BASE_URL}/verify-email?token={token}"

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning(
            "SMTP credentials not configured. "
            "Verification link (copy and paste in browser):\n%s",
            verify_link,
        )
        return

    msg = EmailMessage()
    msg["Subject"] = "Verify your Happiness Exchange account"
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to_email
    
    # HTML Email body
    html_content = f"""
    <html>
      <body style="font-family: sans-serif; line-height: 1.6; color: #1f1f1f;">
        <h2 style="color: #8b4cf6;">Welcome to Happiness Exchange</h2>
        <p>Please verify your email to start listing items, requesting items, chatting, and reviewing exchanges.</p>
        <div style="margin-top: 24px; margin-bottom: 24px;">
            <a href="{verify_link}" style="background-color: #8b4cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Verify Email</a>
        </div>
        <p style="font-size: 12px; color: #68766d;">If the button above does not work, copy and paste this link into your browser:<br/>{verify_link}</p>
      </body>
    </html>
    """
    msg.set_content("Please verify your email to start listing items, requesting items, chatting, and reviewing exchanges.\n\n" + verify_link)
    msg.add_alternative(html_content, subtype="html")

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            logger.info("Verification email sent successfully to %s", to_email)
    except Exception as e:
        logger.error("Failed to send verification email to %s: %s", to_email, e)
        # Even if email fails, we don't necessarily want to crash the whole signup process.
        # But for local dev it's useful to log.
