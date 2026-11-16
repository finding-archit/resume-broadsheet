import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useConfig } from '../services/config.jsx'

const TICKER = [
  ['Python', 'matched'], ['FastAPI', 'matched'], ['Kubernetes', 'missing'], ['PostgreSQL', 'matched'],
  ['Docker', 'matched'], ['AWS', 'missing'], ['Django', 'alternative'], ['Redis', 'missing'],
  ['Git', 'matched'], ['CI/CD', 'missing'], ['REST API', 'matched'], ['Agile', 'matched'],
  ['Communication', 'missing'], ['Unit Testing', 'matched'], ['Microservices', 'missing'], ['SQL', 'matched'],
]
const TICK_STYLE = {
  matched: ['▲', 'moss'],
  missing: ['▼', 'accent'],
  alternative: ['◆', 'ochre'],
}

const STEPS = [
  ['Submit', 'Upload a PDF or DOCX résumé, or paste the text, along with the job description you are targeting.'],
  ['Clean', 'Ligatures, bullets, hyphenation and contact details are removed, while C++, C#, .NET and Node.js stay intact.'],
  ['Extract', 'A 118-skill taxonomy with aliases, negation and context checks finds what each document actually claims.'],
  ['Weigh', 'TF-IDF vectors and cosine similarity measure shared vocabulary; skill coverage counts the requirements met.'],
]

const INDEX = [
  ['The score, set in type', 'Gauge, stamp and the anatomy of the number', 'III'],
  ['Skill constellation', 'A force-directed map of matched, missing and inferred skills', 'III'],
  ['The annotated manuscript', 'Your résumé and the job post, highlighted side by side', 'III'],
  ['What-if desk', 'Tick the skills you genuinely have and watch the projection', 'III'],
  ['Comparison table', 'One résumé against every sample job, as a heatmap', 'III'],
  ['Methods', 'Formulas, weights, bands and the limits of lexical matching', 'IV'],
]

function Specimen() {
  // Static illustration built from the bundled sample (python developer vs backend post).
  const score = 46.3
  const angle = Math.PI * (1 - score / 100)
  const nx = 100 + 74 * Math.cos(angle)
  const ny = 100 - 74 * Math.sin(angle)
  return (
    <figure className="sheet animate-rise p-6 [animation-delay:150ms]">
      <div className="flex items-center justify-between">
        <span className="kicker">Specimen report</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">sample data</span>
      </div>
      <div className="relative mt-4">
        <svg viewBox="0 0 200 108" className="w-full" aria-hidden="true">
          <path d="M 16 100 A 84 84 0 0 1 184 100" fill="none" stroke="rgb(var(--rule) / 0.12)" strokeWidth="14" />
          <path d="M 16 100 A 84 84 0 0 1 184 100" fill="none" stroke="rgb(var(--blueprint))" strokeWidth="14" strokeDasharray={`${(Math.PI * 84 * score) / 100} 999`} />
          {[20, 40, 60].map((t) => {
            const a = Math.PI * (1 - t / 100)
            return <line key={t} x1={100 + 76 * Math.cos(a)} y1={100 - 76 * Math.sin(a)} x2={100 + 93 * Math.cos(a)} y2={100 - 93 * Math.sin(a)} stroke="rgb(var(--paper))" strokeWidth="2" />
          })}
          <line x1="100" y1="100" x2={nx} y2={ny} stroke="rgb(var(--ink))" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="100" cy="100" r="5" fill="rgb(var(--ink))" />
        </svg>
        <div className="-mt-1 text-center">
          <span className="headline num text-5xl">{score.toFixed(1)}</span>
        </div>
        <span className="absolute right-0 top-2 rotate-[-7deg] border-[3px] border-double border-blueprint px-2 py-0.5 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-blueprint">
          Good match
        </span>
      </div>
      <blockquote className="mt-6 border-l-[3px] border-rule/30 pl-4 font-display text-[17px] leading-[1.75] text-ink2">
        “Developed RESTful APIs with{' '}
        <mark className="bg-moss/15 px-0.5 text-ink underline decoration-moss decoration-2 underline-offset-[5px]">FastAPI</mark> and{' '}
        <mark className="bg-moss/15 px-0.5 text-ink underline decoration-moss decoration-2 underline-offset-[5px]">PostgreSQL</mark>…
        containerised three services with{' '}
        <mark className="bg-moss/15 px-0.5 text-ink underline decoration-moss decoration-2 underline-offset-[5px]">Docker</mark>.”
      </blockquote>
      <div className="mt-4 flex flex-wrap gap-2">
        {['Kubernetes', 'AWS', 'CI/CD'].map((s) => (
          <span key={s} className="tag border-accent text-accent">✕ {s}</span>
        ))}
        <span className="tag border-ochre text-ochre">◆ Django · alternative</span>
      </div>
      <figcaption className="mt-5 border-t border-rule/30 pt-3 text-xs italic text-muted">
        Fig. 1: Python developer vs. backend post. Matched skills underlined in green, gaps in red.
      </figcaption>
    </figure>
  )
}

