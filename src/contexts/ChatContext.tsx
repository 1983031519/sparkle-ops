/**
 * ChatContext — manages direct messages (DMs) between users.
 * Shared by Layout (sidebar badge) and ChatPage (full UI).
 *
 * IMPORTANT: Realtime must be enabled on the `direct_messages` table in the
 * Supabase dashboard (Table Editor → direct_messages → Enable Realtime toggle).
 */
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface DirectMessage {
  id: string
  sender_id: string
  recipient_id: string
  sender_name: string
  recipient_name: string
  content: string
  read_at: string | null
  created_at: string
}

export interface TeamMember {
  id: string
  full_name: string
  email: string
  role: string
}

interface ChatContextValue {
  messages: DirectMessage[]           // all DMs involving the current user
  teamMembers: TeamMember[]            // all other active users
  sendMessage: (recipientId: string, content: string) => Promise<void>
  markConversationRead: (otherUserId: string) => Promise<void>
  unreadCount: number                  // total unread across all conversations
  unreadByUser: Record<string, number> // per-user unread counts
  loading: boolean
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const seenIds = useRef(new Set<string>())

  // Load team members + message history on mount
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    const userId = user.id
    let mounted = true

    async function init() {
      // Other active users
      const { data: profilesRaw } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('active', true)
        .neq('id', userId)
        .order('full_name', { ascending: true })

      // All DMs involving me (sent or received), most recent 500
      const { data: msgsRaw } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: true })
        .limit(500)

      if (!mounted) return
      const members = (profilesRaw ?? []) as TeamMember[]
      const msgs = (msgsRaw ?? []) as DirectMessage[]
      msgs.forEach(m => seenIds.current.add(m.id))
      setTeamMembers(members)
      setMessages(msgs)
      setLoading(false)
    }

    init()
    return () => { mounted = false }
  }, [user])

  // Realtime: subscribe to INSERTs and UPDATEs on direct_messages
  useEffect(() => {
    if (!user) return
    const userId = user.id

    const channel = supabase
      .channel('dm_realtime')
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        (payload: { new: DirectMessage }) => {
          const msg = payload.new
          // Only handle messages involving the current user
          if (msg.sender_id !== userId && msg.recipient_id !== userId) return
          if (seenIds.current.has(msg.id)) return
          seenIds.current.add(msg.id)
          setMessages(prev => [...prev, msg])
        }
      )
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'direct_messages' },
        (payload: { new: DirectMessage }) => {
          const msg = payload.new
          if (msg.sender_id !== userId && msg.recipient_id !== userId) return
          setMessages(prev => prev.map(m => (m.id === msg.id ? msg : m)))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const sendMessage = useCallback(async (recipientId: string, content: string) => {
    if (!user || !profile || !content.trim()) return
    const recipient = teamMembers.find(m => m.id === recipientId)
    if (!recipient) return

    const { data } = await supabase
      .from('direct_messages')
      .insert({
        sender_id: user.id,
        recipient_id: recipientId,
        sender_name: profile.full_name || user.email || 'Unknown',
        recipient_name: recipient.full_name || recipient.email || 'Unknown',
        content: content.trim(),
      } as never)
      .select()
      .single()

    // Optimistic: add locally in case realtime is delayed
    if (data) {
      const msg = data as DirectMessage
      if (!seenIds.current.has(msg.id)) {
        seenIds.current.add(msg.id)
        setMessages(prev => [...prev, msg])
      }
    }
  }, [user, profile, teamMembers])

  const markConversationRead = useCallback(async (otherUserId: string) => {
    if (!user) return
    const now = new Date().toISOString()

    // Update unread messages from otherUserId → me to have read_at
    const unreadIds = messages
      .filter(m => m.recipient_id === user.id && m.sender_id === otherUserId && !m.read_at)
      .map(m => m.id)

    if (unreadIds.length === 0) return

    // Optimistic local update
    setMessages(prev => prev.map(m => (unreadIds.includes(m.id) ? { ...m, read_at: now } : m)))

    await supabase
      .from('direct_messages')
      .update({ read_at: now } as never)
      .in('id', unreadIds)
  }, [user, messages])

  // Unread counts: messages where I'm the recipient and read_at is null
  const unreadByUser: Record<string, number> = {}
  let unreadCount = 0
  if (user) {
    for (const m of messages) {
      if (m.recipient_id === user.id && !m.read_at) {
        unreadByUser[m.sender_id] = (unreadByUser[m.sender_id] ?? 0) + 1
        unreadCount++
      }
    }
  }

  return (
    <ChatContext.Provider value={{
      messages,
      teamMembers,
      sendMessage,
      markConversationRead,
      unreadCount,
      unreadByUser,
      loading,
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider')
  return ctx
}
