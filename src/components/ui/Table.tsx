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
          <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
            {columns.map(col => (
              <th key={col.key} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#9CA3AF' }}>
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
              style={{ height: 52, borderBottom: '1px solid #F3F4F6', cursor: onRowClick ? 'pointer' : 'default', transition: 'background 0.1s' }}
              className={onRowClick ? 'group hover:bg-[#FAFAF5]' : ''}
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
