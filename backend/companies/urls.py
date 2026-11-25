from django.urls import path

from .company_logo_view import CompanyLogoView
from .company_delete_view import CompanyDeleteView
from .views import (
    CompanyCurrencyDetailView,
    CompanyCurrencyListView,
    CompanyDetailView,
    CompanyExchangeRateListCreateView,
    CompanyListCreateView,
    CompanyWorkspaceView,
    CompanyMemberListCreateView,
    CompanyMemberDetailView,
)


urlpatterns = [
    path(
        "",
        CompanyListCreateView.as_view(),
        name="company-list-create",
    ),
    path(
        "<int:pk>/",
        CompanyDetailView.as_view(),
        name="company-detail",
    ),
    path(
        "<int:pk>/members/",
        CompanyMemberListCreateView.as_view(),
        name="company-members",
    ),
    path(
        "<int:pk>/members/<int:membership_id>/",
        CompanyMemberDetailView.as_view(),
        name="company-member-detail",
    ),
    path(
        "<int:pk>/delete/",
        CompanyDeleteView.as_view(),
        name="company-delete",
    ),
    
    path(
        "<int:pk>/currencies/",
        CompanyCurrencyListView.as_view(),
        name="company-currencies",
    ),
    path(
        "<int:pk>/currencies/<str:currency>/",
        CompanyCurrencyDetailView.as_view(),
        name="company-currency-detail",
    ),
    path(
        "<int:pk>/exchange-rates/",
        CompanyExchangeRateListCreateView.as_view(),
        name="company-exchange-rates",
    ),
    path(
        "<int:pk>/workspace/",
        CompanyWorkspaceView.as_view(),
        name="company-workspace",
    ),
    path(
        "<int:pk>/logo/",
        CompanyLogoView.as_view(),
        name="company-logo",
    ),
]
