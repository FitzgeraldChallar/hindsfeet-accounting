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


/* ============================================================
   HINDSFEET CHART COLORS
   ============================================================ */

const CHART_COLORS = {
  navy: "#071A3D",
  blue: "#123C78",
  gold: "#F4B400",
  warmGold: "#D99A00",
  lightGold: "#F8D56A",
  slate: "#64748B",
};


/* ============================================================
   MONEY FORMATTER
   ============================================================ */

function normalizeCurrency(currency) {
  const value = String(
    currency || "USD"
  ).trim().toUpperCase();

  /*
   * The backend may eventually return values such as:
   *
   * USD
   * LRD
   * USD / LRD
   * USD/LRD
   *
   * Intl.NumberFormat only accepts a single
   * valid ISO currency code.
   */

  const validCurrencies = [
    "USD",
    "LRD",
    "EUR",
    "GBP",
    "NGN",
    "GHS",
    "SLL",
    "GMD",
    "XOF",
    "ZAR",
    "KES",
    "CAD",
    "AUD",
  ];

  if (validCurrencies.includes(value)) {
    return value;
  }

  if (value.includes("LRD")) {
    return "LRD";
  }

  if (value.includes("USD")) {
    return "USD";
  }

  if (value.includes("EUR")) {
    return "EUR";
  }

  if (value.includes("GBP")) {
    return "GBP";
  }

  return "USD";
}


function money(
  value,
  currency = "USD"
) {
  const amount =
    Number(value || 0);

  const safeCurrency =
    normalizeCurrency(currency);

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(amount);
}


/* ============================================================
   NUMBER
   ============================================================ */

function number(value) {
  return Number(value || 0);
}


/* ============================================================
   EXTRACT LIST
   ============================================================ */

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


/* ============================================================
   DATE FORMAT
   ============================================================ */

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
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


