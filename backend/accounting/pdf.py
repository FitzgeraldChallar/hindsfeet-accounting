from decimal import Decimal
from io import BytesIO

from django.http import FileResponse
from django.utils import timezone

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .services import AccountingService


# ============================================================
# PDF HELPERS
# ============================================================

def money(value):
    """
    Format a Decimal value for PDF display.
    """

    if value is None:
        value = Decimal("0.00")

    value = Decimal(str(value))

    return f"{value:,.2f}"


def currency_label(currency):
    """
    Return a display-friendly currency label.
    """

    if currency == "USD":
        return "USD"

    if currency == "LRD":
        return "LRD"

    return currency or "USD"


def build_filename(company, report_name):
    """
    Generate a safe PDF filename.
    """

    company_name = (
        company.name
        .replace(" ", "_")
        .replace("/", "_")
        .replace("\\", "_")
    )

    report_name = (
        report_name
        .replace(" ", "_")
        .replace("/", "_")
        .replace("\\", "_")
    )

    return f"{company_name}_{report_name}.pdf"


# ============================================================
# PDF STYLES
# ============================================================

def get_pdf_styles():
    """
    Return all styles used by accounting reports.
    """

    styles = getSampleStyleSheet()

    styles.add(
        ParagraphStyle(
            name="ReportTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=22,
            alignment=TA_CENTER,
            spaceAfter=4 * mm,
        )
    )

    styles.add(
        ParagraphStyle(
            name="CompanyName",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            alignment=TA_CENTER,
            spaceAfter=2 * mm,
        )
    )

    styles.add(
        ParagraphStyle(
            name="ReportMeta",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            alignment=TA_CENTER,
            textColor=colors.grey,
            spaceAfter=1 * mm,
        )
    )

    styles.add(
        ParagraphStyle(
            name="SectionHeader",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            spaceBefore=4 * mm,
            spaceAfter=2 * mm,
        )
    )

    styles.add(
        ParagraphStyle(
            name="NormalSmall",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            alignment=TA_LEFT,
            splitLongWords=True,
        )
    )

    styles.add(
        ParagraphStyle(
            name="NormalSmallRight",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            alignment=TA_RIGHT,
            splitLongWords=True,
        )
    )

    styles.add(
        ParagraphStyle(
            name="TableCell",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=9,
            alignment=TA_LEFT,
            splitLongWords=True,
            spaceAfter=0,
            spaceBefore=0,
        )
    )

    styles.add(
        ParagraphStyle(
            name="TableCellRight",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            leading=9,
            alignment=TA_RIGHT,
            splitLongWords=True,
            spaceAfter=0,
            spaceBefore=0,
        )
    )

    styles.add(
        ParagraphStyle(
            name="TableHeader",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9,
            alignment=TA_LEFT,
            splitLongWords=True,
            spaceAfter=0,
            spaceBefore=0,
        )
    )

    styles.add(
        ParagraphStyle(
            name="TableHeaderRight",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9,
            alignment=TA_RIGHT,
            splitLongWords=True,
            spaceAfter=0,
            spaceBefore=0,
        )
    )

    styles.add(
        ParagraphStyle(
            name="BoldSmall",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            splitLongWords=True,
        )
    )

    styles.add(
        ParagraphStyle(
            name="BoldSmallRight",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            alignment=TA_RIGHT,
            splitLongWords=True,
        )
    )

    styles.add(
        ParagraphStyle(
            name="Footer",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7,
            leading=9,
            alignment=TA_CENTER,
            textColor=colors.grey,
        )
    )

    return styles


# ============================================================
# PAGE FOOTER
# ============================================================

def draw_page_footer(canvas, doc):
    """
    Draw footer and page number on every PDF page.
    """

    canvas.saveState()

    page_number = canvas.getPageNumber()

    width, height = A4

    canvas.setStrokeColor(
        colors.HexColor("#D9D9D9")
    )

    canvas.line(
        20 * mm,
        12 * mm,
        width - 20 * mm,
        12 * mm,
    )

    canvas.setFont(
        "Helvetica",
        7,
    )

    canvas.setFillColor(
        colors.grey
    )

    canvas.drawString(
        20 * mm,
        8 * mm,
        "Generated by Hindsfeet Accounting",
    )

    canvas.drawRightString(
        width - 20 * mm,
        8 * mm,
        f"Page {page_number}",
    )

    canvas.restoreState()


# ============================================================
# REPORT HEADER
# ============================================================

