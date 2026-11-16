import { useCallback, useState } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { Colophon, Masthead } from './components/Layout.jsx'
import { ConfigProvider } from './services/config.jsx'
import { ThemeProvider } from './utils/theme.jsx'
import HomePage from './pages/HomePage.jsx'
import AnalyzePage from './pages/AnalyzePage.jsx'
import ResultsPage from './pages/ResultsPage.jsx'
import MethodologyPage from './pages/MethodologyPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'

const EMPTY_FORM = { mode: 'file', file: null, resumeText: '', jobDescription: '', sampleJobId: '', sampleResumeId: '' }

export default function App() {
  // Inputs, results and revisions are kept in memory only (never localStorage),
  // so nothing about the résumé outlives the browser tab.
  const [form, setForm] = useState(EMPTY_FORM)
  const [runs, setRuns] = useState([])
  const [active, setActive] = useState(-1)
  const navigate = useNavigate()

  const addRun = useCallback((result, input, label) => {
    setRuns((prev) => {
      const next = [...prev, { id: prev.length + 1, at: new Date(), label, result, input }]
      setActive(next.length - 1)
      return next
    })
  }, [])

  const reset = () => {
    setForm(EMPTY_FORM)
    setRuns([])
    setActive(-1)
    navigate('/analyze')
  }

  const current = runs[active] ?? null

  return (
    <ThemeProvider>
      <ConfigProvider>
        <div className="flex min-h-screen flex-col">
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
            Skip to content
          </a>
          <Masthead />
          <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-10 sm:px-8">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route
                path="/analyze"
                element={
                  <AnalyzePage
                    form={form}
                    setForm={setForm}
                    onResult={(result) => {
                      addRun(result, { ...form }, 'Original')
                      navigate('/results')
                    }}
                  />
                }
              />
              <Route
                path="/results"
                element={
                  <ResultsPage
                    run={current}
                    runs={runs}
                    onSelectRun={setActive}
                    onAddRun={addRun}
                    onReset={reset}
                  />
                }
              />
              <Route path="/methodology" element={<MethodologyPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Colophon />
        </div>
      </ConfigProvider>
    </ThemeProvider>
  )
}
