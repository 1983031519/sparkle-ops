import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { askAi } from '@/lib/ai'
import { useRockoContext } from '@/hooks/useRockoContext'
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'

interface Msg {
  role: 'user' | 'assistant'
  content: string
  time: string
}

const QUICK_ACTIONS = [
  { emoji: '📊', label: 'Resumo do dia', message: 'Me dê um resumo completo do dia de hoje — jobs, invoices, o que preciso resolver.' },
  { emoji: '💰', label: 'Invoices em aberto', message: 'Quais invoices estão em aberto? Liste com valores e quem deve.' },
  { emoji: '📈', label: 'Margem do mês', message: 'Qual minha margem de lucro este mês? Compare com o mês passado.' },
  { emoji: '🔥', label: 'Insights do mercado', message: 'Me dê insights sobre o mercado de pavers e stone na região de Sarasota/Bradenton agora. O que devo prestar atenção?' },
  { emoji: '➕', label: 'Novo job / proposta', message: 'Quero criar um novo job ou proposta. Me ajude a pensar no escopo e preço.' },
]

function timestamp() {
  return format(new Date(), 'h:mm a', { locale: enUS })
}

export default function RockoPage() {
  const { context, ready } = useRockoContext()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [showQuickActions, setShowQuickActions] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || thinking) return
    setShowQuickActions(false)
    setInput('')

    const userMsg: Msg = { role: 'user', content: text.trim(), time: timestamp() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setThinking(true)

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))
      // Pass context only when it's ready
      const response = await askAi(apiMessages, ready ? context : undefined, { max_tokens: 1000 })
      setMessages(prev => [...prev, { role: 'assistant', content: response, time: timestamp() }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Erro: ${err instanceof Error ? err.message : 'Falha na requisição'}`, time: timestamp() }])
    } finally {
      setThinking(false)
      inputRef.current?.focus()
    }
  }, [messages, thinking, context, ready])

  function clearChat() {
    setMessages([])
    setShowQuickActions(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/rocko.png" alt="Rocko" style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'contain' }} />
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: '#0D1B3D', margin: 0 }}>Rocko</h1>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Sparkle AI Partner</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid #E5E3DF', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#6B7280', cursor: 'pointer' }}>
            <Trash2 size={13} strokeWidth={1.5} /> Limpar
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Greeting + Quick Actions */}
        {showQuickActions && messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 20 }}>
            <img src="/rocko.png" alt="Rocko" style={{ width: 80, height: 80, objectFit: 'contain' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#0D1B3D', marginBottom: 4 }}>Oi Oscar! Rocko aqui.</p>
              <p style={{ fontSize: 14, color: '#6B7280' }}>O que você precisa hoje?</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 480 }}>
              {QUICK_ACTIONS.map(qa => (
                <button
                  key={qa.label}
                  onClick={() => sendMessage(qa.message)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '10px 16px', borderRadius: 12,
                    border: '1px solid #E5E3DF', background: 'white',
                    fontSize: 13, fontWeight: 500, color: '#333',
                    cursor: 'pointer', transition: 'all 150ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#C8A96E'; e.currentTarget.style.background = '#FAFAF7' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E3DF'; e.currentTarget.style.background = 'white' }}
                >
                  <span>{qa.emoji}</span> {qa.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
            {msg.role === 'assistant' && (
              <img src="/rocko.png" alt="Rocko" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', flexShrink: 0, marginTop: 2 }} />
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

        {/* Thinking indicator */}
        {thinking && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <img src="/rocko.png" alt="Rocko" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain', flexShrink: 0 }} />
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
        <form onSubmit={e => { e.preventDefault(); sendMessage(input) }} style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Pergunte qualquer coisa..."
            disabled={thinking}
            style={{
              flex: 1, height: 44, borderRadius: 12, border: '1px solid #E5E3DF',
              padding: '0 16px', fontSize: 14, outline: 'none', transition: 'border-color 150ms',
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
