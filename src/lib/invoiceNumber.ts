import { supabase } from './supabase'

export async function nextInvoiceNumber(): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const prefix = `${year}-${mm}${dd}`
  const { data } = await supabase.from('invoices').select('number').like('number', `${prefix}-%`).order('number', { ascending: false }).limit(1)
  let seq = 1
  if (data?.length) seq = parseInt((data[0] as { number: string }).number.split('-').pop()!, 10) + 1
  return `${prefix}-${String(seq).padStart(3, '0')}`
}
