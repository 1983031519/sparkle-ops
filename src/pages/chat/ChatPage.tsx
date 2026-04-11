import { useState, useEffect, useRef } from 'react'
import { Send } from 'lucide-react'
import { useChatContext } from '@/contexts/ChatContext'
import { useAuth } from '@/hooks/useAuth'

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:   { bg: 'rgba(79,108,247,0.12)',  text: '#4F6CF7' },
  manager: { bg: 'rgba(59,130,246,0.12)',  text: '#2563eb' },
  office:  { bg: 'rgba(16,185,129,0.12)',  text: '#059669' },
  field:   { bg: 'rgba(139,92,246,0.12)',  text: '#7c3aed' },
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (isToday) return time
  if (isYesterday) return `Yesterday ${time}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` · ${time}`
}

// Show a date separator when the day changes between messages
function DateSeparator({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
      <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
      <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
    </div>
  )
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function ChatPage() {
  const { messages, sendMessage, loading, markRead } = useChatContext()
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Mark as read on mount
  useEffect(() => { markRead() }, [markRead])

  // Initial scroll to bottom after loading
  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [loading])

  // Auto-scroll on new messages only if user is near the bottom
  const prevLenRef = useRef(0)
  useEffect(() => {
    if (messages.length > prevLenRef.current && atBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevLenRef.current = messages.length
  }, [messages])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  async function handleSend() {
    const content = input.trim()
    if (!content || sending) return
    setInput('')
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setSending(true)
    atBottomRef.current = true
    try {
      await sendMessage(content)
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

  // Build render list with date separators
  type RenderItem =
    | { kind: 'separator'; key: string; label: string }
    | { kind: 'message'; key: string; msg: typeof messages[number] }

  const renderItems: RenderItem[] = []
  let lastDay = ''
  for (const msg of messages) {
    const day = new Date(msg.created_at).toDateString()
    if (day !== lastDay) {
      renderItems.push({ kind: 'separator', key: `sep-${msg.created_at}`, label: dayLabel(msg.created_at) })
      lastDay = day
    }
    renderItems.push({ kind: 'message', key: msg.id, msg })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8F9FC' }}>
      {/* Header */}
      <div style={{
        flexShrink: 0, padding: '20px 24px 16px',
        borderBottom: '1px solid #E5E7EB', background: 'white',
      }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>Team Chat</h1>
        <p style={{ margin: '2px 0 0', fontSize: 13, color: '#9CA3AF' }}>
          Internal messages — all team members
        </p>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 24px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 14 }}>
            Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 32 }}>👋</span>
            <span style={{ fontSize: 15, color: '#9CA3AF' }}>No messages yet. Say hello!</span>
          </div>
        ) : (
          renderItems.map(item => {
            if (item.kind === 'separator') {
              return <DateSeparator key={item.key} label={item.label} />
            }

            const { msg } = item
            const isOwn = msg.user_id === user?.id
            const roleStyle = ROLE_COLORS[msg.user_role] ?? { bg: 'rgba(0,0,0,0.06)', text: '#555' }

            return (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isOwn ? 'flex-end' : 'flex-start',
                  marginBottom: 6,
                }}
              >
                {/* Sender name + role badge (others only) */}
                {!isOwn && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, paddingLeft: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{msg.user_name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      padding: '1px 7px', borderRadius: 99,
                      backgroundColor: roleStyle.bg,
                      color: roleStyle.text,
                      textTransform: 'capitalize',
                    }}>
                      {msg.user_role}
                    </span>
                  </div>
                )}

                {/* Bubble */}
                <div style={{
                  maxWidth: '68%',
                  padding: '9px 14px',
                  borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  backgroundColor: isOwn ? '#4F6CF7' : '#F3F4F6',
                  color: isOwn ? '#ffffff' : '#111827',
                  fontSize: 14,
                  lineHeight: 1.55,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                }}>
                  {msg.content}
                </div>

                {/* Timestamp */}
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

      {/* Input bar */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid #E5E7EB',
        padding: '12px 20px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-end',
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
          placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: '1px solid #E5E7EB',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 14,
            fontFamily: 'inherit',
            lineHeight: 1.5,
            outline: 'none',
            maxHeight: 120,
            overflowY: 'auto',
            backgroundColor: '#F8F9FC',
            color: '#111827',
            transition: 'border-color 150ms',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#4F6CF7' }}
          onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{
            flexShrink: 0,
            width: 42,
            height: 42,
            borderRadius: 12,
            border: 'none',
            cursor: input.trim() && !sending ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: input.trim() && !sending ? '#4F6CF7' : '#E5E7EB',
            transition: 'background-color 150ms',
          }}
        >
          <Send size={16} strokeWidth={1.5} color={input.trim() && !sending ? 'white' : '#9CA3AF'} />
        </button>
      </div>
    </div>
  )
}
