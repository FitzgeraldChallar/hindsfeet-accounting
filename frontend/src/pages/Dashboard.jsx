import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  CircleDollarSign,
  CreditCard,
  FileText,
  Landmark,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "../services/api";
import { useCompany } from "../context/CompanyContext";


function money(value, currency = "USD") {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}


function number(value) {
  return Number(value || 0);
}


function currencyCode(value) {
  return String(value || "").trim().toUpperCase();
}


function getLineCurrency(line, entry) {
  return currencyCode(
    line?.currency ||
      entry?.currency ||
      ""
  );
}


function accountTypeFromCode(code) {
  const firstDigit = String(code || "").trim().charAt(0);

  if (firstDigit === "1") return "ASSET";
  if (firstDigit === "2") return "LIABILITY";
  if (firstDigit === "3") return "EQUITY";
  if (firstDigit === "4") return "REVENUE";
  if (firstDigit === "5") return "COGS";
  if (firstDigit === "6") return "EXPENSE";

  return "";
}


function lineAmount(line, side) {
  return number(line?.[side]);
}


function extractList(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}


function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}


function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  positive,
}) {
  return (
    <div className="dashboard-stat-card">

      <div className="dashboard-stat-top">

        <div className="dashboard-stat-icon">
          <Icon size={19} />
        </div>

        {trend !== undefined && (
          <div
            className={`dashboard-stat-trend ${
              positive
                ? "dashboard-stat-trend-positive"
                : "dashboard-stat-trend-negative"
            }`}
          >
            {positive ? (
              <ArrowUpRight size={13} />
            ) : (
              <ArrowDownRight size={13} />
            )}

            {trend}
          </div>
        )}

      </div>


      <div className="dashboard-stat-title">
        {title}
      </div>


      <div className="dashboard-stat-value">
        {value}
      </div>


      {subtitle && (
        <div className="dashboard-stat-subtitle">
          {subtitle}
        </div>
      )}


      {trendLabel && (
        <div className="dashboard-stat-trend-label">
          {trendLabel}
        </div>
      )}

    </div>
  );
}


function SectionCard({
  title,
  subtitle,
  icon: Icon,
  children,
  action,
}) {
  return (
    <section className="dashboard-section-card">

      <div className="dashboard-section-header">

        <div className="dashboard-section-heading">

          {Icon && (
            <div className="dashboard-section-icon">
              <Icon size={17} />
            </div>
          )}

          <div>
            <h2>{title}</h2>

            {subtitle && (
              <p>{subtitle}</p>
            )}
          </div>

        </div>

        {action}

      </div>


      <div className="dashboard-section-body">
        {children}
      </div>

    </section>
  );
}


function EmptyState({
  message = "No data available for this period.",
}) {
  return (
    <div className="dashboard-empty-state">
      <BarChart3 size={24} />
      <span>{message}</span>
    </div>
  );
}


function currentEntriesCashChange(
  entries,
  selectedCurrency,
  accountMap
) {
  return entries.reduce(
    (total, entry) =>
      total +
      (entry?.lines || [])
        .filter(
          (line) =>
            getLineCurrency(
              line,
              entry
            ) === selectedCurrency &&
            String(
              line?.account_code ||
                accountMap.get(
                  String(
                    line?.account
                  )
                )?.code ||
                ""
            ).startsWith("10")
        )
        .reduce(
          (sum, line) =>
            sum +
            lineAmount(
              line,
              "debit"
            ) -
            lineAmount(
              line,
              "credit"
            ),
          0
        ),
    0
  );
}


