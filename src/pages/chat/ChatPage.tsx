import { useState, useEffect, useRef, useMemo } from 'react'
import { Send } from 'lucide-react'
import { useChatContext, type DirectMessage, type TeamMember } from '@/contexts/ChatContext'
import { useAuth } from '@/hooks/useAuth'

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:   { bg: 'rgba(79,108,247,0.12)',  text: '#4F6CF7' },
  manager: { bg: 'rgba(59,130,246,0.12)',  text: '#2563eb' },
  office:  { bg: 'rgba(16,185,129,0.12)',  text: '#059669' },
  field:   { bg: 'rgba(139,92,246,0.12)',  text: '#7c3aed' },
}

function initialsOf(name: string, email: string): string {
  const src = (name || email || '?').trim()
  const parts = src.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

function avatarColor(id: string): string {
  // Deterministic color from user id
  const palette = ['#4F6CF7', '#2563eb', '#059669', '#7c3aed', '#DC2626', '#EA580C', '#0891B2', '#DB2777']
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}

function Avatar({ member, size = 36 }: { member: TeamMember; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: avatarColor(member.id), color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 600, flexShrink: 0,
    }}>
      {initialsOf(member.full_name, member.email)}
    </div>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatPreviewTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  if (isToday) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (isYesterday) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0' }}>
      <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
      <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
    </div>
  )
}

