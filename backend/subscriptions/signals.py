from django.db.models.signals import post_save
from django.dispatch import receiver

from companies.models import Company
from .models import Plan, Subscription


@receiver(post_save, sender=Company)
def create_pending_subscription_for_new_company(sender, instance, created, **kwargs):
    if not created:
        return

    essential = Plan.objects.filter(code=Plan.Code.ESSENTIAL).first()
    if essential:
        Subscription.objects.get_or_create(
            company=instance,
            defaults={
                "plan": essential,
                "status": Subscription.Status.PENDING,
            },
        )
