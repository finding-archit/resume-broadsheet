import { describe, expect, it } from 'vitest'
import {
  MAX_FILE_SIZE_BYTES,
  countWords,
  getExtension,
  validateFile,
  validateForm,
  validateJobDescription,
  validateResumeText,
} from '../utils/validation.js'

const fakeFile = (name, size = 1000) => ({ name, size })
const longJd = 'We need a Python developer with SQL, Docker and AWS experience to build APIs for our platform.'

describe('file validation', () => {
  it('accepts PDF and DOCX regardless of case', () => {
    expect(validateFile(fakeFile('cv.pdf'))).toBeNull()
    expect(validateFile(fakeFile('CV.DOCX'))).toBeNull()
  })

  it('rejects unsupported types with a helpful message', () => {
    expect(validateFile(fakeFile('cv.txt'))).toMatch(/Unsupported file type/)
    expect(validateFile(fakeFile('cv.doc'))).toMatch(/Legacy \.doc/)
    expect(validateFile(fakeFile('cv'))).toMatch(/unknown/)
  })

  it('rejects empty and oversized files', () => {
    expect(validateFile(fakeFile('cv.pdf', 0))).toMatch(/empty/)
    expect(validateFile(fakeFile('cv.pdf', MAX_FILE_SIZE_BYTES + 1))).toMatch(/maximum size/)
  })

  it('extracts extensions', () => {
    expect(getExtension('a.b.PDF')).toBe('.pdf')
    expect(getExtension('noext')).toBe('')
  })
})

describe('text validation', () => {
  it('counts words', () => {
    expect(countWords('  one two\nthree  ')).toBe(3)
    expect(countWords('')).toBe(0)
  })

  it('requires resume text of sufficient length', () => {
    expect(validateResumeText('')).toMatch(/upload a resume/)
    expect(validateResumeText('too short')).toMatch(/too short/)
    // Long enough in characters but only one word: the backend would reject it.
    expect(validateResumeText('x'.repeat(60))).toMatch(/at least 10 words/)
    expect(validateResumeText('word '.repeat(12))).toBeNull()
  })

  it('requires a job description with enough words', () => {
    expect(validateJobDescription('   ')).toMatch(/paste a job description/)
    expect(validateJobDescription('Python developer')).toMatch(/too short/)
    expect(validateJobDescription(longJd)).toBeNull()
  })

  it('validates the whole form by mode', () => {
    expect(validateForm({ mode: 'file', file: null, jobDescription: longJd }).resume).toMatch(/choose a PDF/)
    const ok = validateForm({ mode: 'text', resumeText: 'resume '.repeat(12), jobDescription: longJd })
    expect(ok).toEqual({ resume: null, job: null })
  })
})