function getCashComposition(
  entries,
  selectedCurrency,
  accountMap
) {
  const result = {
    OPERATING: 0,
    INVESTING: 0,
    FINANCING: 0,
  };

  entries.forEach(
    (entry) => {
      const lines =
        (entry?.lines || []).filter(
          (line) =>
            getLineCurrency(
              line,
              entry
            ) === selectedCurrency
        );

      const cashLines =
        lines.filter(
          (line) =>
            String(
              line?.account_code ||
                accountMap.get(
                  String(
                    line?.account
                  )
                )?.code ||
                ""
            ).startsWith("10")
        );

      cashLines.forEach(
        (cashLine) => {
          const movement =
            lineAmount(
              cashLine,
              "debit"
            ) -
            lineAmount(
              cashLine,
              "credit"
            );

          const counterpart =
            lines.find(
              (line) =>
                String(
                  line?.id
                ) !==
                String(
                  cashLine?.id
                )
            );

          const account =
            accountMap.get(
              String(
                counterpart?.account
              )
            );

          let category =
            String(
              account?.cash_flow_category ||
                ""
            ).toUpperCase();

          if (
            ![
              "OPERATING",
              "INVESTING",
              "FINANCING",
            ].includes(category)
          ) {
            const type =
              account?.account_type ||
              accountTypeFromCode(
                counterpart?.account_code
              );

            if (
              [
                "REVENUE",
                "COGS",
                "EXPENSE",
                "LIABILITY",
              ].includes(type)
            ) {
              category =
                "OPERATING";
            } else if (
              type === "EQUITY"
            ) {
              category =
                "FINANCING";
            } else {
              category =
                "INVESTING";
            }
          }

          result[category] +=
            movement;
        }
      );
    }
  );

  return result;
}


