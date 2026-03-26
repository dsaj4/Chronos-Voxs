"""Adapters for mapping MediaCrawler JSONL output into Chronos-Vox raw comments."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from ..contracts.models import RawComment


def canonicalize_text(value: object) -> str:
    return str(value or "").strip()


PLATFORM_ALIASES = {
    "bili": "bilibili",
    "bilibili": "bilibili",
    "xhs": "xiaohongshu",
    "xiaohongshu": "xiaohongshu",
    "zhihu": "zhihu",
    "weibo": "weibo",
}


def _as_int(value: object) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def _resolve_platform(value: object) -> str:
    normalized = canonicalize_text(value).lower()
    return PLATFORM_ALIASES.get(normalized, "other")


def _record_kind(record: dict[str, Any]) -> str:
    if canonicalize_text(record.get("comment_id") or record.get("source_comment_id")) and canonicalize_text(
        record.get("text") or record.get("content")
    ):
        return "comment"
    if canonicalize_text(record.get("item_id") or record.get("source_item_id") or record.get("video_id")) and (
        canonicalize_text(record.get("title"))
        or canonicalize_text(record.get("item_title"))
        or canonicalize_text(record.get("video_url"))
        or canonicalize_text(record.get("item_url"))
    ):
        return "content"
    return "unknown"


def _default_timezone(manifest: dict[str, Any]) -> datetime.tzinfo | None:
    created_at = canonicalize_text(manifest.get("created_at"))
    if not created_at:
        return datetime.now().astimezone().tzinfo
    try:
        parsed = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except ValueError:
        return datetime.now().astimezone().tzinfo
    return parsed.tzinfo or datetime.now().astimezone().tzinfo


def _coerce_datetime(value: object, *, default_tz: datetime.tzinfo | None) -> str:
    if isinstance(value, (int, float)) or canonicalize_text(value).isdigit():
        try:
            timestamp = int(str(value))
        except ValueError:
            return canonicalize_text(value)
        if abs(timestamp) >= 1_000_000_000_000:
            timestamp = int(timestamp / 1000)
        return datetime.fromtimestamp(timestamp, tz=default_tz).isoformat(timespec="seconds")

    text = canonicalize_text(value)
    if not text:
        return ""
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return text
    if parsed.tzinfo is None and default_tz is not None:
        parsed = parsed.replace(tzinfo=default_tz)
    return parsed.isoformat(timespec="seconds")


def _stable_record_id(platform: str, item_id: str, comment_id: str) -> str:
    safe_platform = canonicalize_text(platform).lower() or "other"
    safe_item = canonicalize_text(item_id) or "item"
    safe_comment = canonicalize_text(comment_id) or "comment"
    return f"{safe_platform}_{safe_item}_{safe_comment}"


class MediaCrawlerRawRecordAdapter:
    """Read MediaCrawler JSONL files and coerce them into RawComment payloads."""

    def resolve_output_files(self, manifest: dict[str, Any], *, manifest_path: Path | None = None) -> list[Path]:
        base_dir = manifest_path.resolve().parent if manifest_path is not None else Path.cwd()
        resolved_paths: list[Path] = []
        for item in manifest.get("output_files", []):
            raw_path = canonicalize_text(item)
            if not raw_path:
                continue
            path = Path(raw_path)
            resolved_paths.append(path.resolve() if path.is_absolute() else (base_dir / path).resolve())
        return resolved_paths

    def load_records(self, manifest: dict[str, Any], *, manifest_path: Path | None = None) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for path in self.resolve_output_files(manifest, manifest_path=manifest_path):
            if not path.exists():
                raise FileNotFoundError(f"MediaCrawler output file not found: {path}")
            for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
                line = raw_line.strip().lstrip("\ufeff")
                if not line:
                    continue
                try:
                    payload = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise ValueError(f"Invalid JSONL in {path} line {line_number}") from exc
                if not isinstance(payload, dict):
                    raise ValueError(f"Expected object records in {path} line {line_number}")
                records.append(payload)
        return records

    @staticmethod
    def _build_content_lookup(records: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
        lookup: dict[str, dict[str, Any]] = {}
        for record in records:
            if _record_kind(record) != "content":
                continue
            item_id = canonicalize_text(record.get("item_id") or record.get("source_item_id") or record.get("video_id"))
            if not item_id:
                continue
            lookup[item_id] = dict(record)
        return lookup

    def to_raw_comment(
        self,
        record: dict[str, Any],
        *,
        keyword: str,
        manifest: dict[str, Any] | None = None,
        content_lookup: dict[str, dict[str, Any]] | None = None,
    ) -> RawComment:
        manifest = manifest or {}
        content_lookup = content_lookup or {}
        timezone_hint = _default_timezone(manifest)
        item_id = canonicalize_text(record.get("item_id") or record.get("source_item_id") or record.get("video_id"))
        comment_id = canonicalize_text(record.get("comment_id") or record.get("source_comment_id"))
        text = canonicalize_text(record.get("text") or record.get("content"))
        platform = _resolve_platform(record.get("platform") or (manifest.get("platforms") or [""])[0])
        record_id = canonicalize_text(record.get("record_id")) or _stable_record_id(platform, item_id, comment_id)
        content_record = content_lookup.get(item_id, {})
        published_at = _coerce_datetime(
            record.get("published_at") or record.get("created_at") or record.get("create_time"),
            default_tz=timezone_hint,
        )
        crawled_at = _coerce_datetime(
            record.get("crawled_at") or record.get("collected_at") or manifest.get("created_at"),
            default_tz=timezone_hint,
        )

        missing = [
            field_name
            for field_name, value in (
                ("record_id", record_id),
                ("item_id", item_id),
                ("comment_id", comment_id),
                ("text", text),
                ("published_at", published_at),
                ("crawled_at", crawled_at),
            )
            if not value
        ]
        if missing:
            raise ValueError(f"MediaCrawler record missing required fields: {', '.join(missing)}")

        metadata = dict(record.get("metadata", {})) if isinstance(record.get("metadata"), dict) else {}
        metadata.setdefault("ingest_source", "mediacrawler")
        metadata.setdefault("keyword", keyword)
        metadata.setdefault("source_keyword", canonicalize_text(record.get("source_keyword")) or keyword)
        metadata.setdefault("platform_record_type", "comment")
        parent_comment_id = canonicalize_text(record.get("parent_comment_id"))
        if parent_comment_id:
            metadata.setdefault("parent_comment_id", parent_comment_id)
        user_id = canonicalize_text(record.get("user_id"))
        if user_id:
            metadata.setdefault("user_id", user_id)
        item_title = canonicalize_text(record.get("item_title") or content_record.get("item_title") or content_record.get("title"))
        if item_title:
            metadata.setdefault("item_title", item_title)
        item_url = canonicalize_text(record.get("item_url") or content_record.get("item_url") or content_record.get("video_url"))
        if item_url:
            metadata.setdefault("item_url", item_url)
        item_desc = canonicalize_text(content_record.get("desc"))
        if item_desc:
            metadata.setdefault("item_description", item_desc)

        return {
            "raw_comment_id": record_id,
            "platform": platform,
            "source_item_id": item_id,
            "source_comment_id": comment_id,
            "text": text,
            "created_at": published_at,
            "collected_at": crawled_at,
            "engagement": {
                "like_count": _as_int(record.get("like_count")),
                "reply_count": _as_int(record.get("reply_count") or record.get("sub_comment_count")),
                "share_count": _as_int(record.get("share_count")),
            },
            "metadata": metadata,
            "author_handle": canonicalize_text(record.get("author_handle") or record.get("nickname")),
        }

    def load_raw_comments(self, manifest: dict[str, Any], *, manifest_path: Path | None = None) -> list[RawComment]:
        keyword = canonicalize_text(manifest.get("keyword"))
        records = self.load_records(manifest, manifest_path=manifest_path)
        content_lookup = self._build_content_lookup(records)
        return [
            self.to_raw_comment(record, keyword=keyword, manifest=manifest, content_lookup=content_lookup)
            for record in records
            if _record_kind(record) == "comment"
        ]
