import { describe, expect, it } from 'vitest'
import { buildCsv, buildReportSections, csvEscape } from '../utils/exportResults.js'

const result = {
  overall_match_score: 61.3,
  match_level: 'Good match',
  tfidf_similarity: 42.2,
  skill_coverage: 90,
  matched_skills: [
    { name: 'Python', category: 'Programming Languages', implied: false, implied_by: [] },
    { name: 'SQL', category: 'Databases', implied: true, implied_by: ['PostgreSQL'] },
  ],
  missing_skills: [
    { name: 'AWS', category: 'Cloud & DevOps', importance: 'required', job_mentions: 1, priority: 'high' },
  ],
  additional_skills: [{ name: 'Java', category: 'Programming Languages' }],
  job_skill_count: 3,
  resume_skill_count: 4,
  extracted_resume_text_length: 1234,
  job_description_keywords: [{ term: 'Python', weight: 0.31, in_resume: true, is_skill: true }],
  recommendations: [
    { id: 1, priority: 'high', category: 'Missing skills', title: 'Address gaps', detail: 'Learn "AWS", then add it.', skills: ['AWS'] },
  ],
  scoring_method: {
    overall_formula: 'Overall Match Score = 0.60 x TF-IDF Similarity + 0.40 x Skill Coverage',
    tfidf_formula: 'cosine x 100',
    skill_coverage_formula: 'matched / required x 100',
  },
  input_source: { type: 'file', filename: 'resume.pdf' },
}

const date = new Date('2026-01-01T10:00:00Z')

describe('report export', () => {
  it('uses the exact displayed values', () => {
    const summary = buildReportSections(result, date)[0].rows
    const get = (k) => summary.find((r) => r[0] === k)[1]
    expect(get('Overall match score')).toBe('61.3%')
    expect(get('TF-IDF similarity')).toBe('42.2%')
    expect(get('Skill coverage')).toBe('90.0%')
    expect(get('Resume source')).toBe('File: resume.pdf')
  })

  it('shows N/A when skill coverage is unavailable', () => {
    const summary = buildReportSections({ ...result, skill_coverage: null }, date)[0].rows
    expect(summary.find((r) => r[0] === 'Skill coverage')[1]).toBe('N/A')
  })

  it('includes every skill list and flags inferred skills', () => {
    const csv = buildCsv(result, date)
    expect(csv).toContain('Matched skills,Python')
    expect(csv).toContain('inferred from PostgreSQL')
    expect(csv).toContain('Missing skills,AWS')
    expect(csv).toContain('Additional resume skills,Java')
    expect(csv).toContain('not a probability of being hired')
  })

  it('escapes CSV special characters', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('plain')).toBe('plain')
    expect(buildCsv(result, date)).toContain('"Learn ""AWS"", then add it."')
  })

  it('starts with a BOM and header row', () => {
    const csv = buildCsv(result, date)
    expect(csv.startsWith('﻿Section,Item,Value')).toBe(true)
  })
})
