from django.core.files.images import get_image_dimensions
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Company


ALLOWED_LOGO_TYPES = {
    "image/png",
    "image/jpeg",
    "image/webp",
}
MAX_LOGO_SIZE = 5 * 1024 * 1024


def user_can_manage_company_branding(user):
    return bool(
        user.is_superuser
        or getattr(user, "role", None) in ["OWNER", "ADMIN"]
    )


def company_payload(request, company):
    logo_url = None
    if company.logo:
        try:
            logo_url = request.build_absolute_uri(company.logo.url)
        except (AttributeError, ValueError):
            logo_url = None

    return {
        "id": company.id,
        "name": company.name,
        "legal_name": company.legal_name,
        "business_type": company.business_type,
        "registration_number": company.registration_number,
        "address": company.address,
        "phone": company.phone,
        "email": company.email,
        "logo": logo_url,
        "currency": company.currency,
        "fiscal_year_start_month": company.fiscal_year_start_month,
        "is_active": company.is_active,
        "created_at": company.created_at,
        "updated_at": company.updated_at,
    }


class CompanyLogoView(APIView):
    """
    Upload, replace, or remove the logo belonging to one company.

    Company branding is deliberately handled through a dedicated endpoint
    so document branding remains company-specific and cannot accidentally
    modify unrelated company fields.
    """

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_company(self, request, pk):
        company = get_object_or_404(Company, pk=pk)

        if not user_can_manage_company_branding(request.user):
            raise PermissionDenied(
                "Only a company owner or administrator can manage company branding."
            )

        return company

    def get(self, request, pk):
        company = self.get_company(request, pk)

        return Response(
            {
                "company": company_payload(request, company),
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request, pk):
        company = self.get_company(request, pk)
        uploaded_logo = request.FILES.get("logo")

        if not uploaded_logo:
            raise ValidationError({"logo": "Please select a logo image to upload."})

        if uploaded_logo.size > MAX_LOGO_SIZE:
            raise ValidationError({
                "logo": "The company logo must be 5 MB or smaller."
            })

        content_type = (uploaded_logo.content_type or "").lower()
        if content_type not in ALLOWED_LOGO_TYPES:
            raise ValidationError({
                "logo": "Only PNG, JPG, JPEG, and WebP images are supported."
            })

        # Force Pillow/ImageField validation before storing the file.
        try:
            width, height = get_image_dimensions(uploaded_logo)
        except Exception:
            width, height = None, None

        if not width or not height:
            raise ValidationError({
                "logo": "The selected file is not a valid image."
            })

        try:
            uploaded_logo.seek(0)
        except (AttributeError, OSError):
            pass

        old_logo = company.logo.name if company.logo else None

        company.logo = uploaded_logo
        company.save(update_fields=["logo", "updated_at"])

        if old_logo and old_logo != company.logo.name:
            try:
                company.logo.storage.delete(old_logo)
            except Exception:
                # The database update is still valid even if old storage
                # cleanup fails. The current logo remains authoritative.
                pass

        return Response(
            {
                "message": "Company logo uploaded successfully.",
                "company": company_payload(request, company),
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        company = self.get_company(request, pk)

        if not company.logo:
            return Response(
                {
                    "message": "The company does not currently have a logo.",
                    "company": company_payload(request, company),
                },
                status=status.HTTP_200_OK,
            )

        logo = company.logo
        company.logo = None
        company.save(update_fields=["logo", "updated_at"])

        try:
            logo.delete(save=False)
        except Exception:
            pass

        return Response(
            {
                "message": "Company logo removed successfully.",
                "company": company_payload(request, company),
            },
            status=status.HTTP_200_OK,
        )
