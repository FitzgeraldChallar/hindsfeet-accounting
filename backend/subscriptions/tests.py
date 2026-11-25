from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory, APIClient, force_authenticate
from types import SimpleNamespace

from companies.models import Company, CompanyMembership
from .models import Feature, Plan, PlanFeature, Subscription
from .permissions import FeatureEntitlementPermission


class SubscriptionEntitlementTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="org-owner",
            email="owner@example.com",
            password="StrongTestPassword123!",
            role="OWNER",
        )
        self.company = Company.objects.create(
            name="Example Organization",
            created_by=self.user,
        )
        CompanyMembership.objects.create(
            user=self.user,
            company=self.company,
            role=CompanyMembership.Role.OWNER,
        )
        self.plan = Plan.objects.get(code=Plan.Code.PLUS)
        self.feature, _ = Feature.objects.get_or_create(
            key="payroll",
            defaults={"name": "Payroll"},
        )
        PlanFeature.objects.update_or_create(
            plan=self.plan,
            feature=self.feature,
            defaults={"enabled": True},
        )
        self.subscription = Subscription.objects.get(company=self.company)
        self.subscription.plan = self.plan
        self.subscription.status = Subscription.Status.ACTIVE
        self.subscription.starts_at = timezone.now() - timedelta(days=1)
        self.subscription.ends_at = timezone.now() + timedelta(days=30)
        self.subscription.save()

    def test_active_subscription_grants_enabled_feature(self):
        self.assertTrue(self.subscription.has_feature("payroll"))

    def test_disabled_or_unknown_feature_is_denied(self):
        self.assertFalse(self.subscription.has_feature("unlisted_future_feature"))
        PlanFeature.objects.filter(
            plan=self.plan,
            feature=self.feature,
        ).update(enabled=False)
        self.assertFalse(self.subscription.has_feature("payroll"))

    def test_pending_subscription_does_not_grant_features(self):
        self.subscription.status = Subscription.Status.PENDING
        self.subscription.save(update_fields=("status",))
        self.assertFalse(self.subscription.has_feature("payroll"))

    def test_expired_subscription_does_not_grant_features(self):
        self.subscription.ends_at = timezone.now() - timedelta(days=1)
        self.subscription.save(update_fields=("ends_at",))
        self.assertFalse(self.subscription.has_feature("payroll"))
        self.assertFalse(self.subscription.is_currently_active)

    def test_grace_period_keeps_access_until_grace_expires(self):
        self.subscription.ends_at = timezone.now() - timedelta(days=1)
        self.subscription.grace_until = timezone.now() + timedelta(days=2)
        self.subscription.save(update_fields=("ends_at", "grace_until"))
        self.assertTrue(self.subscription.has_feature("payroll"))


class FeaturePermissionTests(SubscriptionEntitlementTests):
    def setUp(self):
        super().setUp()
        self.factory = APIRequestFactory()
        self.permission = FeatureEntitlementPermission()
        self.view = SimpleNamespace(required_feature="payroll", kwargs={})

    def test_member_with_active_plan_is_allowed(self):
        raw_request = self.factory.get(
            "/api/payroll/employees/",
            {"company": self.company.pk},
        )
        force_authenticate(raw_request, user=self.user)
        request = Request(raw_request)
        self.assertTrue(self.permission.has_permission(request, self.view))

    def test_global_owner_role_does_not_bypass_other_company_membership(self):
        other_company = Company.objects.create(name="Other Organization")
        raw_request = self.factory.get(
            "/api/payroll/employees/",
            {"company": other_company.pk},
        )
        force_authenticate(raw_request, user=self.user)
        request = Request(raw_request)
        with self.assertRaises(PermissionDenied):
            self.permission.has_permission(request, self.view)

    def test_plus_cannot_access_complete_only_lra_automation(self):
        self.view.required_feature = "lra_tax_automation"
        raw_request = self.factory.get(
            "/api/payroll/tax-bands/",
            {"company": self.company.pk},
        )
        force_authenticate(raw_request, user=self.user)
        request = Request(raw_request)
        with self.assertRaises(PermissionDenied):
            self.permission.has_permission(request, self.view)

    def test_complete_can_access_lra_automation(self):
        self.subscription.plan = Plan.objects.get(code=Plan.Code.COMPLETE)
        self.subscription.save(update_fields=("plan",))
        self.view.required_feature = "lra_tax_automation"
        raw_request = self.factory.get(
            "/api/payroll/tax-bands/",
            {"company": self.company.pk},
        )
        force_authenticate(raw_request, user=self.user)
        request = Request(raw_request)
        self.assertTrue(self.permission.has_permission(request, self.view))


class CompanyTeamManagementTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(
            username="team-owner",
            email="team-owner@example.com",
            password="StrongTestPassword123!",
            role="OWNER",
        )
        self.company = Company.objects.create(
            name="Team Test Organization",
            created_by=self.owner,
        )
        CompanyMembership.objects.create(
            user=self.owner,
            company=self.company,
            role=CompanyMembership.Role.OWNER,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_owner_can_create_an_organization_member(self):
        response = self.client.post(
            f"/api/companies/{self.company.pk}/members/",
            {
                "username": "team-accountant",
                "email": "accountant@example.com",
                "first_name": "Team",
                "last_name": "Accountant",
                "password": "StrongTeamPassword123!",
                "role": "ACCOUNTANT",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["role"], "ACCOUNTANT")
        self.assertTrue(
            CompanyMembership.objects.filter(
                company=self.company,
                user__username="team-accountant",
                role=CompanyMembership.Role.ACCOUNTANT,
                is_active=True,
            ).exists()
        )

    def test_global_owner_role_does_not_allow_roster_access_without_membership(self):
        User = get_user_model()
        unrelated_user = User.objects.create_user(
            username="unrelated-owner",
            password="StrongTestPassword123!",
            role="OWNER",
        )
        self.client.force_authenticate(user=unrelated_user)

        response = self.client.get(
            f"/api/companies/{self.company.pk}/members/"
        )

        self.assertEqual(response.status_code, 403)

    def test_last_owner_cannot_be_demoted_and_deactivated_in_one_request(self):
        membership = CompanyMembership.objects.get(
            company=self.company,
            user=self.owner,
        )
        response = self.client.patch(
            f"/api/companies/{self.company.pk}/members/{membership.pk}/",
            {"role": "ACCOUNTANT", "is_active": False},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        membership.refresh_from_db()
        self.assertEqual(membership.role, CompanyMembership.Role.OWNER)
        self.assertTrue(membership.is_active)


class SupportTicketTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="support-customer",
            email="customer@example.com",
            password="StrongSupportPassword123!",
        )
        self.company = Company.objects.create(
            name="Support Test Organization",
            created_by=self.user,
            email="finance@example.com",
        )
        CompanyMembership.objects.create(
            user=self.user,
            company=self.company,
            role=CompanyMembership.Role.OWNER,
        )
        self.subscription = Subscription.objects.get(company=self.company)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _create_ticket(self, subject):
        return self.client.post(
            "/api/subscriptions/support/tickets/",
            {
                "company": self.company.pk,
                "subject": subject,
                "category": "TECHNICAL",
                "description": "Please help us resolve this issue.",
            },
            format="json",
        )

    def test_essential_support_ticket_gets_standard_priority(self):
        response = self._create_ticket("Essential support request")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["priority"], "STANDARD")
        self.assertEqual(len(response.data["messages"]), 1)

    def test_plus_support_ticket_gets_priority_support(self):
        self.subscription.plan = Plan.objects.get(code=Plan.Code.PLUS)
        self.subscription.save(update_fields=("plan",))
        response = self._create_ticket("Plus support request")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["priority"], "PRIORITY")
