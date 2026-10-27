import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Brain,
  ClipboardList,
  FileUp,
  ListChecks,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'

const FEATURES = [
  {
    icon: ScanSearch,
    title: 'Resume text extraction',
    text: 'Reads PDF (PyMuPDF) and DOCX (python-docx) resumes, or text you paste directly.',
  },
  {
    icon: ListChecks,
    title: 'Skill extraction',
    text: '117 skills in 8 categories with alias normalization: JS = JavaScript, ML = Machine Learning.',
  },
  {
    icon: BarChart3,
    title: 'TF-IDF + cosine similarity',
    text: 'Vectorizes both documents and measures how closely their vocabulary overlaps.',
  },
  {
    icon: Target,
    title: 'Skill gap analysis',
    text: 'Shows matched, missing and additional skills, with priorities taken from the job post.',
  },
  {
    icon: Sparkles,
    title: 'Actionable suggestions',
    text: 'Recommendations generated from your results that never invent experience you do not have.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by design',
    text: 'Runs locally without paid AI APIs. Uploaded files are deleted right after processing.',
  },
]

const STEPS = [
  { icon: FileUp, title: 'Upload resume', text: 'PDF, DOCX or pasted text' },
  { icon: ClipboardList, title: 'Add job description', text: 'Paste it or try a sample' },
  { icon: Brain, title: 'Analyze', text: 'NLP pipeline runs on the server' },
  { icon: BarChart3, title: 'View results', text: 'Scores, skill gaps, export' },
]

export default function HomePage() {
  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
            <Brain size={14} aria-hidden="true" /> Natural Language Processing mini project
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            See how well your resume matches the job.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">
            AI Resume Matcher compares your resume with a job description using text preprocessing,
            skill extraction, TF-IDF and cosine similarity. It shows a transparent match score, the
            skills you are missing and what to improve.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/analyze" className="btn-primary px-5 py-3 text-base">
              Match My Resume <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link to="/methodology" className="btn-secondary px-5 py-3 text-base">
              How the scoring works
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            The score measures text and skill similarity. It is not a prediction of whether you will be hired.
          </p>
        </div>

        <div className="card p-6">
          <p className="text-sm font-semibold text-slate-500">How the overall score is computed</p>
          <div className="mt-4 rounded-xl bg-slate-900 p-5 font-mono text-sm leading-relaxed text-slate-100">
            <p><span className="text-indigo-300">Overall</span> = 0.60 × TF-IDF Similarity</p>
            <p className="pl-[4.6rem]">+ 0.40 × Skill Coverage</p>
            <p className="mt-3 text-slate-400"># both components on a 0–100 scale</p>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl bg-indigo-50 p-4">
              <dt className="font-semibold text-indigo-900">TF-IDF Similarity</dt>
              <dd className="mt-1 text-indigo-800">cosine(resume, job) × 100</dd>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <dt className="font-semibold text-emerald-900">Skill Coverage</dt>
              <dd className="mt-1 text-emerald-800">matched ÷ required skills × 100</dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="workflow">
        <h2 id="workflow" className="text-2xl font-bold text-slate-900">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card relative p-5">
              <span className="absolute right-4 top-4 text-sm font-bold text-slate-300">0{i + 1}</span>
              <s.icon className="text-indigo-600" size={24} aria-hidden="true" />
              <p className="mt-3 font-semibold text-slate-900">{s.title}</p>
              <p className="mt-1 text-sm text-slate-500">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="features">
        <h2 id="features" className="text-2xl font-bold text-slate-900">Features</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                <f.icon size={20} aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card flex flex-col items-start gap-4 bg-gradient-to-br from-indigo-600 to-indigo-700 p-8 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Ready to try it?</h2>
          <p className="mt-1 text-indigo-100">Use your own resume or the built-in sample data.</p>
        </div>
        <Link to="/analyze" className="btn bg-white px-5 py-3 text-indigo-700 hover:bg-indigo-50">
          Match My Resume <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  )
}
