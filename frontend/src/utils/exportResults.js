// Export helpers. CSV and PDF are both built from buildReportSections(), which
// reads values straight from the API response, so exported numbers always
// match what the dashboard shows.
import { formatPercent } from './format.js'

const DISCLAIMER =
  'This score measures text and skill similarity only. It is not a probability of being hired.'

export function buildReportSections(result, generatedAt = new Date()) {
  const method = result.scoring_method || {}
  const source =
    result.input_source?.type === 'file'
      ? `File: ${result.input_source.filename}`
      : 'Pasted text'

  return [
    {
      title: 'Summary',
      rows: [
        ['Generated', generatedAt.toLocaleString()],
        ['Resume source', source],
        ['Overall match score', formatPercent(result.overall_match_score)],
        ['Match level', result.match_level],
        ['TF-IDF similarity', formatPercent(result.tfidf_similarity)],
        ['Skill coverage', formatPercent(result.skill_coverage)],
        ['Job description skills detected', String(result.job_skill_count)],
        ['Resume skills detected', String(result.resume_skill_count)],
        ['Extracted resume text length', `${result.extracted_resume_text_length} characters`],
      ],
    },
    {
      title: 'Scoring method',
      rows: [
        ['Overall formula', method.overall_formula || ''],
        ['TF-IDF formula', method.tfidf_formula || ''],
        ['Skill coverage formula', method.skill_coverage_formula || ''],
        ['Disclaimer', DISCLAIMER],
      ],
    },
    {
      title: 'Matched skills',
      rows: result.matched_skills.map((s) => [
        s.name,
        `${s.category}${s.implied ? ` (inferred from ${s.implied_by.join(', ')})` : ''}`,
      ]),
    },
    {
      title: 'Missing skills',
      rows: result.missing_skills.map((s) => [
        s.name,
        `${s.category}; priority: ${s.priority}; ${s.importance} in job description`,
      ]),
    },
    {
      title: 'Alternatives satisfied',
      rows: (result.alternative_skills || []).map((a) => [
        a.name,
        `Not required: listed as an alternative to ${a.satisfied_by.join(', ')}`,
      ]),
    },
    {
      title: 'Additional resume skills',
      rows: result.additional_skills.map((s) => [s.name, s.category]),
    },
    {
      title: 'Job description keywords',
      rows: result.job_description_keywords.map((k) => [
        k.term,
        `TF-IDF weight ${k.weight.toFixed(4)}; ${k.in_resume ? 'found in resume' : 'not in resume'}`,
      ]),
    },
    {
      title: 'Recommendations',
      rows: result.recommendations.map((r) => [
        `[${r.priority.toUpperCase()}] ${r.title}`,
        r.detail,
      ]),
    },
  ]
}

export function csvEscape(value) {
  const s = String(value ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function buildCsv(result, generatedAt) {
  const lines = [['Section', 'Item', 'Value'].join(',')]
  for (const section of buildReportSections(result, generatedAt)) {
    if (!section.rows.length) lines.push([section.title, 'None', ''].map(csvEscape).join(','))
    for (const [item, value] of section.rows) {
      lines.push([section.title, item, value].map(csvEscape).join(','))
    }
  }
  // Byte-order mark so Excel opens UTF-8 correctly.
  return '﻿' + lines.join('\r\n')
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const stamp = () => new Date().toISOString().slice(0, 10)

export function downloadCsv(result) {
  const blob = new Blob([buildCsv(result)], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, `resume-match-report-${stamp()}.csv`)
}

export async function downloadPdf(result) {
  // Loaded on demand to keep the initial bundle small.
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 40
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('AI Resume Matcher - Analysis Report', margin, 50)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(DISCLAIMER, margin, 66)
  doc.setTextColor(0)

  let y = 82
  for (const section of buildReportSections(result)) {
    autoTable(doc, {
      startY: y,
      head: [[section.title, '']],
      body: section.rows.length ? section.rows : [['None', '']],
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [79, 70, 229] },
      columnStyles: { 0: { cellWidth: 170, fontStyle: 'bold' } },
    })
    y = doc.lastAutoTable.finalY + 14
  }
  doc.save(`resume-match-report-${stamp()}.pdf`)
}
