import { useState } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { Footer, Navbar } from './components/Layout.jsx'
import HomePage from './pages/HomePage.jsx'
import AnalyzePage from './pages/AnalyzePage.jsx'
import ResultsPage from './pages/ResultsPage.jsx'
import MethodologyPage from './pages/MethodologyPage.jsx'

const EMPTY_FORM = { mode: 'file', file: null, resumeText: '', jobDescription: '', sampleId: '' }

export default function App() {
  // Form inputs and results are kept in memory only (never localStorage),
  // so nothing about the resume outlives the browser tab.
  const [form, setForm] = useState(EMPTY_FORM)
  const [result, setResult] = useState(null)
  const navigate = useNavigate()

  const reset = () => {
    setForm(EMPTY_FORM)
    setResult(null)
    navigate('/analyze')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/analyze"
            element={
              <AnalyzePage
                form={form}
                setForm={setForm}
                onResult={(r) => {
                  setResult(r)
                  navigate('/results')
                }}
              />
            }
          />
          <Route path="/results" element={<ResultsPage result={result} onReset={reset} />} />
          <Route path="/methodology" element={<MethodologyPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
