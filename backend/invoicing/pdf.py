from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from PIL import Image as PILImage
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def money(value):
    """Format monetary values consistently."""
    return f"{Decimal(str(value or 0)):,.2f}"


def _company_logo(company, max_width=42 * mm, max_height=28 * mm):
    """
    Load and normalize the company logo through Django storage.

    PNG, JPEG and WebP uploads are converted to PNG in memory so ReportLab
    can render the logo reliably with both local and remote storage.
    """
    if not company or not getattr(company, "logo", None):
        return None

    try:
        with company.logo.storage.open(company.logo.name, "rb") as file_obj:
            image_bytes = file_obj.read()

        if not image_bytes:
            return None

        source = PILImage.open(BytesIO(image_bytes))
        source.load()

        if "A" in source.getbands():
            rgba = source.convert("RGBA")
            background = PILImage.new(
                "RGB",
                rgba.size,
                (255, 255, 255),
            )
            background.paste(
                rgba,
                mask=rgba.getchannel("A"),
            )
            normalized = background
        else:
            normalized = source.convert("RGB")

        normalized.thumbnail(
            (int(max_width), int(max_height)),
            PILImage.Resampling.LANCZOS,
        )

        png_buffer = BytesIO()
        normalized.save(
            png_buffer,
            format="PNG",
            optimize=True,
        )
        png_buffer.seek(0)

        # Keep the BytesIO stream alive through the ReportLab build.
        flowable = Image(
            png_buffer,
            width=normalized.width,
            height=normalized.height,
        )
        flowable.hAlign = "LEFT"
        return flowable
    except Exception as exc:
        print(
            f"[INVOICE LOGO] Unable to load company logo: {exc}"
        )
        return None


