export function TableSkeleton({
  label,
  columns,
}: {
  label: string;
  columns: number;
}) {
  return (
    <div className="table-wrap skeleton-table" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <table aria-hidden="true">
        <tbody>
          {Array.from({ length: 5 }, (_, row) => (
            <tr key={row}>
              {Array.from({ length: columns }, (_, column) => (
                <td key={column}>
                  <span className="skeleton-line" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
