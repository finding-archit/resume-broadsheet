// Export helpers. CSV and PDF are both built from buildReportSections(), which
// reads values straight from the API response, so exported numbers always
// match what the report shows.
import { formatPercent } from './format.js'

const DISCLAIMER =
  'This score measures text and skill similarity only. It is not a probability of being hired.'

const EVIDENCE_LABEL = { demonstrated: 'shown in use', listed: 'listed only', inferred: 'inferred' }

export function buildReportSections(result, generatedAt = new Date()) {
  const method = result.scoring_method || {}
  const source =
    result.input_source?.type === 'file' ? `File: ${result.input_source.filename}` : 'Pasted text'
  const cap = result.score_cap?.applied ? result.score_cap : null

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
        ...(cap ? [['Score cap', `${cap.reason} Uncapped score: ${formatPercent(cap.uncapped_score)}`]] : []),
        ...(result.copied_text_removed?.lines
          ? [['Copied text removed', `${result.copied_text_removed.lines} line(s) copied from the job description were ignored`]]
          : []),
      ],
    },
    {
      title: 'Scoring method',
      rows: [
        ['Overall formula', method.overall_formula || ''],
        ['TF-IDF formula', method.tfidf_formula || ''],
        ['Skill coverage formula', method.skill_coverage_formula || ''],
        ...(method.adjustments ? [['Adjustments', method.adjustments]] : []),
        ['Disclaimer', DISCLAIMER],
      ],
    },
    {
      title: 'Matched skills',
      rows: result.matched_skills.map((s) => [
        s.name,
        [
          s.category,
          s.implied ? `inferred from ${s.implied_by.join(', ')}` : EVIDENCE_LABEL[s.evidence],
        ]
          .filter(Boolean)
          .join('; '),
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
      title: 'Similarity contributions',
      rows: (result.similarity_terms || []).map((t) => [
        t.term,
        `${(t.contribution * 100).toFixed(1)}% of the TF-IDF similarity`,
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
  return '\uFEFF' + lines.join('\r\n')
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

// Morning-edition palette for the printed report.
const INK = [23, 21, 18]
const PAPER = [243, 238, 228]
const ACCENT = [214, 57, 34]
const BLUEPRINT = [40, 62, 104]
const MOSS = [44, 96, 68]
const MUTED = [120, 112, 100]

// jsPDF's built-in fonts only cover Latin-1, so typographic symbols are simplified.
const latin1 = (s) =>
  String(s)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2192/g, '->')
    .replace(/\u00D7/g, 'x')
    .replace(/[^\x00-\xFF]/g, '')

export async function downloadPdf(result) {
  // Loaded on demand to keep the initial bundle small.
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 44

  doc.setFillColor(...PAPER)
  doc.rect(0, 0, W, 190, 'F')
  doc.setTextColor(...MUTED)
  doc.setFont('courier', 'bold')
  doc.setFontSize(8)
  doc.text(`ANALYSIS REPORT  -  ${new Date().toLocaleDateString('en-GB').toUpperCase()}`, M, 34)
  doc.setTextColor(...INK)
  doc.setFont('times', 'bolditalic')
  doc.setFontSize(30)
  doc.text('The Resume Broadsheet', M, 66)
  doc.setDrawColor(...INK)
  doc.setLineWidth(2)
  doc.line(M, 78, W - M, 78)
  doc.setLineWidth(0.6)
  doc.line(M, 82, W - M, 82)

  doc.setFont('times', 'bold')
  doc.setFontSize(54)
  doc.text(result.overall_match_score.toFixed(1), M, 140)
  doc.setFont('courier', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...ACCENT)
  doc.text(result.match_level.toUpperCase(), M, 162)
  doc.setTextColor(...MUTED)
  doc.setFont('times', 'italic')
  doc.setFontSize(9)
  doc.text(latin1(DISCLAIMER), M, 178)

  const bar = (label, value, y, color) => {
    const x = 260
    const w = W - M - x
    doc.setFont('courier', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(label, x, y - 6)
    doc.setTextColor(...INK)
    doc.text(value === null || value === undefined ? 'N/A' : `${value.toFixed(1)}%`, W - M, y - 6, { align: 'right' })
    doc.setFillColor(225, 218, 205)
    doc.rect(x, y, w, 8, 'F')
    if (value) {
      doc.setFillColor(...color)
      doc.rect(x, y, (w * Math.min(value, 100)) / 100, 8, 'F')
    }
  }
  bar('TF-IDF SIMILARITY', result.tfidf_similarity, 116, BLUEPRINT)
  bar('SKILL COVERAGE', result.skill_coverage, 146, MOSS)

  let y = 212
  for (const section of buildReportSections(result)) {
    autoTable(doc, {
      startY: y,
      head: [[latin1(section.title), '']],
      body: section.rows.length ? section.rows.map((r) => r.map(latin1)) : [['None', '']],
      margin: { left: M, right: M },
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, overflow: 'linebreak', textColor: INK, lineColor: [210, 202, 188], lineWidth: { bottom: 0.5 } },
      headStyles: { font: 'times', fontStyle: 'bold', fontSize: 12, textColor: INK, lineColor: INK, lineWidth: { bottom: 1.5 } },
      columnStyles: { 0: { cellWidth: 170, fontStyle: 'bold' } },
    })
    y = doc.lastAutoTable.finalY + 16
  }
  doc.save(`resume-match-report-${stamp()}.pdf`)
}