export default function HomePage() {
  const { config } = useConfig()
  const w = config.weights
  const categories = config.categories?.length || 8

  return (
    <div className="space-y-20">
      {/* Lead story */}
      <section className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="kicker animate-rise text-accent">Lead story · Natural language processing</p>
          <h1 className="headline mt-5 animate-rise text-[2.9rem] sm:text-7xl [animation-delay:60ms]">
            Does your résumé speak the <em className="font-medium text-accent" style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1' }}>language</em> of the job?
          </h1>
          <p className="dek mt-6 max-w-2xl animate-rise [animation-delay:120ms]">
            A transparent matcher that reads both documents, finds the skills each one claims, and tells you, with the
            arithmetic shown, how closely they align.
          </p>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            By the NLP desk · Fully offline · No API keys
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/analyze" className="btn-accent px-6 py-3.5">
              Match my résumé <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link to="/methodology" className="btn-paper px-6 py-3.5">How the scoring works</Link>
          </div>
          <div className="mt-10 gap-8 text-[15.5px] leading-relaxed text-ink2 sm:columns-2">
            <p className="drop-cap">
              Recruiters and applicant tracking systems scan for vocabulary. A qualified candidate can be overlooked
              simply because their résumé names a skill differently from the posting, or not at all. This tool makes
              that gap visible.
            </p>
            <p className="mt-4 sm:mt-0">
              It is honest about what it measures: shared words and listed skills, not talent. The score is not a
              probability of being hired, and every recommendation is conditional on experience you genuinely have.
            </p>
          </div>
        </div>
        <div className="lg:col-span-5">
          <Specimen />
        </div>
      </section>

      {/* Ticker */}
      <section aria-label="Sample skill ticker" className="-mx-4 overflow-hidden border-y-2 border-rule bg-ink py-2.5 text-paper sm:-mx-8">
        <div className="flex w-max animate-ticker gap-8 whitespace-nowrap font-mono text-xs font-bold uppercase tracking-[0.16em]">
          {[...TICKER, ...TICKER].map(([name, status], i) => {
            const [glyph, token] = TICK_STYLE[status]
            return (
              <span key={i} className="flex items-center gap-2" aria-hidden={i >= TICKER.length}>
                {name} <span style={{ color: `rgb(var(--${token}))`, filter: 'brightness(1.35) saturate(1.2)' }}>{glyph}</span>
                <span className="text-paper/45">{status}</span>
              </span>
            )
          })}
        </div>
      </section>

      {/* By the numbers */}
      <section aria-labelledby="numbers">
        <h2 id="numbers" className="kicker mb-6">By the numbers</h2>
        <dl className="grid grid-cols-2 border-l-2 border-rule lg:grid-cols-4">
          {[
            [config.skills_in_taxonomy, 'skills in the taxonomy, each with aliases'],
            [categories, 'categories, from languages to soft skills'],
            ['0', 'paid AI APIs, keys or external calls'],
            ['0', 'bytes of your résumé kept after the request'],
          ].map(([n, label]) => (
            <div key={label} className="border-b-2 border-r-2 border-t-2 border-rule p-5">
              <dt className="headline num text-6xl text-ink">{n}</dt>
              <dd className="mt-2 text-sm text-ink2">{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* How it works */}
      <section aria-labelledby="how">
        <div className="mb-8 flex items-baseline justify-between border-b-2 border-rule pb-2">
          <h2 id="how" className="font-display text-3xl font-semibold">How a report is made</h2>
          <span className="kicker hidden sm:inline">Four stages · Under a second</span>
        </div>
        <ol className="grid gap-y-8 md:grid-cols-4 md:divide-x md:divide-rule/30">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="md:px-6 md:first:pl-0 md:last:pr-0">
              <span className="font-display text-5xl italic text-accent">{['I', 'II', 'III', 'IV'][i]}</span>
              <h3 className="mt-2 font-display text-2xl font-semibold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink2">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Pull quote */}
      <section className="grid items-center gap-8 border-y-[3px] border-double border-rule py-12 lg:grid-cols-[auto_1fr]">
        <span className="font-display text-[9rem] leading-none text-accent" aria-hidden="true">“</span>
        <div>
          <p className="font-display text-3xl leading-snug sm:text-[2.6rem]">
            Overall = <span className="text-blueprint">{w.tfidf.toFixed(2)}</span> × TF-IDF similarity
            <br className="hidden sm:block" /> + <span className="text-moss">{w.skill_coverage.toFixed(2)}</span> × skill coverage
          </p>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            Both parts on a 0–100 scale · weights are heuristic and configurable · not a hiring probability
          </p>
        </div>
      </section>

      {/* Index */}
      <section aria-labelledby="index" className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 id="index" className="font-display text-3xl font-semibold">In this edition</h2>
          <p className="mt-3 text-ink2">Every report includes the following features, typeset from your own documents.</p>
          <Link to="/analyze" className="btn-ink mt-6">
            Start a report <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <ul className="lg:col-span-8">
          {INDEX.map(([title, text, page]) => (
            <li key={title} className="border-b border-rule/30 py-4">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-xl font-semibold">{title}</span>
                <span className="leader" />
                <span className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-accent">§ {page}</span>
              </div>
              <p className="mt-1 text-sm text-ink2">{text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
