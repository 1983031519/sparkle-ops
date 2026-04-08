import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export function useTable<T>(table: string, orderBy = 'created_at', ascending = false) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data: rows, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending })
    if (!error && rows) setData(rows as T[])
    setLoading(false)
  }, [table, orderBy, ascending])

  useEffect(() => { fetch() }, [fetch])

  const insert = async (row: Partial<T>) => {
    const { data: newRow, error } = await supabase.from(table).insert(row as never).select().single()
    if (error) throw error
    await fetch()
    return newRow as T
  }

  const update = async (id: string, changes: Partial<T>) => {
    const { error } = await supabase.from(table).update(changes as never).eq('id', id)
    if (error) throw error
    await fetch()
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
    await fetch()
  }

  return { data, loading, fetch, insert, update, remove }
}
