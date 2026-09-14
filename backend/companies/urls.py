from django.urls import path

from .company_logo_view import CompanyLogoView
from .views import (
    CompanyDetailView,
    CompanyListCreateView,
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
        "<int:pk>/logo/",
        CompanyLogoView.as_view(),
        name="company-logo",
    ),
]