/* ============================================================
   STAT CARD
   ============================================================ */

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
              <ArrowUpRight
                size={13}
              />
            ) : (
              <ArrowDownRight
                size={13}
              />
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


/* ============================================================
   SECTION CARD
   ============================================================ */

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

            <h2>
              {title}
            </h2>

            {subtitle && (
              <p>
                {subtitle}
              </p>
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


/* ============================================================
   EMPTY STATE
   ============================================================ */

function EmptyState({
  message =
    "No data available for this period.",
}) {
  return (
    <div className="dashboard-empty-state">

      <BarChart3
        size={24}
      />

      <span>
        {message}
      </span>

    </div>
  );
}


/* ============================================================
   DASHBOARD
   ============================================================ */

export default function Dashboard() {

  const {
    currentCompany,
  } = useCompany();


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    refreshing,
    setRefreshing,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState(null);


  const [
    financialData,
    setFinancialData,
  ] = useState({
    incomeStatement: null,
    balanceSheet: null,
    trialBalance: null,
    cashFlow: null,
  });


  const [
    invoices,
    setInvoices,
  ] = useState([]);


  const [
    bills,
    setBills,
  ] = useState([]);


  const [
    dateRange,
    setDateRange,
  ] = useState("all");


  const companyId =
    currentCompany?.id;


  /* ==========================================================
     DATE RANGE
     ========================================================== */

  const dates = useMemo(() => {

    const end =
      new Date();

    let start = null;


    if (
      dateRange === "month"
    ) {
      start =
        new Date(
          end.getFullYear(),
          end.getMonth(),
          1
        );
    }


    if (
      dateRange === "quarter"
    ) {

      const quarterStartMonth =
        Math.floor(
          end.getMonth() / 3
        ) * 3;

      start =
        new Date(
          end.getFullYear(),
          quarterStartMonth,
          1
        );
    }


    if (
      dateRange === "year"
    ) {
      start =
        new Date(
          end.getFullYear(),
          0,
          1
        );
    }


    const toApiDate =
      (date) => {

        if (!date) {
          return null;
        }

        return date
          .toISOString()
          .split("T")[0];
      };


    return {
      startDate:
        toApiDate(start),

      endDate:
        toApiDate(end),
    };

  }, [dateRange]);


  /* ==========================================================
     LOAD DASHBOARD
     ========================================================== */

  const loadDashboard =
    useCallback(
      async (
        isRefresh = false
      ) => {

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


        const startQuery =
          dates.startDate
            ? `&start_date=${dates.startDate}`
            : "";


        const endQuery =
          dates.endDate
            ? `&end_date=${dates.endDate}`
            : "";


        try {

          const [
            incomeStatement,
            balanceSheet,
            trialBalance,
            cashFlow,
            invoiceData,
            billData,
          ] =
            await Promise.all([

              api.get(
                `/api/accounting/reports/income-statement/${companyQuery}${startQuery}${endQuery}`
              ),

              api.get(
                `/api/accounting/reports/balance-sheet/${companyQuery}${
                  dates.endDate
                    ? `&as_of_date=${dates.endDate}`
                    : ""
                }`
              ),

              api.get(
                `/api/accounting/reports/trial-balance/${companyQuery}${startQuery}${endQuery}`
              ),

              api.get(
                `/api/accounting/reports/cash-flow/${companyQuery}${startQuery}${endQuery}`
              ),

              api.get(
                `/api/invoicing/invoices/${companyQuery}`
              ).catch(
                () => null
              ),

              api.get(
                `/api/invoicing/supplier-bills/${companyQuery}`
              ).catch(
                () => null
              ),

            ]);


          setFinancialData({
            incomeStatement,
            balanceSheet,
            trialBalance,
            cashFlow,
          });


          setInvoices(
            extractList(
              invoiceData
            )
          );


          setBills(
            extractList(
              billData
            )
          );

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
        dates.startDate,
        dates.endDate,
      ]
    );


  useEffect(() => {

    loadDashboard();

  }, [loadDashboard]);


  /* ==========================================================
     FINANCIAL VALUES
     ========================================================== */

  const income =
    financialData
      .incomeStatement;


  const balance =
    financialData
      .balanceSheet;


  const cashFlow =
    financialData
      .cashFlow;


  const trialBalance =
    financialData
      .trialBalance;


  const currency =
    currentCompany?.currency ||
    "USD";


  const revenue =
    number(
      income?.total_revenue
    );


  const cogs =
    number(
      income
        ?.total_cost_of_goods_sold
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
    number(
      balance?.total_assets
    );


  const liabilities =
    number(
      balance?.total_liabilities
    );


  const equity =
    number(
      balance
        ?.total_equity_with_profit
    );


  const openingCash =
    number(
      cashFlow
        ?.opening_cash_balance
    );


  const netCashChange =
    number(
      cashFlow
        ?.net_change_in_cash
    );


  const closingCash =
    number(
      cashFlow
        ?.closing_cash_balance
    );


  /* ==========================================================
     AR / AP SUMMARY
     ========================================================== */

  const receivableInvoices =
    invoices.filter(
      (invoice) => {

        const status =
          String(
            invoice?.status ||
            ""
          ).toUpperCase();


        return ![
          "PAID",
          "CANCELLED",
          "VOID",
        ].includes(status);

      }
    );


  const payableBills =
    bills.filter(
      (bill) => {

        const status =
          String(
            bill?.status ||
            ""
          ).toUpperCase();


        return ![
          "PAID",
          "CANCELLED",
          "VOID",
        ].includes(status);

      }
    );


  const receivables =
    receivableInvoices.reduce(
      (
        total,
        invoice
      ) => {

        return (
          total +
          number(
            invoice.balance_due ??
            invoice.amount_due ??
            invoice.outstanding_amount ??
            invoice.total
          )
        );

      },
      0
    );


  const payables =
    payableBills.reduce(
      (
        total,
        bill
      ) => {

        return (
          total +
          number(
            bill.balance_due ??
            bill.amount_due ??
            bill.outstanding_amount ??
            bill.total
          )
        );

      },
      0
    );


  /* ==========================================================
     CHART DATA
     ========================================================== */

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
          cashFlow
            ?.total_operating_activities
        )
      ),
    },

    {
      name: "Investing",
      value: Math.abs(
        number(
          cashFlow
            ?.total_investing_activities
        )
      ),
    },

    {
      name: "Financing",
      value: Math.abs(
        number(
          cashFlow
            ?.total_financing_activities
        )
      ),
    },

  ].filter(
    (item) =>
      item.value > 0
  );


  /* ==========================================================
     RECENT ACTIVITY
     ========================================================== */

  const recentTransactions =
    useMemo(() => {

      const transactions =
        [];

      const accounts =
        trialBalance
          ?.accounts || [];


      accounts.forEach(
        (account) => {

          if (
            number(
              account.debit
            ) === 0 &&
            number(
              account.credit
            ) === 0
          ) {
            return;
          }


          transactions.push({

            id:
              account.account,

            code:
              account.account_code,

            name:
              account.account_name,

            type:
              account.account_type,

            debit:
              number(
                account.debit
              ),

            credit:
              number(
                account.credit
              ),

          });

        }
      );


      return transactions
        .sort(
          (a, b) =>
            (
              b.debit +
              b.credit
            ) -
            (
              a.debit +
              a.credit
            )
        )
        .slice(0, 6);

    }, [trialBalance]);


  /* ==========================================================
     LOADING
     ========================================================== */

  if (
    loading &&
    !financialData
      .incomeStatement
  ) {

    return (
      <div className="dashboard-loading">

        <div className="dashboard-loading-spinner" />

        <h2>
          Preparing your dashboard...
        </h2>

        <p>
          Loading financial
          information for{" "}
          {currentCompany?.name ||
            "your company"}.
        </p>

      </div>
    );

  }


  /* ==========================================================
     NO COMPANY
     ========================================================== */

  if (!companyId) {

    return (
      <div className="dashboard-no-company">

        <div className="dashboard-no-company-icon">

          <BriefcaseBusiness
            size={28}
          />

        </div>


        <h2>
          Select a company
        </h2>


        <p>
          Select a company from
          the top-right company
          selector to view its
          financial dashboard.
        </p>

      </div>
    );

  }


  /* ==========================================================
     ERROR
     ========================================================== */

  if (
    error &&
    !financialData
      .incomeStatement
  ) {

    return (
      <div className="dashboard-error">

        <div className="dashboard-error-icon">

          <Activity
            size={25}
          />

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

          <RefreshCw
            size={16}
          />

          Try Again

        </button>

      </div>
    );

  }


  /* ==========================================================
     DASHBOARD
     ========================================================== */

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
            is performing.
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

          <Activity
            size={16}
          />

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
          subtitle="Revenue less COGS"
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
          PROFITABILITY + FINANCIAL POSITION
          ====================================================== */}

      <div className="dashboard-chart-grid">


        {/* PROFITABILITY */}

        <SectionCard
          title="Profitability Overview"
          subtitle="Revenue, costs and profit"
          icon={TrendingUp}
        >

          {profitabilityData.some(
            (item) =>
              item.amount !== 0
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
                    top: 12,
                    right: 15,
                    left: 0,
                    bottom: 5,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E8EDF3"
                  />


                  <XAxis
                    dataKey="name"
                    tick={{
                      fontSize: 13,
                      fontWeight: 500,
                      fill: "#475569",
                    }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                  />


                  <YAxis
                    tick={{
                      fontSize: 12,
                      fill: "#64748B",
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />


                  <Tooltip
                    formatter={(value) =>
                      money(
                        value,
                        currency
                      )
                    }
                    contentStyle={{
                      borderRadius: 10,
                      border:
                        "1px solid #E2E8F0",
                      backgroundColor:
                        "#FFFFFF",
                      boxShadow:
                        "0 10px 30px rgba(7, 26, 61, 0.12)",
                      padding:
                        "10px 14px",
                    }}
                    labelStyle={{
                      color:
                        "#071A3D",
                      fontWeight: 700,
                      fontSize: 13,
                      marginBottom: 4,
                    }}
                    itemStyle={{
                      color:
                        "#475569",
                      fontSize: 13,
                    }}
                  />


                  <Bar
                    dataKey="amount"
                    radius={[
                      8,
                      8,
                      2,
                      2,
                    ]}
                    barSize={48}
                  >

                    {profitabilityData.map(
                      (entry) => {

                        let fill =
                          CHART_COLORS.navy;


                        if (
                          entry.name ===
                          "Revenue"
                        ) {
                          fill =
                            CHART_COLORS.gold;
                        }


                        if (
                          entry.name ===
                          "COGS"
                        ) {
                          fill =
                            CHART_COLORS.blue;
                        }


                        if (
                          entry.name ===
                          "Expenses"
                        ) {
                          fill =
                            CHART_COLORS.warmGold;
                        }


                        if (
                          entry.name ===
                          "Net Profit"
                        ) {
                          fill =
                            CHART_COLORS.navy;
                        }


                        return (
                          <Cell
                            key={
                              entry.name
                            }
                            fill={fill}
                          />
                        );

                      }
                    )}

                  </Bar>

                </BarChart>

              </ResponsiveContainer>

            </div>

          ) : (

            <EmptyState />

          )}

        </SectionCard>


        {/* FINANCIAL POSITION */}

        <SectionCard
          title="Financial Position"
          subtitle="Assets, liabilities and equity"
          icon={Landmark}
        >

          {financialPositionData.some(
            (item) =>
              item.amount !== 0
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
                    left: 5,
                    bottom: 0,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#E8EDF3"
                  />


                  <XAxis
                    type="number"
                    tick={{
                      fontSize: 12,
                      fill: "#64748B",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />


                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{
                      fontSize: 13,
                      fontWeight: 500,
                      fill: "#475569",
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={85}
                  />


                  <Tooltip
                    formatter={(value) =>
                      money(
                        value,
                        currency
                      )
                    }
                    contentStyle={{
                      borderRadius: 10,
                      border:
                        "1px solid #E2E8F0",
                      backgroundColor:
                        "#FFFFFF",
                      boxShadow:
                        "0 10px 30px rgba(7, 26, 61, 0.12)",
                      padding:
                        "10px 14px",
                    }}
                    labelStyle={{
                      color:
                        "#071A3D",
                      fontWeight: 700,
                      fontSize: 13,
                      marginBottom: 4,
                    }}
                    itemStyle={{
                      color:
                        "#475569",
                      fontSize: 13,
                    }}
                  />


                  <Bar
                    dataKey="amount"
                    radius={[
                      0,
                      8,
                      8,
                      0,
                    ]}
                    barSize={32}
                  >

                    {financialPositionData.map(
                      (entry) => {

                        let fill =
                          CHART_COLORS.navy;


                        if (
                          entry.name ===
                          "Assets"
                        ) {
                          fill =
                            CHART_COLORS.gold;
                        }


                        if (
                          entry.name ===
                          "Liabilities"
                        ) {
                          fill =
                            CHART_COLORS.blue;
                        }


                        if (
                          entry.name ===
                          "Equity"
                        ) {
                          fill =
                            CHART_COLORS.navy;
                        }


                        return (
                          <Cell
                            key={
                              entry.name
                            }
                            fill={fill}
                          />
                        );

                      }
                    )}

                  </Bar>

                </BarChart>

              </ResponsiveContainer>

            </div>

          ) : (

            <EmptyState />

          )}

        </SectionCard>

      </div>


      {/* ======================================================
          CASH FLOW + CASH COMPOSITION
          ====================================================== */}

      <div className="dashboard-chart-grid">


        {/* CASH FLOW */}

        <SectionCard
          title="Cash Flow"
          subtitle="Movement in cash during the selected period"
          icon={Wallet}
        >

          {cashData.some(
            (item) =>
              item.amount !== 0
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
                    right: 15,
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
                        offset="0%"
                        stopColor={
                          CHART_COLORS.gold
                        }
                        stopOpacity={0.30}
                      />

                      <stop
                        offset="100%"
                        stopColor={
                          CHART_COLORS.gold
                        }
                        stopOpacity={0.02}
                      />

                    </linearGradient>

                  </defs>


                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E8EDF3"
                  />


                  <XAxis
                    dataKey="name"
                    tick={{
                      fontSize: 13,
                      fontWeight: 500,
                      fill: "#475569",
                    }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                  />


                  <YAxis
                    tick={{
                      fontSize: 12,
                      fill: "#64748B",
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />


                  <Tooltip
                    formatter={(value) =>
                      money(
                        value,
                        currency
                      )
                    }
                    contentStyle={{
                      borderRadius: 10,
                      border:
                        "1px solid #E2E8F0",
                      backgroundColor:
                        "#FFFFFF",
                      boxShadow:
                        "0 10px 30px rgba(7, 26, 61, 0.12)",
                      padding:
                        "10px 14px",
                    }}
                    labelStyle={{
                      color:
                        "#071A3D",
                      fontWeight: 700,
                      fontSize: 13,
                      marginBottom: 4,
                    }}
                    itemStyle={{
                      color:
                        "#475569",
                      fontSize: 13,
                    }}
                  />


                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke={
                      CHART_COLORS.navy
                    }
                    strokeWidth={3}
                    fill="url(#cashGradient)"
                    activeDot={{
                      r: 6,
                      fill:
                        CHART_COLORS.gold,
                      stroke:
                        CHART_COLORS.navy,
                      strokeWidth: 2,
                    }}
                  />

                </AreaChart>

              </ResponsiveContainer>

            </div>

          ) : (

            <EmptyState />

          )}

        </SectionCard>


        {/* CASH COMPOSITION */}

        <SectionCard
          title="Cash Flow Activities"
          subtitle="Operating, investing and financing"
          icon={Banknote}
        >

          {cashCompositionData.length >
          0 ? (

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
                      (
                        entry,
                        index
                      ) => {

                        const colors = [

                          CHART_COLORS.gold,

                          CHART_COLORS.blue,

                          CHART_COLORS.navy,

                        ];


                        return (
                          <Cell
                            key={
                              `cash-${index}`
                            }
                            fill={
                              colors[
                                index %
                                colors.length
                              ]
                            }
                            stroke="#FFFFFF"
                            strokeWidth={3}
                          />
                        );

                      }
                    )}

                  </Pie>


                  <Tooltip
                    formatter={(value) =>
                      money(
                        value,
                        currency
                      )
                    }
                    contentStyle={{
                      borderRadius: 10,
                      border:
                        "1px solid #E2E8F0",
                      backgroundColor:
                        "#FFFFFF",
                      boxShadow:
                        "0 10px 30px rgba(7, 26, 61, 0.12)",
                      padding:
                        "10px 14px",
                    }}
                    labelStyle={{
                      color:
                        "#071A3D",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                    itemStyle={{
                      color:
                        "#475569",
                      fontSize: 13,
                    }}
                  />

                </PieChart>

              </ResponsiveContainer>


              <div className="dashboard-pie-legend">

                {cashCompositionData.map(
                  (
                    item,
                    index
                  ) => (

                    <div
                      key={
                        item.name
                      }
                      className="dashboard-pie-legend-item"
                    >

                      <span
                        className="dashboard-pie-dot"
                        style={{
                          backgroundColor:
                            [
                              CHART_COLORS.gold,
                              CHART_COLORS.blue,
                              CHART_COLORS.navy,
                            ][
                              index % 3
                            ],
                        }}
                      />


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


        {/* ACCOUNT ACTIVITY */}

        <SectionCard
          title="Account Activity"
          subtitle="Accounts with activity in the selected period"
          icon={Activity}
        >

          {recentTransactions.length >
          0 ? (

            <div className="dashboard-activity-list">

              {recentTransactions.map(
                (
                  transaction
                ) => (

                  <div
                    key={
                      transaction.id
                    }
                    className="dashboard-activity-row"
                  >

                    <div className="dashboard-activity-icon">

                      <FileText
                        size={16}
                      />

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


        {/* FINANCIAL HEALTH */}

        <SectionCard
          title="Financial Health"
          subtitle="Quick accounting checks"
          icon={Calculator}
        >

          <div className="dashboard-health-list">


            {/* TRIAL BALANCE */}

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


            {/* BALANCE SHEET */}

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


            {/* CASH RECONCILIATION */}

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


            {/* PROFITABILITY */}

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
            {normalizeCurrency(
              currency
            )}
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