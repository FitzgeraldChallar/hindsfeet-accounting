import { formatStatus } from "../../utils/formatters";


export default function StatusBadge({
  status,
}) {
  if (!status) {
    return null;
  }

  const normalized =
    status.toString().toLowerCase();


  return (
    <span
      className={`status-badge status-${normalized}`}
    >
      <span className="status-badge-dot" />

      {formatStatus(status)}
    </span>
  );
}