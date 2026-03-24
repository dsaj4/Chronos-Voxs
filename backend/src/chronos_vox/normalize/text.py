"""Text helpers for deterministic comment normalization."""

from __future__ import annotations

from collections.abc import Mapping
import re
import unicodedata

URL_RE = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
REPEATED_CHAR_RE = re.compile(r"(.)\1{3,}")

INVISIBLE_CHARS = {
    "\u200b",
    "\u200c",
    "\u200d",
    "\ufeff",
    "\u2060",
}

NOISE_TOKENS = {
    "哈哈",
    "哈哈哈",
    "顶",
    "路过",
    "赞",
    "支持",
    "mark",
    "nice",
    "good",
}


def canonicalize_text(text: object) -> str:
    """Return a stable, trimmed text value with invisible characters removed."""

    if text is None:
        return ""
    value = str(text)
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = "".join(" " if ch in INVISIBLE_CHARS else ch for ch in value)
    return value.strip()


def normalize_text(text: object) -> str:
    """Normalize text into a lowercase, punctuation-free token stream."""

    canonical = unicodedata.normalize("NFKC", canonicalize_text(text))
    if not canonical:
        return ""

    pieces: list[str] = []
    for ch in canonical:
        category = unicodedata.category(ch)
        if ch in INVISIBLE_CHARS or category[0] in {"P", "S"}:
            pieces.append(" ")
        elif category in {"Zl", "Zp"} or ch.isspace():
            pieces.append(" ")
        else:
            pieces.append(ch.lower())

    normalized = "".join(pieces)
    return " ".join(normalized.split())


def tokenize(text: object) -> list[str]:
    """Tokenize normalized text into deterministic word-like chunks."""

    normalized = normalize_text(text)
    if not normalized:
        return []
    return [token for token in re.split(r"\s+", normalized) if token]


def detect_language(text: object) -> str:
    """Baseline language detection tuned for Chinese comment streams."""

    canonical = canonicalize_text(text)
    if not canonical:
        return "unknown"

    cjk_count = 0
    latin_count = 0
    for ch in canonical:
        if "\u4e00" <= ch <= "\u9fff":
            cjk_count += 1
        elif ch.isalpha() and ch.isascii():
            latin_count += 1

    if cjk_count == 0 and latin_count == 0:
        return "unknown"
    if cjk_count and latin_count:
        return "zh-CN" if cjk_count >= latin_count else "mixed"
    if cjk_count:
        return "zh-CN"
    return "en"


def has_url(text: object) -> bool:
    """Return whether the text contains a URL-like substring."""

    return bool(URL_RE.search(canonicalize_text(text)))


def repeated_character_run(text: object) -> bool:
    """Return whether the text contains long repeated character runs."""

    return bool(REPEATED_CHAR_RE.search(canonicalize_text(text)))


def symbol_ratio(text: object) -> float:
    """Compute a coarse symbol ratio for noise detection."""

    canonical = canonicalize_text(text)
    if not canonical:
        return 1.0
    considered = [ch for ch in canonical if not ch.isspace()]
    if not considered:
        return 1.0
    symbol_count = sum(1 for ch in considered if unicodedata.category(ch)[0] in {"P", "S"})
    return symbol_count / len(considered)


def looks_like_boilerplate(text: object) -> bool:
    """Detect very low-information boilerplate comments."""

    normalized = normalize_text(text)
    if not normalized:
        return True
    if normalized in NOISE_TOKENS:
        return True
    compact = normalized.replace(" ", "")
    if compact in NOISE_TOKENS:
        return True
    return False


def keyword_hits(text: object, keywords: Mapping[str, tuple[str, ...]]) -> list[str]:
    """Collect ordered keyword hits from a canonical text value."""

    canonical = canonicalize_text(text).lower()
    hits: list[str] = []
    for tag, terms in keywords.items():
        if any(term.lower() in canonical for term in terms):
            hits.append(tag)
    return hits
