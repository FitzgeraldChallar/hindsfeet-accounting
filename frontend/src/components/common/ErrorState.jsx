import { AlertCircle, RefreshCw } from "lucide-react";


export default function ErrorState({
  message = "Something went wrong.",
  onRetry,
}) {
  return (
    <div className="error-state">

      <div className="error-state-icon">
        <AlertCircle size={22} />
      </div>

      <div>
        <h3>
          Unable to load this information
        </h3>

        <p>{message}</p>

        {onRetry && (
          <button
            type="button"
            className="button button-secondary"
            onClick={onRetry}
          >
            <RefreshCw size={15} />
            Try Again
          </button>
        )}
      </div>

    </div>
  );
}