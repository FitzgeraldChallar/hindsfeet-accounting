# Hindsfeet subscriptions, team access and email support

This implementation adds organization-level subscriptions, backend feature
authorization, team membership management and an in-app email-support workflow.
AI analytics is intentionally not included.

## Organization and user model

- One `Company` is one subscribing organization/tenant.
- One `Subscription` belongs to one `Company` (one-to-one).
- Multiple users can belong to the same Company through `CompanyMembership`.
- Each membership has its own organization role: Owner, Administrator,
  Accountant, Manager or Payroll Officer.
- Every member inherits the Company's subscription entitlements. Their role
  still controls organization-level management actions.
- This implementation does not place multiple legal Company profiles under
  one subscription. Each Company is a separate subscribing organization.

## Plan entitlements seeded by migration

| Feature | Essential | Plus | Complete |
|---|---:|---:|---:|
| Core accounting | Yes | Yes | Yes |
| Sales, invoicing, customer records and receipts | Yes | Yes | Yes |
| Purchases, suppliers and expenses | Yes | Yes | Yes |
| Banking | Yes | Yes | Yes |
| Standard financial reports | Yes | Yes | Yes |
| USD and LRD transactions | Yes | Yes | Yes |
| Multiple organization users | Yes | Yes | Yes |
| Email support | Standard | Priority | Enhanced |
| Accounts receivable | — | Yes | Yes |
| Accounts payable tools | — | Yes | Yes |
| Inventory management | — | Yes | Yes |
| Payroll management | — | Yes | Yes |
| Expanded management reports | — | Yes | Yes |
| LRA payroll tax-table automation | — | — | Yes |
| Gas operations | — | — | Yes |

AI analytics is not seeded or enabled.

Advanced BI and multi-department management are reserved Complete-plan feature
keys, but are globally inactive because their dedicated product workflows are
not implemented in this source version. They are not shown as enabled to
customers. Enable them only after those modules are built and tested.

## Subscription activation

New organizations are created with a PENDING Essential subscription. They
cannot use subscription-controlled modules until Hindsfeet activates the
subscription.

1. A customer pays Hindsfeet manually.
2. Hindsfeet verifies the payment.
3. In Django Admin, open **Subscriptions → Subscriptions**.
4. Select the organization and assign Essential, Plus or Complete.
5. Record payment amount, date, method and reference.
6. Set the start and expiry date.
7. Set status to ACTIVE and save, or use the activation action.
8. The activation action requires an expiry date.

Plan changes and status changes are recorded in Subscription History.
Downgrades revoke access to higher-tier functionality without deleting the
organization's financial records.

### Existing organizations

The initial data migration preserves existing customers by assigning them
Essential/ACTIVE with no expiry date. It also creates an Owner membership for
a company's recorded creator if that membership is missing. This avoids
unexpectedly locking out organization creators during deployment. Other
users must have explicit active CompanyMembership records; a global user
role no longer grants access across unrelated organizations. Hindsfeet must
review those subscriptions in Django Admin and update each organization to
its actual paid plan and term.

## Backend feature enforcement

`FeatureEntitlementPermission` is attached to subscription-controlled DRF
views. It verifies:

1. The request identifies a Company.
2. The authenticated user has an active membership in that Company.
3. The Company has an active, in-term subscription.
4. The subscription's plan enables the requested feature.

The frontend also filters navigation and protects direct routes, but frontend
visibility is not treated as security. Restricted API calls return HTTP 403.

The existing global OWNER/ADMIN role is no longer treated as permission to
access every Company. Company membership is the tenant boundary; only Django
superusers bypass that membership check.

LRA tax-table automation is also checked inside the payroll calculation
service. Plus customers can use payroll and enter tax deductions manually;
automatic LRA PAYE tax-table calculations are available only to Complete.

## Customer-facing pages and APIs

- `/subscription` — current plan, status, dates and enabled features.
- `/team` — view organization users; Owners and Administrators can add users,
  change roles and deactivate/reactivate memberships.
- `/support` — submit tickets, attach a file, view replies and respond.

API routes:

- `GET /api/subscriptions/current/?company=<company_id>`
- `GET|POST /api/subscriptions/support/tickets/`
- `GET /api/subscriptions/support/tickets/<ticket_id>/`
- `POST /api/subscriptions/support/tickets/<ticket_id>/replies/`
- `GET|POST /api/companies/<company_id>/members/`
- `PATCH /api/companies/<company_id>/members/<membership_id>/`

Support ticket priority is assigned from the organization's plan:
Essential = Standard, Plus = Priority, Complete = Enhanced.

Support attachments are stored under `private_support/` and are returned
through authenticated, organization-scoped download endpoints. In production,
ensure the media/object-storage bucket does not expose this directory through
public URLs; the API deliberately does not return public attachment URLs.

## Email configuration

Local development defaults to Django's console email backend. Configure SMTP
environment variables in the backend environment for actual delivery:

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-smtp-username
EMAIL_HOST_PASSWORD=your-smtp-password
EMAIL_USE_TLS=true
EMAIL_USE_SSL=false
DEFAULT_FROM_EMAIL=Hindsfeet Support <support@your-domain.com>
SUPPORT_NOTIFICATION_EMAIL=support@your-domain.com
```

Use a real mailbox and SMTP credentials controlled by Hindsfeet. Do not commit
the real `.env` file or credentials to source control.

For production, also set `DJANGO_DEBUG=false`, provide a strong
`DJANGO_SECRET_KEY`, set `DJANGO_ALLOWED_HOSTS` to the backend hostnames,
set `CORS_ALLOW_ALL_ORIGINS=false`, and provide the exact frontend origins in
`CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`. The backend now refuses to
start in non-debug mode without `DJANGO_SECRET_KEY`.

## Deployment

From the backend directory:

```bash
python manage.py migrate
python manage.py check
python manage.py test
```

No new Python package is required for the subscription or support modules.
After deploying, configure SMTP variables and review all legacy subscriptions
in Django Admin.

The frontend source has been updated. Reinstall its locked dependencies and
create a fresh production build using the existing package scripts before
deploying it. Do not deploy the old `dist` folder from the original archive.

## Important rollout checks

- Verify every current organization has the intended plan and expiry.
- Activate a test Essential, Plus and Complete organization separately.
- Test restricted endpoints directly, not only by hiding navigation.
- Test two users from different organizations to confirm cross-tenant access
  is denied.
- Test team roles and the last-owner safeguard.
- Test support email delivery using the production SMTP provider.
- Confirm that USD and LRD workspaces remain available on every tier.
