'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ComponentProps, PropsWithChildren } from 'react'

type RevealProps = PropsWithChildren<{ className?: string; delay?: number }>

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const reducedMotion = useReducedMotion()
  const motionChildren = children as ComponentProps<typeof motion.div>['children']

  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 22 }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {motionChildren}
    </motion.div>
  )
}
