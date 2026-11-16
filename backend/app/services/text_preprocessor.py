"""Text preprocessing and normalization.

Design goal: clean up extraction artifacts without destroying technical terms.
Common tokenizers split "C++" into "c", "C#" into "c", and ".NET" / "Node.js"
into fragments. We avoid that by:

1. Cleaning formatting artifacts (bullets, ligatures, hyphenated line breaks,
   repeated whitespace) while keeping the characters + # . / that occur inside
   technical terms.
2. Using a custom tokenizer regex that keeps "c++", "c#", ".net", "node.js",
   "ci/cd" as single tokens.
3. (In the matching engine) replacing detected skill mentions with canonical
   single tokens so aliases such as "JS" and "JavaScript" are treated as the
   same term by TF-IDF.
4. Stemming plain words with the English Snowball stemmer (pure Python, no
   data download) so "cleaning" / "clean" and "datasets" / "dataset" match.
   Stop words are checked on the surface form first, and skill tokens or
   tokens containing digits or . + # / are never stemmed.

Stop words come from scikit-learn's built-in English list, so no corpus
download (e.g. NLTK data) is needed and everything works offline.
"""

import re
import threading
import unicodedata
from functools import lru_cache

import snowballstemmer
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

# Words that are frequent in every resume / job post but carry no matching signal.
DOMAIN_STOP_WORDS = frozenset(
    {
        "etc", "e.g", "i.e", "using", "used", "use", "work", "working", "worked",
        "including", "responsible", "responsibilities", "ability", "able",
        "strong", "good", "excellent", "years", "year", "looking", "join",
        "candidate", "candidates", "role", "position", "company", "team's",
        "we", "you", "our", "your", "will", "plus", "preferred", "required",
        "requirements", "requirement", "must", "nice", "have", "having",
        # Generic job-post verbs and filler: frequent everywhere, no matching signal.
        "experience", "experienced", "knowledge", "skills", "skill", "understanding",
        "design", "develop", "developing", "build", "building", "write", "writing",
        "maintain", "take", "part", "make", "help", "ensure", "support", "provide",
        "create", "new", "like", "well", "related", "based", "various", "familiarity",
        "hiring", "seeking", "need", "proven", "solid", "hands", "hands-on", "best",
        "practices", "clear", "concise", "way", "turn", "fictional", "demonstration",
        "sample", "description", "job", "pvt", "ltd",
    }
)

STOP_WORDS = frozenset(ENGLISH_STOP_WORDS) | DOMAIN_STOP_WORDS

# Tokens: a leading dot is allowed only for ".net"-style names; internal dots
# and slashes are kept when followed by alphanumerics ("node.js", "ci/cd");
# trailing + or # are kept ("c++", "c#").
TOKEN_PATTERN = r"(?:(?<![\w])\.)?[a-z0-9][a-z0-9_]*(?:[./][a-z0-9_]+)*[+#]*"
_TOKEN_RE = re.compile(TOKEN_PATTERN)

_BULLETS = "•●○◦▪▫■□►▸‣⁃∙·–—"
_BULLET_RE = re.compile(f"[{re.escape(_BULLETS)}]")
_HYPHEN_LINEBREAK_RE = re.compile(r"(\w)-\n(\w)")
_URL_RE = re.compile(r"https?://\S+|www\.\S+")
_EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
# Phone candidates stay on one line; _strip_phone keeps year ranges such as
# "2021 - 2025" (8 digits) and only removes runs with at least 10 digits.
_PHONE_RE = re.compile(r"(?<![\w+])\+?\d[\d \t().-]{8,}\d(?!\w)")
_YEAR_RANGE_RE = re.compile(r"^[\s(]*(?:(?:19|20)\d{2}[\s()]*-[\s()]*)+(?:19|20)\d{2}[\s)]*$")
_MIN_PHONE_DIGITS = 10
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_SPACES_RE = re.compile(r"[ \t ]+")
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")


def _strip_phone(match: re.Match) -> str:
    value = match.group(0)
    if sum(ch.isdigit() for ch in value) < _MIN_PHONE_DIGITS or _YEAR_RANGE_RE.match(value):
        return value
    return " "


def clean_text(text: str) -> str:
    """Normalize raw extracted text while preserving case and line structure.

    The skill extractor runs on this output (it needs original casing to tell
    the language "Go" from the verb "go"), so we do not lowercase here.
    """
    if not text:
        return ""
    # NFKC folds ligatures (ﬁ -> fi) and full-width characters.
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _CONTROL_RE.sub(" ", text)
    # Re-join words split across lines by PDF hyphenation: "develop-\nment".
    text = _HYPHEN_LINEBREAK_RE.sub(r"\1\2", text)
    # Contact details are personal data and add no matching signal.
    text = _URL_RE.sub(" ", text)
    text = _EMAIL_RE.sub(" ", text)
    text = _PHONE_RE.sub(_strip_phone, text)
    text = _BULLET_RE.sub(" ", text)
    text = _SPACES_RE.sub(" ", text)
    text = "\n".join(line.strip() for line in text.split("\n"))
    text = _MULTI_NEWLINE_RE.sub("\n\n", text)
    return text.strip()


def normalize_for_vectorizer(text: str) -> str:
    """Lowercase and collapse whitespace; input should already be cleaned."""
    return re.sub(r"\s+", " ", text.lower()).strip()


def tokenize(text: str) -> list[str]:
    """Split normalized text into tokens, keeping technical terms intact.

    Trailing sentence periods are removed by the regex itself because a dot
    must be followed by an alphanumeric to stay inside a token.
    """
    return _TOKEN_RE.findall(text.lower())


def remove_stop_words(tokens: list[str]) -> list[str]:
    return [t for t in tokens if t not in STOP_WORDS and not t.isdigit()]


# Snowball stemmers keep internal state while stemming, so each thread gets its own.
_stemmers = threading.local()


@lru_cache(maxsize=65536)
def stem(token: str) -> str:
    """Stem a plain alphabetic token; leave skill tokens and technical terms intact.

    Skill tokens contain "_" and terms such as "c++", "node.js", "ci/cd" or
    "python3" contain non-letters, so ``isalpha`` excludes all of them.
    """
    if not token.isalpha():
        return token
    stemmer = getattr(_stemmers, "english", None)
    if stemmer is None:
        stemmer = _stemmers.english = snowballstemmer.stemmer("english")
    return stemmer.stemWord(token)


def analyze_terms(text: str) -> list[tuple[str, str]]:
    """(stemmed term, surface token) pairs after stop-word removal."""
    return [(stem(t), t) for t in remove_stop_words(tokenize(text))]


def analyzer(text: str) -> list[str]:
    """Analyzer used by the TF-IDF vectorizer: tokenize, drop stop words, stem."""
    return [stem(t) for t in remove_stop_words(tokenize(text))]


def word_count(text: str) -> int:
    return len(tokenize(text))
