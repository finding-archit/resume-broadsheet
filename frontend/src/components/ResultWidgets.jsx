import { CheckCircle2, XCircle, PlusCircle, Lightbulb, Sparkles } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PRIORITY_STYLES, TONE_HEX, formatPercent, scoreTone } from '../utils/format.js'

export function ScoreRing({ score, size = 180, label = 'Overall match' }) {
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score ?? 0))
  const color = TONE_HEX[scoreTone(score)]
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${formatPercent(score)}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums text-slate-900">{pct.toFixed(1)}</span>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">out of 100</span>
      </div>
    </div>
  )
}

export function MetricCard({ icon: Icon, label, value, hint, children }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        {Icon && <Icon size={16} aria-hidden="true" />} {label}
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</p>
      {children}
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function ProgressBar({ value, color = '#4f46e5' }) {
  const pct = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

const CHIP_VARIANTS = {
  matched: { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200', Icon: CheckCircle2 },
  missing: { cls: 'bg-rose-50 text-rose-800 ring-rose-200', Icon: XCircle },
  additional: { cls: 'bg-sky-50 text-sky-800 ring-sky-200', Icon: PlusCircle },
}

export function SkillGroup({ title, description, skills, variant, emptyText, footer }) {
  const { cls, Icon } = CHIP_VARIANTS[variant]
  return (
    <section className="card p-5" aria-labelledby={`skills-${variant}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={`skills-${variant}`} className="section-title">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{skills.length}</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      {skills.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-2">
          {skills.map((s) => (
            <li
              key={s.name}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${cls}`}
              title={[
                s.category,
                s.priority && `priority: ${s.priority}`,
                s.importance && `${s.importance} in job description`,
                s.implied && `inferred from ${s.implied_by.join(', ')}`,
              ].filter(Boolean).join(' · ')}
            >
              <Icon size={14} aria-hidden="true" />
              {s.name}
              {s.implied && <span className="text-xs font-normal opacity-75">(inferred)</span>}
              {variant === 'missing' && s.priority === 'high' && (
                <span className="rounded bg-rose-600 px-1.5 text-[10px] font-bold uppercase text-white">high</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {footer}
    </section>
  )
}

export function CategoryChart({ data }) {
  if (!data.length) {
    return <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No skills from the taxonomy were found in the job description.</p>
  }
  const rows = data.map((d) => ({
    category: d.category.replace('Software Engineering Tools', 'SE Tools'),
    Matched: d.matched,
    Missing: d.required - d.matched,
  }))
  return (
    <div style={{ width: '100%', height: Math.max(180, rows.length * 44) }}>
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
          <YAxis type="category" dataKey="category" width={150} tick={{ fontSize: 12, fill: '#334155' }} />
          <Tooltip cursor={{ fill: '#f1f5f9' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Matched" stackId="a" fill="#059669" radius={[4, 0, 0, 4]} />
          <Bar dataKey="Missing" stackId="a" fill="#fda4af" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function KeywordTable({ keywords }) {
  if (!keywords.length) {
    return <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No keywords could be extracted.</p>
  }
  const max = keywords[0].weight || 1
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Top job description keywords by TF-IDF weight</caption>
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="py-2 pr-3 font-semibold">Keyword</th>
            <th scope="col" className="w-2/5 py-2 pr-3 font-semibold">TF-IDF weight</th>
            <th scope="col" className="py-2 font-semibold">In resume</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {keywords.map((k) => (
            <tr key={k.term}>
              <td className="py-2 pr-3 font-medium text-slate-800">
                {k.term}
                {k.is_skill && <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">skill</span>}
              </td>
              <td className="py-2 pr-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(k.weight / max) * 100}%` }} />
                  </div>
                  <span className="w-12 text-right tabular-nums text-slate-500">{k.weight.toFixed(3)}</span>
                </div>
              </td>
              <td className="py-2">
                {k.in_resume ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} aria-hidden="true" /> Yes</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-rose-700"><XCircle size={14} aria-hidden="true" /> No</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function RecommendationList({ items }) {
  if (!items.length) {
    return <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No recommendations - nothing stood out.</p>
  }
  return (
    <ol className="space-y-3">
      {items.map((r) => (
        <li key={r.id} className="flex gap-3 rounded-xl border border-slate-200 p-4">
          <span className="mt-0.5 text-indigo-500">
            {r.category === 'Summary' ? <Sparkles size={18} aria-hidden="true" /> : <Lightbulb size={18} aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-slate-900">{r.title}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${PRIORITY_STYLES[r.priority]}`}>
                {r.priority} priority
              </span>
              <span className="text-xs text-slate-400">{r.category}</span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{r.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
