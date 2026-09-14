import re
from io import BytesIO
from xml.sax.saxutils import escape

from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from PIL import Image as PILImage
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from companies.models import CompanyMembership

from .models import PayrollPeriod, PayrollRecord


class PayrollPayslipView(APIView):
    """
    Generate a professional employee payslip from a finalized
    PayrollRecord snapshot.

    Payslips are available only for APPROVED or LOCKED payroll periods.
    Company branding is read directly from payroll_period.company, so the
    logo shown on the document always belongs to the selected company.
    """

    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _money(value):
        try:
            return f"{float(value or 0):,.2f}"
        except (TypeError, ValueError):
            return "0.00"

    @staticmethod
    def _currency_symbol(currency):
        return {
            "USD": "$",
            "LRD": "L$",
        }.get(
            str(currency or "USD").upper(),
            f"{str(currency or 'USD').upper()} ",
        ).strip()

    @staticmethod
    def _date_label(value):
        if not value:
            return "—"
        return value.strftime("%B %d, %Y").replace(" 0", " ")

    @staticmethod
    def _user_can_access_company(user, company):
        if user.is_superuser:
            return True

        if user.role in ["OWNER", "ADMIN"]:
            return True

        return CompanyMembership.objects.filter(
            user=user,
            company=company,
            is_active=True,
        ).exists()

    @staticmethod
    def _logo_flowable(company, max_width=42 * mm, max_height=28 * mm):
        """
        Load and normalize the company logo through Django storage.

        The image is converted to PNG in memory before ReportLab receives it.
        This makes PNG, JPEG and WebP uploads reliable, including transparent
        logos, without depending on FieldFile.path.
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

            # Normalize the uploaded image onto a white canvas. This avoids
            # rendering problems with transparent PNG/WebP files and makes
            # the logo visible on the white document background.
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
                f"[PAYSLIP LOGO] Unable to load company logo: {exc}"
            )
            return None

    def get(self, request, period_id, record_id):
        try:
            record = (
                PayrollRecord.objects
                .select_related(
                    "payroll_period__company",
                    "employee",
                )
                .prefetch_related(
                    "earning_lines__earning_type",
                    "deduction_lines__deduction_type",
                )
                .get(
                    id=record_id,
                    payroll_period_id=period_id,
                )
            )
        except PayrollRecord.DoesNotExist:
            return Response(
                {"detail": "Payroll record not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        period = record.payroll_period
        company = period.company
        employee = record.employee

        if not self._user_can_access_company(request.user, company):
            return Response(
                {"detail": "You do not have access to this company."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if period.status not in [
            PayrollPeriod.Status.APPROVED,
            PayrollPeriod.Status.LOCKED,
        ]:
            return Response(
                {
                    "detail": (
                        "Payslips can only be generated after payroll "
                        "has been approved."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if employee.company_id != company.id:
            return Response(
                {
                    "detail": (
                        "This employee does not belong to the payroll "
                        "company."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        currency = getattr(company, "currency", None) or "USD"
        symbol = self._currency_symbol(currency)

        page_width, page_height = A4
        margin = 15 * mm
        usable_width = page_width - (2 * margin)

        buffer = BytesIO()

        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=margin,
            leftMargin=margin,
            topMargin=12 * mm,
            bottomMargin=13 * mm,
            title=f"Payslip - {employee.full_name} - {period.name}",
            author="Hindsfeet Accounting",
        )

        styles = getSampleStyleSheet()

        company_style = ParagraphStyle(
            "PayslipCompany",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=18,
            alignment=TA_LEFT,
            textColor=colors.HexColor("#102A43"),
            spaceAfter=2,
        )

        legal_style = ParagraphStyle(
            "PayslipLegal",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=10.5,
            textColor=colors.HexColor("#52606D"),
        )

        contact_style = ParagraphStyle(
            "PayslipContact",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7.7,
            leading=9.5,
            textColor=colors.HexColor("#627D98"),
        )

        document_title = ParagraphStyle(
            "PayslipDocumentTitle",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=21,
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#102A43"),
            spaceAfter=2,
        )

        period_style = ParagraphStyle(
            "PayslipPeriod",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#627D98"),
        )

        section_style = ParagraphStyle(
            "PayslipSection",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=10,
            textColor=colors.HexColor("#102A43"),
        )

        body_style = ParagraphStyle(
            "PayslipBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.3,
            leading=10.5,
            textColor=colors.HexColor("#243B53"),
        )

        body_bold = ParagraphStyle(
            "PayslipBodyBold",
            parent=body_style,
            fontName="Helvetica-Bold",
        )

        amount_style = ParagraphStyle(
            "PayslipAmount",
            parent=body_style,
            alignment=TA_RIGHT,
            fontSize=8.3,
        )

        amount_bold = ParagraphStyle(
            "PayslipAmountBold",
            parent=amount_style,
            fontName="Helvetica-Bold",
        )

        net_label_style = ParagraphStyle(
            "PayslipNetLabel",
            parent=body_bold,
            fontSize=9,
            leading=11,
            textColor=colors.white,
        )

        net_amount_style = ParagraphStyle(
            "PayslipNetAmount",
            parent=amount_bold,
            fontSize=13,
            leading=15,
            textColor=colors.white,
        )

        tiny_style = ParagraphStyle(
            "PayslipTiny",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=6.8,
            leading=8,
            textColor=colors.HexColor("#7B8794"),
        )

        story = []

        # ---------------------------------------------------------
        # COMPANY HEADER
        # ---------------------------------------------------------
        company_display_name = str(
            getattr(company, "name", "") or "Company"
        ).strip()
        legal_name = str(
            getattr(company, "legal_name", "") or ""
        ).strip()

        logo = self._logo_flowable(company)

        company_block = []

        # Explicitly place the company logo above the company name.
        if logo:
            company_block.append(logo)
            company_block.append(
                Spacer(1, 2.5 * mm)
            )

        company_block.append(
            Paragraph(
                escape(company_display_name),
                company_style,
            )
        )

        if legal_name and legal_name != company_display_name:
            company_block.append(
                Paragraph(
                    escape(legal_name),
                    legal_style,
                )
            )

        contact_parts = []
        address = str(getattr(company, "address", "") or "").strip()
        phone = str(getattr(company, "phone", "") or "").strip()
        email = str(getattr(company, "email", "") or "").strip()
        registration_number = str(
            getattr(company, "registration_number", "") or ""
        ).strip()

        if address:
            contact_parts.append(escape(address).replace("\n", "<br/>"))

        contact_line = "  |  ".join(
            escape(part)
            for part in [phone, email]
            if part
        )
        if contact_line:
            contact_parts.append(contact_line)

        if registration_number:
            contact_parts.append(
                f"Registration No.: {escape(registration_number)}"
            )

        if contact_parts:
            company_block.append(
                Spacer(1, 1.5 * mm)
            )
            company_block.append(
                Paragraph(
                    "<br/>".join(contact_parts),
                    contact_style,
                )
            )

        right_block = [
            Paragraph("EMPLOYEE PAYSLIP", document_title),
            Paragraph(
                f"PAY PERIOD: {escape(str(period.name or 'Payroll Period'))}",
                period_style,
            ),
            Paragraph(
                f"Pay date: {self._date_label(getattr(period, 'pay_date', None))}",
                period_style,
            ),
        ]

        # company_block already contains the logo. Do not prepend it again.
        left_header = company_block

        header_table = Table(
            [[left_header, right_block]],
            colWidths=[usable_width * 0.60, usable_width * 0.40],
        )
        header_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ])
        )
        story.append(header_table)

        # Professional accent line.
        story.append(
            Table(
                [["", ""]],
                colWidths=[usable_width * 0.78, usable_width * 0.22],
                rowHeights=[2.2],
                style=TableStyle([
                    (
                        "BACKGROUND",
                        (0, 0),
                        (0, 0),
                        colors.HexColor("#2F80A0"),
                    ),
                    (
                        "BACKGROUND",
                        (1, 0),
                        (1, 0),
                        colors.HexColor("#D9EAF0"),
                    ),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]),
            )
        )
        story.append(Spacer(1, 4 * mm))

        # ---------------------------------------------------------
        # EMPLOYEE INFORMATION
        # ---------------------------------------------------------
        employee_name = escape(
            str(getattr(employee, "full_name", "") or "Unknown Employee")
        )
        employee_number = escape(
            str(getattr(employee, "employee_number", "") or "—")
        )
        department = escape(
            str(getattr(employee, "department", "") or "—")
        )
        position = escape(
            str(getattr(employee, "position", "") or "—")
        )

        employee_info = Table(
            [
                [
                    Paragraph("EMPLOYEE", section_style),
                    Paragraph("EMPLOYEE NO.", section_style),
                ],
                [
                    Paragraph(employee_name, body_bold),
                    Paragraph(employee_number, body_style),
                ],
                [
                    Paragraph("DEPARTMENT", section_style),
                    Paragraph("POSITION", section_style),
                ],
                [
                    Paragraph(department, body_style),
                    Paragraph(position, body_style),
                ],
            ],
            colWidths=[
                usable_width * 0.50,
                usable_width * 0.50,
            ],
        )
        employee_info.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F7FA")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D9E2EC")),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E6EDF2")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        story.append(employee_info)
        story.append(Spacer(1, 4 * mm))

        symbol = escape(symbol)

        def money_paragraph(value, bold=False):
            style = amount_bold if bold else amount_style
            return Paragraph(
                f"{symbol}{self._money(value)}",
                style,
            )

        def row(label, value, bold=False):
            label_style = body_bold if bold else body_style
            return [
                Paragraph(escape(str(label)), label_style),
                money_paragraph(value, bold=bold),
            ]

        # ---------------------------------------------------------
        # EARNINGS / DEDUCTIONS SIDE BY SIDE
        # ---------------------------------------------------------
        earnings_rows = [
            [
                Paragraph("EARNINGS", section_style),
                Paragraph("AMOUNT", section_style),
            ],
            row("Basic Salary", record.basic_salary),
        ]

        for earning_line in record.earning_lines.all():
            earning_name = str(
                getattr(
                    earning_line.earning_type,
                    "name",
                    None,
                )
                or earning_line.description
                or "Other Earnings"
            )
            earnings_rows.append(
                row(earning_name, earning_line.amount)
            )

        absent_days = getattr(record, "absent_days", 0) or 0
        absence_deduction = getattr(
            record,
            "absence_deduction",
            0,
        ) or 0

        if float(absent_days or 0) > 0 or float(absence_deduction or 0) > 0:
            earnings_rows.append(
                row(
                    f"Absence Deduction ({self._money(absent_days)} days)",
                    absence_deduction,
                )
            )

        earnings_rows.append(
            row("Gross Pay", record.gross_pay, bold=True)
        )

        withholding_rows = [
            [
                Paragraph("DEDUCTIONS", section_style),
                Paragraph("AMOUNT", section_style),
            ],
            row("PAYE / Income Tax", getattr(record, "paye_tax", 0)),
            row(
                "Employee NASSCORP",
                getattr(record, "social_security_employee", 0),
            ),
        ]

        reserved_codes = {"PAYE", "NASSCORP", "ABSENCE"}

        for deduction_line in record.deduction_lines.all():
            code = str(
                getattr(
                    deduction_line.deduction_type,
                    "code",
                    "",
                )
                or ""
            ).upper()

            if code in reserved_codes:
                continue

            deduction_name = str(
                getattr(
                    deduction_line.deduction_type,
                    "name",
                    None,
                )
                or deduction_line.description
                or "Other Deduction"
            )
            withholding_rows.append(
                row(deduction_name, deduction_line.amount)
            )

        withholding_rows.append(
            row("Total Deductions", record.total_deductions, bold=True)
        )

        earnings_table = Table(
            earnings_rows,
            colWidths=[usable_width * 0.39, usable_width * 0.21],
            repeatRows=1,
        )

        deductions_table = Table(
            withholding_rows,
            colWidths=[usable_width * 0.25, usable_width * 0.15],
            repeatRows=1,
        )

        for table in [earnings_table, deductions_table]:
            table.setStyle(
                TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F7FA")),
                    ("LINEBELOW", (0, 0), (-1, 0), 0.7, colors.HexColor("#2F80A0")),
                    ("LINEBELOW", (0, -1), (-1, -1), 0.7, colors.HexColor("#B8C7D1")),
                    ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ])
            )

        side_by_side = Table(
            [[earnings_table, deductions_table]],
            colWidths=[usable_width * 0.60, usable_width * 0.40],
        )
        side_by_side.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ])
        )
        story.append(side_by_side)
        story.append(Spacer(1, 4 * mm))

        # ---------------------------------------------------------
        # NET PAY / PAYMENT SUMMARY
        # ---------------------------------------------------------
        net_table = Table(
            [[
                Paragraph("NET PAY", net_label_style),
                Paragraph(
                    f"{symbol}{self._money(record.net_pay)}",
                    net_amount_style,
                ),
            ]],
            colWidths=[usable_width * 0.68, usable_width * 0.32],
        )
        net_table.setStyle(
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
        story.append(net_table)
        story.append(Spacer(1, 3 * mm))


        # ---------------------------------------------------------
        # FOOTER / SIGNATURE
        # ---------------------------------------------------------
        signature_table = Table(
            [[
                Paragraph(
                    "Authorized Signature: ______________________________",
                    body_style,
                ),
                Paragraph(
                    "Date: ____________________",
                    body_style,
                ),
            ]],
            colWidths=[usable_width * 0.60, usable_width * 0.40],
        )
        signature_table.setStyle(
            TableStyle([
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ])
        )
        story.append(signature_table)
        story.append(Spacer(1, 2 * mm))
        story.append(
            Paragraph(
                "This payslip was generated by Hindsfeet Accounting from the finalized payroll record for the selected period.",
                tiny_style,
            )
        )

        document.build(story)
        buffer.seek(0)

        safe_employee = re.sub(
            r"[^A-Za-z0-9_-]+",
            "_",
            str(getattr(employee, "full_name", "employee")),
        ).strip("_") or f"employee_{employee.id}"

        safe_period = re.sub(
            r"[^A-Za-z0-9_-]+",
            "_",
            str(period.name),
        ).strip("_") or f"period_{period.id}"

        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/pdf",
        )
        response["Content-Disposition"] = (
            f'attachment; filename="Payslip_{safe_employee}_'
            f'{safe_period}.pdf"'
        )

        return response
