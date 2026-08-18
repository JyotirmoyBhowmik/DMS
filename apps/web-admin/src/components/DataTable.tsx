import React, { ReactNode, useState } from 'react';
import { ColumnDef } from '../types';

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

// Memoize DataTable to prevent unnecessary re-renders of this UI component.
// Using 'as typeof DataTable' to preserve generic inference.
const DataTableInternal = function DataTable<T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data available',
}: DataTableProps<T>): React.ReactElement {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div
      style={{
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        width: '100%',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: '14px',
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
            }}
          >
            {columns.map((col, index) => (
              <th
                key={String(col.key) || index}
                style={{
                  padding: '12px 16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#64748B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  width: col.width || 'auto',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: '#64748B',
                  fontSize: '14px',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => {
              const isHovered = hoveredIndex === rowIndex;

              return (
                <tr
                  key={rowIndex}
                  onClick={() => onRowClick && onRowClick(row)}
                  onMouseEnter={() => setHoveredIndex(rowIndex)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    borderBottom: '1px solid #E2E8F0',
                    backgroundColor: isHovered ? '#F8FAFC' : 'transparent',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {columns.map((col, colIndex) => {
                    let content: ReactNode;

                    if (col.render) {
                      content = col.render(row);
                    } else {
                      const val = row[col.key as keyof T];
                      content = val !== undefined && val !== null ? String(val) : '';
                    }

                    return (
                      <td
                        key={String(col.key) || colIndex}
                        style={{
                          padding: '12px 16px',
                          color: '#334155',
                          verticalAlign: 'middle',
                        }}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export const DataTable = React.memo(DataTableInternal) as typeof DataTableInternal;
