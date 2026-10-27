import { useEffect, useRef, useState } from 'react'
import { ClipboardType, FileUp, Play, RotateCcw, FlaskConical } from 'lucide-react'
import FileDropzone from '../components/FileDropzone.jsx'
import { ErrorAlert, FieldError, LoadingPanel, PrivacyNotice } from '../components/Feedback.jsx'
import { PageHeader } from '../components/Layout.jsx'
import { analyzeResume } from '../services/api.js'
import { SAMPLE_JOBS, SAMPLE_RESUME_TEXT } from '../data/sampleJobs.js'
import { countWords, validateForm, MIN_JD_WORDS } from '../utils/validation.js'

const TABS = [
  { id: 'file', label: 'Upload file', icon: FileUp },
  { id: 'text', label: 'Paste text', icon: ClipboardType },
]

export default function AnalyzePage({ form, setForm, onResult }) {
  const [errors, setErrors] = useState({ resume: null, job: null })
  const [serverError, setServerError] = useState(null)
  const [loading, setLoading] = useState(false)
  const controllerRef = useRef(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const update = (patch) => setForm((f) => ({ ...f, ...patch }))
  const jdWords = countWords(form.jobDescription)

  const submit = async (e) => {
    e.preventDefault()
    setServerError(null)
    const found = validateForm(form)
    setErrors(found)
    if (found.resume || found.job) {
      document.getElementById(found.resume ? 'resume-section' : 'job-description')?.focus()
      return
    }
    controllerRef.current = new AbortController()
    setLoading(true)
    try {
      const result = await analyzeResume({
        file: form.mode === 'file' ? form.file : null,
        resumeText: form.resumeText,
        jobDescription: form.jobDescription,
        signal: controllerRef.current.signal,
      })
      onResult(result)
    } catch (err) {
      if (err.name !== 'AbortError') setServerError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingPanel message={form.mode === 'file' ? `Analyzing ${form.file?.name}...` : 'Analyzing your resume...'} />
  }

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader eyebrow="Step 1 & 2" title="Resume and job description">
        Provide your resume and the job description you are targeting. The analysis runs on the
        local backend; nothing is stored.
      </PageHeader>

      {serverError && (
        <div className="mb-6">
          <ErrorAlert title="Analysis failed" message={serverError} onDismiss={() => setServerError(null)} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Resume input */}
        <section
          id="resume-section"
          tabIndex={-1}
          className="card p-6 focus:outline-none"
          aria-labelledby="resume-heading"
        >
          <h2 id="resume-heading" className="section-title">Your resume</h2>
          <div role="tablist" aria-label="Resume input method" className="mt-4 inline-flex rounded-lg bg-slate-100 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={form.mode === t.id}
                aria-controls={`panel-${t.id}`}
                onClick={() => { update({ mode: t.id }); setErrors((er) => ({ ...er, resume: null })) }}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  form.mode === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <t.icon size={16} aria-hidden="true" /> {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {form.mode === 'file' ? (
              <div id="panel-file" role="tabpanel">
                <label htmlFor="resume-file" className="sr-only">Resume file</label>
                <FileDropzone
                  file={form.file}
                  onChange={(file) => update({ file })}
                  error={errors.resume}
                  onError={(msg) => setErrors((er) => ({ ...er, resume: msg }))}
                  describedBy="resume-error"
                />
              </div>
            ) : (
              <div id="panel-text" role="tabpanel">
                <div className="flex items-center justify-between">
                  <label htmlFor="resume-text" className="label">Resume text</label>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                    onClick={() => update({ resumeText: SAMPLE_RESUME_TEXT })}
                  >
                    <FlaskConical size={14} aria-hidden="true" /> Load sample resume
                  </button>
                </div>
                <textarea
                  id="resume-text"
                  rows={14}
                  className="input mt-2 font-mono text-[13px]"
                  placeholder="Paste the full text of your resume..."
                  value={form.resumeText}
                  aria-invalid={Boolean(errors.resume)}
                  aria-describedby="resume-error"
                  onChange={(e) => update({ resumeText: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-500">{countWords(form.resumeText)} words</p>
              </div>
            )}
            <FieldError id="resume-error" message={errors.resume} />
          </div>
        </section>

        {/* Job description input */}
        <section className="card p-6" aria-labelledby="jd-heading">
          <h2 id="jd-heading" className="section-title">Job description</h2>
          <div className="mt-4">
            <label htmlFor="sample-job" className="text-sm font-medium text-slate-700">
              Try a sample job description <span className="font-normal text-slate-500">(fictional sample data)</span>
            </label>
            <select
              id="sample-job"
              className="input mt-1.5"
              value={form.sampleId}
              onChange={(e) => {
                const sample = SAMPLE_JOBS.find((s) => s.id === e.target.value)
                update({ sampleId: e.target.value, jobDescription: sample ? sample.text : form.jobDescription })
                setErrors((er) => ({ ...er, job: null }))
              }}
            >
              <option value="">Choose a sample...</option>
              {SAMPLE_JOBS.map((s) => (
                <option key={s.id} value={s.id}>SAMPLE: {s.title}</option>
              ))}
            </select>
          </div>
          <label htmlFor="job-description" className="label mt-4">Job description text</label>
          <textarea
            id="job-description"
            rows={14}
            className="input mt-2"
            placeholder="Paste the job description, including responsibilities and requirements..."
            value={form.jobDescription}
            aria-invalid={Boolean(errors.job)}
            aria-describedby="job-error job-count"
            onChange={(e) => update({ jobDescription: e.target.value, sampleId: '' })}
          />
          <p id="job-count" className={`mt-1 text-xs ${jdWords > 0 && jdWords < MIN_JD_WORDS ? 'text-amber-700' : 'text-slate-500'}`}>
            {jdWords} words {jdWords < MIN_JD_WORDS && `(minimum ${MIN_JD_WORDS})`}
          </p>
          <FieldError id="job-error" message={errors.job} />
        </section>
      </div>

      <div className="mt-6">
        <PrivacyNotice />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setForm({ mode: form.mode, file: null, resumeText: '', jobDescription: '', sampleId: '' })
            setErrors({ resume: null, job: null })
            setServerError(null)
          }}
        >
          <RotateCcw size={16} aria-hidden="true" /> Clear
        </button>
        <button type="submit" className="btn-primary px-6">
          <Play size={16} aria-hidden="true" /> Analyze Match
        </button>
      </div>
    </form>
  )
}
