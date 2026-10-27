import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  FileDown,
  FileSpreadsheet,
  FileText,
  ListChecks,
  RotateCcw,
  TextSearch,
} from 'lucide-react'
import { PageHeader } from '../components/Layout.jsx'
import { ErrorAlert } from '../components/Feedback.jsx'
import {
  CategoryChart,
  KeywordTable,
  MetricCard,
  ProgressBar,
  RecommendationList,
  ScoreRing,
  SkillGroup,
} from '../components/ResultWidgets.jsx'
import { downloadCsv, downloadPdf } from '../utils/exportResults.js'
import { TONE_HEX, formatPercent, scoreTone } from '../utils/format.js'

function EmptyState() {
  return (
    <div className="card mx-auto max-w-lg p-10 text-center">
      <TextSearch className="mx-auto text-slate-400" size={40} aria-hidden="true" />
      <h1 className="mt-4 text-xl font-bold text-slate-900">No results yet</h1>
      <p className="mt-2 text-slate-600">
        Run an analysis first. Results are kept only in this browser tab and are cleared when you
        reset or reload the page.
      </p>
      <Link to="/analyze" className="btn-primary mt-6">
        Start an analysis <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  )
}

export default function ResultsPage({ result, onReset }) {
  const [exportError, setExportError] = useState(null)
  const [exporting, setExporting] = useState(false)

  if (!result) return <EmptyState />

  const method = result.scoring_method
  const tone = scoreTone(result.overall_match_score)
  const source =
    result.input_source?.type === 'file' ? result.input_source.filename : 'Pasted resume text'

  const exportPdf = async () => {
    setExportError(null)
    setExporting(true)
    try {
      await downloadPdf(result)
    } catch {
      setExportError('The PDF could not be generated. Try the CSV export instead.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 3: Results"
        title="Resume match analysis"
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => downloadCsv(result)}>
              <FileSpreadsheet size={16} aria-hidden="true" /> Export CSV
            </button>
            <button type="button" className="btn-secondary" onClick={exportPdf} disabled={exporting}>
              <FileDown size={16} aria-hidden="true" /> {exporting ? 'Generating...' : 'Export PDF'}
            </button>
            <button type="button" className="btn-primary" onClick={onReset}>
              <RotateCcw size={16} aria-hidden="true" /> New analysis
            </button>
          </>
        }
      >
        <span className="inline-flex items-center gap-1.5">
          <FileText size={15} aria-hidden="true" /> {source} · {result.extracted_resume_text_length.toLocaleString()} characters extracted
        </span>
      </PageHeader>

      {exportError && <ErrorAlert title="Export failed" message={exportError} onDismiss={() => setExportError(null)} />}

      {result.warnings.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
          <ul className="space-y-0.5">
            {result.warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Score overview */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card flex flex-col items-center p-6 text-center" aria-labelledby="overall-heading">
          <h2 id="overall-heading" className="section-title">Overall match score</h2>
          <div className="mt-4">
            <ScoreRing score={result.overall_match_score} />
          </div>
          <span
            className="mt-4 rounded-full px-3 py-1 text-sm font-semibold text-white"
            style={{ backgroundColor: TONE_HEX[tone] }}
          >
            {result.match_level}
          </span>
          <p className="mt-3 text-xs text-slate-500">
            A similarity score, not a probability of being hired.
          </p>
        </section>

        <div className="grid gap-6 sm:grid-cols-2 lg:col-span-2">
          <MetricCard
            icon={TextSearch}
            label="TF-IDF similarity"
            value={formatPercent(result.tfidf_similarity)}
            hint={`Cosine similarity of the TF-IDF vectors × 100. Weight in overall score: ${(method.weights.tfidf * 100).toFixed(0)}%.`}
          >
            <ProgressBar value={result.tfidf_similarity} color="#4f46e5" />
          </MetricCard>
          <MetricCard
            icon={ListChecks}
            label="Skill coverage"
            value={formatPercent(result.skill_coverage)}
            hint={
              result.skill_coverage === null
                ? 'No taxonomy skills were found in the job description.'
                : `${result.matched_skills.length} of ${result.job_skill_count} job-description skills found. Weight: ${(method.weights.skill_coverage * 100).toFixed(0)}%.`
            }
          >
            <ProgressBar value={result.skill_coverage} color="#059669" />
          </MetricCard>
          <section className="card p-5 sm:col-span-2" aria-labelledby="calc-heading">
            <h2 id="calc-heading" className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Calculator size={16} aria-hidden="true" /> How this score was calculated
            </h2>
            {result.skill_coverage === null ? (
              <p className="mt-2 font-mono text-sm text-slate-800">
                Overall = TF-IDF similarity = {result.tfidf_similarity.toFixed(1)}
              </p>
            ) : (
              <p className="mt-2 font-mono text-sm text-slate-800">
                {method.weights.tfidf.toFixed(2)} × {result.tfidf_similarity.toFixed(1)} + {method.weights.skill_coverage.toFixed(2)} × {result.skill_coverage.toFixed(1)} ={' '}
                <strong>{result.overall_match_score.toFixed(1)}</strong>
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              {method.overall_formula}.{' '}
              <Link to="/methodology" className="font-medium text-indigo-600 hover:underline">Read the methodology</Link>
            </p>
          </section>
        </div>
      </div>

      {/* Skills */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SkillGroup
          variant="matched"
          title="Matched skills"
          description="Job-description skills found in your resume."
          skills={result.matched_skills}
          emptyText="None of the job-description skills were found in your resume."
          footer={
            result.alternative_skills.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                {result.alternative_skills.map((a) => (
                  <li key={a.name}>
                    <strong className="font-semibold text-slate-700">{a.name}</strong> not required:
                    listed as an alternative to {a.satisfied_by.join(', ')}.
                  </li>
                ))}
              </ul>
            )
          }
        />
        <SkillGroup
          variant="missing"
          title="Missing skills"
          description="Job-description skills not found in your resume, highest priority first."
          skills={result.missing_skills}
          emptyText="No missing skills. Your resume mentions every skill detected in the job description."
        />
        <SkillGroup
          variant="additional"
          title="Additional skills"
          description="Skills on your resume that this job description does not mention."
          skills={result.additional_skills}
          emptyText="No additional skills detected."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6" aria-labelledby="cat-heading">
          <h2 id="cat-heading" className="section-title">Skill coverage by category</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">Job-description skills in each category, split into matched and missing.</p>
          <CategoryChart data={result.category_breakdown} />
        </section>
        <section className="card p-6" aria-labelledby="kw-heading">
          <h2 id="kw-heading" className="section-title">Job description keyword analysis</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">
            The {result.job_description_keywords.length} highest-weighted TF-IDF terms in the job description.
          </p>
          <KeywordTable keywords={result.job_description_keywords} />
        </section>
      </div>

      <section className="card p-6" aria-labelledby="rec-heading">
        <h2 id="rec-heading" className="section-title">Personalized recommendations</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Generated from this analysis. Only add skills or keywords that reflect experience you genuinely have.
        </p>
        <RecommendationList items={result.recommendations} />
      </section>

      <section className="card p-6 text-sm text-slate-600" aria-labelledby="method-heading">
        <h2 id="method-heading" className="section-title">Scoring method</h2>
        <dl className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <dt className="font-semibold text-slate-800">TF-IDF similarity</dt>
            <dd className="mt-1">{method.tfidf_formula}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-800">Skill coverage</dt>
            <dd className="mt-1">{method.skill_coverage_formula}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-800">Weights</dt>
            <dd className="mt-1">{method.weights_rationale}</dd>
          </div>
        </dl>
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-slate-600">{method.disclaimer}</p>
      </section>
    </div>
  )
}
