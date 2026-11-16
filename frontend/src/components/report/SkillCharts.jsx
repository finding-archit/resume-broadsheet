import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useTheme } from '../../utils/theme.jsx'
import { categoryCoverage } from '../../utils/report.js'
import { Empty, Tag } from './common.jsx'

function RadarTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="border-2 border-rule bg-card px-3 py-2 text-sm shadow-[3px_3px_0_rgb(var(--rule))]">
      <p className="font-display font-semibold">{d.category}</p>
      <p className="font-mono text-xs text-ink2">{d.matched} of {d.required} skills · {d.coverage}%</p>
    </div>
  )
}

/** Coverage per category as a radar (or bars when there are too few axes for a polygon). */
export function CategoryRadar({ breakdown }) {
  const { palette } = useTheme()
  const rows = categoryCoverage(breakdown)
  if (!rows.length) return <Empty>No taxonomy skills were found in the job description.</Empty>

  if (rows.length < 3) {
    return (
      <ul className="space-y-4">
        {rows.map((r) => (
          <li key={r.category}>
            <div className="flex justify-between text-sm"><span className="font-display font-semibold">{r.category}</span><span className="font-mono text-xs">{r.matched}/{r.required}</span></div>
            <div className="mt-1 h-2.5 bg-rule/10"><div className="h-full bg-moss" style={{ width: `${r.coverage}%` }} /></div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="h-[320px]">
      <ResponsiveContainer>
        <RadarChart data={rows} outerRadius="72%">
          <PolarGrid stroke={palette.alpha('rule', 0.2)} />
          <PolarAngleAxis dataKey="short" tick={{ fill: palette.ink2, fontSize: 11, fontFamily: 'JetBrains Mono Variable' }} />
          <PolarRadiusAxis domain={[0, 100]} tickCount={5} tick={false} axisLine={false} />
          <Radar dataKey="coverage" stroke={palette.moss} strokeWidth={2.5} fill={palette.moss} fillOpacity={0.22} dot={{ r: 3.5, fill: palette.moss }} isAnimationActive animationDuration={900} />
          <Tooltip content={<RadarTip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

function NameList({ names, tone }) {
  const shown = names.slice(0, 7)
  return (
    <p className={`mt-1 text-xs leading-relaxed ${tone}`}>
      {shown.join(' · ') || '—'}
      {names.length > shown.length && <span className="text-muted"> · +{names.length - shown.length} more</span>}
    </p>
  )
}

/** Two-set Venn diagram: résumé skills vs job-description skills. */
export function SkillVenn({ result }) {
  const { palette } = useTheme()
  const resumeOnly = result.additional_skills.map((s) => s.name)
  const shared = result.matched_skills.map((s) => s.name)
  const jobOnly = result.missing_skills.map((s) => s.name)
  return (
    <div>
      <svg viewBox="0 -16 360 226" className="w-full" role="img" aria-label={`${resumeOnly.length} résumé-only, ${shared.length} shared, ${jobOnly.length} job-only skills`}>
        <circle cx="132" cy="105" r="92" fill={palette.alpha('blueprint', 0.1)} stroke={palette.blueprint} strokeWidth="2" />
        <circle cx="228" cy="105" r="92" fill={palette.alpha('accent', 0.08)} stroke={palette.accent} strokeWidth="2" />
        <text x="70" y="0" textAnchor="middle" fontFamily="JetBrains Mono Variable" fontSize="10" letterSpacing="2" fill={palette.blueprint}>RÉSUMÉ</text>
        <text x="290" y="0" textAnchor="middle" fontFamily="JetBrains Mono Variable" fontSize="10" letterSpacing="2" fill={palette.accent}>JOB POST</text>
        {[
          [88, resumeOnly.length, palette.blueprint, 'only yours'],
          [180, shared.length, palette.moss, 'shared'],
          [272, jobOnly.length, palette.accent, 'missing'],
        ].map(([x, n, color, label]) => (
          <g key={label}>
            <text x={x} y="116" textAnchor="middle" fontFamily="Fraunces Variable, serif" fontWeight="700" fontSize="44" fill={color}>{n}</text>
            <text x={x} y="138" textAnchor="middle" fontFamily="JetBrains Mono Variable" fontSize="9.5" letterSpacing="1.5" fill={palette.ink2}>{label.toUpperCase()}</text>
          </g>
        ))}
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <div><p className="kicker text-blueprint">Only yours</p><NameList names={resumeOnly} tone="text-ink2" /></div>
        <div><p className="kicker text-moss">Shared</p><NameList names={shared} tone="text-ink2" /></div>
        <div><p className="kicker text-accent">Missing</p><NameList names={jobOnly} tone="text-ink2" /></div>
      </div>
    </div>
  )
}

/** Typographic word wall of the job's top TF-IDF terms; size = weight, red italic = absent from résumé. */
export function KeywordCloud({ keywords }) {
  if (!keywords?.length) return <Empty>No keywords could be extracted.</Empty>
  const max = Math.max(...keywords.map((k) => k.weight))
  const sorted = [...keywords].sort((a, b) => b.weight - a.weight)
  const arranged = []
  sorted.forEach((k, i) => (i % 2 ? arranged.push(k) : arranged.unshift(k)))
  return (
    <div>
      <p className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-1 py-4 text-center leading-none">
        {arranged.map((k) => {
          const size = 14 + 34 * Math.sqrt(k.weight / max)
          return (
            <span
              key={k.term}
              title={`${k.term}: weight ${k.weight.toFixed(3)} · ${k.in_resume ? 'in your résumé' : 'not in your résumé'}`}
              className={`inline-block transition-transform hover:-translate-y-0.5 ${k.is_skill ? 'font-display font-semibold' : 'font-sans font-medium'} ${
                k.in_resume ? 'text-ink' : 'italic text-accent'
              }`}
              style={{ fontSize: `${size}px` }}
            >
              {k.term}
              {!k.in_resume && <sup className="ml-0.5 font-mono text-[9px] not-italic">✕</sup>}
            </span>
          )
        })}
      </p>
      <p className="mt-2 flex flex-wrap justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-ink2">
        <span><span className="font-display text-sm font-semibold normal-case text-ink">Serif</span> = taxonomy skill</span>
        <span><span className="font-display text-sm italic normal-case text-accent">red italic ✕</span> = missing from résumé</span>
        <span>size = TF-IDF weight</span>
      </p>
    </div>
  )
}

/** Which shared terms make up the cosine similarity (each term's share of Σ rᵢ·jᵢ). */
export function SimilarityTerms({ terms, similarity }) {
  if (!terms?.length) {
    return <Empty>The two documents share no weighted terms, so the text similarity is 0.</Empty>
  }
  const top = terms[0].contribution
  const covered = terms.reduce((s, t) => s + t.contribution, 0)
  return (
    <div>
      <ol className="space-y-2.5">
        {terms.map((t, i) => (
          <li key={t.term} className="grid grid-cols-[1.4rem_minmax(0,9rem)_1fr_3rem] items-center gap-2 text-sm">
            <span className="font-mono text-[10px] text-muted">{String(i + 1).padStart(2, '0')}</span>
            <span className={`truncate ${t.is_skill ? 'font-display font-semibold' : ''}`} title={t.term}>{t.term}</span>
            <span className="h-3 bg-rule/10">
              <span className="block h-full bg-blueprint transition-[width] duration-700" style={{ width: `${(t.contribution / top) * 100}%` }} />
            </span>
            <span className="text-right font-mono text-xs num">{(t.contribution * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-ink2">
        These {terms.length} words account for <strong className="num">{(covered * 100).toFixed(0)}%</strong> of the{' '}
        {similarity.toFixed(1)}% text similarity.
      </p>
    </div>
  )
}

const COLUMNS = [
  ['required', 'Required', 'text-accent', 'bg-accent'],
  ['mentioned', 'Mentioned', 'text-ochre', 'bg-ochre'],
  ['preferred', 'Preferred', 'text-muted', 'bg-muted'],
]

/** Missing skills sorted into the job post's own importance columns, with mention counts as dots. */
export function TriageBoard({ missing }) {
  if (!missing.length) return <Empty>Nothing to triage: every skill in the job post appears on your résumé.</Empty>
  return (
    <div className="grid grid-cols-3 divide-x divide-rule/25 border-y-2 border-rule">
      {COLUMNS.map(([key, label, text, dot]) => {
        const items = missing.filter((m) => m.importance === key)
        return (
          <div key={key} className="px-3 py-3 first:pl-0 last:pr-0">
            <p className={`kicker ${text}`}>{label} · {items.length}</p>
            <ul className="mt-3 space-y-2">
              {items.map((m) => (
                <li key={m.name} className="text-sm">
                  <span className="font-display text-[15px] font-semibold leading-tight">{m.name}</span>
                  <span className="mt-0.5 flex items-center gap-0.5" title={`${m.job_mentions} mention(s) in the job post`}>
                    {Array.from({ length: Math.min(m.job_mentions, 6) }).map((_, i) => (
                      <span key={i} className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                    ))}
                    <span className="ml-1 font-mono text-[9.5px] uppercase text-muted">{m.priority}</span>
                  </span>
                </li>
              ))}
              {!items.length && <li className="text-xs italic text-muted">None</li>}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

const EVIDENCE = {
  demonstrated: ['moss', 'shown in use'],
  listed: ['ochre', 'listed only'],
  inferred: ['blueprint', 'inferred'],
}

/** Three-column ledger of matched, missing and additional skills. */
export function SkillLedger({ result }) {
  const cols = [
    {
      title: 'Matched',
      tone: 'text-moss',
      count: result.matched_skills.length,
      rows: result.matched_skills.map((s) => {
        const ev = s.implied ? 'inferred' : s.evidence
        return (
          <li key={s.name} className="flex items-baseline justify-between gap-2 border-b border-rule/15 py-1.5">
            <span className="font-display text-[15.5px]">{s.name}</span>
            {ev && EVIDENCE[ev] && (
              <Tag tone={EVIDENCE[ev][0]} title={s.implied ? `Inferred from ${s.implied_by.join(', ')}` : undefined}>
                {EVIDENCE[ev][1]}
              </Tag>
            )}
          </li>
        )
      }),
    },
    {
      title: 'Missing',
      tone: 'text-accent',
      count: result.missing_skills.length,
      rows: result.missing_skills.map((s) => (
        <li key={s.name} className="flex items-baseline justify-between gap-2 border-b border-rule/15 py-1.5">
          <span className="font-display text-[15.5px]">{s.name}</span>
          <Tag tone={s.priority === 'high' ? 'accent' : s.priority === 'medium' ? 'ochre' : 'muted'}>{s.priority}</Tag>
        </li>
      )),
    },
    {
      title: 'Only on your résumé',
      tone: 'text-blueprint',
      count: result.additional_skills.length,
      rows: result.additional_skills.map((s) => (
        <li key={s.name} className="flex items-baseline justify-between gap-2 border-b border-rule/15 py-1.5">
          <span className="font-display text-[15.5px]">{s.name}</span>
          <span className="font-mono text-[10px] uppercase text-muted">{s.category.split(' ')[0]}</span>
        </li>
      )),
    },
  ]
  return (
    <div className="grid gap-8 md:grid-cols-3">
      {cols.map((c) => (
        <div key={c.title}>
          <div className="flex items-baseline justify-between border-b-2 border-rule pb-1">
            <h4 className={`font-display text-xl font-semibold ${c.tone}`}>{c.title}</h4>
            <span className="headline num text-3xl">{c.count}</span>
          </div>
          {c.rows.length ? <ul>{c.rows}</ul> : <p className="py-3 text-sm italic text-muted">None.</p>}
          {c.title === 'Matched' && result.alternative_skills?.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-ink2">
              {result.alternative_skills.map((a) => (
                <li key={a.name}>
                  <span className="font-semibold text-ochre">◆ {a.name}</span> not needed: you have {a.satisfied_by.join(' / ')}.
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
