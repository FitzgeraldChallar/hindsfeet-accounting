from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied

from companies.models import Company, CompanyMembership
from .models import Subscription


class FeatureEntitlementPermission(BasePermission):
    """
    Enforces a plan feature on DRF views that declare `required_feature`.
    Company context is resolved from request data/query params or the
    target object's queryset for detail routes.
    """

    message = "Your organization's subscription does not include this feature."

    def has_permission(self, request, view):
        feature = getattr(view, "required_feature", None)
        if not feature:
            return True

        if request.user.is_superuser:
            return True

        company_id = (
            request.query_params.get("company")
            or request.query_params.get("company_id")
            or request.data.get("company")
            or request.data.get("company_id")
            or getattr(view, "company_id", None)
        )

        company = None
        if company_id:
            company = Company.objects.filter(pk=company_id).first()

        if company is None:
            company = _resolve_company_from_route(request, view)

        if company is None and getattr(view, "kwargs", {}).get("pk"):
            try:
                queryset = view.get_queryset()
                obj = queryset.filter(pk=view.kwargs["pk"]).first()
                company = _company_from_object(obj)
            except Exception:
                company = None

        if company is None:
            raise PermissionDenied(
                "A valid company context is required to verify your subscription."
            )

        # A user's global role must never grant access to another tenant.
        if not CompanyMembership.objects.filter(
            user=request.user, company=company, is_active=True
        ).exists():
            raise PermissionDenied("You do not have access to this organization.")

        subscription = (
            Subscription.objects.select_related("plan")
            .filter(company=company)
            .first()
        )
        if not subscription or not subscription.has_feature(feature):
            raise PermissionDenied(self.message)

        return True


def _company_from_object(obj):
    if obj is None:
        return None
    company = getattr(obj, "company", None)
    if company is not None:
        return company
    period = getattr(obj, "payroll_period", None)
    if period is not None:
        return getattr(period, "company", None)
    record = getattr(obj, "payroll_record", None)
    if record is not None:
        period = getattr(record, "payroll_period", None)
        return getattr(period, "company", None) if period else None
    employee = getattr(obj, "employee", None)
    if employee is not None:
        return getattr(employee, "company", None)
    bank_account = getattr(obj, "bank_account", None)
    if bank_account is not None:
        return getattr(bank_account, "company", None)
    product = getattr(obj, "product", None)
    if product is not None:
        return getattr(product, "company", None)
    return None


def feature_view(view_class, feature_key):
    """
    Attach the entitlement permission even when the original view declares
    its own permission_classes (most existing API views do).
    """
    view_class.required_feature = feature_key
    permissions = list(getattr(view_class, "permission_classes", []))
    if FeatureEntitlementPermission not in permissions:
        permissions.append(FeatureEntitlementPermission)
    view_class.permission_classes = permissions
    return view_class.as_view()


def _resolve_company_from_route(request, view):
    """Resolve company for action endpoints whose URL identifies a payroll period."""
    path = request.path
    kwargs = getattr(view, "kwargs", {}) or {}
    try:
        from payroll.models import PayrollPeriod, PayrollRecord, Employee
        from operations.models import Inventory, InventoryTransaction, PumpAttendant, FuelPump, PumpSale, Product, Sale
        from invoicing.models import Customer, CustomerPayment, Invoice, Supplier, SupplierBill, SupplierPayment
        from accounting.models import Account, JournalEntry
        from banking.models import BankAccount, BankTransaction

        candidates = []
        if "/api/payroll/" in path:
            if kwargs.get("period_id"):
                candidates.append(PayrollPeriod.objects.filter(pk=kwargs["period_id"]).first())
            elif "periods" in path and kwargs.get("pk"):
                candidates.append(PayrollPeriod.objects.filter(pk=kwargs["pk"]).first())
            elif "records" in path and kwargs.get("pk"):
                candidates.append(PayrollRecord.objects.select_related("payroll_period__company").filter(pk=kwargs["pk"]).first())
            elif "employees" in path and kwargs.get("pk"):
                candidates.append(Employee.objects.select_related("company").filter(pk=kwargs["pk"]).first())
        elif "/api/operations/" in path and kwargs.get("pk"):
            model = (
                PumpSale if "pump-sales" in path else
                FuelPump if "fuel-pumps" in path else
                PumpAttendant if "pump-attendants" in path else
                InventoryTransaction if "inventory/transactions" in path else
                Product if "products" in path else
                Sale if "sales" in path else Inventory
            )
            candidates.append(model.objects.select_related("company").filter(pk=kwargs["pk"]).first())
        elif "/api/invoicing/" in path and kwargs.get("pk"):
            model = (
                SupplierBill if "supplier-bills" in path else
                SupplierPayment if "supplier-payments" in path else
                Supplier if "suppliers" in path else
                CustomerPayment if "customer-payments" in path else
                Invoice if "invoices" in path else Customer
            )
            candidates.append(model.objects.select_related("company").filter(pk=kwargs["pk"]).first())
        elif "/api/accounting/" in path and kwargs.get("pk"):
            model = JournalEntry if "journal-entries" in path else Account
            candidates.append(model.objects.select_related("company").filter(pk=kwargs["pk"]).first())
        elif "/api/banking/" in path and kwargs.get("pk"):
            model = BankTransaction if "transactions" in path else BankAccount
            candidates.append(model.objects.select_related("company").filter(pk=kwargs["pk"]).first())

        for obj in candidates:
            company = _company_from_object(obj)
            if company is not None:
                return company
    except Exception:
        return None
    return None
