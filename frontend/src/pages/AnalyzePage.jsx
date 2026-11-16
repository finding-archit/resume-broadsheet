import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ClipboardType, FileUp, RotateCcw } from 'lucide-react'
import FileDropzone from '../components/FileDropzone.jsx'
import { ErrorAlert, FieldError, PressRoom, PrivacyNote } from '../components/Feedback.jsx'
import { PageHeader } from '../components/Layout.jsx'
import { analyzeResume } from '../services/api.js'
import { SAMPLE_JOBS, SAMPLE_RESUMES } from '../data/sampleJobs.js'
import {
  MIN_JD_WORDS,
  countWords,
  validateForm,
  validateJobDescription,
  validateResumeText,
} from '../utils/validation.js'

const TABS = [
  { id: 'file', label: 'Upload a file', icon: FileUp },
  { id: 'text', label: 'Paste the text', icon: ClipboardType },
]

function Exhibit({ letter, title, note, id, children }) {
  return (
    <section id={id} tabIndex={-1} className="sheet flex flex-col p-6 focus:outline-none sm:p-8" aria-labelledby={`${id}-title`}>
      <div className="flex items-start justify-between gap-4 border-b-2 border-rule pb-4">
        <div>
          <p className="kicker">Exhibit {letter}</p>
          <h2 id={`${id}-title`} className="mt-1 font-display text-3xl font-semibold">{title}</h2>
        </div>
        <span className="font-display text-6xl font-bold leading-none text-rule/10" aria-hidden="true">{letter}</span>
      </div>
      {note && <p className="mt-3 text-sm text-ink2">{note}</p>}
      <div className="mt-5 flex flex-1 flex-col">{children}</div>
    </section>
  )
}

function ReadyItem({ ok, label, detail }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`grid h-5 w-5 place-items-center border-2 ${ok ? 'border-moss bg-moss text-paper' : 'border-rule/40'}`}>
        {ok && <Check size={12} strokeWidth={3} aria-hidden="true" />}
      </span>
      <span className={ok ? 'text-ink' : 'text-muted'}>{label}</span>
      <span className="hidden text-muted sm:inline">· {detail}</span>
    </span>
  )
}

