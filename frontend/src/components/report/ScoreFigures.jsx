import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { useTheme } from '../../utils/theme.jsx'
import { DEFAULT_BANDS, scoreTone } from '../../utils/format.js'
import { scoreAnatomy } from '../../utils/report.js'
import { useCountUp } from './common.jsx'

const CX = 160
const CY = 168
const R = 128

function polar(score, r = R) {
  const a = Math.PI * (1 - score / 100)
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)]
}

function arc(from, to, r = R) {
  const [x1, y1] = polar(from, r)
  const [x2, y2] = polar(to, r)
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
}

const BAND_TONES = [
  [0, 20, 'accent'],
  [20, 40, 'ochre'],
  [40, 60, 'blueprint'],
  [60, 100, 'moss'],
]

/** Semicircular gauge with the four bands, an animated needle and a rubber stamp. */
export function ScoreGauge({ score, level, capped }) {
  const { palette } = useTheme()
  const v = useCountUp(score)
  const tone = scoreTone(score)
  const length = Math.PI * R
  const [nx, ny] = polar(v, R - 26)

  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <svg viewBox="-22 -14 364 210" className="w-full" role="img" aria-label={`Overall match ${score.toFixed(1)} out of 100, ${level}`}>
        {BAND_TONES.map(([a, b, t]) => (
          <path key={a} d={arc(a + 0.6, b - 0.6)} fill="none" stroke={palette.alpha(t, 0.18)} strokeWidth="24" />
        ))}
        <path d={arc(0, 100)} fill="none" stroke={palette[tone]} strokeWidth="24" strokeDasharray={`${(length * v) / 100} ${length}`} />
        {[0, 20, 40, 60, 80, 100].map((t) => {
          const [x1, y1] = polar(t, R + 15)
          const [x2, y2] = polar(t, R + 22)
          const [lx, ly] = polar(t, R + 33)
          return (
            <g key={t}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={palette.ink} strokeWidth="1.5" />
              <text x={lx} y={ly + 4} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono Variable, monospace" fill={palette.muted}>{t}</text>
            </g>
          )
        })}
        {[20, 40, 60].map((t) => {
          const [x1, y1] = polar(t, R - 13)
          const [x2, y2] = polar(t, R + 13)
          return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke={palette.card} strokeWidth="2.5" />
        })}
        <line x1={CX} y1={CY} x2={nx} y2={ny} stroke={palette.ink} strokeWidth="3" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="8" fill={palette.ink} />
        <circle cx={CX} cy={CY} r="3" fill={palette.accent} />
      </svg>
      <div className="-mt-3 text-center">
        <span className="headline num text-7xl sm:text-8xl" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 0' }}>
          {v.toFixed(1)}
        </span>
        <p className="kicker mt-1">out of 100{capped ? ' · capped' : ''}</p>
        <span
          className="mt-4 inline-block animate-stamp border-[3px] border-double px-4 py-1.5 font-mono text-base font-black uppercase tracking-[0.22em]"
          style={{ color: palette[tone], borderColor: palette[tone] }}
        >
          {level}
        </span>
      </div>
    </div>
  )
}

/** Donut showing how much each weighted component contributes to the overall score. */
export function ScoreAnatomy({ result }) {
  const { palette } = useTheme()
  const anatomy = scoreAnatomy(result)
  const w = result.scoring_method?.weights ?? { tfidf: 0.6, skill_coverage: 0.4 }
  const coverageOff = result.skill_coverage === null || result.skill_coverage === undefined

  const slices = [
    ...anatomy.parts.map((p) => ({
      name: p.key === 'tfidf' ? 'TF-IDF similarity' : 'Skill coverage',
      value: p.value,
      color: p.key === 'tfidf' ? palette.blueprint : palette.moss,
    })),
    ...(anatomy.lostToCap ? [{ name: 'Removed by cap', value: anatomy.lostToCap, color: palette.accent }] : []),
    { name: 'Headroom', value: anatomy.gap, color: palette.alpha('rule', 0.08) },
  ]

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
      <div className="relative h-[180px]">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={slices} dataKey="value" innerRadius={58} outerRadius={84} startAngle={90} endAngle={-270} stroke={palette.card} strokeWidth={2} isAnimationActive animationDuration={900}>
              {slices.map((s) => <Cell key={s.name} fill={s.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <span className="headline num text-3xl">{result.overall_match_score.toFixed(1)}</span>
            <span className="block font-mono text-[9px] uppercase tracking-[0.18em] text-muted">of 100</span>
          </div>
        </div>
      </div>
      <ul className="space-y-3 text-sm">
        {anatomy.parts.map((p) => (
          <li key={p.key} className="flex items-baseline gap-3">
            <span className="h-3 w-3 shrink-0 translate-y-0.5" style={{ background: p.key === 'tfidf' ? palette.blueprint : palette.moss }} />
            <span className="flex-1">
              <span className="font-display text-lg font-semibold num">{p.value.toFixed(1)}</span>{' '}
              <span className="text-ink2">
                {p.key === 'tfidf'
                  ? coverageOff
                    ? `from TF-IDF similarity (${result.tfidf_similarity.toFixed(1)}%), used alone`
                    : `from TF-IDF (${w.tfidf.toFixed(2)} × ${result.tfidf_similarity.toFixed(1)})`
                  : `from skill coverage (${w.skill_coverage.toFixed(2)} × ${result.skill_coverage.toFixed(1)})`}
              </span>
            </span>
          </li>
        ))}
        {anatomy.lostToCap > 0 && (
          <li className="flex items-baseline gap-3">
            <span className="h-3 w-3 shrink-0 translate-y-0.5 bg-accent" />
            <span className="flex-1">
              <span className="font-display text-lg font-semibold num">−{anatomy.lostToCap.toFixed(1)}</span>{' '}
              <span className="text-ink2">removed by the keyword-list cap</span>
            </span>
          </li>
        )}
        <li className="flex items-baseline gap-3">
          <span className="h-3 w-3 shrink-0 translate-y-0.5 border border-rule/40" />
          <span className="flex-1 text-ink2">
            <span className="font-display text-lg font-semibold text-ink num">{anatomy.gap.toFixed(1)}</span> points of headroom
          </span>
        </li>
      </ul>
    </div>
  )
}

/** Thin horizontal bar with band ticks; used for the two component metrics. */
export function MeterBar({ value, tone = 'ink', bands = DEFAULT_BANDS }) {
  const { palette } = useTheme()
  const pct = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div className="relative mt-2 h-2.5 w-full bg-rule/10" aria-hidden="true">
      <div className="h-full transition-[width] duration-1000 ease-out" style={{ width: `${pct}%`, background: palette[tone] }} />
      {bands.filter((b) => b.min > 0).map((b) => (
        <span key={b.min} className="absolute top-0 h-full w-px bg-paper" style={{ left: `${b.min}%` }} />
      ))}
    </div>
  )
}