def report_header(
    company,
    title,
    currency,
    styles,
    period_text=None,
):
    """
    Build the common report header.
    """

    elements = []

    # --------------------------------------------------------
    # Company logo
    # --------------------------------------------------------

    if company.logo:
        try:
            logo = Image(
                company.logo.path,
                width=25 * mm,
                height=25 * mm,
            )

            logo.hAlign = "CENTER"

            elements.append(logo)

            elements.append(
                Spacer(
                    1,
                    2 * mm,
                )
            )

        except Exception:
            pass

    # --------------------------------------------------------
    # Company name
    # --------------------------------------------------------

    elements.append(
        Paragraph(
            company.name,
            styles["CompanyName"],
        )
    )

    # --------------------------------------------------------
    # Legal name
    # --------------------------------------------------------

    if company.legal_name:
        elements.append(
            Paragraph(
                company.legal_name,
                styles["ReportMeta"],
            )
        )

    # --------------------------------------------------------
    # Report title
    # --------------------------------------------------------

    elements.append(
        Paragraph(
            title,
            styles["ReportTitle"],
        )
    )

    # --------------------------------------------------------
    # Period
    # --------------------------------------------------------

    if period_text:
        elements.append(
            Paragraph(
                period_text,
                styles["ReportMeta"],
            )
        )

    # --------------------------------------------------------
    # Currency
    # --------------------------------------------------------

    elements.append(
        Paragraph(
            f"Currency: {currency_label(currency)}",
            styles["ReportMeta"],
        )
    )

    elements.append(
        Spacer(
            1,
            4 * mm,
        )
    )

    return elements


# ============================================================
# TABLE HELPERS
# ============================================================

def _paragraph_cell(
    value,
    styles,
    right=False,
    header=False,
):
    """
    Convert table content into a Paragraph.

    Paragraphs are important here because ReportLab can then
    automatically wrap long references and descriptions inside
    their assigned column widths.
    """

    if value is None:
        value = ""

    value = str(value)

    if header:
        style = (
            styles["TableHeaderRight"]
            if right
            else styles["TableHeader"]
        )
    else:
        style = (
            styles["TableCellRight"]
            if right
            else styles["TableCell"]
        )

    return Paragraph(
        value,
        style,
    )


def standard_table(
    data,
    widths,
    header=True,
    right_columns=None,
):
    """
    Build a standardized accounting table.

    Important:
    - Every cell is converted to a Paragraph.
    - Long text automatically wraps.
    - Right-aligned columns use dedicated right-aligned
      Paragraph styles.
    - Explicit widths prevent columns from expanding beyond
      the printable A4 area.
    """

    right_columns = set(
        right_columns or []
    )

    converted_data = []

    for row_index, row in enumerate(data):

        converted_row = []

        for column_index, value in enumerate(row):

            converted_row.append(
                _paragraph_cell(
                    value,
                    get_pdf_styles(),
                    right=column_index in right_columns,
                    header=(
                        header
                        and row_index == 0
                    ),
                )
            )

        converted_data.append(
            converted_row
        )

    table = Table(
        converted_data,
        colWidths=widths,
        repeatRows=1 if header else 0,
        hAlign="LEFT",
    )

    commands = [
        (
            "VALIGN",
            (0, 0),
            (-1, -1),
            "MIDDLE",
        ),
        (
            "LEFTPADDING",
            (0, 0),
            (-1, -1),
            4,
        ),
        (
            "RIGHTPADDING",
            (0, 0),
            (-1, -1),
            4,
        ),
        (
            "TOPPADDING",
            (0, 0),
            (-1, -1),
            4,
        ),
        (
            "BOTTOMPADDING",
            (0, 0),
            (-1, -1),
            4,
        ),
        (
            "GRID",
            (0, 0),
            (-1, -1),
            0.25,
            colors.HexColor("#DDDDDD"),
        ),
    ]

    if header:
        commands.extend([
            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.HexColor("#F2F2F2"),
            ),
        ])

    table.setStyle(
        TableStyle(commands)
    )

    return table


def total_row(
    label,
    amount,
    styles,
    colspan=2,
):
    """
    Build a total row for reports.
    """

    return [
        Paragraph(
            label,
            styles["BoldSmall"],
        ),
        "",
        Paragraph(
            money(amount),
            styles["BoldSmallRight"],
        ),
    ]


# ============================================================
# PDF DOCUMENT
# ============================================================

