import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { PageHeader } from '../components/Layout.jsx'
import { useConfig } from '../services/config.jsx'

const STAGES = [
  ['Extract', 'PyMuPDF · python-docx'],
  ['Clean', 'NFKC · PII removal'],
  ['Skills', 'Taxonomy · context · negation'],
  ['Vectorise', 'Stems · TF-IDF'],
  ['Compare', 'Cosine · coverage'],
  ['Report', 'Score · advice'],
]

function Pipeline() {
  return (
    <figure className="my-10">
      <ol className="grid grid-cols-2 border-2 border-rule sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map(([title, sub], i) => (
          <li key={title} className="relative border-rule p-4 [&:not(:last-child)]:border-b-2 sm:[&:not(:last-child)]:border-r-2 lg:border-b-0">
            <span className="font-display text-3xl italic text-accent">{i + 1}</span>
            <p className="mt-1 font-display text-lg font-semibold">{title}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{sub}</p>
            {i < STAGES.length - 1 && (
              <span className="absolute -right-[11px] top-1/2 z-10 hidden -translate-y-1/2 bg-paper px-0.5 font-display text-lg text-accent lg:block" aria-hidden="true">→</span>
            )}
          </li>
        ))}
      </ol>
      <figcaption className="mt-2 text-xs italic text-muted">Fig. A: The pipeline, from upload to report. Every stage is a separately tested module.</figcaption>
    </figure>
  )
}

function Article({ id, n, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 border-t-2 border-rule pt-6">
      <h2 className="flex items-baseline gap-3 font-display text-3xl font-semibold">
        <span className="italic text-accent">{n}</span> {title}
      </h2>
      <div className="mt-4 space-y-4 text-[16.5px] leading-[1.75] text-ink2">{children}</div>
    </section>
  )
}

