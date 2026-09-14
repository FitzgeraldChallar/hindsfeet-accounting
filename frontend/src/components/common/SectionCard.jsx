export default function SectionCard({
  title,
  description,
  action,
  children,
  className = "",
}) {
  return (
    <section
      className={`section-card ${className}`}
    >
      {(title || description || action) && (
        <div className="section-card-header">

          <div>
            {title && (
              <h2 className="section-card-title">
                {title}
              </h2>
            )}

            {description && (
              <p className="section-card-description">
                {description}
              </p>
            )}
          </div>

          {action && (
            <div className="section-card-action">
              {action}
            </div>
          )}

        </div>
      )}

      <div className="section-card-body">
        {children}
      </div>
    </section>
  );
}