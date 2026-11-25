from decimal import Decimal
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
from django.core.validators import MinValueValidator


def seed_plans_and_features(apps, schema_editor):
    Feature = apps.get_model("subscriptions", "Feature")
    Plan = apps.get_model("subscriptions", "Plan")
    PlanFeature = apps.get_model("subscriptions", "PlanFeature")
    Subscription = apps.get_model("subscriptions", "Subscription")
    Company = apps.get_model("companies", "Company")
    CompanyMembership = apps.get_model("companies", "CompanyMembership")

    features = {
        "core_accounting": "Core accounting",
        "sales_invoicing": "Sales and invoicing",
        "purchases_expenses": "Purchases and expenses",
        "banking": "Banking",
        "standard_reports": "Standard financial reports",
        "multi_currency": "USD and LRD transactions",
        "email_support": "Email support",
        "priority_support": "Priority support",
        "enhanced_support": "Enhanced support",
        "company_users": "Multiple organization users",
        "multi_department_management": "Multi-department management",
        "accounts_receivable": "Accounts receivable",
        "accounts_payable": "Accounts payable",
        "inventory": "Inventory management",
        "payroll": "Payroll management",
        "expanded_reports": "Expanded management reports",
        "advanced_bi": "Advanced business intelligence",
        "gas_operations": "Gas operations",
        "lra_tax_automation": "LRA payroll tax automation",
    }
    feature_objects = {}
    for key, name in features.items():
        feature_objects[key], _ = Feature.objects.get_or_create(
            key=key,
            defaults={
                "name": name,
                "description": name,
                # Reserved Complete-plan capabilities remain unavailable
                # until their dedicated modules are implemented.
                "is_active": key not in {"advanced_bi", "multi_department_management"},
            },
        )

    common = {
        "core_accounting", "sales_invoicing", "purchases_expenses",
        "banking", "standard_reports", "multi_currency", "email_support",
        "company_users",
    }
    plan_definitions = {
        "ESSENTIAL": ("Essential", Decimal("200.00"), common),
        "PLUS": (
            "Plus", Decimal("350.00"),
            common | {
                "accounts_receivable", "accounts_payable", "inventory",
                "payroll", "expanded_reports", "priority_support",
            },
        ),
        "COMPLETE": (
            "Complete", Decimal("500.00"),
            common | {
                "accounts_receivable", "accounts_payable", "inventory",
                "payroll", "expanded_reports", "advanced_bi",
                "gas_operations", "lra_tax_automation", "priority_support",
                "enhanced_support", "multi_department_management",
            },
        ),
    }
    plans = {}
    for order, (code, (name, price, enabled)) in enumerate(plan_definitions.items()):
        plan, _ = Plan.objects.get_or_create(
            code=code,
            defaults={
                "name": name, "monthly_price": price,
                "description": f"{name} subscription plan",
                "display_order": order,
            },
        )
        plans[code] = plan
        for key, feature in feature_objects.items():
            PlanFeature.objects.update_or_create(
                plan=plan, feature=feature,
                defaults={"enabled": key in enabled},
            )

    # Preserve access for companies that were already using the platform.
    # They are grandfathered onto Essential until an administrator records
    # their actual paid plan and term. New companies are created as PENDING.
    for company in Company.objects.all().iterator():
        if company.created_by_id:
            CompanyMembership.objects.get_or_create(
                company_id=company.pk,
                user_id=company.created_by_id,
                defaults={"role": "OWNER", "is_active": True},
            )

        Subscription.objects.get_or_create(
            company_id=company.pk,
            defaults={
                "plan_id": plans["ESSENTIAL"].pk,
                "status": "ACTIVE",
                "starts_at": None,
                "ends_at": None,
                "notes": "Legacy company grandfathered during subscription rollout; review and set paid term.",
            },
        )


