from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

from .models import SubscriptionHistory


def record_subscription_change(subscription, *, action, user=None,
                               previous_plan="", previous_status="",
                               amount=None, payment_reference="", notes=""):
    SubscriptionHistory.objects.create(
        subscription=subscription,
        action=action,
        previous_plan=previous_plan,
        new_plan=subscription.plan.code,
        previous_status=previous_status,
        new_status=subscription.status,
        amount=amount,
        payment_reference=payment_reference,
        notes=notes,
        performed_by=user,
    )


def notify_support_event(ticket, subject, message):
    recipients = []
    company_email = getattr(ticket.company, "email", "") or ""
    if company_email:
        recipients.append(company_email)

    requester_email = getattr(getattr(ticket, "submitted_by", None), "email", "") or ""
    if requester_email and requester_email not in recipients:
        recipients.append(requester_email)

    admin_email = getattr(settings, "SUPPORT_NOTIFICATION_EMAIL", "") or ""
    if admin_email and admin_email not in recipients:
        recipients.append(admin_email)

    if recipients:
        try:
            send_mail(
                subject=f"[Hindsfeet Support #{ticket.pk}] {subject}",
                message=message,
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
                recipient_list=recipients,
                fail_silently=False,
            )
        except Exception:
            logger.exception(
                "Unable to send email notification for support ticket %s",
                ticket.pk,
            )
