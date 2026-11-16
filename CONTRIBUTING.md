# Contributing

Thanks for your interest in improving Resume Broadsheet. Issues and pull requests are welcome.

## Set up

Follow the [Quick start](README.md#quick-start) in the README to install the backend (Python 3.11+) and the frontend (Node.js 18+).

## Before you open a pull request

Run the same checks as CI:

```bash
cd backend && python -m pytest -q
cd frontend && npm test && npm run build
```

- Add or update tests for any behaviour you change. Tests must stay deterministic and offline.
- Keep the scoring explainable: if you change a formula, a weight or a threshold, update `docs/methodology.md`, the README and the in-app Methods page.
- Never add real résumés or personal data to the repository. Use the fictional files in `sample_data/`.
- Recommendations must stay conditional on genuine experience; they must never suggest claiming skills or certifications.

## Common changes

- **Add a skill:** edit `backend/app/data/skills.json`. Short or ambiguous names belong in `exact_aliases` (matched case-sensitively), and ordinary English words should be marked `"ambiguous": true`. Add a test in `backend/tests/test_skill_extractor.py`.
- **Add a report figure:** put the component in `frontend/src/components/report/`, keep pure calculations in `frontend/src/utils/report.js`, and test them in `frontend/src/__tests__/`.

## Style

- Python: PEP 8, 4-space indentation, docstrings that explain design decisions.
- JavaScript/JSX: 2-space indentation, no semicolons, single quotes (match the surrounding code).
- `.editorconfig` sets the basics for most editors.

## Commit messages

Use short, imperative subjects with a conventional prefix, for example `fix: keep year ranges when removing phone numbers` or `feat: add category radar chart`.
