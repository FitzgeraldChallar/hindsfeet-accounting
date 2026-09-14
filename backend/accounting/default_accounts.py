from .models import Account


DEFAULT_ACCOUNTS = [
    {
        "code": "1000",
        "name": "Cash",
        "account_type": Account.AccountType.ASSET,
    },
    {
        "code": "1010",
        "name": "Bank",
        "account_type": Account.AccountType.ASSET,
    },
    {
        "code": "1100",
        "name": "Accounts Receivable",
        "account_type": Account.AccountType.ASSET,
    },
    {
        "code": "1200",
        "name": "Inventory",
        "account_type": Account.AccountType.ASSET,
    },
    {
        "code": "1300",
        "name": "Prepaid Expenses",
        "account_type": Account.AccountType.ASSET,
    },
    {
        "code": "1500",
        "name": "Property, Plant & Equipment",
        "account_type": Account.AccountType.ASSET,
    },
    {
        "code": "2000",
        "name": "Accounts Payable",
        "account_type": Account.AccountType.LIABILITY,
    },
    {
        "code": "2100",
        "name": "Accrued Expenses",
        "account_type": Account.AccountType.LIABILITY,
    },
    {
        "code": "2200",
        "name": "Taxes Payable",
        "account_type": Account.AccountType.LIABILITY,
    },
    {
        "code": "2300",
        "name": "Payroll Liabilities",
        "account_type": Account.AccountType.LIABILITY,
    },
    {
        "code": "3000",
        "name": "Owner's Capital",
        "account_type": Account.AccountType.EQUITY,
    },
    {
        "code": "3100",
        "name": "Retained Earnings",
        "account_type": Account.AccountType.EQUITY,
    },
    {
        "code": "4000",
        "name": "Sales Revenue",
        "account_type": Account.AccountType.REVENUE,
    },
    {
        "code": "4100",
        "name": "Service Revenue",
        "account_type": Account.AccountType.REVENUE,
    },
    {
        "code": "5000",
        "name": "Cost of Goods Sold",
        "account_type": Account.AccountType.COGS,
    },
    {
        "code": "6000",
        "name": "Salaries & Wages",
        "account_type": Account.AccountType.EXPENSE,
    },
    {
        "code": "6100",
        "name": "Rent Expense",
        "account_type": Account.AccountType.EXPENSE,
    },
    {
        "code": "6200",
        "name": "Utilities Expense",
        "account_type": Account.AccountType.EXPENSE,
    },
    {
        "code": "6300",
        "name": "Transportation Expense",
        "account_type": Account.AccountType.EXPENSE,
    },
    {
        "code": "6400",
        "name": "Office Expense",
        "account_type": Account.AccountType.EXPENSE,
    },
    {
        "code": "6500",
        "name": "Bank Charges",
        "account_type": Account.AccountType.EXPENSE,
    },
    {
        "code": "6600",
        "name": "Depreciation Expense",
        "account_type": Account.AccountType.EXPENSE,
    },
]


def create_default_accounts(company):
    accounts = []

    for data in DEFAULT_ACCOUNTS:
        account, _ = Account.objects.get_or_create(
            company=company,
            code=data["code"],
            defaults={
                "name": data["name"],
                "account_type": data["account_type"],
                "is_system_account": True,
            },
        )

        accounts.append(account)

    return accounts