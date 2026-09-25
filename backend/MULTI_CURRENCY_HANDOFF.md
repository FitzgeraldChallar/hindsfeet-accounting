# Hindsfeet Accounting — Final Backend Handoff

This backend is prepared as the backend handoff for the Hindsfeet multi-currency architecture.

## Target architecture

One legal company can have both USD and LRD workspaces:

- Shared master data: customers, suppliers, products, employees, etc.
- Currency-specific financial activity: accounts, journals, sales, inventory transaction snapshots, bank accounts/transactions, invoices/bills, payments, payroll periods/records.
- Historical exchange rates are snapshotted on financial transactions and are not recalculated from today's rate.
- Functional/company currency remains the accounting base currency; workspace currency controls the currency of new operational transactions.

## Included

- Company currency/workspace configuration and historical exchange-rate APIs.
- Currency-specific chart of accounts.
- Currency-aware journal entries and journal lines with functional-currency snapshots.
- Currency-aware accounting reports: ledger, trial balance, income statement, balance sheet, cash flow.
- USD/LRD bank accounts and transactions.
- Same-currency and cross-currency bank transfers.
- Currency-aware sales and product prices.
- Currency-aware inventory transaction snapshots.
- USD/LRD gas-station pump sales.
- Currency-aware customer invoices and supplier bills.
- Cross-currency AR/AP payments with historical-rate settlement and FX gain/loss.
- Currency-aware payroll periods/records and existing payroll workflow.
- Professional individual and bulk portrait-A4 payslips with company branding.
- Company logo API and company-branded PDF support.
- Company-scoped permanent deletion endpoint for test cleanup.

## Migration

The required migrations are already included. After replacing your backend folder:

```bash
python manage.py migrate
```

Do **not** run `makemigrations` first unless you intentionally change the models yourself.

If you have a virtual environment, activate it before running the command.

## Exchange-rate setup

For a company whose functional currency is LRD, for example:

- USD -> LRD: `200.000000`

means:

- `1 USD = 200 LRD`

The rate is selected by transaction date. Older transactions retain their stored rate.

## Important behavior

A USD transaction and an LRD transaction use separate currency-specific ledger accounts. A cross-currency payment/transfer creates a functional-currency-balanced journal while preserving the source/destination transaction currencies and historical rates. The accounting engine also adds native-currency clearing lines to cross-currency journals so each currency-specific trial balance and balance sheet remains independently balanced. These synthetic clearing lines have zero functional value and are excluded from functional-basis reporting.

## Validation performed in this environment

All Python source files compile successfully with `compileall`.

A full Django `manage.py check` could not be executed in this environment because Django is not installed here and the environment cannot reach PyPI. The backend source and migrations are therefore handed off for validation in the project's existing virtual environment.
