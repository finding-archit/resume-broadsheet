import { createContext, useContext, useEffect, useState } from 'react'
import { checkHealth, fetchConfig } from './api.js'
import { DEFAULT_BANDS } from '../utils/format.js'

// Mirrors the backend defaults so the UI still renders sensibly if /api/config
// is unreachable. Live values replace these as soon as the backend answers.
export const DEFAULT_CONFIG = {
  version: '2.0.0',
  weights: { tfidf: 0.6, skill_coverage: 0.4 },
  bands: DEFAULT_BANDS,
  max_file_size_mb: 5,
  min_resume_chars: 50,
  min_resume_words: 10,
  min_job_description_chars: 50,
  min_job_description_words: 10,
  skills_in_taxonomy: 118,
  categories: [],
  keyword_list_cap: 39.9,
}

const ConfigContext = createContext({ config: DEFAULT_CONFIG, online: null })

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [online, setOnline] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchConfig(controller.signal)
      .then((c) => setConfig({ ...DEFAULT_CONFIG, ...c }))
      .catch(() => {})
    return () => controller.abort()
  }, [])

  useEffect(() => {
    let alive = true
    const ping = () =>
      checkHealth()
        .then(() => alive && setOnline(true))
        .catch(() => alive && setOnline(false))
    ping()
    const id = setInterval(ping, 20000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  return <ConfigContext.Provider value={{ config, online }}>{children}</ConfigContext.Provider>
}

export const useConfig = () => useContext(ConfigContext)
