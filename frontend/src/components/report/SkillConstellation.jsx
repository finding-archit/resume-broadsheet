import { useMemo, useState } from 'react'
import { forceCollide, forceLink, forceManyBody, forceRadial, forceSimulation, forceX, forceY } from 'd3-force'
import { useTheme } from '../../utils/theme.jsx'
import { shortCategory } from '../../utils/report.js'
import { Empty } from './common.jsx'

const STATUS_COPY = {
  matched: 'In the job post and on your résumé',
  missing: 'Asked for by the job post, not found on your résumé',
  alternative: 'Not required: an alternative you already satisfy',
  additional: 'On your résumé only',
}

export function buildGraph(result) {
  const nodes = []
  const links = []
  const ids = new Map()
  const add = (node) => {
    if (ids.has(node.id)) return ids.get(node.id)
    ids.set(node.id, node)
    nodes.push(node)
    return node
  }
  const hub = (category) => add({ id: `cat:${category}`, kind: 'hub', label: shortCategory(category), category })
  const skill = (s, status, extra = {}) => {
    const node = add({ id: `skill:${s.name}`, kind: 'skill', label: s.name, category: s.category, status, ...extra })
    links.push({ source: node.id, target: hub(s.category).id, kind: 'hub', outer: status === 'additional' })
    return node
  }

  result.matched_skills.forEach((s) => skill(s, 'matched', { evidence: s.evidence, implied_by: s.implied_by }))
  result.missing_skills.forEach((s) => skill(s, 'missing', { importance: s.importance, priority: s.priority }))
  ;(result.alternative_skills ?? []).forEach((s) => skill(s, 'alternative', { satisfied_by: s.satisfied_by }))
  result.additional_skills.forEach((s) => skill(s, 'additional', { evidence: s.evidence }))

  for (const n of [...nodes]) {
    for (const src of n.implied_by ?? []) {
      if (ids.has(`skill:${src}`)) links.push({ source: `skill:${src}`, target: n.id, kind: 'implied' })
    }
    for (const alt of n.satisfied_by ?? []) {
      if (ids.has(`skill:${alt}`)) links.push({ source: n.id, target: `skill:${alt}`, kind: 'alternative' })
    }
  }
  return { nodes, links }
}

function layout(result) {
  const { nodes, links } = buildGraph(result)
  if (!nodes.length) return null
  const outer = 210
  forceSimulation(nodes)
    .force('charge', forceManyBody().strength((d) => (d.kind === 'hub' ? -420 : -110)))
    .force(
      'link',
      forceLink(links)
        .id((d) => d.id)
        .distance((l) => (l.kind === 'hub' ? (l.outer ? 105 : 58) : 70))
        .strength((l) => (l.kind === 'hub' ? 0.7 : 0.15)),
    )
    .force('collide', forceCollide((d) => (d.kind === 'hub' ? Math.max(30, d.label.length * 4.5) : 20)).iterations(2))
    .force('x', forceX(0).strength(0.05))
    .force('y', forceY(0).strength(0.09))
    .force('radial', forceRadial((d) => (d.status === 'additional' ? outer : 0), 0, 0).strength((d) => (d.status === 'additional' ? 0.12 : 0)))
    .stop()
    .tick(420)

  placeLabels(nodes)
  // Bounds cover every node and its placed label, so names are never clipped.
  const boxes = nodes.flatMap((n) => [n.box, [n.x - 10, n.y - 10, 20, 20]])
  const pad = 20
  const minX = Math.min(...boxes.map((b) => b[0])) - pad
  const minY = Math.min(...boxes.map((b) => b[1])) - pad
  const width = Math.max(...boxes.map((b) => b[0] + b[2])) - minX + pad
  const height = Math.max(...boxes.map((b) => b[1] + b[3])) - minY + pad
  return { nodes, links, viewBox: `${minX} ${minY} ${width} ${height}` }
}

const overlap = (a, b) =>
  Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) *
  Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]))

/**
 * Greedy label placement: hub labels sit above their square; each skill label
 * tries right, left, above and below its node and takes the first spot that
 * collides with no other label or node (or the least-overlapping one).
 */
function placeLabels(nodes) {
  const taken = nodes.map((n) => [n.x - 10, n.y - 10, 20, 20])
  const cost = (box, own) => taken.reduce((s, t, i) => s + (i === own ? 0 : overlap(box, t)), 0)

  for (const n of nodes.filter((d) => d.kind === 'hub')) {
    const w = n.label.length * 8.6
    n.box = [n.x - w / 2, n.y - 29, w, 19]
    n.lx = 0
    n.ly = -12
    n.anchor = 'middle'
    taken.push(n.box)
  }

  const order = { missing: 0, matched: 1, alternative: 2, additional: 3 }
  const skills = nodes.filter((d) => d.kind === 'skill').sort((a, b) => order[a.status] - order[b.status])
  for (const n of skills) {
    const own = nodes.indexOf(n)
    const w = n.label.length * (n.status === 'additional' ? 7 : 7.9)
    const options = [
      { box: [n.x + 13, n.y - 9, w, 15], lx: 13, ly: 4.5, anchor: 'start' },
      { box: [n.x - 13 - w, n.y - 9, w, 15], lx: -13, ly: 4.5, anchor: 'end' },
      { box: [n.x - w / 2, n.y - 29, w, 15], lx: 0, ly: -16, anchor: 'middle' },
      { box: [n.x - w / 2, n.y + 13, w, 15], lx: 0, ly: 25, anchor: 'middle' },
    ]
    let best = options[0]
    let bestCost = Infinity
    for (const o of options) {
      const c = cost(o.box, own)
      if (c < bestCost) {
        best = o
        bestCost = c
      }
      if (c === 0) break
    }
    Object.assign(n, { box: best.box, lx: best.lx, ly: best.ly, anchor: best.anchor })
    taken.push(best.box)
  }
}

