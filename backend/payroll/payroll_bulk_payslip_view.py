from io import BytesIO

from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

try:
    from pypdf import PdfReader, PdfWriter
except ImportError:
    from PyPDF2 import PdfReader, PdfWriter

from .models import PayrollPeriod, PayrollRecord
from .payroll_payslip_view import PayrollPayslipView


class BulkPayrollPayslipView(APIView):
    """
    Generate all employee payslips for one finalized payroll period
    as a single PDF document.

    Each page is generated through PayrollPayslipView so the bulk PDF
    uses the same portrait payslip design, company branding, logo,
    calculations and employee information as an individual payslip.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, period_id):
        period = get_object_or_404(
            PayrollPeriod.objects.select_related("company"),
            pk=period_id,
        )
        company = period.company

        payslip_view = PayrollPayslipView()

        if not payslip_view._user_can_access_company(
            request.user,
            company,
        ):
            return Response(
                {
                    "detail": (
                        "You do not have access to this company's "
                        "payroll."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if period.status not in [
            PayrollPeriod.Status.APPROVED,
            PayrollPeriod.Status.LOCKED,
        ]:
            return Response(
                {
                    "detail": (
                        "Bulk payslips can only be generated after "
                        "payroll has been approved."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        records = list(
            PayrollRecord.objects
            .filter(payroll_period=period)
            .select_related("employee")
            .order_by(
                "employee__employee_number",
                "employee__id",
                "id",
            )
        )

        if not records:
            return Response(
                {
                    "detail": (
                        "There are no finalized payroll records "
                        "for this payroll period."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        writer = PdfWriter()

        for record in records:
            payslip_response = payslip_view.get(
                request,
                period.id,
                record.id,
            )

            response_status = getattr(
                payslip_response,
                "status_code",
                200,
            )

            if response_status != 200:
                detail = (
                    "Unable to generate one of the employee "
                    "payslips."
                )

                response_data = getattr(
                    payslip_response,
                    "data",
                    None,
                )

                if isinstance(response_data, dict):
                    detail = (
                        response_data.get("detail")
                        or response_data.get("message")
                        or detail
                    )

                return Response(
                    {
                        "detail": detail,
                        "record_id": record.id,
                    },
                    status=response_status,
                )

            try:
                reader = PdfReader(
                    BytesIO(
                        payslip_response.content
                    )
                )

                for page in reader.pages:
                    writer.add_page(page)

            except Exception as exc:
                return Response(
                    {
                        "detail": (
                            "Unable to assemble the bulk "
                            "payslip PDF."
                        ),
                        "record_id": record.id,
                        "error": str(exc),
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        output = BytesIO()
        writer.write(output)
        output.seek(0)

        company_name = str(
            getattr(company, "name", "") or "Company"
        ).strip()

        period_name = str(
            getattr(period, "name", "") or "Payroll Period"
        ).strip()

        safe_company = "".join(
            character
            if character.isalnum() or character in "_-"
            else "_"
            for character in company_name
        ).strip("_") or "company"

        safe_period = "".join(
            character
            if character.isalnum() or character in "_-"
            else "_"
            for character in period_name
        ).strip("_") or f"period_{period.id}"

        response = HttpResponse(
            output.getvalue(),
            content_type="application/pdf",
        )

        response["Content-Disposition"] = (
            f'attachment; filename="Bulk_Payslips_'
            f'{safe_company}_{safe_period}.pdf"'
        )

        return response
