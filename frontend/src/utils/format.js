export const DEFAULT_BANDS = [
  { min: 60, label: 'Strong match' },
  { min: 40, label: 'Good match' },
  { min: 20, label: 'Partial match' },
  { min: 0, label: 'Low match' },
]

export function formatPercent(value) {
  return value === null || value === undefined ? 'N/A' : `${Number(value).toFixed(1)}%`
}

export function formatScore(value) {
  return value === null || value === undefined ? 'N/A' : Number(value).toFixed(1)
}

// One palette token per band so the colour always means the same thing.
export function scoreTone(score) {
  if (score === null || score === undefined) return 'muted'
  if (score >= 60) return 'moss'
  if (score >= 40) return 'blueprint'
  if (score >= 20) return 'ochre'
  return 'accent'
}

export function bandFor(score, bands = DEFAULT_BANDS) {
  const sorted = [...bands].sort((a, b) => b.min - a.min)
  return sorted.find((b) => score >= b.min)?.label ?? sorted[sorted.length - 1].label
}

export const PRIORITY_TONE = { high: 'accent', medium: 'ochre', low: 'muted' }

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const ROMAN = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]

export function roman(n) {
  let out = ''
  for (const [v, s] of ROMAN) {
    while (n >= v) {
      out += s
      n -= v
    }
  }
  return out
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}
