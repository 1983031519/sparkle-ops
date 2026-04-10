import { useState, useRef, useEffect } from 'react'
import { Send, Trash2, Loader2 } from 'lucide-react'
import { askAi } from '@/lib/ai'
import { useRockoContext } from '@/hooks/useRockoContext'
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'

interface Msg {
  role: 'user' | 'assistant'
  content: string
  time: string
}

function timestamp() {
  return format(new Date(), 'h:mm a', { locale: enUS })
}

export default function RockoPage() {
  const { context, ready } = useRockoContext()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [briefingDone, setBriefingDone] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])

  // Auto-briefing on load
  useEffect(() => {
    if (!ready || briefingDone) return
    setBriefingDone(true)
    setThinking(true)

    askAi(
      [{ role: 'user', content: 'Me dê um resumo rápido do negócio para hoje. Inclua números importantes, alertas e o que preciso resolver. Seja direto, use bullet points.' }],
      context,
      { max_tokens: 600 }
    ).then(text => {
      setMessages([{ role: 'assistant', content: text, time: timestamp() }])
    }).catch(() => {
      setMessages([{ role: 'assistant', content: 'Oi Oscar! Estou online mas não consegui carregar os dados. Pode me perguntar qualquer coisa sobre o negócio.', time: timestamp() }])
    }).finally(() => setThinking(false))
  }, [ready, briefingDone, context])

  async function handleSend() {
    const text = input.trim()
    if (!text || thinking) return
    setInput('')

    const userMsg: Msg = { role: 'user', content: text, time: timestamp() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setThinking(true)

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))
      const response = await askAi(apiMessages, context, { max_tokens: 1000 })
      setMessages(prev => [...prev, { role: 'assistant', content: response, time: timestamp() }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Erro: ${err instanceof Error ? err.message : 'Falha na requisição'}`, time: timestamp() }])
    } finally {
      setThinking(false)
      inputRef.current?.focus()
    }
  }

  function clearChat() {
    setMessages([])
    setBriefingDone(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#0D1B3D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#C8A96E', fontWeight: 800, fontSize: 18 }}>R</span>
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3D', margin: 0 }}>Rocko</h1>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Sparkle AI Assistant</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid #E5E3DF', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#6B7280', cursor: 'pointer' }}>
            <Trash2 size={13} strokeWidth={1.5} /> Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!ready && messages.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center', color: '#9CA3AF' }}>
              <Loader2 size={24} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13 }}>Loading business data...</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
            {msg.role === 'assistant' && (
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#0D1B3D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <span style={{ color: '#C8A96E', fontWeight: 800, fontSize: 13 }}>R</span>
              </div>
            )}
            <div style={{
              maxWidth: '75%', padding: '12px 16px', borderRadius: 16,
              background: msg.role === 'user' ? '#0D1B3D' : '#F5F4F2',
              color: msg.role === 'user' ? 'white' : '#333',
              borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
              borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 16,
            }}>
              <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              <div style={{ fontSize: 10, marginTop: 6, opacity: 0.5, textAlign: msg.role === 'user' ? 'right' : 'left' }}>{msg.time}</div>
            </div>
          </div>
        ))}

        {thinking && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#0D1B3D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#C8A96E', fontWeight: 800, fontSize: 13 }}>R</span>
            </div>
            <div style={{ background: '#F5F4F2', borderRadius: '16px 16px 16px 4px', padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF', animation: 'pulse 1.2s infinite', animationDelay: '0s' }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF', animation: 'pulse 1.2s infinite', animationDelay: '0.2s' }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF', animation: 'pulse 1.2s infinite', animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 24px 16px', borderTop: '1px solid #F3F4F6', flexShrink: 0, background: 'white' }}>
        <form onSubmit={e => { e.preventDefault(); handleSend() }} style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Rocko anything..."
            disabled={thinking}
            style={{
              flex: 1, height: 44, borderRadius: 12, border: '1px solid #E5E3DF',
              padding: '0 16px', fontSize: 14, outline: 'none',
              transition: 'border-color 150ms',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#0D1B3D' }}
            onBlur={e => { e.currentTarget.style.borderColor = '#E5E3DF' }}
          />
          <button
            type="submit"
            disabled={thinking || !input.trim()}
            style={{
              width: 44, height: 44, borderRadius: 12, border: 'none',
              background: input.trim() ? '#0D1B3D' : '#E5E3DF',
              color: input.trim() ? 'white' : '#9CA3AF',
              cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 150ms',
            }}
          >
            <Send size={18} strokeWidth={1.5} />
          </button>
        </form>
      </div>
    </div>
  )
}
