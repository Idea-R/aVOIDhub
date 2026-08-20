'use client'

import { Share2 } from 'lucide-react'
import { useState } from 'react'

export function SharePageButton() {
  const [status, setStatus] = useState('Share this page')
  return (
    <button className="sharePageButton" type="button" onClick={async () => {
      try {
        if (navigator.share) {
          await navigator.share({ title: document.title, url: window.location.href })
          setStatus('Shared')
        } else {
          await navigator.clipboard.writeText(window.location.href)
          setStatus('Link copied')
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setStatus('Copy the address above')
      }
    }}><Share2 size={15} aria-hidden="true" /><span>{status}</span></button>
  )
}

