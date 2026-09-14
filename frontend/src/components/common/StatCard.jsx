import {
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";


export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  variant = "default",
}) {
  const isPositive =
    trend !== undefined &&
    Number(trend) >= 0;


  return (
    <div
      className={`stat-card stat-card-${variant}`}
    >
      <div className="stat-card-top">

        <span className="stat-card-title">
          {title}
        </span>

        {Icon && (
          <div className="stat-card-icon">
            <Icon size={19} />
          </div>
        )}

      </div>


      <div className="stat-card-value">
        {value}
      </div>


      {(subtitle || trendLabel) && (
        <div className="stat-card-bottom">

          {trend !== undefined && (
            <span
              className={
                isPositive
                  ? "stat-trend stat-trend-positive"
                  : "stat-trend stat-trend-negative"
              }
            >
              {isPositive ? (
                <ArrowUpRight size={14} />
              ) : (
                <ArrowDownRight size={14} />
              )}

              {Math.abs(Number(trend))}%
            </span>
          )}

          <span className="stat-card-subtitle">
            {trendLabel || subtitle}
          </span>

        </div>
      )}
    </div>
  );
}