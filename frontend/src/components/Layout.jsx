import { Link, NavLink, useLocation } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { useConfig } from '../services/config.jsx'
import { useTheme } from '../utils/theme.jsx'

const SECTIONS = [
  { to: '/', label: 'Front Page', n: 'I', end: true },
  { to: '/analyze', label: 'Submit', n: 'II' },
  { to: '/results', label: 'The Report', n: 'III' },
  { to: '/methodology', label: 'Methods', n: 'IV' },
]

function StatusDot() {
  const { online } = useConfig()
  const label = online === null ? 'Checking server' : online ? 'Server online' : 'Server offline'
  const tone = online === null ? 'bg-muted' : online ? 'bg-moss' : 'bg-accent'
  return (
    <span className="inline-flex items-center gap-1.5" role="status" aria-live="polite">
      <span className={`relative inline-block h-2 w-2 rounded-full ${tone}`}>
        {online && <span className="absolute inset-0 animate-ping rounded-full bg-moss/60" />}
      </span>
      {label}
    </span>
  )
}

export function Masthead() {
  const { config } = useConfig()
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const home = pathname === '/'
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <header className="no-print relative z-30 bg-paper">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-rule/30 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink2">
          <span>{today}</span>
          <span className="hidden md:inline">Vol. I · Offline edition · {config.skills_in_taxonomy} skills on file</span>
          <span className="flex items-center gap-4">
            <StatusDot />
            <button
              type="button"
              onClick={toggle}
              className="inline-flex items-center gap-1.5 uppercase hover:text-accent"
              aria-label={`Switch to ${theme === 'night' ? 'morning' : 'night'} edition`}
            >
              {theme === 'night' ? <Sun size={13} aria-hidden="true" /> : <Moon size={13} aria-hidden="true" />}
              {theme === 'night' ? 'Morning edition' : 'Night edition'}
            </button>
          </span>
        </div>

        <div className={`flex items-end justify-between gap-6 ${home ? 'py-7 sm:py-9' : 'py-4'}`}>
          <Link to="/" className="group block" aria-label="The Resume Matcher, home">
            <span
              className={`headline block transition-all ${home ? 'text-5xl sm:text-7xl lg:text-[5.6rem]' : 'text-3xl sm:text-4xl'}`}
              style={{ fontVariationSettings: '"SOFT" 30, "WONK" 1, "opsz" 144' }}
            >
              <span className="mr-2 align-top text-[0.42em] font-medium italic text-muted">The</span>
              Resume<span className="text-accent">·</span>Matcher
            </span>
          </Link>
          <p className={`hidden max-w-[17rem] text-right font-display italic leading-snug text-ink2 sm:block ${home ? 'text-base' : 'text-sm'}`}>
            “Does your résumé speak the language of the job?” An NLP broadsheet for job seekers.
          </p>
        </div>
      </div>

      <nav aria-label="Sections" className="sticky top-0 border-y-[3px] border-double border-rule bg-paper/95 backdrop-blur">
        <ul className="mx-auto flex max-w-7xl overflow-x-auto px-4 sm:px-8">
          {SECTIONS.map((s) => (
            <li key={s.to} className="shrink-0">
              <NavLink
                to={s.to}
                end={s.end}
                className={({ isActive }) =>
                  `group relative flex items-baseline gap-2 px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] transition-colors sm:px-5 ${
                    isActive ? 'text-ink' : 'text-muted hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`font-display text-sm italic ${isActive ? 'text-accent' : ''}`}>{s.n}.</span>
                    {s.label}
                    <span
                      className={`absolute inset-x-3 bottom-0 h-[3px] bg-accent transition-transform duration-300 sm:inset-x-5 ${
                        isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50'
                      }`}
                      style={{ transformOrigin: 'left' }}
                    />
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}

export function Colophon() {
  const { config } = useConfig()
  return (
    <footer className="no-print mt-24 border-t-[3px] border-double border-rule">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-3 sm:px-8">
        <div>
          <p className="headline text-2xl">The Resume·Matcher</p>
          <p className="mt-2 text-sm text-ink2">An NLP mini project in computer science and engineering. Version {config.version}.</p>
        </div>
        <div className="text-sm text-ink2">
          <p className="kicker mb-2">Colophon</p>
          Set in Fraunces, Instrument Sans and JetBrains Mono, all bundled locally. Charts drawn with Recharts and d3-force.
        </div>
        <div className="text-sm text-ink2">
          <p className="kicker mb-2">Privacy</p>
          Runs offline. No paid AI APIs, no database, no telemetry. Résumés are processed in memory and never stored.
        </div>
      </div>
    </footer>
  )
}

export function PageHeader({ kicker, title, dek, actions, children }) {
  return (
    <header className="mb-10 grid gap-6 border-b border-rule/40 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
      <div className="animate-rise">
        {kicker && <p className="kicker text-accent">{kicker}</p>}
        <h1 className="headline mt-3 text-4xl sm:text-6xl">{title}</h1>
        {dek && <p className="dek mt-4 max-w-3xl">{dek}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  )
}

/** Small-caps section heading used inside pages. */
export function SectionHead({ n, title, note, id }) {
  return (
    <div className="mb-5 flex items-baseline gap-3 border-b-2 border-rule pb-2">
      {n && <span className="font-display text-2xl italic text-accent">{n}</span>}
      <h2 id={id} className="font-display text-2xl font-semibold tracking-tight sm:text-[1.7rem]">{title}</h2>
      {note && <span className="ml-auto hidden font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted sm:inline">{note}</span>}
    </div>
  )
}
