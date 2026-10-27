import { AlertCircle, Loader2, ShieldCheck, Info } from 'lucide-react'

export function ErrorAlert({ title = 'Something went wrong', message, onDismiss }) {
  if (!message) return null
  return (
    <div role="alert" className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <AlertCircle className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5">{message}</p>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-rose-700 underline-offset-2 hover:underline">
          Dismiss
        </button>
      )}
    </div>
  )
}

export function FieldError({ id, message }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-sm text-rose-700">
      <AlertCircle size={14} aria-hidden="true" /> {message}
    </p>
  )
}

export function InfoNote({ children }) {
  return (
    <div className="flex gap-2 rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
      <Info className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

export function PrivacyNotice({ compact = false }) {
  return (
    <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
      <ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" size={18} aria-hidden="true" />
      <div>
        <p className="font-semibold">Privacy notice</p>
        <p className="mt-0.5">
          Your resume is processed only to produce this analysis. Uploaded files are written to a
          temporary folder, read as text and deleted immediately. Nothing is saved to a database,
          resume text is not logged, and no data is sent to third-party AI services.
          {!compact && ' Results live only in this browser tab and disappear when you reset or close it.'}
        </p>
      </div>
    </div>
  )
}

export function LoadingPanel({ message = 'Analyzing...' }) {
  const steps = ['Extracting text', 'Preprocessing', 'Detecting skills', 'Computing TF-IDF similarity', 'Scoring']
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center" role="status" aria-live="polite">
      <Loader2 className="animate-spin text-indigo-600" size={36} aria-hidden="true" />
      <p className="mt-4 text-lg font-semibold text-slate-900">{message}</p>
      <ul className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-slate-500">
        {steps.map((s) => (
          <li key={s} className="rounded-full bg-slate-100 px-3 py-1">{s}</li>
        ))}
      </ul>
    </div>
  )
}
