import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, FileDown, FileSpreadsheet, RotateCcw } from 'lucide-react'
import { PageHeader, SectionHead } from '../components/Layout.jsx'
import { ErrorAlert } from '../components/Feedback.jsx'
import { Figure, Tag } from '../components/report/common.jsx'
import { MeterBar, ScoreAnatomy, ScoreGauge } from '../components/report/ScoreFigures.jsx'
import SkillConstellation from '../components/report/SkillConstellation.jsx'
import { CategoryRadar, KeywordCloud, SimilarityTerms, SkillLedger, SkillVenn, TriageBoard } from '../components/report/SkillCharts.jsx'
import { AnnotatedDocs, CompareDesk, Recommendations, Revisions, WhatIfDesk } from '../components/report/Desk.jsx'
import { downloadCsv, downloadPdf } from '../utils/exportResults.js'
import { formatPercent } from '../utils/format.js'
import { reportHeadline } from '../utils/report.js'

const JUMPS = [
  ['score', 'The score'],
  ['skills', 'The skills'],
  ['words', 'The words'],
  ['manuscript', 'Manuscript'],
  ['desk', 'Advice desk'],
  ['compare', 'Compare & revise'],
  ['method', 'Method'],
]

function EmptyState() {
  return (
    <section className="mx-auto max-w-2xl py-10 text-center">
      <p className="kicker text-accent">Section III · The Report</p>
      <h1 className="headline mt-4 text-5xl sm:text-6xl">The presses are <em className="text-accent">idle</em>.</h1>
      <p className="dek mx-auto mt-5 max-w-lg">
        No report has been filed yet. Reports live only in this browser tab and disappear when you reset or reload.
      </p>
      <Link to="/analyze" className="btn-accent mt-8">
        File your documents <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </section>
  )
}

function EditorsNote({ result }) {
  const notes = [...(result.warnings ?? [])]
  if (result.score_cap?.applied) notes.push(`Without the cap, the score would have been ${result.score_cap.uncapped_score.toFixed(1)}.`)
  if (!notes.length) return null
  return (
    <aside className="mb-10 grid gap-3 border-y-2 border-ochre bg-ochre/5 px-5 py-4 sm:grid-cols-[9rem_1fr]">
      <p className="kicker text-ochre">Editor’s note</p>
      <ul className="space-y-1 text-[15px] text-ink">
        {[...new Set(notes)].map((n) => <li key={n}>{n}</li>)}
      </ul>
    </aside>
  )
}

function KeyFigures({ result }) {
  const ev = result.evidence_summary
  const evTotal = ev ? ev.demonstrated + ev.listed + ev.inferred : 0
  const w = result.scoring_method.weights
  return (
    <dl className="divide-y divide-rule/25 border-y-2 border-rule">
      <div className="py-4">
        <dt className="kicker">TF-IDF similarity · weight {w.tfidf.toFixed(2)}</dt>
        <dd className="headline num mt-1 text-4xl">{formatPercent(result.tfidf_similarity)}</dd>
        <MeterBar value={result.tfidf_similarity} tone="blueprint" />
      </div>
      <div className="py-4">
        <dt className="kicker">Skill coverage · weight {w.skill_coverage.toFixed(2)}</dt>
        <dd className="headline num mt-1 text-4xl">{formatPercent(result.skill_coverage)}</dd>
        <MeterBar value={result.skill_coverage} tone="moss" />
        <p className="mt-1.5 text-xs text-ink2">
          {result.skill_coverage === null
            ? 'No taxonomy skills found in the job post.'
            : `${result.matched_skills.length} of ${result.job_skill_count} job skills found`}
        </p>
      </div>
      {ev && evTotal > 0 && (
        <div className="py-4">
          <dt className="kicker">Evidence for matched skills</dt>
          <dd className="mt-2 flex h-3 w-full overflow-hidden" aria-hidden="true">
            <span className="bg-moss" style={{ width: `${(ev.demonstrated / evTotal) * 100}%` }} />
            <span className="bg-ochre" style={{ width: `${(ev.listed / evTotal) * 100}%` }} />
            <span className="bg-blueprint" style={{ width: `${(ev.inferred / evTotal) * 100}%` }} />
          </dd>
          <p className="mt-2 flex flex-wrap gap-x-3 font-mono text-[10.5px] uppercase text-ink2">
            <span className="text-moss">{ev.demonstrated} shown in use</span>
            <span className="text-ochre">{ev.listed} listed only</span>
            <span className="text-blueprint">{ev.inferred} inferred</span>
          </p>
        </div>
      )}
    </dl>
  )
}

