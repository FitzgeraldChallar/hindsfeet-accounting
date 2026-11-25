from rest_framework import serializers

from .models import Subscription, SupportTicket, SupportMessage


class SubscriptionSerializer(serializers.ModelSerializer):
    plan_code = serializers.CharField(source="plan.code", read_only=True)
    plan_name = serializers.CharField(source="plan.name", read_only=True)
    monthly_price = serializers.DecimalField(
        source="plan.monthly_price", max_digits=10, decimal_places=2, read_only=True
    )
    features = serializers.SerializerMethodField()
    is_currently_active = serializers.BooleanField(read_only=True)
    access_status = serializers.SerializerMethodField()

    class Meta:
        model = Subscription
        fields = (
            "id", "company", "plan_code", "plan_name", "monthly_price",
            "status", "starts_at", "ends_at", "grace_until",
            "payment_date", "payment_method", "payment_reference",
            "is_currently_active", "access_status", "features", "created_at", "updated_at",
        )
        read_only_fields = fields

    def get_access_status(self, obj):
        if obj.status == Subscription.Status.ACTIVE and not obj.is_currently_active:
            return "EXPIRED"
        return obj.status

    def get_features(self, obj):
        return {
            assignment.feature.key: bool(assignment.enabled and assignment.feature.is_active)
            for assignment in obj.plan.feature_assignments.select_related("feature").all()
        }


class SupportMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    attachment = serializers.FileField(required=False, allow_null=True, write_only=True)
    has_attachment = serializers.SerializerMethodField()

    class Meta:
        model = SupportMessage
        fields = ("id", "sender", "sender_name", "message", "attachment", "has_attachment", "is_staff_reply", "created_at")
        read_only_fields = ("id", "sender", "sender_name", "has_attachment", "is_staff_reply", "created_at")

    def get_has_attachment(self, obj):
        return bool(obj.attachment)

    def validate_attachment(self, value):
        if value and value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("Attachments must be 10 MB or smaller.")
        if value and value.content_type not in {
            "image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"
        }:
            raise serializers.ValidationError("Only PNG, JPG, WebP, PDF and TXT files are allowed.")
        return value

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.username


class SupportTicketSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.SerializerMethodField()
    messages = SupportMessageSerializer(many=True, read_only=True)
    attachment = serializers.FileField(required=False, allow_null=True, write_only=True)
    has_attachment = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = (
            "id", "company", "submitted_by", "submitted_by_name",
            "subject", "category", "description", "status", "priority",
            "attachment", "has_attachment", "messages", "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "submitted_by", "submitted_by_name", "status", "priority",
            "has_attachment", "messages", "created_at", "updated_at",
        )

    def get_has_attachment(self, obj):
        return bool(obj.attachment)

    def validate_attachment(self, value):
        if value and value.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("Attachments must be 10 MB or smaller.")
        if value and value.content_type not in {
            "image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"
        }:
            raise serializers.ValidationError("Only PNG, JPG, WebP, PDF and TXT files are allowed.")
        return value

    def get_submitted_by_name(self, obj):
        return obj.submitted_by.get_full_name() or obj.submitted_by.username

    def validate_company(self, company):
        user = self.context["request"].user
        from companies.models import CompanyMembership
        if not CompanyMembership.objects.filter(
            user=user, company=company, is_active=True
        ).exists() and not user.is_superuser:
            raise serializers.ValidationError("You do not belong to this organization.")
        return company