def build_pdf_document(buffer, title):
    """
    Create the base PDF document.

    A4 printable width:

        210mm - 15mm - 15mm = 180mm
    """

    return SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=17 * mm,
        title=title,
        author="Hindsfeet Accounting",
    )


# ============================================================
# GENERAL LEDGER PDF
# ============================================================

def general_ledger_pdf(
    *,
    company,
    start_date=None,
    end_date=None,
    account=None,
):
    """
    Generate General Ledger PDF.
    """

    styles = get_pdf_styles()

    ledger = AccountingService.general_ledger(
        company=company,
        start_date=start_date,
        end_date=end_date,
        account=account,
    )

    buffer = BytesIO()

    document = build_pdf_document(
        buffer,
        "General Ledger",
    )

    elements = []

    if start_date and end_date:
        period_text = (
            f"For the period "
            f"{start_date} to {end_date}"
        )

    elif start_date:
        period_text = (
            f"From {start_date}"
        )

    elif end_date:
        period_text = (
            f"Through {end_date}"
        )

    else:
        period_text = "All posted transactions"

    elements.extend(
        report_header(
            company=company,
            title="GENERAL LEDGER",
            currency=company.currency,
            styles=styles,
            period_text=period_text,
        )
    )

    for account_data in ledger:

        elements.append(
            Paragraph(
                (
                    f"{account_data['account_code']} - "
                    f"{account_data['account_name']}"
                ),
                styles["SectionHeader"],
            )
        )

        # ----------------------------------------------------
        # Account balances
        # ----------------------------------------------------

        account_info = [
            [
                Paragraph(
                    "Opening Balance",
                    styles["BoldSmall"],
                ),
                Paragraph(
                    money(
                        account_data[
                            "opening_balance"
                        ]
                    ),
                    styles["BoldSmallRight"],
                ),
            ],
            [
                Paragraph(
                    "Closing Balance",
                    styles["BoldSmall"],
                ),
                Paragraph(
                    money(
                        account_data[
                            "closing_balance"
                        ]
                    ),
                    styles["BoldSmallRight"],
                ),
            ],
        ]

        info_table = Table(
            account_info,
            colWidths=[
                45 * mm,
                35 * mm,
            ],
        )

        info_table.setStyle(
            TableStyle([
                (
                    "ALIGN",
                    (1, 0),
                    (1, -1),
                    "RIGHT",
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    3,
                ),
            ])
        )

        elements.append(info_table)

        elements.append(
            Spacer(
                1,
                2 * mm,
            )
        )

        # ----------------------------------------------------
        # Ledger table
        #
        # Total = 180mm
        #
        # Date        20mm
        # Reference   30mm
        # Description 65mm
        # Debit       21mm
        # Credit      21mm
        # Balance     23mm
        # ----------------------------------------------------

        data = [
            [
                "Date",
                "Reference",
                "Description",
                "Debit",
                "Credit",
                "Balance",
            ]
        ]

        for transaction in account_data[
            "transactions"
        ]:
            data.append([
                str(transaction["date"]),
                transaction["reference"],
                transaction["description"],
                money(transaction["debit"]),
                money(transaction["credit"]),
                money(transaction["balance"]),
            ])

        if len(data) == 1:
            data.append([
                "",
                "",
                "No transactions",
                "",
                "",
                "",
            ])

        table = standard_table(
            data,
            widths=[
                20 * mm,
                30 * mm,
                65 * mm,
                21 * mm,
                21 * mm,
                23 * mm,
            ],
            right_columns=[
                3,
                4,
                5,
            ],
        )

        elements.append(table)

        elements.append(
            Spacer(
                1,
                5 * mm,
            )
        )

    if not ledger:
        elements.append(
            Paragraph(
                "No ledger activity found for the selected criteria.",
                styles["NormalSmall"],
            )
        )

    generated_at = timezone.now().strftime(
        "%Y-%m-%d %H:%M"
    )

    elements.append(
        Spacer(
            1,
            5 * mm,
        )
    )

    elements.append(
        Paragraph(
            f"Generated: {generated_at}",
            styles["Footer"],
        )
    )

    document.build(
        elements,
        onFirstPage=draw_page_footer,
        onLaterPages=draw_page_footer,
    )

    buffer.seek(0)

    return FileResponse(
        buffer,
        as_attachment=True,
        filename=build_filename(
            company,
            "General_Ledger",
        ),
        content_type="application/pdf",
    )


# ============================================================
# TRIAL BALANCE PDF
# ============================================================

