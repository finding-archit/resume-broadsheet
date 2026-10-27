// API client for the FastAPI backend.
// In development, Vite proxies /api to http://127.0.0.1:8000 (see vite.config.js).
// Set VITE_API_URL to call a backend on another origin.
const API_BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function errorMessage(body, status) {
  const detail = body?.detail
  if (typeof detail === 'string') return detail
  // FastAPI validation errors are a list of { loc, msg }.
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((d) => `${d.loc?.slice(-1)[0] ?? 'field'}: ${d.msg}`)
      .join('; ')
  }
  return `Request failed with status ${status}.`
}

export async function analyzeResume({ file, resumeText, jobDescription, signal }) {
  const form = new FormData()
  form.append('job_description', jobDescription)
  if (file) form.append('resume_file', file)
  else form.append('resume_text', resumeText)

  let response
  try {
    response = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', body: form, signal })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError(
      'Could not reach the analysis server. Make sure the backend is running on port 8000.',
      0,
    )
  }

  const body = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(errorMessage(body, response.status), response.status)
  return body
}

export async function checkHealth() {
  const response = await fetch(`${API_BASE}/api/health`)
  if (!response.ok) throw new ApiError('Backend health check failed.', response.status)
  return response.json()
}
