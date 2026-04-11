/**
 * ChatContext — single Supabase Realtime subscription shared by Layout (badge)
 * and ChatPage (full UI). Wrap ProtectedRoutes with <ChatProvider> in App.tsx.
 *
 * IMPORTANT: Realtime must be enabled on the `chat_messages` table in the
 * Supabase dashboard (Table Editor → chat_messages → Enable Realtime toggle).
 */
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface ChatMessage {
  id: string
  user_id: string
  user_name: string
  user_role: string
  content: string
  created_at: string
}

interface ChatContextValue {
  messages: ChatMessage[]
  sendMessage: (content: string) => Promise<void>
  unreadCount: number
  loading: boolean
  markRead: () => Promise<void>
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [lastReadAt, setLastReadAt] = useState<string | null>(null)
  const seenIds = useRef(new Set<string>())

  // Load history + last_read_at on mount
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    const userId = user.id
    let mounted = true

    async function init() {
      // Last 100 messages in chronological order
      const { data: msgsRaw } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100)

      if (!mounted) return
      const msgs = (msgsRaw ?? []) as ChatMessage[]
      msgs.forEach(m => seenIds.current.add(m.id))
      setMessages(msgs)

      // User's last read timestamp (may not exist for new users)
      const { data: readData } = await supabase
        .from('chat_reads')
        .select('last_read_at')
        .eq('user_id', userId)
        .single()

      if (!mounted) return
      if (readData) {
        setLastReadAt((readData as { last_read_at: string }).last_read_at)
      }

      setLoading(false)
    }

    init()
    return () => { mounted = false }
  }, [user])

  // Realtime: subscribe to new messages
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('chat_global_messages')
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload: { new: ChatMessage }) => {
          const msg = payload.new
          if (seenIds.current.has(msg.id)) return
          seenIds.current.add(msg.id)
          setMessages(prev => [...prev, msg])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const sendMessage = useCallback(async (content: string) => {
    if (!user || !profile || !content.trim()) return
    await supabase
      .from('chat_messages')
      .insert({
        user_id: user.id,
        user_name: profile.full_name || user.email || 'Unknown',
        user_role: profile.role,
        content: content.trim(),
      } as never)
  }, [user, profile])

  const markRead = useCallback(async () => {
    if (!user) return
    const now = new Date().toISOString()
    await supabase
      .from('chat_reads')
      .upsert({ user_id: user.id, last_read_at: now } as never, { onConflict: 'user_id' })
    setLastReadAt(now)
  }, [user])

  // Only messages from OTHER users count as unread
  const unreadCount = messages.filter(m => {
    if (m.user_id === user?.id) return false
    if (!lastReadAt) return true
    return m.created_at > lastReadAt
  }).length

  return (
    <ChatContext.Provider value={{ messages, sendMessage, unreadCount, loading, markRead }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider')
  return ctx
}