def trial_balance_pdf(
    *,
    company,
    start_date=None,
    end_date=None,
):
    """
    Generate Trial Balance PDF.
    """

    styles = get_pdf_styles()

    report = AccountingService.trial_balance(
        company=company,
        start_date=start_date,
        end_date=end_date,
    )

    buffer = BytesIO()

    document = build_pdf_document(
        buffer,
        "Trial Balance",
    )

    elements = []

    if start_date and end_date:
        period_text = (
            f"For the period "
            f"{start_date} to {end_date}"
        )

    elif start_date:
        period_text = f"From {start_date}"

    elif end_date:
        period_text = f"Through {end_date}"

    else:
        period_text = "All posted transactions"

    elements.extend(
        report_header(
            company=company,
            title="TRIAL BALANCE",
            currency=company.currency,
            styles=styles,
            period_text=period_text,
        )
    )

    data = [
        [
            "Code",
            "Account",
            "Type",
            "Debit",
            "Credit",
        ]
    ]

    total_debit = Decimal("0.00")
    total_credit = Decimal("0.00")

    for account in report:

        debit = account["debit"]
        credit = account["credit"]

        total_debit += debit
        total_credit += credit

        data.append([
            account["account_code"],
            account["account_name"],
            account["account_type"],
            money(debit),
            money(credit),
        ])

    data.append([
        "",
        "",
        "TOTAL",
        money(total_debit),
        money(total_credit),
    ])

    table = standard_table(
        data,
        widths=[
            25 * mm,
            70 * mm,
            35 * mm,
            25 * mm,
            25 * mm,
        ],
        right_columns=[
            3,
            4,
        ],
    )

    table.setStyle(
        TableStyle([
            (
                "FONTNAME",
                (0, -1),
                (-1, -1),
                "Helvetica-Bold",
            ),
            (
                "BACKGROUND",
                (0, -1),
                (-1, -1),
                colors.HexColor("#F2F2F2"),
            ),
        ])
    )

    elements.append(table)

    elements.append(
        Spacer(
            1,
            5 * mm,
        )
    )

    balanced = (
        total_debit == total_credit
    )

    status = (
        "BALANCED"
        if balanced
        else "NOT BALANCED"
    )

    elements.append(
        Paragraph(
            (
                f"Trial Balance Status: "
                f"<b>{status}</b>"
            ),
            styles["NormalSmall"],
        )
    )

    document.build(
        elements,
        onFirstPage=draw_page_footer,
        onLaterPages=draw_page_footer,
    )

    buffer.seek(0)

    return FileResponse(
        buffer,
        as_attachment=True,
        filename=build_filename(
            company,
            "Trial_Balance",
        ),
        content_type="application/pdf",
    )


# ============================================================
# INCOME STATEMENT PDF
# ============================================================