export default function SkillConstellation({ result }) {
  const { palette } = useTheme()
  const graph = useMemo(() => layout(result), [result])
  const [hover, setHover] = useState(null)

  if (!graph) return <Empty>No skills were detected in either document, so there is nothing to map.</Empty>

  const neighbours = new Set()
  if (hover) {
    neighbours.add(hover.id)
    for (const l of graph.links) {
      if (l.source.id === hover.id) neighbours.add(l.target.id)
      if (l.target.id === hover.id) neighbours.add(l.source.id)
    }
  }
  const dim = (id) => (hover && !neighbours.has(id) ? 0.12 : 1)

  const fill = {
    matched: palette.moss,
    missing: palette.card,
    alternative: palette.card,
    additional: palette.alpha('blueprint', 0.55),
  }
  const stroke = {
    matched: palette.moss,
    missing: palette.accent,
    alternative: palette.ochre,
    additional: palette.blueprint,
  }

  return (
    <div>
      <div className="mb-2"><ConstellationLegend /></div>
      <svg viewBox={graph.viewBox} className="h-[560px] w-full" role="img" aria-label="Network of job and résumé skills grouped by category">
        <g>
          {graph.links.map((l, i) => (
            <line
              key={i}
              x1={l.source.x}
              y1={l.source.y}
              x2={l.target.x}
              y2={l.target.y}
              stroke={l.kind === 'implied' ? palette.blueprint : l.kind === 'alternative' ? palette.ochre : palette.alpha('rule', l.outer ? 0.12 : 0.28)}
              strokeWidth={l.kind === 'hub' ? 1 : 1.6}
              strokeDasharray={l.kind === 'implied' ? '5 4' : l.kind === 'alternative' ? '1.5 4' : undefined}
              strokeLinecap="round"
              opacity={hover ? (neighbours.has(l.source.id) && neighbours.has(l.target.id) ? 1 : 0.06) : 1}
            />
          ))}
        </g>
        {graph.nodes.map((n, i) =>
          n.kind === 'hub' ? (
            <g key={n.id} transform={`translate(${n.x},${n.y})`} opacity={dim(n.id)}>
              <g className="animate-rise" style={{ animationDelay: `${i * 18}ms` }}>
              <rect x={-5} y={-5} width={10} height={10} fill={palette.ink} />
              <text
                y={-12}
                textAnchor="middle"
                fontFamily="Fraunces Variable, serif"
                fontStyle="italic"
                fontWeight="600"
                fontSize="17"
                fill={palette.ink}
                stroke={palette.card}
                strokeWidth="4"
                paintOrder="stroke"
              >
                {n.label}
              </text>
              </g>
            </g>
          ) : (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              opacity={dim(n.id)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              role="button"
              aria-label={`${n.label}: ${STATUS_COPY[n.status]}`}
              className="cursor-pointer outline-none"
            >
              <g className="animate-rise" style={{ animationDelay: `${i * 18}ms` }}>
              <circle
                r={n.status === 'additional' ? 6 : 9}
                fill={fill[n.status]}
                stroke={stroke[n.status]}
                strokeWidth={n.status === 'matched' ? 0 : 2.5}
                strokeDasharray={n.status === 'alternative' ? '3 2' : undefined}
              />
              {n.status === 'matched' && n.evidence === 'listed' && <circle r={13} fill="none" stroke={palette.ochre} strokeWidth="1.5" strokeDasharray="2 2.5" />}
              <text
                x={n.lx}
                y={n.ly}
                textAnchor={n.anchor}
                fontFamily="JetBrains Mono Variable, monospace"
                fontSize={n.status === 'additional' ? 11.5 : 13}
                fontWeight={n.status === 'missing' ? 700 : 500}
                fill={n.status === 'missing' ? palette.accent : n.status === 'additional' ? palette.muted : palette.ink2}
                stroke={palette.card}
                strokeWidth="3"
                paintOrder="stroke"
              >
                {n.label}
              </text>
              </g>
            </g>
          ),
        )}
      </svg>
      <div className="mt-2 min-h-[2.5rem] border-t border-rule/25 pt-2 text-sm" aria-live="polite">
        {hover ? (
          <p>
            <span className="font-display text-lg font-semibold">{hover.label}</span>{' '}
            <span className="text-muted">· {hover.category}</span>
            <span className="block text-ink2">
              {STATUS_COPY[hover.status]}
              {hover.evidence === 'listed' && hover.status === 'matched' && ' · only listed, not shown in use'}
                {hover.evidence === 'demonstrated' && hover.status === 'matched' && ' · shown in use in your experience'}
              {hover.implied_by?.length > 0 && ` · inferred from ${hover.implied_by.join(', ')}`}
              {hover.satisfied_by?.length > 0 && ` · you have ${hover.satisfied_by.join(', ')}`}
              {hover.importance && ` · ${hover.importance} in the post`}
            </span>
          </p>
        ) : (
          <p className="italic text-muted">Hover or focus a skill to trace its connections.</p>
        )}
      </div>
    </div>
  )
}

export function ConstellationLegend() {
  const items = [
    ['bg-moss', 'Matched'],
    ['border-[2.5px] border-accent bg-card', 'Missing'],
    ['border-[2.5px] border-dashed border-ochre bg-card', 'Alternative'],
    ['bg-blueprint/60 border-2 border-blueprint', 'Résumé only'],
  ]
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink2">
      {items.map(([cls, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-full ${cls}`} /> {label}
        </li>
      ))}
      <li className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-blueprint" /> Inferred</li>
      <li className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dotted border-ochre" /> Either/or</li>
    </ul>
  )
}
