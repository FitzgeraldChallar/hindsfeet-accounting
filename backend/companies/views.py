from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounting.default_accounts import create_default_accounts

from .currency_service import CompanyCurrencyService
from .models import (
    Company,
    CompanyCurrency,
    CompanyExchangeRate,
    CompanyMembership,
)
from .permissions import IsCompanyMember
from .serializers import (
    CompanyCurrencySerializer,
    CompanyExchangeRateSerializer,
    CompanyMembershipSerializer,
    CompanySerializer,
)


def user_can_access_company(user, company):
    if user.is_superuser:
        return True

    if user.role in ["OWNER", "ADMIN"]:
        return True

    return CompanyMembership.objects.filter(
        user=user,
        company=company,
        is_active=True,
    ).exists()


def user_can_manage_company_configuration(user, company):
    if user.is_superuser:
        return True

    if user.role in ["OWNER", "ADMIN"]:
        return True

    return CompanyMembership.objects.filter(
        user=user,
        company=company,
        is_active=True,
        role__in=["OWNER", "ADMIN"],
    ).exists()


def get_company_for_request(request, pk):
    company = get_object_or_404(
        Company,
        pk=pk,
    )

    if not user_can_access_company(
        request.user,
        company,
    ):
        raise PermissionDenied(
            "You do not have access to this company."
        )

    return company


class CompanyListCreateView(generics.ListCreateAPIView):
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if user.is_superuser or user.role in ["OWNER", "ADMIN"]:
            return (
                Company.objects
                .prefetch_related("enabled_currencies")
                .filter(is_active=True)
            )

        return (
            Company.objects
            .prefetch_related("enabled_currencies")
            .filter(
                memberships__user=user,
                memberships__is_active=True,
                is_active=True,
            )
            .distinct()
        )

    def perform_create(self, serializer):
        company = serializer.save(
            created_by=self.request.user
        )
        if "default_workspace_currency" not in self.request.data:
            company.default_workspace_currency = company.currency
            company.save(update_fields=["default_workspace_currency", "updated_at"])

        CompanyMembership.objects.get_or_create(
            user=self.request.user,
            company=company,
            defaults={
                "role": (
                    "OWNER"
                    if self.request.user.role == "OWNER"
                    else "ADMIN"
                )
            },
        )

        # Seed both supported workspaces for the legal company.
        for workspace_currency in [Company.Currency.USD, Company.Currency.LRD]:
            CompanyCurrency.objects.get_or_create(
                company=company,
                currency=workspace_currency,
                defaults={
                    "is_default": workspace_currency == company.default_workspace_currency,
                    "is_active": True,
                },
            )

        create_default_accounts(company)


class CompanyDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = CompanySerializer
    permission_classes = [
        permissions.IsAuthenticated,
        IsCompanyMember,
    ]

    def get_queryset(self):
        user = self.request.user

        queryset = (
            Company.objects
            .prefetch_related("enabled_currencies")
        )

        if user.is_superuser or user.role in ["OWNER", "ADMIN"]:
            return queryset

        return queryset.filter(
            memberships__user=user,
            memberships__is_active=True,
        ).distinct()

    def perform_update(self, serializer):
        company = self.get_object()
        old_currency = company.currency
        old_default = company.default_workspace_currency

        company = serializer.save()

        # Functional currency is intentionally stable once posted financial
        # activity exists. The frontend should use the workspace currency
        # selector for USD/LRD switching.
        if company.currency != old_currency:
            from accounting.models import JournalEntry
            if JournalEntry.objects.filter(
                company=company,
                status=JournalEntry.Status.POSTED,
            ).exists():
                company.currency = old_currency
                company.save(update_fields=["currency", "updated_at"])
                raise ValidationError({
                    "currency": (
                        "Functional currency cannot be changed after posted "
                        "financial activity exists. Use the workspace currency instead."
                    )
                })

        if company.default_workspace_currency != old_default:
            CompanyCurrencyService.enable_currency(
                company=company,
                currency=company.default_workspace_currency,
            )
            CompanyCurrencyService.set_default_currency(
                company=company,
                currency=company.default_workspace_currency,
            )


class CompanyCurrencyListView(APIView):
    """
    List or enable currencies/workspaces for one company.
    """

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request, pk):
        company = get_company_for_request(
            request,
            pk,
        )

        currencies = (
            CompanyCurrency.objects
            .filter(company=company)
            .order_by("-is_default", "currency")
        )

        return Response(
            CompanyCurrencySerializer(
                currencies,
                many=True,
            ).data,
            status=status.HTTP_200_OK,
        )

    def post(self, request, pk):
        company = get_company_for_request(
            request,
            pk,
        )

        if not user_can_manage_company_configuration(
            request.user,
            company,
        ):
            raise PermissionDenied(
                "Only a company owner or administrator can "
                "configure currencies."
            )

        currency = request.data.get("currency")
        make_default = bool(
            request.data.get("is_default", False)
        )

        try:
            currency_obj = CompanyCurrencyService.enable_currency(
                company=company,
                currency=currency,
                make_default=make_default,
            )
        except ValueError as exc:
            raise ValidationError(
                {"currency": str(exc)}
            )

        return Response(
            CompanyCurrencySerializer(
                currency_obj
            ).data,
            status=status.HTTP_201_CREATED,
        )


