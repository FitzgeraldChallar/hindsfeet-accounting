from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class Feature(models.Model):
    key = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("key",)

    def __str__(self):
        return self.name


class Plan(models.Model):
    class Code(models.TextChoices):
        ESSENTIAL = "ESSENTIAL", "Essential"
        PLUS = "PLUS", "Plus"
        COMPLETE = "COMPLETE", "Complete"

    code = models.CharField(max_length=20, choices=Code.choices, unique=True)
    name = models.CharField(max_length=80)
    monthly_price = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveSmallIntegerField(default=0)
    features = models.ManyToManyField(
        Feature, through="PlanFeature", related_name="plans", blank=True
    )

    class Meta:
        ordering = ("display_order", "monthly_price")

    def __str__(self):
        return f"{self.name} (${self.monthly_price}/month)"


class PlanFeature(models.Model):
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name="feature_assignments")
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE, related_name="plan_assignments")
    enabled = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("plan", "feature"), name="unique_plan_feature")
        ]

    def __str__(self):
        return f"{self.plan.code}: {self.feature.key} ({'on' if self.enabled else 'off'})"


class Subscription(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending activation"
        ACTIVE = "ACTIVE", "Active"
        SUSPENDED = "SUSPENDED", "Suspended"
        EXPIRED = "EXPIRED", "Expired"
        CANCELLED = "CANCELLED", "Cancelled"

    company = models.OneToOneField(
        "companies.Company", on_delete=models.CASCADE, related_name="subscription"
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    grace_until = models.DateTimeField(null=True, blank=True)
    payment_amount = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(0)],
    )
    payment_date = models.DateField(null=True, blank=True)
    payment_method = models.CharField(max_length=80, blank=True)
    payment_reference = models.CharField(max_length=160, blank=True)
    notes = models.TextField(blank=True)
    activated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="activated_subscriptions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.company.name} — {self.plan.name} ({self.status})"

    @property
    def is_currently_active(self):
        now = timezone.now()
        if self.status != self.Status.ACTIVE:
            return False
        if self.starts_at and self.starts_at > now:
            return False
        if self.ends_at and self.ends_at <= now:
            return bool(self.grace_until and self.grace_until > now)
        return True

    def has_feature(self, feature_key):
        if not self.is_currently_active:
            return False
        return self.plan.feature_assignments.filter(
            feature__key=feature_key, feature__is_active=True, enabled=True
        ).exists()


class SubscriptionHistory(models.Model):
    subscription = models.ForeignKey(
        Subscription, on_delete=models.CASCADE, related_name="history"
    )
    action = models.CharField(max_length=40)
    previous_plan = models.CharField(max_length=20, blank=True)
    new_plan = models.CharField(max_length=20, blank=True)
    previous_status = models.CharField(max_length=20, blank=True)
    new_status = models.CharField(max_length=20, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    payment_reference = models.CharField(max_length=160, blank=True)
    notes = models.TextField(blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="subscription_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.subscription.company.name}: {self.action}"


class SupportTicket(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        WAITING = "WAITING", "Waiting for customer"
        RESOLVED = "RESOLVED", "Resolved"
        CLOSED = "CLOSED", "Closed"

    class Category(models.TextChoices):
        ACCOUNT = "ACCOUNT", "Account access"
        BILLING = "BILLING", "Subscription / billing"
        ACCOUNTING = "ACCOUNTING", "Accounting"
        PAYROLL = "PAYROLL", "Payroll"
        TECHNICAL = "TECHNICAL", "Technical issue"
        OTHER = "OTHER", "Other"

    company = models.ForeignKey(
        "companies.Company", on_delete=models.CASCADE, related_name="support_tickets"
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="support_tickets"
    )
    subject = models.CharField(max_length=180)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    priority = models.CharField(max_length=20, default="STANDARD")
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="assigned_support_tickets",
    )
    attachment = models.FileField(upload_to="private_support/tickets/%Y/%m/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)

    def __str__(self):
        return f"#{self.pk} {self.subject}"


class SupportMessage(models.Model):
    ticket = models.ForeignKey(
        SupportTicket, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="support_messages"
    )
    message = models.TextField()
    attachment = models.FileField(upload_to="private_support/messages/%Y/%m/", null=True, blank=True)
    is_staff_reply = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)

    def __str__(self):
        return f"Ticket #{self.ticket_id} message by {self.sender}"
