"""Deterministic normalization from raw comments to normalized comments."""

from .pipeline import NORMALIZER_VERSION, normalize_raw_comment, normalize_raw_comments
from .text import canonicalize_text, detect_language, normalize_text

__all__ = [
    "NORMALIZER_VERSION",
    "canonicalize_text",
    "detect_language",
    "normalize_raw_comment",
    "normalize_raw_comments",
    "normalize_text",
]
