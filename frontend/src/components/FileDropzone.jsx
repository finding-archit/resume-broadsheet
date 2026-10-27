import { useRef, useState } from 'react'
import { FileText, UploadCloud, X, RefreshCw } from 'lucide-react'
import { formatBytes } from '../utils/format.js'
import { MAX_FILE_SIZE_MB, validateFile } from '../utils/validation.js'

export default function FileDropzone({ file, onChange, error, onError, describedBy }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const pick = (selected) => {
    if (!selected) return
    const problem = validateFile(selected)
    if (problem) {
      onError(problem)
      return
    }
    onError(null)
    onChange(selected)
  }

  const openPicker = () => inputRef.current?.click()

  const input = (
    <input
      ref={inputRef}
      id="resume-file"
      type="file"
      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      className="sr-only"
      aria-describedby={describedBy}
      onChange={(e) => {
        pick(e.target.files?.[0])
        e.target.value = '' // allow re-selecting the same file
      }}
    />
  )

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
        {input}
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-indigo-600 ring-1 ring-indigo-200">
          <FileText size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900" title={file.name}>{file.name}</p>
          <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
        </div>
        <button type="button" onClick={openPicker} className="btn-ghost px-2.5 py-1.5" aria-label="Replace file">
          <RefreshCw size={16} aria-hidden="true" /> <span className="hidden sm:inline">Replace</span>
        </button>
        <button
          type="button"
          onClick={() => { onChange(null); onError(null) }}
          className="btn-ghost px-2.5 py-1.5 text-rose-600 hover:bg-rose-50"
          aria-label="Remove file"
        >
          <X size={16} aria-hidden="true" /> <span className="hidden sm:inline">Remove</span>
        </button>
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        pick(e.dataTransfer.files?.[0])
      }}
      className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
        error ? 'border-rose-300 bg-rose-50/40' : dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-slate-50'
      }`}
    >
      {input}
      <UploadCloud className="mx-auto text-indigo-500" size={32} aria-hidden="true" />
      <p className="mt-3 text-sm text-slate-700">
        Drag and drop your resume here, or{' '}
        <button type="button" onClick={openPicker} className="font-semibold text-indigo-600 underline-offset-2 hover:underline">
          browse files
        </button>
      </p>
      <p className="mt-1 text-xs text-slate-500">PDF or DOCX, up to {MAX_FILE_SIZE_MB} MB. Scanned (image-only) PDFs are not supported.</p>
    </div>
  )
}
