import { useEffect, useRef, useState } from 'react'

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Animate a number from 0 (or its previous value) to `target`. */
export function useCountUp(target, duration = 1100) {
  const [value, setValue] = useState(reduceMotion() ? target : 0)
  const from = useRef(0)
  useEffect(() => {
    if (reduceMotion()) {
      setValue(target)
      return undefined
    }
    const start = performance.now()
    const begin = from.current
    let raf
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(begin + (target - begin) * eased)
      if (t < 1) raf = requestAnimationFrame(step)
      else from.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

/** A numbered editorial figure: kicker, title, body and caption. */
export function Figure({ n, kicker, title, caption, className = '', children, id, actions }) {
  return (
    <figure id={id} className={`panel flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker">{n ? `Fig. ${n} · ` : ''}{kicker}</p>
          {title && <h3 className="mt-1 font-display text-[1.45rem] font-semibold leading-tight">{title}</h3>}
        </div>
        {actions}
      </div>
      <div className="mt-4 flex-1">{children}</div>
      {caption && <figcaption className="mt-4 border-t border-rule/25 pt-2 text-xs italic leading-relaxed text-muted">{caption}</figcaption>}
    </figure>
  )
}

const TAG_TONES = {
  moss: 'border-moss text-moss',
  accent: 'border-accent text-accent',
  ochre: 'border-ochre text-ochre',
  blueprint: 'border-blueprint text-blueprint',
  muted: 'border-rule/40 text-muted',
  ink: 'border-rule text-ink',
}

export function Tag({ tone = 'muted', children, title }) {
  return (
    <span className={`tag ${TAG_TONES[tone]}`} title={title}>
      {children}
    </span>
  )
}

export function Empty({ children }) {
  return <p className="border border-dashed border-rule/40 p-4 text-sm italic text-muted">{children}</p>
}
