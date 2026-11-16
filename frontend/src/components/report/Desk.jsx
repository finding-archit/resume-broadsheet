import { useMemo, useRef, useState } from 'react'
import { ArrowRight, Loader2, Play } from 'lucide-react'
import { analyzeResume } from '../../services/api.js'
import { SAMPLE_JOBS } from '../../data/sampleJobs.js'
import { useTheme } from '../../utils/theme.jsx'
import { projectScore, segmentText } from '../../utils/report.js'
import { scoreTone } from '../../utils/format.js'
import { Empty, Tag } from './common.jsx'

const MARKS = {
  matched: { label: 'Matched', cls: 'bg-moss/15 underline decoration-moss decoration-2 underline-offset-4' },
  missing: { label: 'Missing from résumé', cls: 'bg-accent/15 underline decoration-accent decoration-wavy decoration-2 underline-offset-4' },
  alternative: { label: 'Alternative', cls: 'underline decoration-ochre decoration-dashed decoration-2 underline-offset-4' },
  additional: { label: 'Résumé only', cls: 'underline decoration-blueprint decoration-dotted decoration-2 underline-offset-4' },
  negated: { label: 'Negated', cls: 'text-muted line-through decoration-accent' },
}

function Manuscript({ title, doc, visible }) {
  const parts = useMemo(() => (doc ? segmentText(doc.text, doc.spans) : []), [doc])
  if (!doc) return <Empty>The server did not return the annotated text.</Empty>
  return (
    <div className="flex min-w-0 flex-col">
      <p className="kicker mb-2">{title} · {doc.spans.length} marks</p>
      <div className="lined max-h-[540px] overflow-auto border-2 border-rule bg-card px-5 py-1 font-display text-[15.5px] text-ink2" tabIndex={0}>
        <p className="whitespace-pre-wrap break-words">
          {parts.map((p, i) =>
            p.span && visible.has(p.span.status) ? (
              <mark key={i} className={`bg-transparent px-0.5 text-ink ${MARKS[p.span.status]?.cls ?? ''}`} title={`${p.span.skill} · ${MARKS[p.span.status]?.label ?? p.span.status}`}>
                {p.text}
              </mark>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
        </p>
      </div>
    </div>
  )
}

/** Résumé and job post side by side with every detected skill mention highlighted. */
export function AnnotatedDocs({ documents }) {
  const [visible, setVisible] = useState(() => new Set(Object.keys(MARKS)))
  const toggle = (k) =>
    setVisible((v) => {
      const next = new Set(v)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Highlight filters">
        {Object.entries(MARKS).map(([k, m]) => (
          <button
            key={k}
            type="button"
            aria-pressed={visible.has(k)}
            onClick={() => toggle(k)}
            className={`border-2 px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] transition-opacity ${visible.has(k) ? 'border-rule' : 'border-rule/30 opacity-45'}`}
          >
            <span className={`px-0.5 normal-case tracking-normal ${m.cls}`}>{m.label}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Manuscript title="Exhibit A · Your résumé" doc={documents?.resume} visible={visible} />
        <Manuscript title="Exhibit B · The job post" doc={documents?.job} visible={visible} />
      </div>
    </div>
  )
}

/** Tick missing skills you genuinely have to see the projected score (TF-IDF held constant). */
export function WhatIfDesk({ result }) {
  const { palette } = useTheme()
  const [picked, setPicked] = useState([])
  if (result.skill_coverage === null || result.skill_coverage === undefined) {
    return <Empty>Skill coverage is unavailable for this job post, so there is nothing to simulate.</Empty>
  }
  if (!result.missing_skills.length) return <Empty>No missing skills: there is nothing left to add.</Empty>
  const p = projectScore(result, picked)
  const toggle = (name) => setPicked((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name]))
  const now = result.overall_match_score

  return (
    <div className="grid gap-6">
      <ul className="columns-1 gap-4 sm:columns-2">
        {result.missing_skills.map((m) => (
          <li key={m.name} className="mb-1.5 break-inside-avoid">
            <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm">
              <input type="checkbox" className="peer sr-only" checked={picked.includes(m.name)} onChange={() => toggle(m.name)} />
              <span className="grid h-4 w-4 place-items-center border-2 border-rule peer-checked:border-moss peer-checked:bg-moss peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                {picked.includes(m.name) && <span className="text-[10px] font-black leading-none text-paper" aria-hidden="true">✓</span>}
              </span>
              <span className="font-display text-[15px]">{m.name}</span>
              <span className="font-mono text-[9.5px] uppercase text-muted">{m.importance}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="grid gap-x-6 gap-y-2 border-t-2 border-rule pt-4 sm:grid-cols-[auto_1fr]">
        <div>
          <p className="kicker">Projected score</p>
          <p className="headline num mt-1 text-6xl" style={{ color: palette[scoreTone(p.overall)] }}>{p.overall.toFixed(1)}</p>
          <p className="mt-1 font-mono text-xs">
            {p.delta > 0 ? <span className="text-moss">▲ +{p.delta.toFixed(1)}</span> : <span className="text-muted">± 0.0</span>} · {p.level}
          </p>
        </div>
        <div className="self-end">
          <div className="relative h-3 bg-rule/10" aria-hidden="true">
            <div className="absolute inset-y-0 left-0 bg-moss/35 transition-[width] duration-500" style={{ width: `${p.overall}%` }} />
            <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${now}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            Now {now.toFixed(1)} · coverage {result.skill_coverage.toFixed(1)}% → {p.coverage.toFixed(1)}%{p.capped ? ' · cap still applies' : ''}
          </p>
          <p className="mt-2 text-xs italic leading-relaxed text-ink2">
            Tick only skills you genuinely have. Text similarity is held constant; re-run with your revised résumé to measure it.
          </p>
        </div>
      </div>
    </div>
  )
}

const PRIORITY = {
  high: ['accent', 'Urgent'],
  medium: ['ochre', 'Worth doing'],
  low: ['muted', 'If time allows'],
}

export function Recommendations({ items }) {
  if (!items.length) return <Empty>No recommendations: nothing stood out.</Empty>
  return (
    <ol className="divide-y divide-rule/20 border-y-2 border-rule">
      {items.map((r, i) => (
        <li key={r.id} className="grid grid-cols-[3rem_1fr] gap-3 py-4">
          <span className="font-display text-4xl font-semibold italic leading-none text-rule/25">{i + 1}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone={PRIORITY[r.priority][0]}>{PRIORITY[r.priority][1]}</Tag>
              <span className="kicker">{r.category}</span>
            </div>
            <h4 className="mt-1.5 font-display text-xl font-semibold leading-snug">{r.title}</h4>
            <p className="mt-1 text-[15px] leading-relaxed text-ink2">{r.detail}</p>
            {r.skills?.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-1.5">
                {r.skills.map((s) => <Tag key={s} tone="ink">{s}</Tag>)}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function HeatCell({ value }) {
  const { palette } = useTheme()
  if (value === null || value === undefined) return <td className="px-3 py-2 text-center font-mono text-xs text-muted">n/a</td>
  const tone = scoreTone(value)
  const a = 0.12 + (Math.min(value, 100) / 100) * 0.75
  return (
    <td className="px-3 py-2 text-center font-mono text-sm font-bold num" style={{ background: palette.alpha(tone, a), color: a > 0.5 ? palette.card : palette.ink }}>
      {value.toFixed(1)}
    </td>
  )
}

/** Run the same résumé against every sample job (and an optional pasted one) and show a heatmap. */
export function CompareDesk({ run }) {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [extra, setExtra] = useState('')
  const controller = useRef(null)

  const input = run.input ?? {}
  const go = async () => {
    controller.current?.abort()
    controller.current = new AbortController()
    setBusy(true)
    setError(null)
    const jobs = [
      ...SAMPLE_JOBS.filter((j) => j.text !== input.jobDescription).map((j) => ({ title: j.title, text: j.text })),
      ...(extra.trim().split(/\s+/).length >= 10 ? [{ title: 'Your pasted post', text: extra.trim() }] : []),
    ]
    const out = [{ title: 'This job', current: true, r: run.result }]
    try {
      for (const job of jobs) {
        const r = await analyzeResume({
          file: input.mode === 'file' ? input.file : null,
          resumeText: input.resumeText,
          jobDescription: job.text,
          signal: controller.current.signal,
        })
        out.push({ title: job.title, r })
        setRows([...out])
      }
      setRows([...out])
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const sorted = rows ? [...rows].sort((a, b) => b.r.overall_match_score - a.r.overall_match_score) : null

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="extra-jd" className="kicker">Optional · paste another job post</label>
          <textarea id="extra-jd" rows={2} className="field mt-2 text-sm" placeholder="Paste a further job description to include it in the comparison…" value={extra} onChange={(e) => setExtra(e.target.value)} />
        </div>
        <button type="button" className="btn-ink" onClick={go} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          {busy ? 'Comparing…' : 'Compare against sample jobs'}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      {sorted && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <caption className="sr-only">Résumé compared with several job descriptions</caption>
            <thead>
              <tr className="border-b-2 border-rule text-left">
                <th scope="col" className="kicker py-2 pr-3">Rank · Job</th>
                <th scope="col" className="kicker px-3 py-2 text-center">Overall</th>
                <th scope="col" className="kicker px-3 py-2 text-center">TF-IDF</th>
                <th scope="col" className="kicker px-3 py-2 text-center">Coverage</th>
                <th scope="col" className="kicker px-3 py-2">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={row.title} className="border-b border-rule/20">
                  <th scope="row" className="py-2 pr-3 text-left font-display text-base font-semibold">
                    <span className="mr-2 font-mono text-xs text-muted">{i + 1}.</span>
                    {row.title}
                    {row.current && <span className="ml-2 align-middle"><Tag tone="accent">current</Tag></span>}
                  </th>
                  <HeatCell value={row.r.overall_match_score} />
                  <HeatCell value={row.r.tfidf_similarity} />
                  <HeatCell value={row.r.skill_coverage} />
                  <td className="px-3 py-2 font-mono text-xs uppercase">{row.r.match_level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Sparkline({ values }) {
  const { palette } = useTheme()
  if (values.length < 2) return null
  const w = 160
  const h = 40
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - ((v - min) / (max - min || 1)) * (h - 6) - 3])
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-40" aria-hidden="true">
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={palette.ink} strokeWidth="1.8" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.8" fill={i === pts.length - 1 ? palette.accent : palette.ink} />)}
    </svg>
  )
}

/** Edit the extracted résumé text, re-run against the same job, and browse revisions. */
export function Revisions({ run, runs, onSelectRun, onAddRun }) {
  const [text, setText] = useState(run.result.documents?.resume?.text ?? run.input?.resumeText ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const jobDescription = run.input?.jobDescription

  const rerun = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await analyzeResume({ resumeText: text, jobDescription })
      onAddRun(result, { ...run.input, mode: 'text', file: null, resumeText: text }, `Revision ${runs.length}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div>
        <label htmlFor="revise" className="kicker">Revise the copy · extracted text, contact details removed</label>
        <textarea id="revise" rows={12} className="field lined mt-2 font-mono text-[13px]" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-accent" onClick={rerun} disabled={busy || !jobDescription}>
            {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={14} aria-hidden="true" />}
            {busy ? 'Re-running…' : 'Re-run with this text'}
          </button>
          <span className="text-xs italic text-muted">Only describe experience you genuinely have.</span>
        </div>
        {error && <p className="mt-2 text-sm text-accent">{error}</p>}
      </div>
      <div>
        <div className="flex items-end justify-between">
          <p className="kicker">Revision history</p>
          <Sparkline values={runs.map((r) => r.result.overall_match_score)} />
        </div>
        <ol className="mt-3 border-t-2 border-rule">
          {runs.map((r, i) => {
            const prev = runs[i - 1]?.result.overall_match_score
            const delta = prev === undefined ? null : r.result.overall_match_score - prev
            const active = r === run
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelectRun(i)}
                  className={`flex w-full items-baseline justify-between gap-2 border-b border-rule/20 px-2 py-2.5 text-left transition-colors ${active ? 'bg-ink text-paper' : 'hover:bg-sunk'}`}
                  aria-current={active ? 'true' : undefined}
                >
                  <span>
                    <span className="font-display text-base font-semibold">{r.label}</span>
                    <span className={`block font-mono text-[10px] uppercase ${active ? 'text-paper/70' : 'text-muted'}`}>{r.at.toLocaleTimeString()}</span>
                  </span>
                  <span className="text-right">
                    <span className="font-display text-xl font-semibold num">{r.result.overall_match_score.toFixed(1)}</span>
                    {delta !== null && (
                      <span className={`block font-mono text-[10px] ${delta > 0 ? 'text-moss' : delta < 0 ? 'text-accent' : ''}`}>
                        {delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : '± '}{delta.toFixed(1)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