export default function ChatPage() {
  const { messages, teamMembers, sendMessage, markConversationRead, unreadByUser, loading } = useChatContext()
  const { user } = useAuth()
  const [activeUserId, setActiveUserId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Build per-user last-message map for the sidebar
  const lastMessageByUser = useMemo(() => {
    const map: Record<string, DirectMessage> = {}
    if (!user) return map
    for (const m of messages) {
      const other = m.sender_id === user.id ? m.recipient_id : m.sender_id
      if (!map[other] || m.created_at > map[other].created_at) map[other] = m
    }
    return map
  }, [messages, user])

  // Sort team members: unread first, then by last-message time desc, then alphabetically
  const sortedMembers = useMemo(() => {
    return [...teamMembers].sort((a, b) => {
      const ua = unreadByUser[a.id] ?? 0
      const ub = unreadByUser[b.id] ?? 0
      if (ua !== ub) return ub - ua
      const la = lastMessageByUser[a.id]?.created_at ?? ''
      const lb = lastMessageByUser[b.id]?.created_at ?? ''
      if (la || lb) return lb.localeCompare(la)
      return (a.full_name || a.email).localeCompare(b.full_name || b.email)
    })
  }, [teamMembers, unreadByUser, lastMessageByUser])

  // Active conversation messages
  const conversation = useMemo(() => {
    if (!user || !activeUserId) return []
    return messages.filter(m =>
      (m.sender_id === user.id && m.recipient_id === activeUserId) ||
      (m.sender_id === activeUserId && m.recipient_id === user.id)
    )
  }, [messages, user, activeUserId])

  const activeMember = teamMembers.find(m => m.id === activeUserId) ?? null

  // Mark as read whenever the active conversation changes or new messages arrive
  useEffect(() => {
    if (activeUserId) markConversationRead(activeUserId)
  }, [activeUserId, conversation.length, markConversationRead])

  // Scroll to bottom when opening a conversation
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      atBottomRef.current = true
    }
  }, [activeUserId])

  // Auto-scroll on new message if user is at bottom
  const prevLenRef = useRef(0)
  useEffect(() => {
    if (conversation.length > prevLenRef.current && atBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevLenRef.current = conversation.length
  }, [conversation])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  async function handleSend() {
    const content = input.trim()
    if (!content || sending || !activeUserId) return
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setSending(true)
    atBottomRef.current = true
    try {
      await sendMessage(activeUserId, content)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Build conversation render list with date separators and grouping
  type RenderItem =
    | { kind: 'separator'; key: string; label: string }
    | { kind: 'message'; key: string; msg: DirectMessage; showSender: boolean }

  const renderItems: RenderItem[] = []
  let lastDay = ''
  let lastSenderId = ''
  for (const msg of conversation) {
    const day = new Date(msg.created_at).toDateString()
    if (day !== lastDay) {
      renderItems.push({ kind: 'separator', key: `sep-${msg.id}`, label: dayLabel(msg.created_at) })
      lastDay = day
      lastSenderId = ''
    }
    const showSender = msg.sender_id !== user?.id && msg.sender_id !== lastSenderId
    renderItems.push({ kind: 'message', key: msg.id, msg, showSender })
    lastSenderId = msg.sender_id
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: '#F8F9FC' }}>
      {/* ─── LEFT PANEL: Conversation list ─── */}
      <aside style={{
        width: 260, flexShrink: 0,
        borderRight: '1px solid #E5E7EB',
        background: 'white',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #E5E7EB' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>
            {teamMembers.length} team member{teamMembers.length === 1 ? '' : 's'}
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {loading ? (
            <div style={{ padding: 20, fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>Loading…</div>
          ) : sortedMembers.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>
              No team members yet
            </div>
          ) : (
            sortedMembers.map(member => {
              const isActive = member.id === activeUserId
              const lastMsg = lastMessageByUser[member.id]
              const unread = unreadByUser[member.id] ?? 0
              const roleStyle = ROLE_COLORS[member.role] ?? { bg: 'rgba(0,0,0,0.06)', text: '#555' }
              const preview = lastMsg
                ? (lastMsg.sender_id === user?.id ? 'You: ' : '') + lastMsg.content
                : 'No messages yet'

              return (
                <button
                  key={member.id}
                  onClick={() => setActiveUserId(member.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px',
                    border: 'none',
                    background: isActive ? '#EEF1FE' : 'transparent',
                    borderLeft: isActive ? '3px solid #4F6CF7' : '3px solid transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#F9FAFB' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <Avatar member={member} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 13, fontWeight: unread > 0 ? 700 : 600,
                        color: '#111827',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, minWidth: 0,
                      }}>
                        {member.full_name || member.email}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 600,
                        padding: '1px 6px', borderRadius: 99,
                        backgroundColor: roleStyle.bg, color: roleStyle.text,
                        textTransform: 'capitalize', flexShrink: 0,
                      }}>
                        {member.role}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 12,
                        color: unread > 0 ? '#374151' : '#9CA3AF',
                        fontWeight: unread > 0 ? 500 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, minWidth: 0,
                      }}>
                        {preview}
                      </span>
                      {lastMsg && (
                        <span style={{ fontSize: 10, color: '#9CA3AF', flexShrink: 0 }}>
                          {formatPreviewTime(lastMsg.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  {unread > 0 && (
                    <span style={{
                      background: '#4F6CF7', color: 'white',
                      fontSize: 10, fontWeight: 700, lineHeight: 1,
                      padding: '4px 7px', borderRadius: 99, minWidth: 20, textAlign: 'center',
                      flexShrink: 0,
                    }}>
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* ─── RIGHT PANEL: Active conversation ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!activeMember ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
          }}>
            <span style={{ fontSize: 48 }}>💬</span>
            <p style={{ margin: 0, fontSize: 15, color: '#6B7280', textAlign: 'center', maxWidth: 320 }}>
              Select a team member to start a conversation
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              flexShrink: 0, padding: '14px 24px',
              borderBottom: '1px solid #E5E7EB', background: 'white',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <Avatar member={activeMember} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>
                  {activeMember.full_name || activeMember.email}
                </h2>
                <span style={{
                  fontSize: 11, fontWeight: 500,
                  color: (ROLE_COLORS[activeMember.role] ?? { text: '#6B7280' }).text,
                  textTransform: 'capitalize',
                }}>
                  {activeMember.role}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              style={{
                flex: 1, overflowY: 'auto',
                padding: '16px 24px 8px',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}
            >
              {conversation.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 32 }}>👋</span>
                  <span style={{ fontSize: 14, color: '#9CA3AF' }}>
                    No messages yet. Say hello to {activeMember.full_name || activeMember.email}!
                  </span>
                </div>
              ) : (
                renderItems.map(item => {
                  if (item.kind === 'separator') {
                    return <DateSeparator key={item.key} label={item.label} />
                  }
                  const { msg, showSender } = item
                  const isOwn = msg.sender_id === user?.id
                  return (
                    <div
                      key={item.key}
                      style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: isOwn ? 'flex-end' : 'flex-start',
                        marginBottom: 6,
                      }}
                    >
                      {showSender && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 3, paddingLeft: 4 }}>
                          {msg.sender_name}
                        </span>
                      )}
                      <div style={{
                        maxWidth: '68%',
                        padding: '9px 14px',
                        borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        backgroundColor: isOwn ? '#4F6CF7' : '#F3F4F6',
                        color: isOwn ? '#ffffff' : '#111827',
                        fontSize: 14, lineHeight: 1.55,
                        wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                      }}>
                        {msg.content}
                      </div>
                      <span style={{
                        fontSize: 11, color: '#9CA3AF',
                        marginTop: 3,
                        paddingLeft: isOwn ? 0 : 4,
                        paddingRight: isOwn ? 4 : 0,
                      }}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>

            {/* Input */}
            <div style={{
              flexShrink: 0,
              borderTop: '1px solid #E5E7EB',
              padding: '12px 20px',
              display: 'flex', gap: 10, alignItems: 'flex-end',
              background: 'white',
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
                }}
                placeholder={`Message ${activeMember.full_name || activeMember.email}…`}
                rows={1}
                style={{
                  flex: 1, resize: 'none',
                  border: '1px solid #E5E7EB', borderRadius: 12,
                  padding: '10px 14px',
                  fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5,
                  outline: 'none', maxHeight: 120, overflowY: 'auto',
                  backgroundColor: '#F8F9FC', color: '#111827',
                  transition: 'border-color 150ms',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#4F6CF7' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                style={{
                  flexShrink: 0, width: 42, height: 42, borderRadius: 12,
                  border: 'none',
                  cursor: input.trim() && !sending ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: input.trim() && !sending ? '#4F6CF7' : '#E5E7EB',
                  transition: 'background-color 150ms',
                }}
              >
                <Send size={16} strokeWidth={1.5} color={input.trim() && !sending ? 'white' : '#9CA3AF'} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
