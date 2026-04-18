import type { ReactNode } from 'react'

interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  emptyMessage?: string
}

export function Table<T extends { id: string }>({ columns, data, onRowClick, emptyMessage = 'No records yet.' }: Props<T>) {
  if (data.length === 0) {
    return <p className="py-16 text-center text-[13px] text-gray-400">{emptyMessage}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            {columns.map(col => (
              <th key={col.key} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              style={{ borderBottom: '1px solid #F3F4F6', cursor: onRowClick ? 'pointer' : 'default', transition: 'background 80ms ease-out' }}
              onMouseEnter={e => { if (onRowClick) (e.currentTarget as HTMLTableRowElement).style.background = '#F9FAFB' }}
              onMouseLeave={e => { if (onRowClick) (e.currentTarget as HTMLTableRowElement).style.background = '' }}
            >
              {columns.map((col, i) => (
                <td key={col.key} style={{ padding: '12px 16px', fontSize: 13, color: i === 0 ? '#111827' : '#6B7280', fontWeight: i === 0 ? 500 : 400 }} className={col.className}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
