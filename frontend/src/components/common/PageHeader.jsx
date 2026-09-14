export default function PageHeader({
  title,
  description,
  action,
  children,
}) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">
          {title}
        </h1>

        {description && (
          <p className="page-description">
            {description}
          </p>
        )}
      </div>

      <div className="page-header-actions">
        {action}
        {children}
      </div>
    </div>
  );
}