// Pure helpers behind the results report. Kept framework-free so they can be unit tested.
import { DEFAULT_BANDS, bandFor } from './format.js'

const round1 = (x) => Math.round(x * 10) / 10

/**
 * Project the score if the candidate genuinely added some missing skills.
 * TF-IDF similarity is held constant (re-running the analysis is the only way
 * to know how the wording changes); only skill coverage is recomputed, with
 * the same formula and rounding as the backend.
 */
export function projectScore(result, addedNames = []) {
  const weights = result.scoring_method?.weights ?? { tfidf: 0.6, skill_coverage: 0.4 }
  const bands = result.scoring_method?.bands ?? DEFAULT_BANDS
  const missing = new Set(result.missing_skills.map((s) => s.name))
  const added = [...new Set(addedNames)].filter((n) => missing.has(n))
  const total = result.job_skill_count

  if (result.skill_coverage === null || result.skill_coverage === undefined || !total) {
    return { coverage: null, overall: result.overall_match_score, level: result.match_level, delta: 0, capped: false }
  }
  const coverage = round1(((result.matched_skills.length + added.length) / total) * 100)
  let overall = round1(Math.min(100, Math.max(0, weights.tfidf * result.tfidf_similarity + weights.skill_coverage * coverage)))
  const cap = result.score_cap?.applied ? result.score_cap.max_score : null
  const capped = cap !== null && overall > cap
  if (capped) overall = cap
  return {
    coverage,
    overall,
    level: bandFor(overall, bands),
    delta: round1(overall - result.overall_match_score),
    capped,
  }
}

/** Split text into plain and highlighted segments using non-overlapping spans. */
export function segmentText(text, spans = []) {
  const sorted = [...spans].sort((a, b) => a.start - b.start)
  const out = []
  let pos = 0
  for (const span of sorted) {
    if (span.start < pos || span.end > text.length || span.end <= span.start) continue
    if (span.start > pos) out.push({ text: text.slice(pos, span.start) })
    out.push({ text: text.slice(span.start, span.end), span })
    pos = span.end
  }
  if (pos < text.length) out.push({ text: text.slice(pos) })
  return out
}

/** Per-category coverage rows (percent) for radar / bar charts. */
export function categoryCoverage(breakdown = []) {
  return breakdown.map((c) => ({
    category: c.category,
    short: shortCategory(c.category),
    required: c.required,
    matched: c.matched,
    coverage: c.required ? round1((c.matched / c.required) * 100) : 0,
  }))
}

const SHORT = {
  'Programming Languages': 'Languages',
  'Web Development': 'Web',
  'Data Science & Machine Learning': 'Data & ML',
  'NLP & Generative AI': 'NLP & GenAI',
  'Cloud & DevOps': 'Cloud',
  'Software Engineering Tools': 'Tooling',
  'Soft Skills': 'Soft skills',
}

export function shortCategory(name) {
  return SHORT[name] ?? name
}

/** Generated report headline, e.g. "A good match, with gaps in Cloud & DevOps." */
export function reportHeadline(result) {
  if (result.score_cap?.applied) return { lead: 'Capped:', rest: 'a keyword list is not evidence.' }
  const level = result.match_level.toLowerCase()
  const article = /^[aeiou]/.test(level) ? 'An' : 'A'
  const gaps = [...(result.category_breakdown ?? [])]
    .map((c) => ({ ...c, missing: c.required - c.matched }))
    .filter((c) => c.missing > 0)
    .sort((a, b) => b.missing - a.missing)
  const tail = gaps.length ? `with gaps in ${gaps[0].category}.` : 'with no skill gaps.'
  return { lead: `${article} ${level},`, rest: tail }
}

/** The overall score split into its two weighted parts plus the remaining gap. */
export function scoreAnatomy(result) {
  const w = result.scoring_method?.weights ?? { tfidf: 0.6, skill_coverage: 0.4 }
  if (result.skill_coverage === null || result.skill_coverage === undefined) {
    const t = result.tfidf_similarity
    return { parts: [{ key: 'tfidf', value: t }], gap: round1(100 - result.overall_match_score) }
  }
  const tfidfPart = round1(w.tfidf * result.tfidf_similarity)
  const coveragePart = round1(w.skill_coverage * result.skill_coverage)
  const lostToCap = result.score_cap?.applied ? round1(Math.max(0, tfidfPart + coveragePart - result.overall_match_score)) : 0
  return {
    parts: [
      { key: 'tfidf', value: tfidfPart },
      { key: 'coverage', value: coveragePart },
    ],
    lostToCap,
    gap: round1(Math.max(0, 100 - result.overall_match_score - lostToCap)),
  }
}