class CompanyCurrencyDetailView(APIView):
    """
    Enable/disable or make a company currency the default.

    A currency is disabled rather than deleted so that historical
    transactions remain interpretable.
    """

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def patch(self, request, pk, currency):
        company = get_company_for_request(
            request,
            pk,
        )

        if not user_can_manage_company_configuration(
            request.user,
            company,
        ):
            raise PermissionDenied(
                "Only a company owner or administrator can "
                "configure currencies."
            )

        try:
            normalized = CompanyCurrencyService.normalize_currency(
                currency
            )
        except ValueError as exc:
            raise ValidationError(
                {"currency": str(exc)}
            )

        currency_obj = (
            CompanyCurrency.objects
            .filter(
                company=company,
                currency=normalized,
            )
            .first()
        )

        if currency_obj is None:
            raise ValidationError(
                {"currency": "Currency is not enabled for this company."}
            )

        if "is_default" in request.data:
            if bool(request.data["is_default"]):
                try:
                    currency_obj = (
                        CompanyCurrencyService.set_default_currency(
                            company=company,
                            currency=normalized,
                        )
                    )
                except ValueError as exc:
                    raise ValidationError(
                        {"currency": str(exc)}
                    )

            elif currency_obj.is_default:
                raise ValidationError(
                    {
                        "is_default": (
                            "The default company currency cannot be "
                            "unset. Select another currency as default first."
                        )
                    }
                )

        if "is_active" in request.data:
            requested_active = bool(
                request.data["is_active"]
            )

            try:
                if requested_active:
                    currency_obj = (
                        CompanyCurrencyService.enable_currency(
                            company=company,
                            currency=normalized,
                        )
                    )
                else:
                    currency_obj = (
                        CompanyCurrencyService.disable_currency(
                            company=company,
                            currency=normalized,
                        )
                    )
            except ValueError as exc:
                raise ValidationError(
                    {"is_active": str(exc)}
                )

        currency_obj.refresh_from_db()

        return Response(
            CompanyCurrencySerializer(
                currency_obj
            ).data,
            status=status.HTTP_200_OK,
        )


class CompanyExchangeRateListCreateView(APIView):
    """
    List historical exchange rates or add a new rate.

    Existing rates should not be overwritten for historical accounting.
    Add a new effective-date record when the rate changes.
    """

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request, pk):
        company = get_company_for_request(
            request,
            pk,
        )

        queryset = (
            CompanyExchangeRate.objects
            .filter(company=company)
            .select_related("created_by")
            .order_by(
                "-effective_date",
                "-id",
            )
        )

        from_currency = request.query_params.get(
            "from_currency"
        )
        to_currency = request.query_params.get(
            "to_currency"
        )

        if from_currency:
            queryset = queryset.filter(
                from_currency=from_currency.upper()
            )

        if to_currency:
            queryset = queryset.filter(
                to_currency=to_currency.upper()
            )

        return Response(
            CompanyExchangeRateSerializer(
                queryset,
                many=True,
            ).data,
            status=status.HTTP_200_OK,
        )

    def post(self, request, pk):
        company = get_company_for_request(
            request,
            pk,
        )

        if not user_can_manage_company_configuration(
            request.user,
            company,
        ):
            raise PermissionDenied(
                "Only a company owner or administrator can "
                "manage exchange rates."
            )

        serializer = CompanyExchangeRateSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        from_currency = serializer.validated_data[
            "from_currency"
        ]
        to_currency = serializer.validated_data[
            "to_currency"
        ]

        enabled = set(
            CompanyCurrency.objects.filter(
                company=company,
                is_active=True,
            ).values_list(
                "currency",
                flat=True,
            )
        )

        if from_currency not in enabled:
            raise ValidationError(
                {
                    "from_currency": (
                        "This currency is not enabled for the company."
                    )
                }
            )

        if to_currency not in enabled:
            raise ValidationError(
                {
                    "to_currency": (
                        "This currency is not enabled for the company."
                    )
                }
            )

        # The URL identifies the company. Do not pass the serializer's
        # company field a second time, otherwise Django receives duplicate
        # values for the company keyword argument.
        rate_data = dict(serializer.validated_data)
        rate_data.pop("company", None)

        rate = CompanyExchangeRate(
            company=company,
            created_by=request.user,
            **rate_data,
        )

        try:
            rate.full_clean()
            rate.save()
        except Exception as exc:
            if hasattr(exc, "message_dict"):
                raise ValidationError(exc.message_dict)
            raise ValidationError({"detail": str(exc)})

        return Response(
            CompanyExchangeRateSerializer(rate).data,
            status=status.HTTP_201_CREATED,
        )


class CompanyWorkspaceView(APIView):
    """
    Return the complete currency/workspace configuration needed by
    the frontend after a company is selected.
    """

    permission_classes = [
        permissions.IsAuthenticated,
    ]

    def get(self, request, pk):
        company = get_company_for_request(
            request,
            pk,
        )

        currencies = list(
            CompanyCurrency.objects.filter(
                company=company,
            ).order_by(
                "-is_default",
                "currency",
            )
        )

        rates = list(
            CompanyExchangeRate.objects.filter(
                company=company,
                is_active=True,
            )
            .select_related("created_by")
            .order_by(
                "-effective_date",
                "-id",
            )
        )

        return Response(
            {
                "company": CompanySerializer(
                    company,
                    context={"request": request},
                ).data,
                "functional_currency": company.currency,
                "default_workspace_currency": company.default_workspace_currency,
                "currencies": CompanyCurrencySerializer(
                    currencies,
                    many=True,
                ).data,
                "exchange_rates": CompanyExchangeRateSerializer(
                    rates,
                    many=True,
                ).data,
            },
            status=status.HTTP_200_OK,
        )
