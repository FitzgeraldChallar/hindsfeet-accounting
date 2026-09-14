from django.contrib import admin

from .models import Account, JournalEntry, JournalLine


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "company",
        "account_type",
        "is_active",
        "is_system_account",
    )

    list_filter = (
        "company",
        "account_type",
        "is_active",
        "is_system_account",
    )

    search_fields = (
        "code",
        "name",
        "company__name",
    )


class JournalLineInline(admin.TabularInline):
    model = JournalLine
    extra = 0


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "company",
        "transaction_date",
        "status",
        "created_by",
        "posted_by",
    )

    list_filter = (
        "company",
        "status",
        "transaction_date",
    )

    search_fields = (
        "reference",
        "description",
        "company__name",
    )

    inlines = [
        JournalLineInline,
    ]


@admin.register(JournalLine)
class JournalLineAdmin(admin.ModelAdmin):
    list_display = (
        "journal_entry",
        "account",
        "debit",
        "credit",
    )

    list_filter = (
        "account",
        "journal_entry__company",
    )

    search_fields = (
        "journal_entry__reference",
        "account__name",
        "account__code",
    )