def income_statement_pdf(
    *,
    company,
    start_date=None,
    end_date=None,
):
    """
    Generate Income Statement / Profit & Loss PDF.
    """

    styles = get_pdf_styles()

    report = AccountingService.income_statement(
        company=company,
        start_date=start_date,
        end_date=end_date,
    )

    buffer = BytesIO()

    document = build_pdf_document(
        buffer,
        "Income Statement",
    )

    elements = []

    if start_date and end_date:
        period_text = (
            f"For the period "
            f"{start_date} to {end_date}"
        )

    elif start_date:
        period_text = f"From {start_date}"

    elif end_date:
        period_text = f"Through {end_date}"

    else:
        period_text = "All posted transactions"

    elements.extend(
        report_header(
            company=company,
            title="INCOME STATEMENT",
            currency=company.currency,
            styles=styles,
            period_text=period_text,
        )
    )

    # --------------------------------------------------------
    # Revenue
    # --------------------------------------------------------

    elements.append(
        Paragraph(
            "Revenue",
            styles["SectionHeader"],
        )
    )

    revenue_data = [
        [
            "Code",
            "Account",
            "Amount",
        ]
    ]

    for item in report["revenue"]:
        revenue_data.append([
            item["code"],
            item["name"],
            money(item["amount"]),
        ])

    revenue_data.append([
        "",
        "Total Revenue",
        money(
            report["total_revenue"]
        ),
    ])

    revenue_table = standard_table(
        revenue_data,
        widths=[
            30 * mm,
            105 * mm,
            45 * mm,
        ],
        right_columns=[
            2,
        ],
    )

    revenue_table.setStyle(
        TableStyle([
            (
                "FONTNAME",
                (0, -1),
                (-1, -1),
                "Helvetica-Bold",
            ),
            (
                "BACKGROUND",
                (0, -1),
                (-1, -1),
                colors.HexColor("#F2F2F2"),
            ),
        ])
    )

    elements.append(
        revenue_table
    )

    # --------------------------------------------------------
    # COGS
    # --------------------------------------------------------

    elements.append(
        Paragraph(
            "Cost of Goods Sold",
            styles["SectionHeader"],
        )
    )

    cogs_data = [
        [
            "Code",
            "Account",
            "Amount",
        ]
    ]

    for item in report[
        "cost_of_goods_sold"
    ]:
        cogs_data.append([
            item["code"],
            item["name"],
            money(item["amount"]),
        ])

    cogs_data.append([
        "",
        "Total Cost of Goods Sold",
        money(
            report[
                "total_cost_of_goods_sold"
            ]
        ),
    ])

    cogs_table = standard_table(
        cogs_data,
        widths=[
            30 * mm,
            105 * mm,
            45 * mm,
        ],
        right_columns=[
            2,
        ],
    )

    cogs_table.setStyle(
        TableStyle([
            (
                "FONTNAME",
                (0, -1),
                (-1, -1),
                "Helvetica-Bold",
            ),
            (
                "BACKGROUND",
                (0, -1),
                (-1, -1),
                colors.HexColor("#F2F2F2"),
            ),
        ])
    )

    elements.append(
        cogs_table
    )

    # --------------------------------------------------------
    # Gross Profit
    # --------------------------------------------------------

    gross_profit_data = [[
        Paragraph(
            "GROSS PROFIT / (LOSS)",
            styles["BoldSmall"],
        ),
        "",
        Paragraph(
            money(
                report["gross_profit"]
            ),
            styles["BoldSmallRight"],
        ),
    ]]

    gross_profit_table = Table(
        gross_profit_data,
        colWidths=[
            30 * mm,
            105 * mm,
            45 * mm,
        ],
    )

    gross_profit_table.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (-1, -1),
                colors.HexColor("#E8E8E8"),
            ),
            (
                "LINEABOVE",
                (0, 0),
                (-1, 0),
                0.75,
                colors.black,
            ),
            (
                "LINEBELOW",
                (0, 0),
                (-1, 0),
                0.75,
                colors.black,
            ),
            (
                "ALIGN",
                (2, 0),
                (2, 0),
                "RIGHT",
            ),
            (
                "TOPPADDING",
                (0, 0),
                (-1, -1),
                6,
            ),
            (
                "BOTTOMPADDING",
                (0, 0),
                (-1, -1),
                6,
            ),
        ])
    )

    elements.append(
        Spacer(
            1,
            3 * mm,
        )
    )

    elements.append(
        gross_profit_table
    )

    # --------------------------------------------------------
    # Expenses
    # --------------------------------------------------------

    elements.append(
        Paragraph(
            "Operating Expenses",
            styles["SectionHeader"],
        )
    )

    expense_data = [
        [
            "Code",
            "Account",
            "Amount",
        ]
    ]

    for item in report["expenses"]:
        expense_data.append([
            item["code"],
            item["name"],
            money(item["amount"]),
        ])

    expense_data.append([
        "",
        "Total Operating Expenses",
        money(
            report["total_expenses"]
        ),
    ])

    expense_table = standard_table(
        expense_data,
        widths=[
            30 * mm,
            105 * mm,
            45 * mm,
        ],
        right_columns=[
            2,
        ],
    )

    expense_table.setStyle(
        TableStyle([
            (
                "FONTNAME",
                (0, -1),
                (-1, -1),
                "Helvetica-Bold",
            ),
            (
                "BACKGROUND",
                (0, -1),
                (-1, -1),
                colors.HexColor("#F2F2F2"),
            ),
        ])
    )

    elements.append(
        expense_table
    )

    # --------------------------------------------------------
    # Net Profit
    # --------------------------------------------------------

    net_profit_data = [[
        Paragraph(
            "NET PROFIT / (LOSS)",
            styles["BoldSmall"],
        ),
        "",
        Paragraph(
            money(
                report["net_profit"]
            ),
            styles["BoldSmallRight"],
        ),
    ]]

    net_profit_table = Table(
        net_profit_data,
        colWidths=[
            30 * mm,
            105 * mm,
            45 * mm,
        ],
    )

    net_profit_table.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (-1, -1),
                colors.HexColor("#E8E8E8"),
            ),
            (
                "LINEABOVE",
                (0, 0),
                (-1, 0),
                1,
                colors.black,
            ),
            (
                "LINEBELOW",
                (0, 0),
                (-1, 0),
                1,
                colors.black,
            ),
            (
                "ALIGN",
                (2, 0),
                (2, 0),
                "RIGHT",
            ),
            (
                "TOPPADDING",
                (0, 0),
                (-1, -1),
                7,
            ),
            (
                "BOTTOMPADDING",
                (0, 0),
                (-1, -1),
                7,
            ),
        ])
    )

    elements.append(
        Spacer(
            1,
            4 * mm,
        )
    )

    elements.append(
        net_profit_table
    )

    document.build(
        elements,
        onFirstPage=draw_page_footer,
        onLaterPages=draw_page_footer,
    )

    buffer.seek(0)

    return FileResponse(
        buffer,
        as_attachment=True,
        filename=build_filename(
            company,
            "Income_Statement",
        ),
        content_type="application/pdf",
    )


