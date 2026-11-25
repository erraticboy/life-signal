"""Real SMTP email delivery service with PDF attachment support."""

from __future__ import annotations

import smtplib
from dataclasses import dataclass
from datetime import datetime, timezone
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from app.core.config import get_settings
from app.models.document import EmailDeliveryStatus


@dataclass(frozen=True)
class EmailDispatchResult:
    status: EmailDeliveryStatus
    error: str | None
    sent_at: datetime | None


def _send_mime_message(msg: MIMEMultipart, recipient: str) -> EmailDispatchResult:
    settings = get_settings()
    if not settings.is_smtp_configured:
        return EmailDispatchResult(
            status=EmailDeliveryStatus.NOT_CONFIGURED,
            error=(
                "SMTP credentials are not configured in backend/.env. Set SMTP_USERNAME and "
                "SMTP_PASSWORD (e.g. a Gmail App Password) to send confirmation emails."
            ),
            sent_at=None,
        )

    from_addr = settings.SMTP_FROM_EMAIL.strip() or settings.SMTP_USERNAME.strip()
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{from_addr}>"
    msg["To"] = recipient

    try:
        if settings.SMTP_PORT == 465 and not settings.SMTP_USE_TLS:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
                server.ehlo()
                if settings.SMTP_USE_TLS:
                    server.starttls()
                    server.ehlo()
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)

        return EmailDispatchResult(
            status=EmailDeliveryStatus.SENT,
            error=None,
            sent_at=datetime.now(timezone.utc),
        )
    except (smtplib.SMTPException, OSError) as exc:
        return EmailDispatchResult(
            status=EmailDeliveryStatus.FAILED,
            error=f"SMTP delivery failed ({type(exc).__name__}): {exc}",
            sent_at=None,
        )


def send_complaint_acknowledgment_email(
    *,
    recipient_email: str,
    citizen_name: str,
    complaint_number: str,
    pdf_disk_path: Path,
) -> EmailDispatchResult:
    """Send official complaint confirmation email with the ReportLab PDF attached."""
    msg = MIMEMultipart()
    msg["Subject"] = f"Your LIFE SIGNAL Complaint Has Been Registered – {complaint_number}"

    body = (
        f"Hello {citizen_name},\n\n"
        "Your complaint has been successfully registered with LIFE SIGNAL.\n\n"
        f"Your complaint reference number is {complaint_number}.\n\n"
        "Please find your official complaint acknowledgment attached as a PDF.\n\n"
        "You can use the complaint reference number to track your complaint status.\n\n"
        "Thank you for helping improve our communities.\n\n"
        "Team LIFE SIGNAL"
    )
    msg.attach(MIMEText(body, "plain", "utf-8"))

    if pdf_disk_path.is_file():
        pdf_bytes = pdf_disk_path.read_bytes()
        attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
        attachment.add_header(
            "Content-Disposition",
            "attachment",
            filename=f"{complaint_number}-acknowledgment.pdf",
        )
        msg.attach(attachment)

    return _send_mime_message(msg, recipient_email)


def send_complaint_status_update_email(
    *,
    recipient_email: str,
    citizen_name: str,
    complaint_number: str,
    new_status: str,
    notes: str | None = None,
) -> EmailDispatchResult:
    """Notify the citizen via email when an administrator updates complaint status."""
    msg = MIMEMultipart()
    msg["Subject"] = f"LIFE SIGNAL Status Update – {complaint_number}"
    readable_status = new_status.replace("_", " ").title()
    notes_line = f"\nAdministrator Notes: {notes}\n" if notes else ""
    body = (
        f"Hello {citizen_name},\n\n"
        f"The status of your LIFE SIGNAL complaint ({complaint_number}) has been updated to: {readable_status}.\n"
        f"{notes_line}\n"
        "Sign in to your LIFE SIGNAL Citizen Dashboard to view full details.\n\n"
        "Team LIFE SIGNAL"
    )
    msg.attach(MIMEText(body, "plain", "utf-8"))
    return _send_mime_message(msg, recipient_email)

