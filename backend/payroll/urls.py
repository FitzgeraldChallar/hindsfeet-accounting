from django.urls import path

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
    path("employees/", EmployeeListCreateView.as_view(), name="employee-list-create"),
    path("employees/<int:pk>/", EmployeeDetailView.as_view(), name="employee-detail"),

    path("periods/", PayrollPeriodListCreateView.as_view(), name="payroll-period-list-create"),
    path("periods/<int:pk>/", PayrollPeriodDetailView.as_view(), name="payroll-period-detail"),

    path("tax-bands/", PayrollTaxBandListCreateView.as_view(), name="payroll-tax-band-list-create"),
    path("tax-bands/<int:pk>/", PayrollTaxBandDetailView.as_view(), name="payroll-tax-band-detail"),

    path("earning-types/", PayrollEarningTypeListCreateView.as_view(), name="payroll-earning-type-list-create"),
    path("earnings/", PayrollEarningListCreateView.as_view(), name="payroll-earning-list-create"),

    path("deduction-types/", PayrollDeductionTypeListCreateView.as_view(), name="payroll-deduction-type-list-create"),
    path("deductions/", PayrollDeductionListCreateView.as_view(), name="payroll-deduction-list-create"),

    path("absences/", PayrollAbsenceListCreateView.as_view(), name="payroll-absence-list-create"),
    path("absences/<int:pk>/", PayrollAbsenceDetailView.as_view(), name="payroll-absence-detail"),

    path("records/", PayrollRecordListView.as_view(), name="payroll-record-list"),
    path("records/<int:pk>/", PayrollRecordDetailView.as_view(), name="payroll-record-detail"),

    path("periods/<int:pk>/process/", ProcessPayrollView.as_view(), name="payroll-process"),
    path("periods/<int:pk>/summary/", PayrollSummaryView.as_view(), name="payroll-summary"),
    path("periods/<int:pk>/approve/", ApprovePayrollView.as_view(), name="payroll-approve"),
    path("periods/<int:pk>/return-to-draft/", ReturnPayrollToDraftView.as_view(), name="payroll-return-to-draft"),
    path("periods/<int:pk>/lock/", LockPayrollView.as_view(), name="payroll-lock"),
    path("periods/<int:pk>/post-to-accounting/", PostPayrollToAccountingView.as_view(), name="payroll-post-accounting"),
    path("periods/<int:pk>/pay/", PayPayrollView.as_view(), name="payroll-pay"),


    path(
        "periods/<int:period_id>/records/<int:record_id>/payslip/",
        PayrollPayslipView.as_view(),
        name="payroll-payslip",
    ),

    path(
        "periods/<int:period_id>/bulk-payslips/",
        BulkPayrollPayslipView.as_view(),
        name="payroll-bulk-payslips",
    ),

    path(
        "periods/<int:pk>/export-csv/",
        ExportPayrollCSVView.as_view(),
        name="payroll-export-csv",
    ),

    path("remittances/", PayrollRemittanceListCreateView.as_view(), name="payroll-remittance-list-create"),
]
