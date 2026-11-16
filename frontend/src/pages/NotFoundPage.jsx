import { Link, useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export default function NotFoundPage() {
  const { pathname } = useLocation()
  return (
    <section className="mx-auto max-w-3xl py-10 text-center">
      <p className="kicker text-accent">Erratum · Error 404</p>
      <h1 className="headline mt-4 text-6xl sm:text-8xl">
        This page was <em className="text-accent">never</em> set in type.
      </h1>
      <p className="dek mx-auto mt-6 max-w-xl">
        We searched the archive for <code className="font-mono text-base not-italic text-ink">{pathname}</code> and found
        nothing. It may have been moved, or it never went to press.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-ink">Front page</Link>
        <Link to="/analyze" className="btn-accent">
          Analyse a résumé <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
