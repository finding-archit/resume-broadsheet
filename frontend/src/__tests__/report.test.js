import { describe, expect, it } from 'vitest'
import { projectScore, reportHeadline, scoreAnatomy, segmentText } from '../utils/report.js'

const base = {
  overall_match_score: 43.0,
  match_level: 'Good match',
  tfidf_similarity: 29.5,
  skill_coverage: 63.2,
  job_skill_count: 19,
  matched_skills: Array.from({ length: 12 }, (_, i) => ({ name: `M${i}` })),
  missing_skills: [{ name: 'AWS' }, { name: 'Kubernetes' }, { name: 'Redis' }],
  category_breakdown: [
    { category: 'Cloud & DevOps', required: 5, matched: 1 },
    { category: 'Databases', required: 2, matched: 2 },
  ],
  scoring_method: { weights: { tfidf: 0.6, skill_coverage: 0.4 } },
  score_cap: null,
}

describe('what-if projection', () => {
  it('recomputes coverage and score with the backend formula and rounding', () => {
    const p = projectScore(base, ['AWS', 'Kubernetes'])
    expect(p.coverage).toBe(73.7) // 14 / 19
    expect(p.overall).toBe(47.2) // 0.6 * 29.5 + 0.4 * 73.7
    expect(p.delta).toBe(4.2)
    expect(p.level).toBe('Good match')
  })

  it('ignores names that are not missing skills and duplicates', () => {
    expect(projectScore(base, ['Python', 'AWS', 'AWS']).coverage).toBe(68.4) // 13 / 19
  })

  it('respects the keyword-list cap', () => {
    const capped = { ...base, score_cap: { applied: true, max_score: 39.9 }, overall_match_score: 39.9 }
    const p = projectScore(capped, ['AWS', 'Kubernetes', 'Redis'])
    expect(p.overall).toBe(39.9)
    expect(p.capped).toBe(true)
  })

  it('is a no-op when skill coverage is unavailable', () => {
    const p = projectScore({ ...base, skill_coverage: null }, ['AWS'])
    expect(p.coverage).toBeNull()
    expect(p.overall).toBe(43.0)
  })
})

describe('report helpers', () => {
  it('splits text into highlighted segments and skips overlapping spans', () => {
    const text = 'Python and FastAPI'
    const parts = segmentText(text, [
      { start: 11, end: 18, status: 'matched' },
      { start: 0, end: 6, status: 'matched' },
      { start: 3, end: 8, status: 'missing' },
    ])
    expect(parts.map((p) => p.text)).toEqual(['Python', ' and ', 'FastAPI'])
    expect(parts.map((p) => p.text).join('')).toBe(text)
  })

  it('breaks the score into weighted parts that add up', () => {
    const a = scoreAnatomy(base)
    expect(a.parts.map((p) => p.value)).toEqual([17.7, 25.3])
    expect(a.gap).toBe(57.0)
  })

  it('writes a headline naming the weakest category', () => {
    expect(reportHeadline(base)).toEqual({ lead: 'A good match,', rest: 'with gaps in Cloud & DevOps.' })
    expect(reportHeadline({ ...base, match_level: 'Low match', category_breakdown: [] }).rest).toBe('with no skill gaps.')
    expect(reportHeadline({ ...base, score_cap: { applied: true } }).lead).toBe('Capped:')
  })
})
