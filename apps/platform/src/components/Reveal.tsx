import type { CSSProperties, PropsWithChildren } from 'react'

type RevealProps = PropsWithChildren<{ className?: string; delay?: number }>

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  return (
    <div
      className={`reveal ${className ?? ''}`.trim()}
      style={{ '--reveal-delay': `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  )
}
