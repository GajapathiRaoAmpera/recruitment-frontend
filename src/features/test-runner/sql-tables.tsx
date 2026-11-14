import type { SqlTable } from "@/api/attempt";
import { hire as h } from "@/components/hire/ui";
import { Table, Td, Th } from "@/components/ui/table";

// Read-only tables for SQL questions on the student coding screen. Built from the shared Table; no animation.

const cellText = (v: number | string | null) => (v === null ? "NULL" : String(v));

/** One table of a sample's data, with its real column names. */
export function SqlDataTable({ name, table, label }: { name: string; table: SqlTable; label: string }) {
  return (
    <div>
      <p className={h.xs}>
        Table <span className={h.mono}>{name}</span>
      </p>
      <Table aria-label={label}>
        <thead>
          <tr>
            {table.columns.map((c, i) => (
              <Th key={i} className={h.mono}>
                {c}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.length === 0 ? (
            <tr>
              <Td colSpan={Math.max(1, table.columns.length)}>No rows</Td>
            </tr>
          ) : (
            table.rows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <Td key={j} className={h.mono}>
                    {cellText(v)}
                  </Td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}

/** Result rows without column names (the API never prints them): headed Column 1…n. */
export function SqlRowsTable({ rows, label, title }: { rows: string[][]; label: string; title: string }) {
  const width = Math.max(1, ...rows.map((r) => r.length));
  return (
    <div>
      <p className={h.xs}>{title}</p>
      <Table aria-label={label}>
        <thead>
          <tr>
            {Array.from({ length: width }, (_, i) => (
              <Th key={i}>Column {i + 1}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <Td colSpan={width}>No rows</Td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                {Array.from({ length: width }, (_, j) => (
                  <Td key={j} className={h.mono}>
                    {r[j] ?? ""}
                  </Td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}
