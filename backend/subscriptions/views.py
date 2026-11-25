from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
import os
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from companies.models import CompanyMembership
from .models import Subscription, SupportTicket, SupportMessage
from .serializers import SubscriptionSerializer, SupportTicketSerializer, SupportMessageSerializer
from .services import notify_support_event


class CurrentSubscriptionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        company_id = request.query_params.get("company")
        if not company_id:
            return Response({"detail": "company is required."}, status=status.HTTP_400_BAD_REQUEST)

        membership = CompanyMembership.objects.filter(
            user=request.user, company_id=company_id, is_active=True
        ).select_related("company").first()

        if not membership and not request.user.is_superuser:
            raise PermissionDenied("You do not have access to this organization.")

        subscription = Subscription.objects.select_related("plan").filter(
            company_id=company_id
        ).first()
        if not subscription:
            return Response({
                "plan_code": None,
                "plan_name": "No subscription",
                "status": "PENDING",
                "is_currently_active": False,
                "features": {},
            })
        return Response(SubscriptionSerializer(subscription).data)


class SupportTicketListCreateView(generics.ListCreateAPIView):
    serializer_class = SupportTicketSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = SupportTicket.objects.select_related(
            "company", "submitted_by"
        ).prefetch_related("messages__sender")
        if self.request.user.is_superuser or self.request.user.is_staff:
            company_id = self.request.query_params.get("company")
            return queryset.filter(company_id=company_id) if company_id else queryset
        return queryset.filter(
            company__memberships__user=self.request.user,
            company__memberships__is_active=True,
        ).distinct()

    def perform_create(self, serializer):
        company = serializer.validated_data["company"]
        if not CompanyMembership.objects.filter(
            user=self.request.user, company=company, is_active=True
        ).exists():
            raise PermissionDenied("You do not have access to this organization.")

        subscription = Subscription.objects.select_related("plan").filter(company=company).first()
        plan_code = subscription.plan.code if subscription else "ESSENTIAL"
        priority = {
            "ESSENTIAL": "STANDARD",
            "PLUS": "PRIORITY",
            "COMPLETE": "ENHANCED",
        }.get(plan_code, "STANDARD")

        ticket = serializer.save(
            submitted_by=self.request.user,
            priority=priority,
        )
        SupportMessage.objects.create(
            ticket=ticket,
            sender=self.request.user,
            message=ticket.description,
            is_staff_reply=False,
        )
        notify_support_event(
            ticket,
            "New support request received",
            f"Your support request #{ticket.pk} has been received. Our team will respond by email.",
        )


class SupportTicketDetailView(generics.RetrieveAPIView):
    serializer_class = SupportTicketSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = SupportTicket.objects.select_related(
            "company", "submitted_by"
        ).prefetch_related("messages__sender")
        if self.request.user.is_superuser or self.request.user.is_staff:
            return queryset
        return queryset.filter(
            company__memberships__user=self.request.user,
            company__memberships__is_active=True,
        ).distinct()


class SupportTicketReplyView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request, pk):
        ticket = get_object_or_404(SupportTicket.objects.select_related("company"), pk=pk)
        if not (request.user.is_superuser or request.user.is_staff) and not CompanyMembership.objects.filter(
            user=request.user, company=ticket.company, is_active=True
        ).exists():
            raise PermissionDenied("You do not have access to this support ticket.")

        message_text = (request.data.get("message") or "").strip()
        if not message_text:
            return Response({"message": "This field is required."}, status=400)

        attachment = request.FILES.get("attachment")
        if attachment and attachment.size > 10 * 1024 * 1024:
            return Response({"attachment": "Attachments must be 10 MB or smaller."}, status=400)
        if attachment and attachment.content_type not in {
            "image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"
        }:
            return Response({"attachment": "Only PNG, JPG, WebP, PDF and TXT files are allowed."}, status=400)

        message = SupportMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            message=message_text,
            attachment=attachment,
            is_staff_reply=request.user.is_staff or request.user.is_superuser,
        )
        if message.is_staff_reply:
            ticket.status = SupportTicket.Status.WAITING
        else:
            ticket.status = SupportTicket.Status.IN_PROGRESS
        ticket.save(update_fields=["status", "updated_at"])

        notify_support_event(
            ticket,
            "New reply on your support request",
            f"A new reply has been added to support ticket #{ticket.pk}. Sign in to view the conversation.",
        )
        return Response(SupportMessageSerializer(message).data, status=status.HTTP_201_CREATED)


class SupportTicketAttachmentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        ticket = get_object_or_404(SupportTicket.objects.select_related("company"), pk=pk)
        if not _can_access_support_ticket(request.user, ticket):
            raise PermissionDenied("You do not have access to this support attachment.")
        if not ticket.attachment:
            raise Http404("No attachment was uploaded for this ticket.")
        return FileResponse(
            ticket.attachment.open("rb"),
            as_attachment=True,
            filename=os.path.basename(ticket.attachment.name),
        )


class SupportMessageAttachmentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        message = get_object_or_404(
            SupportMessage.objects.select_related("ticket__company"),
            pk=pk,
        )
        if not _can_access_support_ticket(request.user, message.ticket):
            raise PermissionDenied("You do not have access to this support attachment.")
        if not message.attachment:
            raise Http404("No attachment was uploaded for this message.")
        return FileResponse(
            message.attachment.open("rb"),
            as_attachment=True,
            filename=os.path.basename(message.attachment.name),
        )


def _can_access_support_ticket(user, ticket):
    if user.is_superuser or user.is_staff:
        return True
    return CompanyMembership.objects.filter(
        user=user,
        company=ticket.company,
        is_active=True,
    ).exists()
