"""Official ReportLab PDF complaint acknowledgment generator with QR tracking code."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

import qrcode
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image as RLImage,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.models.complaint import Complaint
from app.models.user import User
from app.schemas.complaint import CATEGORY_LABELS
from app.services.storage import ensure_storage_dirs, resolve_storage_path

NAVY = colors.HexColor("#0B1220")
ELECTRIC_BLUE = colors.HexColor("#2563EB")
CYAN_ACCENT = colors.HexColor("#06B6D4")
SLATE_TEXT = colors.HexColor("#334155")
MUTED_TEXT = colors.HexColor("#64748B")
SURFACE_TINT = colors.HexColor("#F8FAFC")
BORDER_GRAY = colors.HexColor("#CBD5E1")
SUCCESS_GREEN = colors.HexColor("#059669")


def _draw_header_banner(canvas, doc) -> None:
    """Draw LIFE SIGNAL branding bar, pulse vector logo mark, and page footer."""
    canvas.saveState()
    page_w, page_h = A4

    # Top navy header bar
    bar_height = 28 * mm
    canvas.setFillColor(NAVY)
    canvas.rect(0, page_h - bar_height, page_w, bar_height, stroke=0, fill=1)

    # Cyan accent bottom border
    canvas.setFillColor(CYAN_ACCENT)
    canvas.rect(0, page_h - bar_height - 1.5, page_w, 1.5, stroke=0, fill=1)

    # Vector signal pulse mark inside rounded badge
    badge_x = 18 * mm
    badge_y = page_h - 20 * mm
    canvas.setFillColor(ELECTRIC_BLUE)
    canvas.roundRect(badge_x, badge_y, 12 * mm, 12 * mm, 2.5 * mm, stroke=0, fill=1)

    canvas.setStrokeColor(colors.white)
    canvas.setLineWidth(1.6)
    p = canvas.beginPath()
    p.moveTo(badge_x + 1.8 * mm, badge_y + 6 * mm)
    p.lineTo(badge_x + 4.0 * mm, badge_y + 6 * mm)
    p.lineTo(badge_x + 5.2 * mm, badge_y + 9.4 * mm)
    p.lineTo(badge_x + 6.9 * mm, badge_y + 2.6 * mm)
    p.lineTo(badge_x + 8.3 * mm, badge_y + 6 * mm)
    p.lineTo(badge_x + 10.2 * mm, badge_y + 6 * mm)
    canvas.drawPath(p, stroke=1, fill=0)

    # Header titles
    text_x = badge_x + 15.5 * mm
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 15)
    canvas.drawString(text_x, page_h - 12.5 * mm, "LIFE SIGNAL")

    canvas.setFillColor(colors.HexColor("#94A3B8"))
    canvas.setFont("Helvetica", 8)
    canvas.drawString(text_x, page_h - 17.5 * mm, "URBAN INFRASTRUCTURE INTELLIGENCE")

    canvas.setFillColor(CYAN_ACCENT)
    canvas.setFont("Helvetica-Bold", 9.5)
    canvas.drawRightString(page_w - 18 * mm, page_h - 13 * mm, "OFFICIAL COMPLAINT")
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 9.5)
    canvas.drawRightString(page_w - 18 * mm, page_h - 18 * mm, "ACKNOWLEDGMENT")

    # Footer
    canvas.setStrokeColor(BORDER_GRAY)
    canvas.setLineWidth(0.5)
    canvas.line(18 * mm, 15 * mm, page_w - 18 * mm, 15 * mm)
    canvas.setFillColor(MUTED_TEXT)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(
        18 * mm,
        10.5 * mm,
        "LIFE SIGNAL · Generated automatically upon database registration. Keep this receipt for tracking.",
    )
    canvas.drawRightString(page_w - 18 * mm, 10.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def _build_qr_image_flowable(tracking_url: str, size_mm: float = 28.0) -> RLImage:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(tracking_url)
    qr.make(fit=True)
    pil_qr = qr.make_image(fill_color="#0B1220", back_color="white").convert("RGB")
    buf = BytesIO()
    pil_qr.save(buf, format="PNG")
    buf.seek(0)
    return RLImage(buf, width=size_mm * mm, height=size_mm * mm)


def _build_evidence_image_flowable(image_path: str | None) -> RLImage | None:
    if not image_path:
        return None
    disk_path = resolve_storage_path(image_path)
    if not disk_path.is_file():
        return None
    try:
        with PILImage.open(disk_path) as img:
            rgb = img.convert("RGB")
            max_w_px, max_h_px = 900, 560
            rgb.thumbnail((max_w_px, max_h_px))
            w_px, h_px = rgb.size
            buf = BytesIO()
            rgb.save(buf, format="JPEG", quality=85)
            buf.seek(0)
    except Exception:
        return None

    target_w = 72 * mm
    target_h = target_w * (h_px / max(w_px, 1))
    if target_h > 48 * mm:
        target_h = 48 * mm
        target_w = target_h * (w_px / max(h_px, 1))
    return RLImage(buf, width=target_w, height=target_h)


def generate_complaint_acknowledgment_pdf(
    *,
    complaint: Complaint,
    citizen: User,
    tracking_url: str,
) -> str:
    """
    Generate the official ReportLab PDF acknowledgment receipt and return its relative storage path.
    """
    _, pdfs_dir = ensure_storage_dirs()
    filename = f"{complaint.complaint_number}.pdf"
    output_path: Path = pdfs_dir / filename

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=34 * mm,
        bottomMargin=20 * mm,
        title=f"LIFE SIGNAL Official Complaint Acknowledgment - {complaint.complaint_number}",
        author="LIFE SIGNAL Platform",
    )

    styles = getSampleStyleSheet()
    section_title_style = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        textColor=NAVY,
        spaceBefore=6,
        spaceAfter=4,
    )
    label_style = ParagraphStyle(
        "FieldLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        textColor=MUTED_TEXT,
    )
    value_style = ParagraphStyle(
        "FieldValue",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        textColor=SLATE_TEXT,
        leading=13,
    )
    ref_style = ParagraphStyle(
        "RefNumber",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=17,
        textColor=ELECTRIC_BLUE,
        spaceAfter=2,
    )
    disclaimer_style = ParagraphStyle(
        "Disclaimer",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8.2,
        textColor=MUTED_TEXT,
        leading=11.5,
    )

    story = []

    # Reference banner card
    ref_table = Table(
        [
            [
                [
                    Paragraph("COMPLAINT REFERENCE NUMBER", label_style),
                    Paragraph(complaint.complaint_number, ref_style),
                ],
                Paragraph(
                    "<b>Status:</b> Submitted (Successfully Registered)<br/>"
                    "<b>AI Analysis:</b> Queued for Phase 3 Vision &amp; Uncertainty Review",
                    ParagraphStyle(
                        "StatusRight",
                        parent=value_style,
                        alignment=2,
                        fontSize=8.8,
                        textColor=SUCCESS_GREEN,
                    ),
                ),
            ]
        ],
        colWidths=[88 * mm, 86 * mm],
    )
    ref_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SURFACE_TINT),
                ("BOX", (0, 0), (-1, -1), 0.75, BORDER_GRAY),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(ref_table)
    story.append(Spacer(1, 6 * mm))

    # Citizen Details
    story.append(Paragraph("Citizen Details", section_title_style))
    citizen_table = Table(
        [
            [Paragraph("Full Name", label_style), Paragraph(citizen.full_name, value_style)],
            [Paragraph("Registered Email", label_style), Paragraph(citizen.email, value_style)],
            [Paragraph("Notification Email", label_style), Paragraph(complaint.contact_email, value_style)],
        ],
        colWidths=[44 * mm, 130 * mm],
    )
    citizen_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER_GRAY),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
                ("BACKGROUND", (0, 0), (0, -1), SURFACE_TINT),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(citizen_table)
    story.append(Spacer(1, 5 * mm))

    # Complaint Details
    category_label = CATEGORY_LABELS.get(complaint.category, complaint.category.value)
    submitted_str = complaint.reported_at.strftime("%d %B %Y, %H:%M UTC")
    coords_str = f"{complaint.latitude:.6f}, {complaint.longitude:.6f}"
    status_label = complaint.status.value.replace("_", " ").title()

    story.append(Paragraph("Complaint Details", section_title_style))
    details_table = Table(
        [
            [Paragraph("Complaint Title", label_style), Paragraph(complaint.title, value_style)],
            [Paragraph("Category", label_style), Paragraph(category_label, value_style)],
            [Paragraph("Location / Address", label_style), Paragraph(complaint.address, value_style)],
            [Paragraph("GPS Coordinates", label_style), Paragraph(coords_str, value_style)],
            [Paragraph("Submission Date", label_style), Paragraph(submitted_str, value_style)],
            [Paragraph("Initial Status", label_style), Paragraph(status_label, value_style)],
            [
                Paragraph("AI Analysis Status", label_style),
                Paragraph("Pending Computer Vision Verification", value_style),
            ],
            [Paragraph("Description", label_style), Paragraph(complaint.description, value_style)],
        ],
        colWidths=[44 * mm, 130 * mm],
    )
    details_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER_GRAY),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
                ("BACKGROUND", (0, 0), (0, -1), SURFACE_TINT),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(details_table)
    story.append(Spacer(1, 5 * mm))

    # Evidence photo + QR Tracking Side-by-Side
    evidence_flowable = _build_evidence_image_flowable(complaint.image_path)
    qr_flowable = _build_qr_image_flowable(tracking_url, size_mm=28.0)

    qr_block = [
        Paragraph("<b>Scan to Track Complaint</b>", value_style),
        Spacer(1, 1.5 * mm),
        qr_flowable,
        Spacer(1, 1.5 * mm),
        Paragraph(
            f"Use reference <b>{complaint.complaint_number}</b> in your LIFE SIGNAL Citizen Dashboard "
            f"or scan this QR code to open live status updates:<br/><font size='7.5' color='#2563EB'>{tracking_url}</font>",
            ParagraphStyle("QrNote", parent=value_style, fontSize=8, leading=11),
        ),
    ]

    if evidence_flowable is not None:
        media_row = [
            [
                Paragraph("<b>Submitted Evidence Photograph</b>", value_style),
                Spacer(1, 1.5 * mm),
                evidence_flowable,
            ],
            qr_block,
        ]
        media_table = Table([media_row], colWidths=[90 * mm, 84 * mm])
    else:
        media_table = Table([[qr_block]], colWidths=[174 * mm])

    media_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.6, BORDER_GRAY),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, BORDER_GRAY),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(media_table)
    story.append(Spacer(1, 5 * mm))

    # Official Disclaimer
    story.append(
        Paragraph(
            "<b>Official Notice &amp; Disclaimer:</b> This document acknowledges receipt of the complaint "
            "registered in the LIFE SIGNAL system. It does not certify that the reported issue has been "
            "verified or repaired, and registration does not guarantee immediate repair. Thank you for "
            "helping build safer, better-maintained cities.",
            disclaimer_style,
        )
    )

    doc.build(story, onFirstPage=_draw_header_banner, onLaterPages=_draw_header_banner)
    return f"pdfs/{filename}"