def reverse_seed(apps, schema_editor):
    Subscription = apps.get_model("subscriptions", "Subscription")
    Subscription.objects.all().delete()


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("companies", "0006_alter_companyexchangerate_rate"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Feature",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.SlugField(max_length=80, unique=True)),
                ("name", models.CharField(max_length=120)),
                ("description", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={"ordering": ("key",)},
        ),
        migrations.CreateModel(
            name="Plan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(choices=[("ESSENTIAL", "Essential"), ("PLUS", "Plus"), ("COMPLETE", "Complete")], max_length=20, unique=True)),
                ("name", models.CharField(max_length=80)),
                ("monthly_price", models.DecimalField(decimal_places=2, max_digits=10, validators=[MinValueValidator(0)])),
                ("description", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
                ("display_order", models.PositiveSmallIntegerField(default=0)),
            ],
            options={"ordering": ("display_order", "monthly_price")},
        ),
        migrations.CreateModel(
            name="Subscription",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("PENDING", "Pending activation"), ("ACTIVE", "Active"), ("SUSPENDED", "Suspended"), ("EXPIRED", "Expired"), ("CANCELLED", "Cancelled")], default="PENDING", max_length=20)),
                ("starts_at", models.DateTimeField(blank=True, null=True)),
                ("ends_at", models.DateTimeField(blank=True, null=True)),
                ("grace_until", models.DateTimeField(blank=True, null=True)),
                ("payment_amount", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True, validators=[MinValueValidator(0)])),
                ("payment_date", models.DateField(blank=True, null=True)),
                ("payment_method", models.CharField(blank=True, max_length=80)),
                ("payment_reference", models.CharField(blank=True, max_length=160)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("activated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="activated_subscriptions", to=settings.AUTH_USER_MODEL)),
                ("company", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="subscription", to="companies.company")),
                ("plan", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="subscriptions", to="subscriptions.plan")),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.CreateModel(
            name="PlanFeature",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("enabled", models.BooleanField(default=True)),
                ("feature", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="plan_assignments", to="subscriptions.feature")),
                ("plan", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="feature_assignments", to="subscriptions.plan")),
            ],
        ),
        migrations.AddField(
            model_name="plan",
            name="features",
            field=models.ManyToManyField(blank=True, related_name="plans", through="subscriptions.PlanFeature", to="subscriptions.feature"),
        ),
        migrations.AddConstraint(
            model_name="planfeature",
            constraint=models.UniqueConstraint(fields=("plan", "feature"), name="unique_plan_feature"),
        ),
        migrations.CreateModel(
            name="SubscriptionHistory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(max_length=40)),
                ("previous_plan", models.CharField(blank=True, max_length=20)),
                ("new_plan", models.CharField(blank=True, max_length=20)),
                ("previous_status", models.CharField(blank=True, max_length=20)),
                ("new_status", models.CharField(blank=True, max_length=20)),
                ("amount", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("payment_reference", models.CharField(blank=True, max_length=160)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("performed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="subscription_actions", to=settings.AUTH_USER_MODEL)),
                ("subscription", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="history", to="subscriptions.subscription")),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.CreateModel(
            name="SupportTicket",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("subject", models.CharField(max_length=180)),
                ("category", models.CharField(choices=[("ACCOUNT", "Account access"), ("BILLING", "Subscription / billing"), ("ACCOUNTING", "Accounting"), ("PAYROLL", "Payroll"), ("TECHNICAL", "Technical issue"), ("OTHER", "Other")], default="OTHER", max_length=20)),
                ("description", models.TextField()),
                ("status", models.CharField(choices=[("OPEN", "Open"), ("IN_PROGRESS", "In progress"), ("WAITING", "Waiting for customer"), ("RESOLVED", "Resolved"), ("CLOSED", "Closed")], default="OPEN", max_length=20)),
                ("priority", models.CharField(default="STANDARD", max_length=20)),
                ("attachment", models.FileField(blank=True, null=True, upload_to="private_support/tickets/%Y/%m/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("assigned_to", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="assigned_support_tickets", to=settings.AUTH_USER_MODEL)),
                ("company", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="support_tickets", to="companies.company")),
                ("submitted_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="support_tickets", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("-updated_at",)},
        ),
        migrations.CreateModel(
            name="SupportMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("message", models.TextField()),
                ("attachment", models.FileField(blank=True, null=True, upload_to="private_support/messages/%Y/%m/")),
                ("is_staff_reply", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("sender", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="support_messages", to=settings.AUTH_USER_MODEL)),
                ("ticket", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="messages", to="subscriptions.supportticket")),
            ],
            options={"ordering": ("created_at",)},
        ),
        migrations.RunPython(seed_plans_and_features, reverse_seed),
    ]