export default function AnalyzePage({ form, setForm, onResult }) {
  const [errors, setErrors] = useState({ resume: null, job: null })
  const [serverError, setServerError] = useState(null)
  const [loading, setLoading] = useState(false)
  const controllerRef = useRef(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const update = (patch) => setForm((f) => ({ ...f, ...patch }))
  // Once an error is showing, re-check on every edit so it disappears as soon as the input is valid.
  const setResumeText = (resumeText, extra = {}) => {
    update({ resumeText, ...extra })
    setErrors((er) => (er.resume ? { ...er, resume: validateResumeText(resumeText) } : er))
  }
  const setJob = (jobDescription, extra = {}) => {
    update({ jobDescription, ...extra })
    setErrors((er) => (er.job ? { ...er, job: validateJobDescription(jobDescription) } : er))
  }

  const jdWords = countWords(form.jobDescription)
  const resumeWords = countWords(form.resumeText)
  const resumeReady = form.mode === 'file' ? Boolean(form.file) : !validateResumeText(form.resumeText)
  const jobReady = !validateJobDescription(form.jobDescription)

  const submit = async (e) => {
    e.preventDefault()
    setServerError(null)
    const found = validateForm(form)
    setErrors(found)
    if (found.resume || found.job) {
      document.getElementById(found.resume ? 'exhibit-a' : 'exhibit-b')?.focus()
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
    return (
      <PressRoom
        title={form.mode === 'file' ? `Analysing ${form.file?.name}` : 'Analysing your résumé'}
        onCancel={() => controllerRef.current?.abort()}
      />
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        kicker="Section II · Submit"
        title={<>File your <em className="text-accent">documents</em>.</>}
        dek="Two exhibits go in: the résumé you have and the job you want. The analysis runs on your own machine and nothing is kept."
      />

      {serverError && (
        <div className="mb-8">
          <ErrorAlert title="Analysis failed" message={serverError} onDismiss={() => setServerError(null)} />
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-2">
        <Exhibit letter="A" id="exhibit-a" title="The résumé">
          <div role="tablist" aria-label="Résumé input method" className="flex border-b-2 border-rule">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={form.mode === t.id}
                aria-controls={`panel-${t.id}`}
                onClick={() => {
                  update({ mode: t.id })
                  setErrors((er) => ({ ...er, resume: null }))
                }}
                className={`-mb-[2px] inline-flex items-center gap-2 border-2 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
                  form.mode === t.id ? 'border-rule border-b-card bg-card text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                <t.icon size={14} aria-hidden="true" /> {t.label}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-1 flex-col">
            {form.mode === 'file' ? (
              <div id="panel-file" role="tabpanel" className="flex flex-1 flex-col">
                <label htmlFor="resume-file" className="sr-only">Résumé file</label>
                <FileDropzone
                  file={form.file}
                  onChange={(file) => update({ file })}
                  error={errors.resume}
                  onError={(msg) => setErrors((er) => ({ ...er, resume: msg }))}
                  describedBy="resume-error"
                />
                <p className="mt-4 text-sm text-ink2">
                  No résumé to hand?{' '}
                  <button type="button" className="btn-link normal-case tracking-normal" onClick={() => update({ mode: 'text' })}>
                    Use a sample manuscript
                  </button>
                </p>
              </div>
            ) : (
              <div id="panel-text" role="tabpanel" className="flex flex-1 flex-col">
                <p className="kicker mb-2">Sample manuscripts · fictional</p>
                <div className="grid grid-cols-3 gap-2">
                  {SAMPLE_RESUMES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setResumeText(s.text, { sampleResumeId: s.id })}
                      className={`border-2 p-2.5 text-left transition-colors ${
                        form.sampleResumeId === s.id && form.resumeText === s.text
                          ? 'border-accent bg-accent/5'
                          : 'border-rule/30 hover:border-rule'
                      }`}
                    >
                      <span className="block font-display text-[15px] font-semibold leading-tight">{s.name}</span>
                      <span className="block text-xs text-ink2">{s.role}</span>
                      <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-wider text-muted">{s.note}</span>
                    </button>
                  ))}
                </div>
                <label htmlFor="resume-text" className="kicker mb-2 mt-5">Résumé text</label>
                <textarea
                  id="resume-text"
                  rows={13}
                  className="field lined flex-1 resize-y font-mono text-[13px]"
                  placeholder="Paste the full text of your résumé…"
                  value={form.resumeText}
                  aria-invalid={Boolean(errors.resume)}
                  aria-describedby="resume-error"
                  onChange={(e) => setResumeText(e.target.value, { sampleResumeId: '' })}
                />
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{resumeWords} words</p>
              </div>
            )}
            <FieldError id="resume-error" message={errors.resume} />
          </div>
        </Exhibit>

        <Exhibit letter="B" id="exhibit-b" title="The job description">
          <p className="kicker mb-2">Classifieds · sample posts, fictional</p>
          <div className="grid grid-cols-2 gap-2">
            {SAMPLE_JOBS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setJob(s.text, { sampleJobId: s.id })}
                className={`border-2 px-3 py-2 text-left transition-colors ${
                  form.sampleJobId === s.id ? 'border-accent bg-accent/5' : 'border-rule/30 hover:border-rule'
                }`}
              >
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted">Wanted</span>
                <span className="block font-display text-[15px] font-semibold leading-tight">{s.title}</span>
              </button>
            ))}
          </div>
          <label htmlFor="job-description" className="kicker mb-2 mt-5">Job description text</label>
          <textarea
            id="job-description"
            rows={13}
            className="field lined flex-1 resize-y text-[14.5px]"
            placeholder="Paste the job description, including responsibilities and requirements…"
            value={form.jobDescription}
            aria-invalid={Boolean(errors.job)}
            aria-describedby="job-error job-count"
            onChange={(e) => setJob(e.target.value, { sampleJobId: '' })}
          />
          <p id="job-count" className={`mt-2 font-mono text-[11px] uppercase tracking-[0.14em] ${jdWords > 0 && jdWords < MIN_JD_WORDS ? 'text-ochre' : 'text-muted'}`}>
            {jdWords} words {jdWords < MIN_JD_WORDS && `· minimum ${MIN_JD_WORDS}`}
          </p>
          <FieldError id="job-error" message={errors.job} />
        </Exhibit>
      </div>

      <div className="mt-10 max-w-3xl">
        <PrivacyNote />
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-10 border-t-[3px] border-double border-rule bg-paper/95 px-4 py-4 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.12em]">
            <span className="kicker">Proof check</span>
            <ReadyItem
              ok={resumeReady}
              label="Résumé"
              detail={form.mode === 'file' ? (form.file ? form.file.name : 'no file yet') : `${resumeWords} words`}
            />
            <ReadyItem ok={jobReady} label="Job description" detail={`${jdWords} words`} />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-paper"
              onClick={() => {
                setForm({ mode: form.mode, file: null, resumeText: '', jobDescription: '', sampleJobId: '', sampleResumeId: '' })
                setErrors({ resume: null, job: null })
                setServerError(null)
              }}
            >
              <RotateCcw size={14} aria-hidden="true" /> Clear
            </button>
            <button type="submit" className="btn-accent px-7">
              Run the analysis <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