export default function MethodologyPage() {
  const { config } = useConfig()
  const w = config.weights
  const toc = [
    ['extraction', 'Text extraction'],
    ['skills', 'Finding skills'],
    ['tfidf', 'Weighing words'],
    ['score', 'The score'],
    ['honesty', 'Keeping it honest'],
    ['limits', 'Limitations'],
  ]

  return (
    <div>
      <PageHeader
        kicker="Section IV · Methods"
        title={<>How two documents become <em className="text-accent">one number</em>.</>}
        dek="A plain-language account of the pipeline: what is measured, how it is weighted, and where it stops being reliable."
      />

      <Pipeline />

      <div className="grid gap-12 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Contents" className="hidden lg:block">
          <div className="sticky top-20">
            <p className="kicker mb-3">Contents</p>
            <ol className="space-y-2 border-l-2 border-rule pl-4">
              {toc.map(([id, label], i) => (
                <li key={id}>
                  <a href={`#${id}`} className="font-display text-[15px] hover:text-accent">
                    <span className="mr-1.5 font-mono text-[10px] text-muted">{String(i + 1).padStart(2, '0')}</span>{label}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="max-w-3xl space-y-12">
          <Article id="extraction" n="§1" title="Text extraction">
            <p className="drop-cap">
              PDF résumés are read with PyMuPDF and DOCX résumés with python-docx, including tables, which many
              two-column templates rely on. Each upload is checked by extension, size ({config.max_file_size_mb} MB) and
              file signature, then read in a private temporary folder that is deleted whether parsing succeeds or fails.
              Scanned, image-only PDFs have no text layer and are rejected, because OCR is not implemented.
            </p>
            <p>
              The text is then cleaned: Unicode normalisation folds ligatures, words split across lines are re-joined,
              and bullets, URLs, e-mail addresses and phone numbers are removed (date ranges such as “2021 – 2025” are
              kept). Case is preserved, so <em>Go</em> the language can be told apart from <em>go</em> the verb.
            </p>
          </Article>

          <Article id="skills" n="§2" title="Finding skills">
            <p>
              A taxonomy of <strong className="text-ink">{config.skills_in_taxonomy} skills</strong>
              {config.categories?.length ? ` in ${config.categories.length} categories` : ''} is matched with regular
              expressions that use technical-term boundaries, so “Java” does not match inside “JavaScript” and “C” does
              not match “C++”. Aliases are normalised (JS → JavaScript, k8s → Kubernetes, Amazon Web Services → AWS).
            </p>
            <ul className="list-none space-y-2 border-l-[3px] border-rule/30 pl-4">
              <li><strong className="text-ink">Context.</strong> Ordinary words such as Swift, Express, Spark or Excel only count in a technical context (a skills list, “in Go”, “Swift apps”). Name initials like “R. Sharma” are ignored.</li>
              <li><strong className="text-ink">Negation.</strong> “No experience with Kubernetes” does not count as Kubernetes.</li>
              <li><strong className="text-ink">Inference.</strong> PostgreSQL implies SQL; such matches are flagged as inferred.</li>
              <li><strong className="text-ink">Importance.</strong> In the job post, section headings and wording mark each skill as required, mentioned or preferred.</li>
              <li><strong className="text-ink">Alternatives.</strong> In “FastAPI, Django or Flask”, any one option satisfies the group.</li>
              <li><strong className="text-ink">Evidence.</strong> A résumé skill is “shown in use” when it appears in a descriptive sentence, and “listed only” when it appears only in a list.</li>
            </ul>
          </Article>

          <Article id="tfidf" n="§3" title="Weighing words">
            <p>
              Each skill mention is replaced by one canonical token, so aliases count as the same term. Other words are
              reduced to their stem (Snowball), so “cleaning” and “clean” match. A TF-IDF vectoriser with sublinear term
              frequency, smoothed IDF and L2 normalisation is fitted on the two documents, and their cosine similarity is
              measured. Because the vectors are normalised, the similarity is a sum of per-term products, which the report
              breaks down term by term.
            </p>
            <pre className="overflow-x-auto border-2 border-rule bg-ink p-5 font-mono text-[13px] leading-relaxed text-paper">{`tf-idf(t, d) = (1 + ln tf) × (ln((1 + n) / (1 + df)) + 1)      n = 2
cosine(A, B) = Σ aᵢ·bᵢ  (vectors are L2-normalised)`}</pre>
          </Article>

          <Article id="score" n="§4" title="The score">
            <div className="border-y-[3px] border-double border-rule py-6 text-center font-display text-2xl text-ink sm:text-3xl">
              Overall = <span className="text-blueprint">{w.tfidf.toFixed(2)}</span> × TF-IDF +{' '}
              <span className="text-moss">{w.skill_coverage.toFixed(2)}</span> × Coverage
            </div>
            <p>
              Skill coverage is the share of the job post’s unique skills found in the résumé. If the post contains no
              taxonomy skills, coverage is reported as unavailable and the score is the TF-IDF similarity alone. TF-IDF
              gets the larger weight because it reads the whole text; coverage rewards meeting the listed requirements.
              Both weights are heuristic and configurable (<code className="font-mono text-sm">TFIDF_WEIGHT</code>,{' '}
              <code className="font-mono text-sm">SKILL_WEIGHT</code>).
            </p>
            <table className="w-full border-collapse text-left">
              <tbody>
                {config.bands.map((b) => (
                  <tr key={b.label} className="border-b border-rule/25">
                    <th scope="row" className="py-2 font-display text-lg font-semibold text-ink">{b.label}</th>
                    <td className="py-2 text-right font-mono text-sm">score ≥ {b.min}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Article>

          <Article id="honesty" n="§5" title="Keeping it honest">
            <p>
              A matcher that rewards vocabulary can be gamed. Two safeguards keep the score meaningful. First, résumé lines
              copied nearly verbatim from the job post are removed before analysis: copied text is not evidence. Second,
              a résumé with fewer than two descriptive sentences (a bare keyword list) is capped at{' '}
              <strong className="text-ink">{config.keyword_list_cap}</strong>, below “Good match”, and the report says so.
            </p>
            <p>
              Recommendations are generated only from computed results and are always conditional: they never suggest
              claiming a skill, certification or experience you do not have.
            </p>
          </Article>

          <Article id="limits" n="§6" title="Limitations">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Matching is lexical. Paraphrases and skills outside the taxonomy can be missed.</li>
              <li>TF-IDF similarity measures shared vocabulary, not candidate quality, and it is not a hiring probability.</li>
              <li>Fitting IDF on two documents gives a narrow range, so good matches typically reach 20–45% similarity.</li>
              <li>Importance and evidence labels are heuristics and can be wrong for unusual layouts.</li>
              <li>No OCR, so scanned PDFs are rejected. Legacy .doc files are not supported.</li>
            </ul>
          </Article>

          <div className="flex justify-end">
            <Link to="/analyze" className="btn-accent">
              Try it now <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