# ============================================================
# BALANCE SHEET PDF
# ============================================================

def balance_sheet_pdf(
    *,
    company,
    as_of_date=None,
):
    """
    Generate Balance Sheet PDF.
    """

    styles = get_pdf_styles()

    report = AccountingService.balance_sheet(
        company=company,
        as_of_date=as_of_date,
    )

    buffer = BytesIO()

    document = build_pdf_document(
        buffer,
        "Balance Sheet",
    )

    elements = []

    if as_of_date:
        period_text = (
            f"As of {as_of_date}"
        )

    else:
        period_text = (
            "As of the latest posted transaction"
        )

    elements.extend(
        report_header(
            company=company,
            title="BALANCE SHEET",
            currency=company.currency,
            styles=styles,
            period_text=period_text,
        )
    )

    # --------------------------------------------------------
    # Assets
    # --------------------------------------------------------

    elements.append(
        Paragraph(
            "Assets",
            styles["SectionHeader"],
        )
    )

    asset_data = [
        [
            "Code",
            "Account",
            "Amount",
        ]
    ]

    for item in report["assets"]:
        asset_data.append([
            item["code"],
            item["name"],
            money(item["amount"]),
        ])

    asset_data.append([
        "",
        "Total Assets",
        money(
            report["total_assets"]
        ),
    ])

    asset_table = standard_table(
        asset_data,
        widths=[
            30 * mm,
            105 * mm,
            45 * mm,
        ],
        right_columns=[
            2,
        ],
    )

    asset_table.setStyle(
        TableStyle([
            (
                "FONTNAME",
                (0, -1),
                (-1, -1),
                "Helvetica-Bold",
            ),
            (
                "BACKGROUND",
                (0, -1),
                (-1, -1),
                colors.HexColor("#F2F2F2"),
            ),
        ])
    )

    elements.append(
        asset_table
    )

    # --------------------------------------------------------
    # Liabilities
    # --------------------------------------------------------

    elements.append(
        Paragraph(
            "Liabilities",
            styles["SectionHeader"],
        )
    )

    liability_data = [
        [
            "Code",
            "Account",
            "Amount",
        ]
    ]

    for item in report["liabilities"]:
        liability_data.append([
            item["code"],
            item["name"],
            money(item["amount"]),
        ])

    liability_data.append([
        "",
        "Total Liabilities",
        money(
            report["total_liabilities"]
        ),
    ])

    liability_table = standard_table(
        liability_data,
        widths=[
            30 * mm,
            105 * mm,
            45 * mm,
        ],
        right_columns=[
            2,
        ],
    )

    liability_table.setStyle(
        TableStyle([
            (
                "FONTNAME",
                (0, -1),
                (-1, -1),
                "Helvetica-Bold",
            ),
            (
                "BACKGROUND",
                (0, -1),
                (-1, -1),
                colors.HexColor("#F2F2F2"),
            ),
        ])
    )

    elements.append(
        liability_table
    )

    # --------------------------------------------------------
    # Equity
    # --------------------------------------------------------

    elements.append(
        Paragraph(
            "Equity",
            styles["SectionHeader"],
        )
    )

    equity_data = [
        [
            "Code",
            "Account",
            "Amount",
        ]
    ]

    for item in report["equity"]:
        equity_data.append([
            item["code"],
            item["name"],
            money(item["amount"]),
        ])

    equity_data.append([
        "",
        "Current Profit / (Loss)",
        money(
            report["current_profit"]
        ),
    ])

    equity_data.append([
        "",
        "Total Equity",
        money(
            report[
                "total_equity_with_profit"
            ]
        ),
    ])

    equity_table = standard_table(
        equity_data,
        widths=[
            30 * mm,
            105 * mm,
            45 * mm,
        ],
        right_columns=[
            2,
        ],
    )

    equity_table.setStyle(
        TableStyle([
            (
                "FONTNAME",
                (0, -2),
                (-1, -1),
                "Helvetica-Bold",
            ),
            (
                "BACKGROUND",
                (0, -2),
                (-1, -1),
                colors.HexColor("#F2F2F2"),
            ),
        ])
    )

    elements.append(
        equity_table
    )

    # --------------------------------------------------------
    # Liabilities + Equity
    # --------------------------------------------------------

    total_data = [[
        Paragraph(
            "TOTAL LIABILITIES + EQUITY",
            styles["BoldSmall"],
        ),
        "",
        Paragraph(
            money(
                report[
                    "total_liabilities_and_equity"
                ]
            ),
            styles["BoldSmallRight"],
        ),
    ]]

    total_table = Table(
        total_data,
        colWidths=[
            30 * mm,
            105 * mm,
            45 * mm,
        ],
    )

    total_table.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (-1, -1),
                colors.HexColor("#E8E8E8"),
            ),
            (
                "LINEABOVE",
                (0, 0),
                (-1, 0),
                1,
                colors.black,
            ),
            (
                "LINEBELOW",
                (0, 0),
                (-1, 0),
                1,
                colors.black,
            ),
            (
                "ALIGN",
                (2, 0),
                (2, 0),
                "RIGHT",
            ),
            (
                "TOPPADDING",
                (0, 0),
                (-1, -1),
                7,
            ),
            (
                "BOTTOMPADDING",
                (0, 0),
                (-1, -1),
                7,
            ),
        ])
    )

    elements.append(
        Spacer(
            1,
            4 * mm,
        )
    )

    elements.append(
        total_table
    )

    # --------------------------------------------------------
    # Balance status
    # --------------------------------------------------------

    elements.append(
        Spacer(
            1,
            4 * mm,
        )
    )

    status = (
        "BALANCED"
        if report["is_balanced"]
        else "NOT BALANCED"
    )

    elements.append(
        Paragraph(
            (
                f"Balance Sheet Status: "
                f"<b>{status}</b>"
            ),
            styles["NormalSmall"],
        )
    )

    if not report["is_balanced"]:
        elements.append(
            Paragraph(
                (
                    "Difference: "
                    f"{money(report['difference'])}"
                ),
                styles["NormalSmall"],
            )
        )

    document.build(
        elements,
        onFirstPage=draw_page_footer,
        onLaterPages=draw_page_footer,
    )

    buffer.seek(0)

    return FileResponse(
        buffer,
        as_attachment=True,
        filename=build_filename(
            company,
            "Balance_Sheet",
        ),
        content_type="application/pdf",
    )


