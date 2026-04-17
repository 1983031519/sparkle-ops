export type SenderId = 'oscar' | 'sabrina' | 'info'

export interface Sender {
  id: SenderId
  email: string
  /** Display name used in the email "From" header. */
  name: string
  /** Label shown in the radio UI. */
  label: string
  /** Sign-off block injected at the end of the email. `\n` becomes `<br/>` at render time. */
  signature: string
}

export const SPARKLE_SENDERS: readonly Sender[] = [
  {
    id: 'oscar',
    email: 'oscar@sparklestonepavers.com',
    name: 'Oscar Rocha',
    label: 'Oscar Rocha — oscar@sparklestonepavers.com',
    signature: 'Oscar Rocha\nField Operations\nSparkle Stone & Pavers\n(941) 387-5133',
  },
  {
    id: 'sabrina',
    email: 'sabrina@sparklestonepavers.com',
    name: 'Sabrina — Sparkle Stone & Pavers',
    label: 'Sabrina — sabrina@sparklestonepavers.com',
    signature: 'Sabrina\nOffice & Scheduling\nSparkle Stone & Pavers\n(941) 387-5134',
  },
  {
    id: 'info',
    email: 'info@sparklestonepavers.com',
    name: 'Sparkle Stone & Pavers',
    label: 'Sparkle Stone & Pavers — info@sparklestonepavers.com',
    signature: 'Sparkle Stone & Pavers Team\n(941) 387-5133\ninfo@sparklestonepavers.com',
  },
]

export function getDefaultSender(userEmail: string | null | undefined): SenderId {
  if (userEmail === 'oscar@sparklestonepavers.com') return 'oscar'
  if (userEmail === 'sabrina@sparklestonepavers.com') return 'sabrina'
  return 'info'
}

export function getSender(id: SenderId): Sender {
  const s = SPARKLE_SENDERS.find(x => x.id === id)
  if (!s) throw new Error(`Unknown sender id: ${id}`)
  return s
}
