"use client";

interface PaginationProps {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [10, 25, 50, 100] as const;

export function Pagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps): React.ReactElement {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  const btnStyle: React.CSSProperties = {
    padding: "4px 10px",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--text-primary)",
    fontSize: 12,
    cursor: "pointer",
  };
  const disabledBtnStyle: React.CSSProperties = {
    ...btnStyle,
    cursor: "not-allowed",
    opacity: 0.4,
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginTop: 12,
        flexWrap: "wrap",
        fontSize: 12,
        color: "var(--text-secondary)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <label htmlFor="rm-page-size">Rows per page:</label>
        <select
          id="rm-page-size"
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
          style={{
            padding: "4px 8px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--text-primary)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div style={{ flex: 1 }} />
      <span>
        {start}–{end} of {totalItems}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          style={currentPage <= 1 ? disabledBtnStyle : btnStyle}
          aria-label="Previous page"
        >
          ‹ Prev
        </button>
        <span style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          style={currentPage >= totalPages ? disabledBtnStyle : btnStyle}
          aria-label="Next page"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