export default function ResultsPage({ run, runs, onSelectRun, onAddRun, onReset }) {
  const [exportError, setExportError] = useState(null)
  const [exporting, setExporting] = useState(false)

  if (!run) return <EmptyState />
  const result = run.result
  const method = result.scoring_method
  const headline = reportHeadline(result)
  const source = result.input_source?.type === 'file' ? result.input_source.filename : 'pasted text'

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
    <article>
      <PageHeader
        kicker={`Section III · The Report · No. ${String(run.id).padStart(3, '0')} · ${run.label}`}
        title={<>{headline.lead} <em className="font-medium text-accent">{headline.rest}</em></>}
        dek={`Your résumé (${source}, ${result.extracted_resume_text_length.toLocaleString()} characters) shares ${formatPercent(result.tfidf_similarity)} of its weighted vocabulary with the post${
          result.skill_coverage === null ? '.' : ` and covers ${result.matched_skills.length} of the ${result.job_skill_count} skills it lists.`
        }`}
        actions={
          <>
            <button type="button" className="btn-paper" onClick={() => downloadCsv(result)}>
              <FileSpreadsheet size={14} aria-hidden="true" /> CSV
            </button>
            <button type="button" className="btn-paper" onClick={exportPdf} disabled={exporting}>
              <FileDown size={14} aria-hidden="true" /> {exporting ? 'Setting…' : 'PDF'}
            </button>
            <button type="button" className="btn-ink" onClick={onReset}>
              <RotateCcw size={14} aria-hidden="true" /> New analysis
            </button>
          </>
        }
      />

      {exportError && <div className="mb-6"><ErrorAlert title="Export failed" message={exportError} onDismiss={() => setExportError(null)} /></div>}

      <nav aria-label="Report sections" className="no-print -mt-4 mb-10 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
        {JUMPS.map(([id, label], i) => (
          <a key={id} href={`#${id}`} className="text-muted hover:text-accent">
            <span className="font-display text-xs italic text-accent">{i + 1}.</span> {label}
          </a>
        ))}
      </nav>

      <EditorsNote result={result} />

      {/* 1. Score */}
      <section id="score" className="scroll-mt-20">
        <SectionHead n="1." title="The score" note="Similarity, not a hiring probability" />
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <ScoreGauge score={result.overall_match_score} level={result.match_level} capped={result.score_cap?.applied} />
          </div>
          <Figure n={1} kicker="Anatomy" title="What the number is made of" className="lg:col-span-4" caption={method.overall_formula}>
            <ScoreAnatomy result={result} />
          </Figure>
          <div className="lg:col-span-3">
            <KeyFigures result={result} />
          </div>
        </div>
      </section>

      {/* 2. Skills */}
      <section id="skills" className="mt-20 scroll-mt-20">
        <SectionHead n="2." title="The skills" note={`${result.job_skill_count} in the post · ${result.resume_skill_count} on your résumé`} />
        <SkillLedger result={result} />
        <div className="mt-12 grid gap-10 lg:grid-cols-12">
          <Figure
            n={2}
            kicker="Network"
            title="Skill constellation"
            className="lg:col-span-8"
            caption="Categories are hubs; job skills cluster around them and résumé-only skills orbit the edge. A dotted ochre halo marks a matched skill that is only listed, never shown in use."
          >
            <SkillConstellation result={result} />
          </Figure>
          <div className="flex flex-col gap-10 lg:col-span-4">
            <Figure n={3} kicker="Overlap" title="Two sets of skills">
              <SkillVenn result={result} />
            </Figure>
            <Figure n={4} kicker="Triage" title="What is missing, by importance">
              <TriageBoard missing={result.missing_skills} />
            </Figure>
          </div>
        </div>
      </section>

      {/* 3. Words */}
      <section id="words" className="mt-20 scroll-mt-20">
        <SectionHead n="3." title="The words" note="TF-IDF · cosine similarity" />
        <div className="grid gap-10 lg:grid-cols-12">
          <Figure n={5} kicker="Vocabulary" title="What the job post emphasises" className="lg:col-span-7" caption="The job post's highest-weighted TF-IDF terms. Word forms are reduced to their stem, so ‘cleaning’ and ‘clean’ count as one.">
            <KeywordCloud keywords={result.job_description_keywords} />
          </Figure>
          <Figure n={6} kicker="Similarity, explained" title="Where the overlap comes from" className="lg:col-span-5" caption="Cosine similarity = Σ résumé weight × job weight over shared terms; each bar is one term's share.">
            <SimilarityTerms terms={result.similarity_terms} similarity={result.tfidf_similarity} />
          </Figure>
        </div>
        <div className="mt-12 grid gap-10 lg:grid-cols-12">
          <Figure n={7} kicker="Coverage by category" title="Where you are strong, and where you are thin" className="lg:col-span-6">
            <CategoryRadar breakdown={result.category_breakdown} />
          </Figure>
          <div className="lg:col-span-6">
            <Figure n={8} kicker="Score bands" title="How the verdict is decided">
              <ul className="divide-y divide-rule/20 border-y-2 border-rule">
                {(method.bands ?? []).map((b) => (
                  <li key={b.label} className={`flex items-baseline justify-between py-2.5 ${b.label === result.match_level ? 'text-ink' : 'text-muted'}`}>
                    <span className="font-display text-lg font-semibold">{b.label}</span>
                    <span className="font-mono text-xs">≥ {b.min}{b.label === result.match_level && <span className="ml-2"><Tag tone="accent">this report</Tag></span>}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-ink2">
                Bands are calibrated to the typical range of TF-IDF cosine values: closely related real documents usually
                reach 20–45% similarity. They describe overlap; they do not predict outcomes.
              </p>
            </Figure>
          </div>
        </div>
      </section>

      {/* 4. Manuscript */}
      <section id="manuscript" className="mt-20 scroll-mt-20">
        <SectionHead n="4." title="The annotated manuscript" note="Every detected mention, marked up" />
        <AnnotatedDocs documents={result.documents} />
      </section>

      {/* 5. Desk */}
      <section id="desk" className="mt-20 scroll-mt-20">
        <SectionHead n="5." title="The advice desk" note="Never add what you have not done" />
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Recommendations items={result.recommendations} />
          </div>
          <Figure n={9} kicker="What if" title="If you genuinely have these…" className="lg:col-span-5">
            <WhatIfDesk key={run.id} result={result} />
          </Figure>
        </div>
      </section>

      {/* 6. Compare & revise */}
      <section id="compare" className="mt-20 scroll-mt-20">
        <SectionHead n="6." title="Compare & revise" note="Same résumé, different posts · same post, edited résumé" />
        <Figure n={10} kicker="Comparison" title="How this résumé reads against other jobs">
          <CompareDesk key={run.id} run={run} />
        </Figure>
        <div className="mt-12">
          <Figure n={11} kicker="Revisions" title="Edit the copy and measure the change">
            <Revisions key={run.id} run={run} runs={runs} onSelectRun={onSelectRun} onAddRun={onAddRun} />
          </Figure>
        </div>
      </section>

      {/* 7. Method */}
      <section id="method" className="mt-20 scroll-mt-20">
        <SectionHead n="7." title="Method" />
        <dl className="grid gap-8 text-[15px] text-ink2 md:grid-cols-3">
          <div><dt className="kicker mb-1">TF-IDF similarity</dt><dd>{method.tfidf_formula}</dd></div>
          <div><dt className="kicker mb-1">Skill coverage</dt><dd>{method.skill_coverage_formula}</dd></div>
          <div><dt className="kicker mb-1">Weights</dt><dd>{method.weights_rationale}</dd></div>
          {method.adjustments && <div className="md:col-span-3"><dt className="kicker mb-1">Adjustments</dt><dd>{method.adjustments}</dd></div>}
        </dl>
        <p className="mt-8 border-l-[3px] border-accent pl-4 font-display text-lg italic text-ink">{method.disclaimer}</p>
        <Link to="/methodology" className="btn-link mt-6">Read the full methods <ArrowRight size={13} aria-hidden="true" /></Link>
      </section>
    </article>
  )
}
