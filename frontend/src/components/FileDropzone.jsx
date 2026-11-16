import { useRef, useState } from 'react'
import { FileText, RefreshCw, X } from 'lucide-react'
import { formatBytes } from '../utils/format.js'
import { MAX_FILE_SIZE_MB, validateFile } from '../utils/validation.js'

export default function FileDropzone({ file, onChange, error, onError, describedBy }) {
  const inputRef = useRef(null)
  // dragenter/dragleave also fire for child elements; a depth counter avoids flicker.
  const depth = useRef(0)
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
      <div className="flex items-center gap-4 border-2 border-rule bg-card p-4">
        {input}
        <span className="grid h-14 w-11 shrink-0 place-items-center border-2 border-rule bg-paper font-mono text-[10px] font-bold uppercase">
          {file.name.split('.').pop()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg" title={file.name}>{file.name}</p>
          <p className="font-mono text-xs text-muted">{formatBytes(file.size)} · ready to analyse</p>
        </div>
        <button type="button" onClick={openPicker} className="btn-link" aria-label="Replace file">
          <RefreshCw size={13} aria-hidden="true" /> <span className="hidden sm:inline">Replace</span>
        </button>
        <button
          type="button"
          onClick={() => {
            onChange(null)
            onError(null)
          }}
          className="btn-link hover:text-accent"
          aria-label="Remove file"
        >
          <X size={13} aria-hidden="true" /> <span className="hidden sm:inline">Remove</span>
        </button>
      </div>
    )
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault()
        depth.current += 1
        setDragging(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        depth.current = 0
        setDragging(false)
        pick(e.dataTransfer.files?.[0])
      }}
      className={`group relative border-2 border-dashed px-6 py-12 text-center transition-colors ${
        error ? 'border-accent bg-accent/5' : dragging ? 'border-accent bg-accent/10' : 'border-rule/50 bg-paper hover:border-rule'
      }`}
    >
      {input}
      <FileText className={`mx-auto transition-transform ${dragging ? '-translate-y-1 text-accent' : 'text-ink2'}`} size={34} strokeWidth={1.4} aria-hidden="true" />
      <p className="mt-4 font-display text-xl">
        {dragging ? 'Drop it on the desk.' : 'Drop the manuscript here'}
      </p>
      <p className="mt-1 text-sm text-ink2">
        or{' '}
        <button type="button" onClick={openPicker} className="font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-accent">
          browse your files
        </button>
      </p>
      <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
        PDF or DOCX · up to {MAX_FILE_SIZE_MB} MB · text-based, not scanned
      </p>
    </div>
  )
}
