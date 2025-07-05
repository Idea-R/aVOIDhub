import { useState, useEffect, useRef, useCallback } from 'react'

interface CursorPosition {
  x: number
  y: number
  timestamp: number
}

const CustomCursor = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [trail, setTrail] = useState<CursorPosition[]>([])
  const animationRef = useRef<number | null>(null)
  const cleanupTimeoutRef = useRef<number | null>(null)

  // Trail configuration
  const TRAIL_LENGTH = 12
  const TRAIL_FADE_TIME = 400 // milliseconds

  const cleanupTrail = useCallback(() => {
    const now = Date.now()
    setTrail(prevTrail => 
      prevTrail.filter(point => now - point.timestamp < TRAIL_FADE_TIME)
    )
  }, [TRAIL_FADE_TIME])

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      const newPosition = { x: e.clientX, y: e.clientY }
      setMousePosition(newPosition)
      
      // Add to trail with timestamp
      const newTrailPoint: CursorPosition = {
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now()
      }
      
      setTrail(prevTrail => {
        const updatedTrail = [newTrailPoint, ...prevTrail]
        return updatedTrail.slice(0, TRAIL_LENGTH)
      })
    }

    const handleMouseEnter = () => setIsHovering(true)
    const handleMouseLeave = () => setIsHovering(false)

    // Add mouse move listener
    document.addEventListener('mousemove', updateMousePosition, { passive: true })

    // Add hover listeners to interactive elements
    const interactiveElements = document.querySelectorAll(
      'button, a, [role="button"], .btn-primary, .btn-secondary, .game-card, .nav-link'
    )

    interactiveElements.forEach(element => {
      element.addEventListener('mouseenter', handleMouseEnter, { passive: true })
      element.addEventListener('mouseleave', handleMouseLeave, { passive: true })
    })

    return () => {
      document.removeEventListener('mousemove', updateMousePosition)
      interactiveElements.forEach(element => {
        element.removeEventListener('mouseenter', handleMouseEnter)
        element.removeEventListener('mouseleave', handleMouseLeave)
      })
    }
  }, [])

  // Efficient trail cleanup with requestAnimationFrame
  useEffect(() => {
    const animate = () => {
      cleanupTrail()
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animationRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [cleanupTrail])

  // Additional cleanup to prevent memory leaks
  useEffect(() => {
    cleanupTimeoutRef.current = window.setInterval(cleanupTrail, 100)
    
    return () => {
      if (cleanupTimeoutRef.current) {
        clearInterval(cleanupTimeoutRef.current)
      }
    }
  }, [cleanupTrail])

  return (
    <>
      {/* Trail elements with improved performance */}
      {trail.map((point, index) => {
        const age = Date.now() - point.timestamp
        const opacity = Math.max(0, (1 - (age / TRAIL_FADE_TIME)) * 0.6)
        const size = Math.max(0.3, 1 - (index / TRAIL_LENGTH))
        
        if (opacity <= 0) return null
        
        return (
          <div
            key={`${point.timestamp}-${index}`}
            className="cursor-trail"
            style={{
              left: `${point.x}px`,
              top: `${point.y}px`,
              opacity,
              transform: `translate(-50%, -50%) scale(${size})`,
              pointerEvents: 'none',
            }}
          />
        )
      })}
      
      {/* Main cursor */}
      <div
        className={`custom-cursor ${isHovering ? 'hover' : ''}`}
        style={{
          left: `${mousePosition.x}px`,
          top: `${mousePosition.y}px`,
        }}
      />
    </>
  )
}

export default CustomCursor 