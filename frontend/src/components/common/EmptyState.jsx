import { FileSearch } from "lucide-react";


export default function EmptyState({
  title = "Nothing to show",
  message = "There are no records available.",
  action,
}) {
  return (
    <div className="empty-state">

      <div className="empty-state-icon">
        <FileSearch size={25} />
      </div>

      <h3>{title}</h3>

      <p>{message}</p>

      {action && (
        <div className="empty-state-action">
          {action}
        </div>
      )}

    </div>
  );
}