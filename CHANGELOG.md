# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-11-17

The project is renamed **Resume Broadsheet** and redesigned as an editorial "broadsheet".

### Added
- Editorial design with light (morning) and dark (night) editions, bundled Fraunces, Instrument Sans and JetBrains Mono fonts, a masthead and section navigation.
- Report visuals: animated score gauge and verdict stamp, score-anatomy donut, d3-force skill constellation, résumé/job Venn diagram, missing-skill triage board, keyword word-wall, similarity breakdown, category radar and score bands.
- An annotated side-by-side manuscript highlighting every detected skill mention in both documents.
- A what-if simulator, a comparison heatmap of one résumé against several job posts, and edit-and-re-run with revision history.
- Evidence labels for résumé skills (shown in use, listed only, inferred) and a recommendation to demonstrate listed-only skills.
- Anti-gaming safeguards: lines copied from the job post are ignored, and a bare keyword list is capped at 39.9.
- `GET /api/config`, `similarity_terms`, `documents` (highlight spans), `evidence_summary`, `copied_text_removed` and `score_cap` in the API.
- A request-size limit returning HTTP 413, the "Vite" skill (118 skills in total), all three sample résumés in the UI, a 404 page, a cancel button, a server status indicator, `start.ps1` for Windows, `backend/.env.example`, a GitHub Actions CI workflow and README screenshots.

### Changed
- Snowball stemming for ordinary words, so word forms such as "cleaning" and "clean" match.
- The frontend reads weights, bands and limits from the server instead of hard-coding them.
- The PDF report is restyled to match the editorial design.
- Dependencies upgraded: Vite 8, Vitest 5, React Router 7, jsPDF 4 and jspdf-autotable 5 (0 npm advisories). Python requirements use compatible ranges for Python 3.11 to 3.14.

### Fixed
- Skill-overlap resolution was quadratic: a 100,000-character résumé took about 15 s and now takes about 0.5 s.
- Person initials ("Priya R. Sharma") and sentence-start words ("Swift delivery", "Spark joy") were read as skills.
- Negated mentions ("no experience with Java") counted as skills.
- Noisy aliases ("torch", "experimentation", "stakeholders", "algorithms" and "vite" as Webpack) caused false matches.
- The phone-number filter deleted year ranges such as "2021 - 2025".
- Recommendation wording did not agree in number ("Communication, which were not found").
- Validation errors stayed visible after the input was corrected, and the browser accepted résumé text the server would reject.
- Temporary upload files were not deleted on Windows when a corrupted PDF was uploaded.
- Unknown routes silently showed the home page.

## [1.0.0]

The original **AI Resume Matcher** by [Aditya Chaudhary](https://github.com/Aditya-Chaudhary-7724/AI-Resume-Matcher): PDF/DOCX extraction, a 117-skill taxonomy, TF-IDF and cosine similarity, skill coverage, rule-based recommendations, a React dashboard with CSV/PDF export, and 110 backend and 13 frontend tests.

[2.0.0]: https://github.com/finding-archit/resume-broadsheet/releases/tag/v2.0.0
