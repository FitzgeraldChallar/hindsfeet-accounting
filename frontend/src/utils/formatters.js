export function capitalize(value) {
  if (!value) {
    return "";
  }

  return value
    .toString()
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}


export function formatAccountType(value) {
  const labels = {
    ASSET: "Asset",
    LIABILITY: "Liability",
    EQUITY: "Equity",
    REVENUE: "Revenue",
    COGS: "Cost of Goods Sold",
    EXPENSE: "Expense",
  };

  return labels[value] || capitalize(value);
}


export function formatStatus(value) {
  const labels = {
    DRAFT: "Draft",
    POSTED: "Posted",
    REVERSED: "Reversed",
    PAID: "Paid",
    UNPAID: "Unpaid",
    PARTIAL: "Partially Paid",
    PENDING: "Pending",
    APPROVED: "Approved",
    LOCKED: "Locked",
  };

  return labels[value] || capitalize(value);
}