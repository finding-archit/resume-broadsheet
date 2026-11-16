import { useEffect, useState } from 'react'
import { AlertTriangle, ShieldCheck, X } from 'lucide-react'

export function ErrorAlert({ title = 'Something went wrong', message, onDismiss }) {
  if (!message) return null
  return (
    <div role="alert" className="flex gap-4 border-2 border-accent bg-accent/5 p-4 text-ink">
      <AlertTriangle className="mt-0.5 shrink-0 text-accent" size={20} aria-hidden="true" />
      <div className="flex-1">
        <p className="kicker text-accent">Correction · {title}</p>
        <p className="mt-1 font-display text-lg leading-snug">{message}</p>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="self-start text-ink2 hover:text-accent" aria-label="Dismiss">
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export function FieldError({ id, message }) {
  if (!message) return null
  return (
    <p id={id} className="mt-2 flex items-start gap-2 border-l-[3px] border-accent pl-2 text-sm text-accent">
      {message}
    </p>
  )
}

export function PrivacyNote() {
  return (
    <aside className="flex gap-3 border-l-[3px] border-moss pl-4 text-sm leading-relaxed text-ink2">
      <ShieldCheck className="mt-0.5 shrink-0 text-moss" size={18} aria-hidden="true" />
      <p>
        <span className="font-semibold text-ink">Off the record.</span> Your résumé is processed only to produce
        this report. Uploads are read in a private temporary folder and deleted immediately; nothing is saved to a
        database, résumé text is never logged, and nothing is sent to third-party AI services. Results live only in
        this browser tab.
      </p>
    </aside>
  )
}

const STAGES = [
  'Reading the manuscript',
  'Cleaning the copy',
  'Finding skills in the text',
  'Weighing every word (TF-IDF)',
  'Measuring the angle between documents',
  'Setting the report in type',
]

export function PressRoom({ title, onCancel }) {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setStage((s) => (s + 1) % STAGES.length), 650)
    return () => clearInterval(id)
  }, [])
  return (
    <section className="sheet mx-auto max-w-2xl p-8 sm:p-12" role="status" aria-live="polite">
      <p className="kicker text-accent">Stop the presses</p>
      <h1 className="headline mt-3 text-4xl">{title}</h1>
      <div className="mt-8 h-[3px] w-full overflow-hidden bg-rule/15">
        <div className="h-full w-full origin-left animate-press bg-accent" />
      </div>
      <ol className="mt-6 space-y-2 font-mono text-xs uppercase tracking-[0.14em]">
        {STAGES.map((s, i) => (
          <li key={s} className={`flex items-center gap-3 transition-colors ${i === stage ? 'text-ink' : 'text-muted/60'}`}>
            <span className={`h-1.5 w-1.5 ${i === stage ? 'bg-accent' : 'bg-muted/40'}`} />
            {s}
          </li>
        ))}
      </ol>
      {onCancel && (
        <button type="button" className="btn-paper mt-8" onClick={onCancel}>
          Cancel analysis
        </button>
      )}
    </section>
  )
}
