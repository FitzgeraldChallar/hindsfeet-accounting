from django.contrib import admin
from django.utils import timezone
from django.contrib import messages
from django.core.exceptions import ValidationError

from .models import Feature, Plan, PlanFeature, Subscription, SubscriptionHistory, SupportTicket, SupportMessage
from .services import record_subscription_change, notify_support_event


class PlanFeatureInline(admin.TabularInline):
    model = PlanFeature
    extra = 0
    autocomplete_fields = ("feature",)


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "monthly_price", "is_active", "display_order")
    list_filter = ("is_active",)
    search_fields = ("code", "name")
    inlines = (PlanFeatureInline,)


@admin.register(Feature)
class FeatureAdmin(admin.ModelAdmin):
    list_display = ("key", "name", "is_active")
    list_filter = ("is_active",)
    search_fields = ("key", "name")


class SubscriptionHistoryInline(admin.TabularInline):
    model = SubscriptionHistory
    extra = 0
    can_delete = False
    readonly_fields = (
        "action", "previous_plan", "new_plan", "previous_status",
        "new_status", "amount", "payment_reference", "notes",
        "performed_by", "created_at",
    )


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        "company", "plan", "status", "starts_at", "ends_at",
        "payment_date", "payment_reference",
    )
    list_filter = ("status", "plan")
    search_fields = ("company__name", "company__email", "payment_reference")
    autocomplete_fields = ("company", "activated_by")
    readonly_fields = ("created_at", "updated_at")
    inlines = (SubscriptionHistoryInline,)
    actions = ("activate_selected", "suspend_selected")

    @admin.action(description="Activate selected subscriptions")
    def activate_selected(self, request, queryset):
        for subscription in queryset:
            if not subscription.ends_at:
                self.message_user(
                    request,
                    f"Set an expiry date for {subscription.company.name} before activating it.",
                    level=messages.ERROR,
                )
                continue
            old_plan = subscription.plan.code
            old_status = subscription.status
            subscription.status = Subscription.Status.ACTIVE
            if not subscription.starts_at:
                subscription.starts_at = timezone.now()
            subscription.activated_by = request.user
            subscription.save()
            record_subscription_change(
                subscription, action="ACTIVATED", user=request.user,
                previous_plan=old_plan, previous_status=old_status,
                amount=subscription.payment_amount,
                payment_reference=subscription.payment_reference,
                notes=f"Term: {subscription.starts_at} to {subscription.ends_at}",
            )

    @admin.action(description="Suspend selected subscriptions")
    def suspend_selected(self, request, queryset):
        for subscription in queryset:
            old_plan = subscription.plan.code
            old_status = subscription.status
            subscription.status = Subscription.Status.SUSPENDED
            subscription.save(update_fields=("status", "updated_at"))
            record_subscription_change(
                subscription, action="SUSPENDED", user=request.user,
                previous_plan=old_plan, previous_status=old_status,
            )

    def save_model(self, request, obj, form, change):
        previous = None
        if change:
            previous = Subscription.objects.select_related("plan").filter(pk=obj.pk).first()
        previous_plan = previous.plan.code if previous else ""
        previous_status = previous.status if previous else ""
        previous_amount = previous.payment_amount if previous else None
        previous_reference = previous.payment_reference if previous else ""
        previous_start = previous.starts_at if previous else None
        previous_end = previous.ends_at if previous else None
        previous_payment_date = previous.payment_date if previous else None
        if obj.status == Subscription.Status.ACTIVE and not obj.ends_at:
            if not previous or previous.status != Subscription.Status.ACTIVE:
                raise ValidationError("Set the subscription expiry date before activating the organization.")
        if obj.status == Subscription.Status.ACTIVE and not obj.activated_by:
            obj.activated_by = request.user
        if obj.status == Subscription.Status.ACTIVE and not obj.starts_at:
            obj.starts_at = timezone.now()
        super().save_model(request, obj, form, change)
        if change and (
            previous_plan != obj.plan.code
            or previous_status != obj.status
            or previous_amount != obj.payment_amount
            or previous_reference != obj.payment_reference
            or previous_start != obj.starts_at
            or previous_end != obj.ends_at
            or previous_payment_date != obj.payment_date
        ):
            history_notes = obj.notes
            if previous and previous_end != obj.ends_at:
                history_notes = (
                    f"{history_notes}\n"
                    f"Subscription expiry changed from {previous_end} to {obj.ends_at}."
                ).strip()
            record_subscription_change(
                obj,
                action="UPDATED",
                user=request.user,
                previous_plan=previous_plan,
                previous_status=previous_status,
                amount=obj.payment_amount,
                payment_reference=obj.payment_reference,
                notes=history_notes,
            )


class SupportMessageInline(admin.TabularInline):
    model = SupportMessage
    extra = 1
    fields = ("message", "attachment", "sender", "is_staff_reply", "created_at")
    readonly_fields = ("sender", "is_staff_reply", "created_at")


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ("id", "company", "subject", "priority", "status", "submitted_by", "updated_at")
    list_filter = ("status", "priority", "category")
    search_fields = ("subject", "company__name", "submitted_by__username")
    autocomplete_fields = ("company", "submitted_by", "assigned_to")
    readonly_fields = ("created_at", "updated_at")
    inlines = (SupportMessageInline,)

    def save_formset(self, request, form, formset, change):
        if formset.model is not SupportMessage:
            return super().save_formset(request, form, formset, change)

        new_messages = []
        for message in formset.save(commit=False):
            if message._state.adding:
                message.sender = request.user
                message.is_staff_reply = True
                new_messages.append(message)
            message.save()
        formset.save_m2m()

        if new_messages:
            ticket = form.instance
            ticket.status = SupportTicket.Status.WAITING
            ticket.save(update_fields=("status", "updated_at"))
            notify_support_event(
                ticket,
                "Hindsfeet Support replied to your request",
                f"A new reply has been added to support ticket #{ticket.pk}. Sign in to view the conversation.",
            )
