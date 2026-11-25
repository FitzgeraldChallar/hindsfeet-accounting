from django.urls import path
from subscriptions.permissions import feature_view

from .payroll_payslip_view import PayrollPayslipView
from .payroll_bulk_payslip_view import BulkPayrollPayslipView

from .views import (
    ApprovePayrollView,
    EmployeeDetailView,
    EmployeeListCreateView,
    LockPayrollView,
    PayPayrollView,
    PayrollAbsenceDetailView,
    PayrollAbsenceListCreateView,
    PayrollDeductionListCreateView,
    PayrollDeductionTypeListCreateView,
    PayrollEarningListCreateView,
    PayrollEarningTypeListCreateView,
    PayrollPeriodDetailView,
    PayrollPeriodListCreateView,
    PayrollRecordDetailView,
    PayrollRecordListView,
    PayrollRemittanceListCreateView,
    ExportPayrollCSVView,
    PayrollSummaryView,
    PayrollTaxBandDetailView,
    PayrollTaxBandListCreateView,
    PostPayrollToAccountingView,
    ProcessPayrollView,
    ReturnPayrollToDraftView,
)

urlpatterns = [
    path("employees/", feature_view(EmployeeListCreateView, "payroll"), name="employee-list-create"),
    path("employees/<int:pk>/", feature_view(EmployeeDetailView, "payroll"), name="employee-detail"),

    path("periods/", feature_view(PayrollPeriodListCreateView, "payroll"), name="payroll-period-list-create"),
    path("periods/<int:pk>/", feature_view(PayrollPeriodDetailView, "payroll"), name="payroll-period-detail"),

    path("tax-bands/", feature_view(PayrollTaxBandListCreateView, "lra_tax_automation"), name="payroll-tax-band-list-create"),
    path("tax-bands/<int:pk>/", feature_view(PayrollTaxBandDetailView, "lra_tax_automation"), name="payroll-tax-band-detail"),

    path("earning-types/", feature_view(PayrollEarningTypeListCreateView, "payroll"), name="payroll-earning-type-list-create"),
    path("earnings/", feature_view(PayrollEarningListCreateView, "payroll"), name="payroll-earning-list-create"),

    path("deduction-types/", feature_view(PayrollDeductionTypeListCreateView, "payroll"), name="payroll-deduction-type-list-create"),
    path("deductions/", feature_view(PayrollDeductionListCreateView, "payroll"), name="payroll-deduction-list-create"),

    path("absences/", feature_view(PayrollAbsenceListCreateView, "payroll"), name="payroll-absence-list-create"),
    path("absences/<int:pk>/", feature_view(PayrollAbsenceDetailView, "payroll"), name="payroll-absence-detail"),

    path("records/", feature_view(PayrollRecordListView, "payroll"), name="payroll-record-list"),
    path("records/<int:pk>/", feature_view(PayrollRecordDetailView, "payroll"), name="payroll-record-detail"),

    path("periods/<int:pk>/process/", feature_view(ProcessPayrollView, "payroll"), name="payroll-process"),
    path("periods/<int:pk>/summary/", feature_view(PayrollSummaryView, "payroll"), name="payroll-summary"),
    path("periods/<int:pk>/approve/", feature_view(ApprovePayrollView, "payroll"), name="payroll-approve"),
    path("periods/<int:pk>/return-to-draft/", feature_view(ReturnPayrollToDraftView, "payroll"), name="payroll-return-to-draft"),
    path("periods/<int:pk>/lock/", feature_view(LockPayrollView, "payroll"), name="payroll-lock"),
    path("periods/<int:pk>/post-to-accounting/", feature_view(PostPayrollToAccountingView, "payroll"), name="payroll-post-accounting"),
    path("periods/<int:pk>/pay/", feature_view(PayPayrollView, "payroll"), name="payroll-pay"),


    path(
        "periods/<int:period_id>/records/<int:record_id>/payslip/",
        feature_view(PayrollPayslipView, "payroll"),
        name="payroll-payslip",
    ),

    path(
        "periods/<int:period_id>/bulk-payslips/",
        feature_view(BulkPayrollPayslipView, "payroll"),
        name="payroll-bulk-payslips",
    ),

    path(
        "periods/<int:pk>/export-csv/",
        feature_view(ExportPayrollCSVView, "payroll"),
        name="payroll-export-csv",
    ),

    path("remittances/", feature_view(PayrollRemittanceListCreateView, "payroll"), name="payroll-remittance-list-create"),
]