export default function Dashboard() {

  const {
    currentCompany,
    workspaceCurrency,
  } = useCompany();


  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState(null);


  const [financialData, setFinancialData] =
    useState({
      incomeStatement: null,
      balanceSheet: null,
      trialBalance: null,
      cashFlow: null,
    });


  const [invoices, setInvoices] =
    useState([]);

  const [bills, setBills] =
    useState([]);

  const [journalEntries, setJournalEntries] =
    useState([]);

  const [accounts, setAccounts] =
    useState([]);


  const [dateRange, setDateRange] =
    useState("all");


  const companyId =
    currentCompany?.id;


  // ==========================================================
  // DATE RANGE
  // ==========================================================

  const dates = useMemo(() => {

    const end = new Date();

    let start = null;

    if (dateRange === "month") {
      start = new Date(
        end.getFullYear(),
        end.getMonth(),
        1
      );
    }

    if (dateRange === "quarter") {

      const quarterStartMonth =
        Math.floor(
          end.getMonth() / 3
        ) * 3;

      start = new Date(
        end.getFullYear(),
        quarterStartMonth,
        1
      );
    }

    if (dateRange === "year") {
      start = new Date(
        end.getFullYear(),
        0,
        1
      );
    }

    const toApiDate = (date) => {
      if (!date) {
        return null;
      }

      return date
        .toISOString()
        .split("T")[0];
    };

    return {
      startDate: toApiDate(start),
      endDate: toApiDate(end),
    };

  }, [dateRange]);


  // ==========================================================
  // LOAD DASHBOARD
  // ==========================================================

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (!companyId) {
        setLoading(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const companyQuery =
        `?company=${companyId}`;

      try {
        const [
          journalData,
          accountData,
          invoiceData,
          billData,
        ] = await Promise.all([
          api.get(
            `/api/accounting/journal-entries/${companyQuery}`
          ),
          api.get(
            `/api/accounting/accounts/${companyQuery}`
          ).catch(() => null),
          api.get(
            `/api/invoicing/invoices/${companyQuery}`
          ).catch(() => null),
          api.get(
            `/api/invoicing/supplier-bills/${companyQuery}`
          ).catch(() => null),
        ]);

        const journalList =
          extractList(journalData);

        const accountList =
          extractList(accountData);

        const invoiceList =
          extractList(invoiceData);

        const billList =
          extractList(billData);

        const selectedCurrency =
          currencyCode(
            workspaceCurrency ||
              currentCompany?.currency ||
              "USD"
          );

        /*
         * Workspace isolation:
         * Financial dashboard totals must be calculated from transactions
         * recorded in the active workspace currency only.
         *
         * USD workspace -> USD invoices/bills.
         * LRD workspace -> LRD invoices/bills.
         *
         * We intentionally do NOT convert one currency into another here.
         * The dashboard is a transaction-currency view; functional-currency
         * reporting belongs to accounting reports that explicitly request it.
         */
        const currencyInvoices =
          invoiceList.filter(
            (invoice) =>
              currencyCode(
                invoice?.currency ||
                  invoice?.invoice_currency ||
                  ""
              ) === selectedCurrency
          );

        const currencyBills =
          billList.filter(
            (bill) =>
              currencyCode(
                bill?.currency ||
                  bill?.bill_currency ||
                  ""
              ) === selectedCurrency
          );

        setJournalEntries(journalList);
        setAccounts(accountList);
        setInvoices(currencyInvoices);
        setBills(currencyBills);

        const accountMap = new Map(
          accountList.map(
            (account) => [
              String(account.id),
              account,
            ]
          )
        );

        const postedEntries =
          journalList.filter(
            (entry) =>
              String(
                entry?.status || ""
              ).toUpperCase() === "POSTED"
          );

        /*
         * Keep entries intact here because a legitimate cross-currency
         * journal entry can contain lines in different currencies.
         * currencyLines() below is therefore the authoritative workspace
         * filter for accounting values.
         */
        const currencyLines = (
          entry
        ) =>
          (entry?.lines || []).filter(
            (line) =>
              getLineCurrency(
                line,
                entry
              ) === selectedCurrency
          );

        const periodEntries =
          postedEntries.filter(
            (entry) => {
              const date =
                String(
                  entry?.transaction_date || ""
                );

              return (
                (!dates.startDate ||
                  date >= dates.startDate) &&
                (!dates.endDate ||
                  date <= dates.endDate)
              );
            }
          );

        const asOfEntries =
          postedEntries.filter(
            (entry) => {
              const date =
                String(
                  entry?.transaction_date || ""
                );

              return (
                !dates.endDate ||
                date <= dates.endDate
              );
            }
          );

        const beforePeriodEntries =
          dates.startDate
            ? postedEntries.filter(
                (entry) =>
                  String(
                    entry?.transaction_date || ""
                  ) < dates.startDate
              )
            : [];

        const aggregateAccounts = (
          entries
        ) => {
          const map = new Map();

          entries.forEach(
            (entry) => {
              currencyLines(entry).forEach(
                (line) => {
                  const id = String(
                    line?.account
                  );

                  const account =
                    accountMap.get(id);

                  const code =
                    line?.account_code ||
                    account?.code ||
                    "";

                  const type =
                    account?.account_type ||
                    accountTypeFromCode(
                      code
                    );

                  if (!map.has(id)) {
                    map.set(id, {
                      account:
                        line?.account,
                      account_code: code,
                      account_name:
                        line?.account_name ||
                        account?.name ||
                        "Account",
                      account_type: type,
                      cash_flow_category:
                        account?.cash_flow_category ||
                        "NONE",
                      debit: 0,
                      credit: 0,
                    });
                  }

                  const row =
                    map.get(id);

                  row.debit +=
                    lineAmount(
                      line,
                      "debit"
                    );

                  row.credit +=
                    lineAmount(
                      line,
                      "credit"
                    );
                }
              );
            }
          );

          return Array.from(
            map.values()
          );
        };

        const periodAccounts =
          aggregateAccounts(
            periodEntries
          );

        const asOfAccounts =
          aggregateAccounts(
            asOfEntries
          );

        const beforePeriodAccounts =
          aggregateAccounts(
            beforePeriodEntries
          );

        const sumType = (
          rows,
          type,
          normalBalance
        ) =>
          rows
            .filter(
              (row) =>
                row.account_type === type
            )
            .reduce(
              (total, row) =>
                total +
                (normalBalance ===
                "DEBIT"
                  ? row.debit -
                    row.credit
                  : row.credit -
                    row.debit),
              0
            );

        const revenue =
          sumType(
            periodAccounts,
            "REVENUE",
            "CREDIT"
          );

        const cogs =
          sumType(
            periodAccounts,
            "COGS",
            "DEBIT"
          );

        const expenses =
          sumType(
            periodAccounts,
            "EXPENSE",
            "DEBIT"
          );

        const grossProfit =
          revenue - cogs;

        const netProfit =
          grossProfit - expenses;

        const assets =
          sumType(
            asOfAccounts,
            "ASSET",
            "DEBIT"
          );

        const liabilities =
          sumType(
            asOfAccounts,
            "LIABILITY",
            "CREDIT"
          );

        const equityAccounts =
          sumType(
            asOfAccounts,
            "EQUITY",
            "CREDIT"
          );

        const asOfRevenue =
          sumType(
            asOfAccounts,
            "REVENUE",
            "CREDIT"
          );

        const asOfCogs =
          sumType(
            asOfAccounts,
            "COGS",
            "DEBIT"
          );

        const asOfExpenses =
          sumType(
            asOfAccounts,
            "EXPENSE",
            "DEBIT"
          );

        const currentProfit =
          asOfRevenue -
          asOfCogs -
          asOfExpenses;

        const equityWithProfit =
          equityAccounts +
          currentProfit;

        const cashRows =
          asOfAccounts.filter(
            (row) =>
              row.account_type ===
                "ASSET" &&
              String(
                row.account_code || ""
              ).startsWith("10")
          );

        const closingCash =
          cashRows.reduce(
            (total, row) =>
              total +
              row.debit -
              row.credit,
            0
          );

        const openingCash =
          beforePeriodAccounts
            .filter(
              (row) =>
                row.account_type ===
                  "ASSET" &&
                String(
                  row.account_code || ""
                ).startsWith("10")
            )
            .reduce(
              (total, row) =>
                total +
                row.debit -
                row.credit,
              0
            );

        const netCashChange =
          currentEntriesCashChange(
            periodEntries,
            selectedCurrency,
            accountMap
          );

        const cashComposition =
          getCashComposition(
            periodEntries,
            selectedCurrency,
            accountMap
          );

        setFinancialData({
          incomeStatement: {
            total_revenue: revenue,
            total_cost_of_goods_sold:
              cogs,
            total_expenses:
              expenses,
            gross_profit:
              grossProfit,
            net_profit:
              netProfit,
            is_profitable:
              netProfit > 0,
          },
          balanceSheet: {
            total_assets:
              assets,
            total_liabilities:
              liabilities,
            total_equity_with_profit:
              equityWithProfit,
            is_balanced:
              Math.abs(
                assets -
                  (liabilities +
                    equityWithProfit)
              ) < 0.005,
          },
          trialBalance: {
            accounts:
              periodAccounts,
            is_balanced:
              Math.abs(
                periodAccounts.reduce(
                  (total, row) =>
                    total +
                    row.debit -
                    row.credit,
                  0
                )
              ) < 0.005,
          },
          cashFlow: {
            opening_cash_balance:
              openingCash,
            net_change_in_cash:
              netCashChange,
            closing_cash_balance:
              closingCash,
            total_operating_activities:
              cashComposition.OPERATING,
            total_investing_activities:
              cashComposition.INVESTING,
            total_financing_activities:
              cashComposition.FINANCING,
            is_reconciled:
              Math.abs(
                openingCash +
                  netCashChange -
                  closingCash
              ) < 0.005,
          },
        });
      } catch (err) {
        console.error(
          "Dashboard loading error:",
          err
        );

        setError(
          err.message ||
          "Unable to load dashboard data."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      companyId,
      currentCompany?.currency,
      workspaceCurrency,
      dates.startDate,
      dates.endDate,
    ]
  );


  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);


  // ==========================================================
  // FINANCIAL VALUES
  // ==========================================================

  const income =
    financialData.incomeStatement;


  const balance =
    financialData.balanceSheet;


  const cashFlow =
    financialData.cashFlow;


  const trialBalance =
    financialData.trialBalance;


  const currency = currencyCode(
    workspaceCurrency ||
      currentCompany?.currency ||
      "USD"
  );


  const revenue =
    number(income?.total_revenue);


  const cogs =
    number(
      income?.total_cost_of_goods_sold
    );


  const expenses =
    number(
      income?.total_expenses
    );


  const grossProfit =
    number(
      income?.gross_profit
    );


  const netProfit =
    number(
      income?.net_profit
    );


  const assets =
    number(balance?.total_assets);


  const liabilities =
    number(balance?.total_liabilities);


  const equity =
    number(
      balance?.total_equity_with_profit
    );


  const openingCash =
    number(
      cashFlow?.opening_cash_balance
    );


  const netCashChange =
    number(
      cashFlow?.net_change_in_cash
    );


  const closingCash =
    number(
      cashFlow?.closing_cash_balance
    );


  // ==========================================================
  // AR / AP SUMMARY
  // ==========================================================

  const receivableInvoices =
    invoices.filter((invoice) => {

      const status =
        String(
          invoice?.status || ""
        ).toUpperCase();

      return ![
        "PAID",
        "CANCELLED",
        "VOID",
      ].includes(status);

    });


  const payableBills =
    bills.filter((bill) => {

      const status =
        String(
          bill?.status || ""
        ).toUpperCase();

      return ![
        "PAID",
        "CANCELLED",
        "VOID",
      ].includes(status);

    });


  const receivables = receivableInvoices.reduce(
    (total, invoice) => {

      const invoiceCurrency =
        currencyCode(
          invoice?.currency ||
            invoice?.invoice_currency ||
            ""
        );

      if (invoiceCurrency !== currency) {
        return total;
      }

      return total +
        number(
          invoice.balance_due ??
          invoice.amount_due ??
          invoice.outstanding_amount ??
          invoice.total
        );

    },
    0
  );


  const payables = payableBills.reduce(
    (total, bill) => {

      const billCurrency =
        currencyCode(
          bill?.currency ||
            bill?.bill_currency ||
            ""
        );

      if (billCurrency !== currency) {
        return total;
      }

      return total +
        number(
          bill.balance_due ??
          bill.amount_due ??
          bill.outstanding_amount ??
          bill.total
        );

    },
    0
  );


  // ==========================================================
  // CHART DATA
  // ==========================================================

  const profitabilityData = [
    {
      name: "Revenue",
      amount: revenue,
    },
    {
      name: "COGS",
      amount: cogs,
    },
    {
      name: "Expenses",
      amount: expenses,
    },
    {
      name: "Net Profit",
      amount: netProfit,
    },
  ];


  const financialPositionData = [
    {
      name: "Assets",
      amount: assets,
    },
    {
      name: "Liabilities",
      amount: liabilities,
    },
    {
      name: "Equity",
      amount: equity,
    },
  ];


  const cashData = [
    {
      name: "Opening",
      amount: openingCash,
    },
    {
      name: "Net Change",
      amount: netCashChange,
    },
    {
      name: "Closing",
      amount: closingCash,
    },
  ];


  const cashCompositionData = [
    {
      name: "Operating",
      value: Math.abs(
        number(
          cashFlow?.total_operating_activities
        )
      ),
    },
    {
      name: "Investing",
      value: Math.abs(
        number(
          cashFlow?.total_investing_activities
        )
      ),
    },
    {
      name: "Financing",
      value: Math.abs(
        number(
          cashFlow?.total_financing_activities
        )
      ),
    },
  ].filter(
    (item) => item.value > 0
  );


  // ==========================================================
  // RECENT ACTIVITY
  // ==========================================================

  const recentTransactions = useMemo(() => {

    const transactions = [];

    const accounts =
      trialBalance?.accounts || [];


    accounts.forEach((account) => {

      if (
        number(account.debit) === 0 &&
        number(account.credit) === 0
      ) {
        return;
      }

      transactions.push({
        id: account.account,
        code: account.account_code,
        name: account.account_name,
        type: account.account_type,
        debit: number(account.debit),
        credit: number(account.credit),
      });

    });


    return transactions
      .sort(
        (a, b) =>
          (b.debit + b.credit) -
          (a.debit + a.credit)
      )
      .slice(0, 6);

  }, [trialBalance]);


  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    loading &&
    !financialData.incomeStatement
  ) {

    return (
      <div className="dashboard-loading">

        <div className="dashboard-loading-spinner" />

        <h2>
          Preparing your dashboard...
        </h2>

        <p>
          Loading financial information
          for{" "}
          {currentCompany?.name ||
            "your company"}.
        </p>

      </div>
    );

  }


  // ==========================================================
  // NO COMPANY
  // ==========================================================

  if (!companyId) {

    return (
      <div className="dashboard-no-company">

        <div className="dashboard-no-company-icon">
          <BriefcaseBusiness size={28} />
        </div>

        <h2>
          Select a company
        </h2>

        <p>
          Select a company from the
          top-right company selector to
          view its financial dashboard.
        </p>

      </div>
    );

  }


  // ==========================================================
  // ERROR
  // ==========================================================

  if (
    error &&
    !financialData.incomeStatement
  ) {

    return (
      <div className="dashboard-error">

        <div className="dashboard-error-icon">
          <Activity size={25} />
        </div>

        <h2>
          Unable to load dashboard
        </h2>

        <p>
          {error}
        </p>

        <button
          type="button"
          onClick={() =>
            loadDashboard(true)
          }
        >
          <RefreshCw size={16} />
          Try Again
        </button>

      </div>
    );

  }


  // ==========================================================
  // DASHBOARD
  // ==========================================================

  return (
    <div className="dashboard-page">

      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="dashboard-page-header">

        <div>

          <div className="dashboard-eyebrow">
            FINANCIAL OVERVIEW
          </div>

          <h1>
            Good to see you.
          </h1>

          <p>
            Here's how{" "}
            <strong>
              {currentCompany?.name}
            </strong>{" "}
            is performing in the{" "}
            <strong>{currency} workspace</strong>.
          </p>

        </div>


        <div className="dashboard-header-actions">

          <select
            value={dateRange}
            onChange={(event) =>
              setDateRange(
                event.target.value
              )
            }
            className="dashboard-period-select"
          >
            <option value="all">
              All time
            </option>

            <option value="month">
              This month
            </option>

            <option value="quarter">
              This quarter
            </option>

            <option value="year">
              This year
            </option>
          </select>


          <button
            type="button"
            className="dashboard-refresh-button"
            onClick={() =>
              loadDashboard(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "dashboard-spin"
                  : ""
              }
            />

            Refresh
          </button>

        </div>

      </div>


      {/* ======================================================
          ERROR NOTICE
          ====================================================== */}

      {error && (
        <div className="dashboard-inline-error">
          <Activity size={16} />
          {error}
        </div>
      )}


      {/* ======================================================
          PRIMARY KPI CARDS
          ====================================================== */}

      <div className="dashboard-stat-grid">

        <StatCard
          title="Total Revenue"
          value={money(
            revenue,
            currency
          )}
          subtitle="Recorded revenue"
          icon={TrendingUp}
          positive={true}
        />


        <StatCard
          title="Net Profit"
          value={money(
            netProfit,
            currency
          )}
          subtitle={
            income?.is_profitable
              ? "Business is profitable"
              : "Current net loss"
          }
          icon={
            netProfit >= 0
              ? CircleDollarSign
              : TrendingDown
          }
          positive={
            netProfit >= 0
          }
        />


        <StatCard
          title="Cash Position"
          value={money(
            closingCash,
            currency
          )}
          subtitle="Closing cash balance"
          icon={Wallet}
          positive={
            closingCash >= 0
          }
        />


        <StatCard
          title="Total Assets"
          value={money(
            assets,
            currency
          )}
          subtitle="Current asset position"
          icon={Landmark}
          positive={true}
        />

      </div>


      {/* ======================================================
          SECONDARY KPI CARDS
          ====================================================== */}

      <div className="dashboard-stat-grid dashboard-stat-grid-secondary">

        <StatCard
          title="Accounts Receivable"
          value={money(
            receivables,
            currency
          )}
          subtitle={`${receivableInvoices.length} outstanding invoices`}
          icon={CreditCard}
        />


        <StatCard
          title="Accounts Payable"
          value={money(
            payables,
            currency
          )}
          subtitle={`${payableBills.length} outstanding bills`}
          icon={Banknote}
        />


        <StatCard
          title="Gross Profit"
          value={money(
            grossProfit,
            currency
          )}
          subtitle={`Revenue less COGS`}
          icon={BarChart3}
        />


        <StatCard
          title="Equity"
          value={money(
            equity,
            currency
          )}
          subtitle="Total equity including profit"
          icon={Calculator}
        />

      </div>


      {/* ======================================================
          MAIN CHARTS
          ====================================================== */}

      <div className="dashboard-chart-grid">

        <SectionCard
          title="Profitability Overview"
          subtitle="Revenue, costs and profit"
          icon={TrendingUp}
        >

          {profitabilityData.some(
            (item) => item.amount !== 0
          ) ? (

            <div className="dashboard-chart">
              <ResponsiveContainer
                width="100%"
                height={300}
              >
                <BarChart
                  data={
                    profitabilityData
                  }
                  margin={{
                    top: 10,
                    right: 10,
                    left: 0,
                    bottom: 0,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="name"
                    tick={{
                      fontSize: 11,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    tick={{
                      fontSize: 10,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    formatter={(value) =>
                      money(
                        value,
                        currency
                      )
                    }
                  />

                  <Bar
                    dataKey="amount"
                    radius={[
                      5,
                      5,
                      0,
                      0,
                    ]}
                  />

                </BarChart>
              </ResponsiveContainer>
            </div>

          ) : (
            <EmptyState />
          )}

        </SectionCard>


        <SectionCard
          title="Financial Position"
          subtitle="Assets, liabilities and equity"
          icon={Landmark}
        >

          {financialPositionData.some(
            (item) => item.amount !== 0
          ) ? (

            <div className="dashboard-chart">
              <ResponsiveContainer
                width="100%"
                height={300}
              >
                <BarChart
                  data={
                    financialPositionData
                  }
                  layout="vertical"
                  margin={{
                    top: 10,
                    right: 20,
                    left: 20,
                    bottom: 0,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                  />

                  <XAxis
                    type="number"
                    tick={{
                      fontSize: 10,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{
                      fontSize: 11,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    formatter={(value) =>
                      money(
                        value,
                        currency
                      )
                    }
                  />

                  <Bar
                    dataKey="amount"
                    radius={[
                      0,
                      5,
                      5,
                      0,
                    ]}
                  />

                </BarChart>
              </ResponsiveContainer>
            </div>

          ) : (
            <EmptyState />
          )}

        </SectionCard>

      </div>


      {/* ======================================================
          CASH FLOW + COMPOSITION
          ====================================================== */}

      <div className="dashboard-chart-grid">

        <SectionCard
          title="Cash Flow"
          subtitle="Movement in cash during the selected period"
          icon={Wallet}
        >

          {cashData.some(
            (item) => item.amount !== 0
          ) ? (

            <div className="dashboard-chart">
              <ResponsiveContainer
                width="100%"
                height={280}
              >
                <AreaChart
                  data={cashData}
                  margin={{
                    top: 10,
                    right: 10,
                    left: 0,
                    bottom: 0,
                  }}
                >

                  <defs>
                    <linearGradient
                      id="cashGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopOpacity={0.3}
                      />

                      <stop
                        offset="95%"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="name"
                    tick={{
                      fontSize: 11,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    tick={{
                      fontSize: 10,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <Tooltip
                    formatter={(value) =>
                      money(
                        value,
                        currency
                      )
                    }
                  />

                  <Area
                    type="monotone"
                    dataKey="amount"
                    strokeWidth={2}
                    fill="url(#cashGradient)"
                  />

                </AreaChart>
              </ResponsiveContainer>
            </div>

          ) : (
            <EmptyState />
          )}

        </SectionCard>


        <SectionCard
          title="Cash Flow Activities"
          subtitle="Operating, investing and financing"
          icon={Banknote}
        >

          {cashCompositionData.length > 0 ? (

            <div className="dashboard-pie-wrapper">

              <ResponsiveContainer
                width="100%"
                height={240}
              >
                <PieChart>

                  <Pie
                    data={
                      cashCompositionData
                    }
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={3}
                  >
                    {cashCompositionData.map(
                      (entry, index) => (
                        <Cell
                          key={`cash-${index}`}
                        />
                      )
                    )}
                  </Pie>

                  <Tooltip
                    formatter={(value) =>
                      money(
                        value,
                        currency
                      )
                    }
                  />

                </PieChart>
              </ResponsiveContainer>


              <div className="dashboard-pie-legend">

                {cashCompositionData.map(
                  (item) => (
                    <div
                      key={item.name}
                      className="dashboard-pie-legend-item"
                    >
                      <span className="dashboard-pie-dot" />

                      <span>
                        {item.name}
                      </span>

                      <strong>
                        {money(
                          item.value,
                          currency
                        )}
                      </strong>
                    </div>
                  )
                )}

              </div>

            </div>

          ) : (
            <EmptyState />
          )}

        </SectionCard>

      </div>


      {/* ======================================================
          LOWER INFORMATION
          ====================================================== */}

      <div className="dashboard-bottom-grid">

        {/* Recent activity */}

        <SectionCard
          title="Account Activity"
          subtitle="Accounts with activity in the selected period"
          icon={Activity}
        >

          {recentTransactions.length > 0 ? (

            <div className="dashboard-activity-list">

              {recentTransactions.map(
                (transaction) => (
                  <div
                    key={transaction.id}
                    className="dashboard-activity-row"
                  >

                    <div className="dashboard-activity-icon">
                      <FileText size={16} />
                    </div>


                    <div className="dashboard-activity-info">

                      <strong>
                        {transaction.name}
                      </strong>

                      <span>
                        {transaction.code} ·{" "}
                        {transaction.type}
                      </span>

                    </div>


                    <div className="dashboard-activity-amount">

                      <span>
                        Debit
                      </span>

                      <strong>
                        {money(
                          transaction.debit,
                          currency
                        )}
                      </strong>

                    </div>


                    <div className="dashboard-activity-amount">

                      <span>
                        Credit
                      </span>

                      <strong>
                        {money(
                          transaction.credit,
                          currency
                        )}
                      </strong>

                    </div>

                  </div>
                )
              )}

            </div>

          ) : (
            <EmptyState
              message="No account activity found."
            />
          )}

        </SectionCard>


        {/* Financial health */}

        <SectionCard
          title="Financial Health"
          subtitle="Quick accounting checks"
          icon={Calculator}
        >

          <div className="dashboard-health-list">

            <div className="dashboard-health-row">

              <div>
                <strong>
                  Trial Balance
                </strong>

                <span>
                  Debit and credit totals
                </span>
              </div>

              <span
                className={`dashboard-status ${
                  trialBalance?.is_balanced
                    ? "dashboard-status-success"
                    : "dashboard-status-danger"
                }`}
              >
                {trialBalance?.is_balanced
                  ? "Balanced"
                  : "Check"}
              </span>

            </div>


            <div className="dashboard-health-row">

              <div>
                <strong>
                  Balance Sheet
                </strong>

                <span>
                  Assets vs liabilities & equity
                </span>
              </div>

              <span
                className={`dashboard-status ${
                  balance?.is_balanced
                    ? "dashboard-status-success"
                    : "dashboard-status-danger"
                }`}
              >
                {balance?.is_balanced
                  ? "Balanced"
                  : "Check"}
              </span>

            </div>


            <div className="dashboard-health-row">

              <div>
                <strong>
                  Cash Reconciliation
                </strong>

                <span>
                  Ledger cash verification
                </span>
              </div>

              <span
                className={`dashboard-status ${
                  cashFlow?.is_reconciled
                    ? "dashboard-status-success"
                    : "dashboard-status-danger"
                }`}
              >
                {cashFlow?.is_reconciled
                  ? "Reconciled"
                  : "Check"}
              </span>

            </div>


            <div className="dashboard-health-row">

              <div>
                <strong>
                  Profitability
                </strong>

                <span>
                  Current net result
                </span>
              </div>

              <span
                className={`dashboard-status ${
                  netProfit >= 0
                    ? "dashboard-status-success"
                    : "dashboard-status-danger"
                }`}
              >
                {netProfit >= 0
                  ? "Profitable"
                  : "Loss"}
              </span>

            </div>

          </div>

        </SectionCard>

      </div>


      {/* ======================================================
          FOOTER SUMMARY
          ====================================================== */}

      <div className="dashboard-footer-summary">

        <div>
          <span>
            Reporting company
          </span>

          <strong>
            {currentCompany?.name}
          </strong>
        </div>


        <div>
          <span>
            Currency
          </span>

          <strong>
            {currency}
          </strong>
        </div>


        <div>
          <span>
            Reporting period
          </span>

          <strong>
            {dates.startDate
              ? `${formatDate(
                  dates.startDate
                )} – ${formatDate(
                  dates.endDate
                )}`
              : "All posted transactions"}
          </strong>
        </div>

      </div>

    </div>
  );
}