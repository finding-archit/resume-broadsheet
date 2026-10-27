import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { PageHeader } from '../components/Layout.jsx'

const PIPELINE = [
  {
    title: '1. Text extraction',
    body: 'PDF resumes are read with PyMuPDF and DOCX resumes with python-docx (paragraphs and tables). Files are checked by extension, size (5 MB) and file signature, written to a private temporary folder and deleted immediately. Scanned image-only PDFs are rejected because OCR is not implemented.',
  },
  {
    title: '2. Preprocessing',
    body: 'Unicode normalization (NFKC) fixes ligatures, hyphenated line breaks are re-joined, bullets, URLs, e-mail addresses and phone numbers are removed, and whitespace is collapsed. A custom tokenizer keeps technical terms such as C++, C#, .NET, Node.js and CI/CD intact. Stop words come from scikit-learn\'s English list plus a small resume-specific list.',
  },
  {
    title: '3. Skill extraction',
    body: 'A taxonomy of 117 skills in 8 categories is matched with regular expressions using technical-term boundaries, so "Java" does not match "JavaScript" and "C" does not match "C++". Aliases are normalized (JS → JavaScript, ML → Machine Learning, AWS → Amazon Web Services). Short, ambiguous names such as C, R and Go are matched case-sensitively. In the job description, each skill is labelled required, mentioned or preferred from its section and wording.',
  },
  {
    title: '4. TF-IDF vectorization',
    body: 'Each detected skill is replaced by one canonical token so aliases count as the same term. A TfidfVectorizer (sublinear TF, smoothed IDF, L2 normalization) is fitted on the resume and the job description together, and the cosine similarity of the two vectors is computed.',
  },
  {
    title: '5. Skill matching',
    body: 'The skills found in both documents are compared to produce matched, missing and additional skills. Closely related skills are inferred (PostgreSQL implies SQL) and flagged as inferred. Skills offered as alternatives in the job description ("FastAPI, Django or Flask") count as satisfied when the resume has one of the options.',
  },
  {
    title: '6. Scoring and recommendations',
    body: 'The two components are combined with configurable weights. Rule-based recommendations are generated from the missing skills, their importance, keyword gaps and the similarity score, and never suggest claiming experience the candidate does not have.',
  },
]

function Formula({ children }) {
  return <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm leading-relaxed text-slate-100">{children}</pre>
}

export default function MethodologyPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="About" title="NLP methodology">
        How AI Resume Matcher turns two documents into a transparent, explainable score.
      </PageHeader>

      <section className="grid gap-4 md:grid-cols-2">
        {PIPELINE.map((step) => (
          <div key={step.title} className="card p-6">
            <h2 className="section-title">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
          </div>
        ))}
      </section>

      <section className="card p-6">
        <h2 className="section-title">Formulas</h2>
        <Formula>{`TF-IDF(t, d) = (1 + log tf(t, d)) × (ln((1 + n) / (1 + df(t))) + 1)     # n = 2 documents
cosine(A, B)  = (A · B) / (‖A‖ × ‖B‖)

TF-IDF Similarity (%) = cosine(resume, job description) × 100
Skill Coverage (%)    = matched JD skills / unique JD skills × 100   (unavailable if 0 JD skills)
Overall Match Score   = 0.60 × TF-IDF Similarity + 0.40 × Skill Coverage`}</Formula>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          <strong>Why 60 / 40?</strong> TF-IDF looks at the whole text, including responsibilities and
          domain vocabulary, so it gets the larger share. Skill coverage rewards matching the listed
          skills explicitly, but it can only see skills that are in the taxonomy. The weights are
          heuristic and configurable (<code>TFIDF_WEIGHT</code>, <code>SKILL_WEIGHT</code>); they have
          not been validated against hiring outcomes. If no skills are detected in the job
          description, the overall score falls back to TF-IDF similarity alone, and the results page
          says so.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="section-title">Interpreting the score</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li><strong className="text-emerald-700">60–100 Strong match:</strong> most required skills and much of the vocabulary overlap.</li>
            <li><strong className="text-indigo-700">40–59 Good match:</strong> solid overlap with some gaps.</li>
            <li><strong className="text-amber-700">20–39 Partial match:</strong> several important skills or topics are missing.</li>
            <li><strong className="text-rose-700">0–19 Low match:</strong> the documents have little in common.</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Bands are calibrated to the observed range of TF-IDF cosine values: two different real
            documents rarely exceed about 45% similarity even when closely related, so 20–40% TF-IDF
            similarity already indicates meaningful overlap.
          </p>
        </div>
        <div className="card p-6">
          <h2 className="section-title">Limitations</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            <li>Matching is lexical. Synonyms or skills outside the taxonomy can be missed, and context (for example "no experience with X") is not understood.</li>
            <li>TF-IDF similarity is not a measure of candidate quality or hiring probability.</li>
            <li>Fitting TF-IDF on two documents gives a small IDF range, so shared terms are slightly down-weighted.</li>
            <li>Scanned PDFs need OCR, which is not implemented.</li>
            <li>No semantic sentence embeddings are used; this keeps the system offline and deterministic.</li>
          </ul>
        </div>
      </section>

      <div className="flex justify-end">
        <Link to="/analyze" className="btn-primary">
          Try it now <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
