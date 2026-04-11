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
    return <p className="py-16 text-center text-[13px] text-stone-400">{emptyMessage}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            {columns.map(col => (
              <th key={col.key} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: '#9CA3AF' }}>
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
              style={{ height: 44, borderBottom: '1px solid rgba(0,0,0,0.04)', cursor: onRowClick ? 'pointer' : 'default', transition: 'box-shadow 100ms ease-out' }}
              onMouseEnter={e => { if (onRowClick) (e.currentTarget as HTMLTableRowElement).style.boxShadow = 'inset 2px 0 0 #0D1B3D' }}
              onMouseLeave={e => { if (onRowClick) (e.currentTarget as HTMLTableRowElement).style.boxShadow = 'none' }}
            >
              {columns.map((col, i) => (
                <td key={col.key} style={{ padding: '10px 16px', fontSize: 13, color: i === 0 ? '#0D1B3D' : '#4B5563', fontWeight: i === 0 ? 600 : 400 }} className={col.className}>
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
