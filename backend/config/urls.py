from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView


urlpatterns = [
    path(
        "admin/",
        admin.site.urls,
    ),

    # Authentication
    path(
        "api/accounts/",
        include("accounts.urls"),
    ),

    path(
        "api/accounts/token/refresh/",
        TokenRefreshView.as_view(),
        name="token-refresh",
    ),

    # Companies
    path(
        "api/companies/",
        include("companies.urls"),
    ),

    # Accounting
    path(
        "api/accounting/",
        include("accounting.urls"),
    ),

    # Operations
    path(
        "api/operations/",
        include("operations.urls"),
    ),

    # Payroll
    path(
        "api/payroll/",
        include("payroll.urls"),
    ),

    # Invoicing
    path(
        "api/invoicing/",
        include("invoicing.urls"),
    ),

    # Banking
    path(
        "api/banking/",
        include("banking.urls"),
    ),
]


# Serve uploaded media files during local development.
# In production, configure your web server or storage service
# to serve MEDIA_ROOT/MEDIA_URL instead.
if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )
