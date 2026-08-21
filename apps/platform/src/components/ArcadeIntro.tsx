'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { RotateCcw, X } from 'lucide-react'

const INTRO_KEY = 'avoidgame:intro-seen:v1'
const REPLAY_EVENT = 'avoidgame:replay-intro'

const fallingObjects = [
  { x: '3%', delay: '-.15s', duration: '1.55s', size: '38px', tone: 'teal', shape: 'meteor' },
  { x: '22%', delay: '.38s', duration: '1.42s', size: '22px', tone: 'lime', shape: 'shard' },
  { x: '38%', delay: '.06s', duration: '1.86s', size: '48px', tone: 'orange', shape: 'meteor' },
  { x: '58%', delay: '.74s', duration: '1.22s', size: '18px', tone: 'paper', shape: 'block' },
  { x: '72%', delay: '.25s', duration: '1.58s', size: '31px', tone: 'teal', shape: 'shard' },
  { x: '90%', delay: '.92s', duration: '1.28s', size: '24px', tone: 'lime', shape: 'block' },
  { x: '12%', delay: '1.1s', duration: '1.3s', size: '28px', tone: 'paper', shape: 'shard' },
] as const

type IntroPhase = 'running' | 'impact' | 'exit'

function rememberIntro() {
  try {
    window.sessionStorage.setItem(INTRO_KEY, '1')
  } catch {
    // A blocked storage API should never trap someone in the opening scene.
  }
}

function wasIntroSeen() {
  try {
    return window.sessionStorage.getItem(INTRO_KEY) === '1'
  } catch {
    return true
  }
}

export function ArcadeIntro() {
  const [active, setActive] = useState(false)
  const [phase, setPhase] = useState<IntroPhase>('running')
  const [score, setScore] = useState(0)
  const [cycle, setCycle] = useState(0)
  const skipButton = useRef<HTMLButtonElement>(null)

  const dismiss = useCallback(() => {
    rememberIntro()
    setPhase('exit')
    window.setTimeout(() => setActive(false), 380)
  }, [])

  const start = useCallback(() => {
    setScore(0)
    setPhase('running')
    setCycle((value) => value + 1)
    setActive(true)
  }, [])

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reducedMotion && !wasIntroSeen()) start()

    const replay = () => {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) start()
    }
    window.addEventListener(REPLAY_EVENT, replay)
    return () => window.removeEventListener(REPLAY_EVENT, replay)
  }, [start])

  useEffect(() => {
    if (!active) return

    rememberIntro()
    document.documentElement.classList.add('introLock')
    skipButton.current?.focus()

    const scoreTimer = window.setInterval(() => {
      setScore((value) => Math.min(value + 125, 3200))
    }, 78)
    const impactTimer = window.setTimeout(() => {
      setScore(4800)
      setPhase('impact')
    }, 2240)
    const exitTimer = window.setTimeout(() => setPhase('exit'), 2940)
    const removeTimer = window.setTimeout(() => setActive(false), 3380)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearInterval(scoreTimer)
      window.clearTimeout(impactTimer)
      window.clearTimeout(exitTimer)
      window.clearTimeout(removeTimer)
      window.removeEventListener('keydown', handleKeyDown)
      document.documentElement.classList.remove('introLock')
    }
  }, [active, cycle, dismiss])

  if (!active) return null

  return (
    <div className="arcadeIntro" data-phase={phase} role="dialog" aria-modal="true" aria-label="aVOID Games opening animation" key={cycle}>
      <div className="introScene" aria-hidden="true">
        <div className="introTelemetry">
          <span>AVD / FIRST CONTACT</span>
          <i />
          <span>OBJECT FIELD ACTIVE</span>
        </div>
        <div className="introScoreboard">
          <span>RUN / 01</span>
          <strong>{score.toString().padStart(5, '0')}</strong>
          <small>SCORE</small>
        </div>
        <div className="introMessage">
          <span>MOVE / SURVIVE / REPEAT</span>
          <strong>Keep moving.</strong>
        </div>
        <div className="introObjects">
          {fallingObjects.map((object, index) => (
            <i
              className={`introObject introObject--${object.shape}`}
              data-tone={object.tone}
              key={`${object.x}-${index}`}
              style={{
                '--intro-x': object.x,
                '--intro-delay': object.delay,
                '--intro-duration': object.duration,
                '--intro-size': object.size,
              } as CSSProperties}
            />
          ))}
          <i className="introObject introObject--meteor introObject--boss" data-tone="orange" />
        </div>
        <div className="introRunner">
          <span className="introRunnerSignal" />
          <span className="introRunnerBody" />
          <span className="introRunnerShadow" />
        </div>
        <div className="introGround"><span /><i /><span /></div>
        <div className="introImpact"><span /><span /><span /></div>
        <div className="introWipe" />
      </div>
      <p className="visuallyHidden">A short animated game scene is playing. Press Escape or skip to continue.</p>
      <button className="introSkip" type="button" onClick={dismiss} ref={skipButton}>
        Skip opening <X aria-hidden="true" />
      </button>
    </div>
  )
}

export function IntroReplayButton() {
  return (
    <button
      className="introReplay"
      type="button"
      onClick={() => window.dispatchEvent(new Event(REPLAY_EVENT))}
    >
      <RotateCcw aria-hidden="true" /> Replay opening
    </button>
  )
}