# ============================================================
# CASH FLOW STATEMENT PDF
# ============================================================

def cash_flow_pdf(
    *,
    company,
    start_date=None,
    end_date=None,
):
    """
    Generate Cash Flow Statement PDF.
    """

    styles = get_pdf_styles()

    report = AccountingService.cash_flow_statement(
        company=company,
        start_date=start_date,
        end_date=end_date,
    )

    buffer = BytesIO()

    document = build_pdf_document(
        buffer,
        "Cash Flow Statement",
    )

    elements = []

    if start_date and end_date:
        period_text = (
            f"For the period "
            f"{start_date} to {end_date}"
        )

    elif start_date:
        period_text = f"From {start_date}"

    elif end_date:
        period_text = f"Through {end_date}"

    else:
        period_text = "All posted transactions"

    elements.extend(
        report_header(
            company=company,
            title="CASH FLOW STATEMENT",
            currency=company.currency,
            styles=styles,
            period_text=period_text,
        )
    )

    # --------------------------------------------------------
    # Helper for cash flow sections
    # --------------------------------------------------------

    def add_cash_flow_section(
        title,
        activities,
        total,
    ):
        elements.append(
            Paragraph(
                title,
                styles["SectionHeader"],
            )
        )

        data = [
            [
                "Date",
                "Reference",
                "Description",
                "Amount",
            ]
        ]

        for item in activities:
            data.append([
                str(item["date"]),
                item["reference"],
                item["description"],
                money(item["amount"]),
            ])

        data.append([
            "",
            "",
            f"Net {title}",
            money(total),
        ])

        # ----------------------------------------------------
        # Total width = 180mm
        #
        # Date        20mm
        # Reference   30mm
        # Description 95mm
        # Amount      35mm
        # ----------------------------------------------------

        table = standard_table(
            data,
            widths=[
                20 * mm,
                30 * mm,
                95 * mm,
                35 * mm,
            ],
            right_columns=[
                3,
            ],
        )

        table.setStyle(
            TableStyle([
                (
                    "FONTNAME",
                    (0, -1),
                    (-1, -1),
                    "Helvetica-Bold",
                ),
                (
                    "BACKGROUND",
                    (0, -1),
                    (-1, -1),
                    colors.HexColor("#F2F2F2"),
                ),
            ])
        )

        elements.append(
            table
        )

    # --------------------------------------------------------
    # Operating
    # --------------------------------------------------------

    add_cash_flow_section(
        "Operating Activities",
        report["operating_activities"],
        report["total_operating_activities"],
    )

    # --------------------------------------------------------
    # Investing
    # --------------------------------------------------------

    add_cash_flow_section(
        "Investing Activities",
        report["investing_activities"],
        report["total_investing_activities"],
    )

    # --------------------------------------------------------
    # Financing
    # --------------------------------------------------------

    add_cash_flow_section(
        "Financing Activities",
        report["financing_activities"],
        report["total_financing_activities"],
    )

    # --------------------------------------------------------
    # Cash reconciliation
    # --------------------------------------------------------

    elements.append(
        Spacer(
            1,
            4 * mm,
        )
    )

    reconciliation_data = [
        [
            Paragraph(
                "Opening Cash Balance",
                styles["BoldSmall"],
            ),
            Paragraph(
                money(
                    report[
                        "opening_cash_balance"
                    ]
                ),
                styles["BoldSmallRight"],
            ),
        ],
        [
            Paragraph(
                "Net Change in Cash",
                styles["BoldSmall"],
            ),
            Paragraph(
                money(
                    report[
                        "net_change_in_cash"
                    ]
                ),
                styles["BoldSmallRight"],
            ),
        ],
        [
            Paragraph(
                "Closing Cash Balance",
                styles["BoldSmall"],
            ),
            Paragraph(
                money(
                    report[
                        "closing_cash_balance"
                    ]
                ),
                styles["BoldSmallRight"],
            ),
        ],
        [
            Paragraph(
                "Actual Ledger Cash",
                styles["BoldSmall"],
            ),
            Paragraph(
                money(
                    report[
                        "actual_closing_cash"
                    ]
                ),
                styles["BoldSmallRight"],
            ),
        ],
    ]

    reconciliation_table = Table(
        reconciliation_data,
        colWidths=[
            125 * mm,
            55 * mm,
        ],
    )

    reconciliation_table.setStyle(
        TableStyle([
            (
                "ALIGN",
                (1, 0),
                (1, -1),
                "RIGHT",
            ),
            (
                "LINEABOVE",
                (0, 2),
                (-1, 2),
                1,
                colors.black,
            ),
            (
                "LINEBELOW",
                (0, 2),
                (-1, 2),
                1,
                colors.black,
            ),
            (
                "BACKGROUND",
                (0, 2),
                (-1, 2),
                colors.HexColor("#E8E8E8"),
            ),
            (
                "TOPPADDING",
                (0, 0),
                (-1, -1),
                5,
            ),
            (
                "BOTTOMPADDING",
                (0, 0),
                (-1, -1),
                5,
            ),
        ])
    )

    elements.append(
        reconciliation_table
    )

    # --------------------------------------------------------
    # Reconciliation status
    # --------------------------------------------------------

    elements.append(
        Spacer(
            1,
            4 * mm,
        )
    )

    status = (
        "RECONCILED"
        if report["is_reconciled"]
        else "NOT RECONCILED"
    )

    elements.append(
        Paragraph(
            (
                f"Cash Flow Reconciliation: "
                f"<b>{status}</b>"
            ),
            styles["NormalSmall"],
        )
    )

    if not report["is_reconciled"]:
        elements.append(
            Paragraph(
                (
                    "Reconciliation Difference: "
                    f"{money(report['reconciliation_difference'])}"
                ),
                styles["NormalSmall"],
            )
        )

    document.build(
        elements,
        onFirstPage=draw_page_footer,
        onLaterPages=draw_page_footer,
    )

    buffer.seek(0)

    return FileResponse(
        buffer,
        as_attachment=True,
        filename=build_filename(
            company,
            "Cash_Flow_Statement",
        ),
        content_type="application/pdf",
    )