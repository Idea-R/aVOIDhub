import Image from 'next/image'

type BrandLockupProps = {
  className?: string
}

export function BrandLockup({ className = '' }: BrandLockupProps) {
  return (
    <span className={`brand ${className}`.trim()}>
      <span className="brandMark" aria-hidden="true">
        <Image
          src="/brand/avoid-meteor-mark.png"
          alt=""
          width={52}
          height={52}
          sizes="52px"
          className="brandMarkImage"
        />
      </span>
      <span className="brandWord">
        <span className="brandA">a</span><span className="brandVoid">VOID</span>game.io
      </span>
    </span>
  )
}
