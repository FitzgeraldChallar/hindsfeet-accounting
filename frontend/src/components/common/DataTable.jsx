export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = "No records found.",
  onRowClick,
}) {
  return (
    <div className="data-table-wrapper">

      <table className="data-table">

        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={
                  column.align
                    ? `text-${column.align}`
                    : ""
                }
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>

          {loading && (
            <tr>
              <td
                colSpan={columns.length}
                className="table-message"
              >
                Loading...
              </td>
            </tr>
          )}

          {!loading && data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="table-message"
              >
                {emptyMessage}
              </td>
            </tr>
          )}

          {!loading &&
            data.map((row, index) => (
              <tr
                key={
                  row.id ??
                  row.pk ??
                  index
                }
                onClick={() =>
                  onRowClick?.(row)
                }
                className={
                  onRowClick
                    ? "data-table-clickable"
                    : ""
                }
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={
                      column.align
                        ? `text-${column.align}`
                        : ""
                    }
                  >
                    {column.render
                      ? column.render(
                          row,
                          index
                        )
                      : row[column.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}

        </tbody>

      </table>

    </div>
  );
}