def generate_invoice_pdf(invoice):
    """
    Generate a professional, company-branded invoice PDF.

    The company identity and logo are always resolved from invoice.company.
    No logo is hardcoded into the invoice generator.
    """
    company = invoice.company
    customer = invoice.customer

    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        topMargin=15 * mm,
        bottomMargin=16 * mm,
        title=f"Invoice {invoice.invoice_number}",
        author=company.name,
    )

    styles = getSampleStyleSheet()

    company_name_style = ParagraphStyle(
        "InvoiceCompanyName",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=21,
        textColor=colors.HexColor("#102A43"),
        alignment=TA_LEFT,
        spaceAfter=2,
    )

    legal_name_style = ParagraphStyle(
        "InvoiceLegalName",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#52606D"),
        alignment=TA_LEFT,
    )

    company_info_style = ParagraphStyle(
        "InvoiceCompanyInfo",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.8,
        leading=10,
        textColor=colors.HexColor("#627D98"),
        alignment=TA_LEFT,
    )

    invoice_title_style = ParagraphStyle(
        "InvoiceTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=25,
        leading=28,
        textColor=colors.HexColor("#102A43"),
        alignment=TA_RIGHT,
    )

    invoice_meta_style = ParagraphStyle(
        "InvoiceMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.2,
        leading=11,
        textColor=colors.HexColor("#52606D"),
        alignment=TA_RIGHT,
    )

    label_style = ParagraphStyle(
        "InvoiceLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor("#627D98"),
    )

    value_style = ParagraphStyle(
        "InvoiceValue",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#243B53"),
    )

    table_header_style = ParagraphStyle(
        "InvoiceTableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9,
        textColor=colors.white,
    )

    table_body_style = ParagraphStyle(
        "InvoiceTableBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#243B53"),
    )

    total_label_style = ParagraphStyle(
        "InvoiceTotalLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#52606D"),
    )

    total_value_style = ParagraphStyle(
        "InvoiceTotalValue",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        alignment=TA_RIGHT,
        textColor=colors.HexColor("#102A43"),
    )

    balance_label_style = ParagraphStyle(
        "InvoiceBalanceLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=colors.white,
    )

    balance_value_style = ParagraphStyle(
        "InvoiceBalanceValue",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        alignment=TA_RIGHT,
        textColor=colors.white,
    )

    small_style = ParagraphStyle(
        "InvoiceSmall",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#627D98"),
    )

    story = []
    usable_width = A4[0] - 32 * mm

    # ------------------------------------------------------------
    # COMPANY / INVOICE HEADER
    # ------------------------------------------------------------
    logo = _company_logo(company)

    company_block = []
    if logo:
        company_block.append(logo)
        company_block.append(Spacer(1, 2.5 * mm))

    company_block.append(
        Paragraph(
            escape(str(company.name or "Company")),
            company_name_style,
        )
    )

    legal_name = str(company.legal_name or "").strip()
    if legal_name and legal_name != str(company.name or "").strip():
        company_block.append(
            Paragraph(escape(legal_name), legal_name_style)
        )

    info_lines = []
    if company.address:
        info_lines.append(
            escape(str(company.address)).replace("\n", "<br/>")
        )
    if company.phone:
        info_lines.append(f"Phone: {escape(str(company.phone))}")
    if company.email:
        info_lines.append(f"Email: {escape(str(company.email))}")
    if company.registration_number:
        info_lines.append(
            "Registration No.: "
            f"{escape(str(company.registration_number))}"
        )

    if info_lines:
        company_block.append(Spacer(1, 1.5 * mm))
        company_block.append(
            Paragraph("<br/>".join(info_lines), company_info_style)
        )

    invoice_meta = [
        Paragraph("INVOICE", invoice_title_style),
        Spacer(1, 2 * mm),
        Paragraph(
            f"<b>Invoice #:</b> {escape(str(invoice.invoice_number))}",
            invoice_meta_style,
        ),
        Paragraph(
            f"<b>Invoice Date:</b> {invoice.invoice_date.strftime('%d %b %Y')}",
            invoice_meta_style,
        ),
        Paragraph(
            f"<b>Due Date:</b> {invoice.due_date.strftime('%d %b %Y')}",
            invoice_meta_style,
        ),
        Paragraph(
            f"<b>Status:</b> {escape(invoice.get_status_display())}",
            invoice_meta_style,
        ),
    ]

    header_table = Table(
        [[company_block, invoice_meta]],
        colWidths=[usable_width * 0.63, usable_width * 0.37],
    )
    header_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ])
    )
    story.append(header_table)

    story.append(Spacer(1, 3 * mm))
    story.append(
        Table(
            [["", ""]],
            colWidths=[usable_width * 0.78, usable_width * 0.22],
            rowHeights=[2.2],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#2F80A0")),
                ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#D9EAF0")),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]),
        )
    )
    story.append(Spacer(1, 5 * mm))

    # ------------------------------------------------------------
    # CUSTOMER / PAYMENT INFORMATION
    # ------------------------------------------------------------
    customer_block = [
        Paragraph("BILL TO", label_style),
        Spacer(1, 1 * mm),
        Paragraph(
            f"<b>{escape(str(customer.name or 'Customer'))}</b>",
            value_style,
        ),
    ]

    if customer.address:
        customer_block.append(
            Paragraph(
                escape(str(customer.address)).replace("\n", "<br/>"),
                value_style,
            )
        )
    if customer.phone:
        customer_block.append(
            Paragraph(f"Phone: {escape(str(customer.phone))}", value_style)
        )
    if customer.email:
        customer_block.append(
            Paragraph(f"Email: {escape(str(customer.email))}", value_style)
        )
    if customer.tax_number:
        customer_block.append(
            Paragraph(
                f"Tax No.: {escape(str(customer.tax_number))}",
                value_style,
            )
        )

    payment_block = [
        Paragraph("PAYMENT DETAILS", label_style),
        Spacer(1, 1 * mm),
        Paragraph(
            f"<b>Currency:</b> {escape(str(getattr(invoice, 'currency', None) or company.currency))}",
            value_style,
        ),
        Paragraph(
            f"<b>Payment Status:</b> {escape(invoice.get_status_display())}",
            value_style,
        ),
    ]

    info_table = Table(
        [[customer_block, payment_block]],
        colWidths=[usable_width * 0.63, usable_width * 0.37],
    )
    info_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F6F9FB")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D9E2EC")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ])
    )
    story.append(info_table)
    story.append(Spacer(1, 5 * mm))

    # ------------------------------------------------------------
    # ITEMS
    # ------------------------------------------------------------
    item_rows = [[
        Paragraph("#", table_header_style),
        Paragraph("DESCRIPTION", table_header_style),
        Paragraph("QTY", table_header_style),
        Paragraph("UNIT PRICE", table_header_style),
        Paragraph("DISCOUNT", table_header_style),
        Paragraph("TAX", table_header_style),
        Paragraph("TOTAL", table_header_style),
    ]]

    for index, item in enumerate(invoice.items.all(), start=1):
        item_rows.append([
            Paragraph(str(index), table_body_style),
            Paragraph(escape(str(item.description or "")), table_body_style),
            Paragraph(f"{item.quantity:,.3f}", table_body_style),
            Paragraph(money(item.unit_price), table_body_style),
            Paragraph(money(item.discount), table_body_style),
            Paragraph(money(item.tax), table_body_style),
            Paragraph(money(item.line_total), table_body_style),
        ])

    items_table = Table(
        item_rows,
        colWidths=[
            8 * mm,
            67 * mm,
            17 * mm,
            25 * mm,
            22 * mm,
            20 * mm,
            23 * mm,
        ],
        repeatRows=1,
    )
    items_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#102A43")),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D9E2EC")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ])
    )
    story.append(items_table)
    story.append(Spacer(1, 5 * mm))

    # ------------------------------------------------------------
    # TOTALS
    # ------------------------------------------------------------
    document_currency = str(
        getattr(invoice, "currency", None) or company.currency or "USD"
    ).upper()

    totals_rows = [
        ["", Paragraph("Subtotal", total_label_style), Paragraph(f"{document_currency} {money(invoice.subtotal)}", total_value_style)],
        ["", Paragraph("Discount", total_label_style), Paragraph(f"{document_currency} {money(invoice.discount)}", total_value_style)],
        ["", Paragraph("Tax", total_label_style), Paragraph(f"{document_currency} {money(invoice.tax)}", total_value_style)],
        ["", Paragraph("TOTAL", total_label_style), Paragraph(f"{document_currency} {money(invoice.total_amount)}", total_value_style)],
        ["", Paragraph("Amount Paid", total_label_style), Paragraph(f"{document_currency} {money(invoice.amount_paid)}", total_value_style)],
    ]

    totals_table = Table(
        totals_rows,
        colWidths=[usable_width * 0.50, usable_width * 0.25, usable_width * 0.25],
    )
    totals_table.setStyle(
        TableStyle([
            ("LINEABOVE", (1, 3), (-1, 3), 0.8, colors.HexColor("#2F80A0")),
            ("LINEBELOW", (1, 3), (-1, 3), 0.4, colors.HexColor("#D9E2EC")),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(totals_table)
    story.append(Spacer(1, 2 * mm))

    balance_table = Table(
        [[
            Paragraph("BALANCE DUE", balance_label_style),
            Paragraph(
                f"{document_currency} {money(invoice.balance_due)}",
                balance_value_style,
            ),
        ]],
        colWidths=[usable_width * 0.72, usable_width * 0.28],
    )
    balance_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#102A43")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ])
    )
    story.append(balance_table)
    story.append(Spacer(1, 6 * mm))

    # ------------------------------------------------------------
    # NOTES / TERMS
    # ------------------------------------------------------------
    if invoice.notes or invoice.terms:
        notes_rows = [[
            Paragraph(
                "<b>Notes</b><br/>" + (
                    escape(str(invoice.notes)).replace("\n", "<br/>")
                    if invoice.notes
                    else "—"
                ),
                small_style,
            ),
            Paragraph(
                "<b>Payment Terms</b><br/>" + (
                    escape(str(invoice.terms)).replace("\n", "<br/>")
                    if invoice.terms
                    else "—"
                ),
                small_style,
            ),
        ]]

        notes_table = Table(
            notes_rows,
            colWidths=[usable_width * 0.50, usable_width * 0.50],
        )
        notes_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#D9E2EC")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ])
        )
        story.append(notes_table)
        story.append(Spacer(1, 5 * mm))

    # ------------------------------------------------------------
    # FOOTER
    # ------------------------------------------------------------
    story.append(
        Paragraph(
            f"Thank you for doing business with <b>{escape(str(company.name))}</b>.",
            small_style,
        )
    )
    story.append(Spacer(1, 1.5 * mm))
    story.append(
        Paragraph(
            f"Generated by Hindsfeet Accounting on {timezone.now().strftime('%d %b %Y %H:%M')}",
            small_style,
        )
    )

    document.build(story)
    buffer.seek(0)
    return buffer
