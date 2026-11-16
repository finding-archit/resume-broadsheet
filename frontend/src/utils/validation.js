// Client-side validation. The backend repeats every check, so these rules only
// give users fast feedback; they are not a security boundary.

export const MAX_FILE_SIZE_MB = 5
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
export const ALLOWED_EXTENSIONS = ['.pdf', '.docx']
export const MIN_RESUME_CHARS = 50
export const MIN_RESUME_WORDS = 10
export const MIN_JD_CHARS = 50
export const MIN_JD_WORDS = 10

export function getExtension(filename = '') {
  const idx = filename.lastIndexOf('.')
  return idx === -1 ? '' : filename.slice(idx).toLowerCase()
}

export function countWords(text = '') {
  return (text.trim().match(/\S+/g) || []).length
}

export function validateFile(file) {
  if (!file) return null
  const ext = getExtension(file.name)
  if (ext === '.doc') {
    return 'Legacy .doc files are not supported. Save your resume as .docx or PDF.'
  }
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Unsupported file type "${ext || 'unknown'}". Please upload a PDF or DOCX file.`
  }
  if (file.size === 0) return 'The selected file is empty.'
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `The file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The maximum size is ${MAX_FILE_SIZE_MB} MB.`
  }
  return null
}

export function validateResumeText(text) {
  const trimmed = (text || '').trim()
  if (!trimmed) return 'Please upload a resume or paste your resume text.'
  if (trimmed.length < MIN_RESUME_CHARS || countWords(trimmed) < MIN_RESUME_WORDS) {
    return `The resume text is too short. Please paste at least ${MIN_RESUME_WORDS} words (${MIN_RESUME_CHARS} characters).`
  }
  return null
}

export function validateJobDescription(text) {
  const trimmed = (text || '').trim()
  if (!trimmed) return 'Please paste a job description.'
  if (trimmed.length < MIN_JD_CHARS || countWords(trimmed) < MIN_JD_WORDS) {
    return `The job description is too short to analyze. Please provide at least ${MIN_JD_WORDS} words.`
  }
  return null
}

/** Validate the whole form. Returns { resume, job } error messages (null when valid). */
export function validateForm({ mode, file, resumeText, jobDescription }) {
  let resume
  if (mode === 'file') resume = file ? validateFile(file) : 'Please choose a PDF or DOCX resume.'
  else resume = validateResumeText(resumeText)
  return { resume, job: validateJobDescription(jobDescription) }
}
