export function formatPercent(value) {
  return value === null || value === undefined ? 'N/A' : `${Number(value).toFixed(1)}%`
}

// One palette for the score everywhere (ring, badges, export) so the
// colour always means the same thing.
export function scoreTone(score) {
  if (score === null || score === undefined) return 'slate'
  if (score >= 60) return 'emerald'
  if (score >= 40) return 'indigo'
  if (score >= 20) return 'amber'
  return 'rose'
}

export const TONE_HEX = {
  emerald: '#059669',
  indigo: '#4f46e5',
  amber: '#d97706',
  rose: '#e11d48',
  slate: '#64748b',
}

export const PRIORITY_STYLES = {
  high: 'bg-rose-50 text-rose-700 ring-rose-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  low: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
