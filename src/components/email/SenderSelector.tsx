import { SPARKLE_SENDERS, type SenderId } from '@/lib/senders'

interface Props {
  value: SenderId
  onChange: (id: SenderId) => void
  disabled?: boolean
}

export function SenderSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-1.5">
      {SPARKLE_SENDERS.map(sender => {
        const selected = value === sender.id
        return (
          <label
            key={sender.id}
            className={`flex items-center gap-2.5 cursor-pointer rounded-lg border px-3 py-2 transition-colors ${
              selected
                ? 'border-[#4F6CF7] bg-[#4F6CF7]/5'
                : 'border-stone-200 hover:border-stone-300'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name="send-from"
              value={sender.id}
              checked={selected}
              onChange={() => onChange(sender.id)}
              disabled={disabled}
              className="accent-[#4F6CF7]"
            />
            <span className="text-[13px] text-stone-700">{sender.label}</span>
          </label>
        )
      })}
    </div>
  )
}
