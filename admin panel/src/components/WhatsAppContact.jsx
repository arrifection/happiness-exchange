import { useState } from 'react'
import { Copy, ExternalLink } from 'lucide-react'

import { copyWhatsAppNumber, whatsappWaMeLink } from '../lib/whatsapp'

export default function WhatsAppContact({ number, label = 'WhatsApp' }) {
  const [copied, setCopied] = useState(false)
  const waLink = whatsappWaMeLink(number)

  if (!number) {
    return <p className="text-xs text-surface-400 italic">No WhatsApp number saved</p>
  }

  async function handleCopy() {
    const ok = await copyWhatsAppNumber(number)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-surface-500">{label}</p>
      <p className="font-mono text-sm text-surface-800 break-all">{number}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary text-xs" onClick={handleCopy}>
          <Copy className="w-3.5 h-3.5" />
          {copied ? 'Copied' : 'Copy'}
        </button>
        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  )
}
