import { NavLink, Link } from 'react-router-dom'
import { FileSearch, Lock } from 'lucide-react'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/analyze', label: 'Analyze' },
  { to: '/results', label: 'Results' },
  { to: '/methodology', label: 'Methodology' },
]

export function Navbar() {
  return (
    <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">
            <FileSearch size={18} aria-hidden="true" />
          </span>
          AI Resume Matcher
        </Link>
        <ul className="flex flex-wrap items-center gap-1 text-sm">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 font-medium transition-colors ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>AI Resume Matcher Using Natural Language Processing · CSE Mini Project</p>
        <p className="flex items-center gap-1">
          <Lock size={14} aria-hidden="true" /> Runs locally · no paid AI APIs · resumes are not stored
        </p>
      </div>
    </footer>
  )
}

export function PageHeader({ eyebrow, title, children, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-sm font-semibold text-indigo-600">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {children && <p className="mt-2 max-w-2xl text-slate-600">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
