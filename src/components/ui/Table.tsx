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
          <tr className="border-b border-stone-100">
            {columns.map(col => (
              <th key={col.key} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[1px] text-stone-400">
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
              className={`h-[44px] border-b border-stone-50 transition-colors duration-100 ${onRowClick ? 'cursor-pointer hover:bg-surface' : ''}`}
            >
              {columns.map(col => (
                <td key={col.key} className={`px-4 py-2.5 text-[13px] text-stone-700 ${col.className ?? ''}`}>
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
