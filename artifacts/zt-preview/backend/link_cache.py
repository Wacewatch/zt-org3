"""Persistent 48-hour cache for detail responses that contain links."""

import asyncio
import copy
import hashlib
import json
import logging
import os
import threading
import time
from pathlib import Path

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 48 * 60 * 60
DATA_DIR = Path(
    os.environ.get("ZT_DATA_DIR", str(Path(__file__).parent / ".data"))
).expanduser()
CACHE_FILE = DATA_DIR / "detail-links-cache.json"


class DetailLinkCache:
    def __init__(self):
        self._entries: dict[str, dict] = {}
        self._loaded = False
        self._guard = threading.RLock()
        self._key_locks: dict[str, asyncio.Lock] = {}

    @staticmethod
    def make_key(page_urls: list[str], is_serie: bool, resolve_protected: bool) -> str:
        normalized_urls = list(dict.fromkeys(url.strip() for url in page_urls if url and url.strip()))
        payload = json.dumps(
            {
                "urls": normalized_urls,
                "is_serie": bool(is_serie),
                "resolve_protected": bool(resolve_protected),
            },
            ensure_ascii=False,
            sort_keys=True,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def lock_for(self, key: str) -> asyncio.Lock:
        with self._guard:
            lock = self._key_locks.get(key)
            if lock is None:
                lock = asyncio.Lock()
                self._key_locks[key] = lock
            return lock

    def _load(self) -> None:
        if self._loaded:
            return
        self._loaded = True
        if not CACHE_FILE.exists():
            return
        try:
            document = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            entries = document.get("entries", {}) if isinstance(document, dict) else {}
            now = time.time()
            if isinstance(entries, dict):
                self._entries = {
                    key: entry
                    for key, entry in entries.items()
                    if isinstance(entry, dict)
                    and isinstance(entry.get("expires_at"), (int, float))
                    and entry["expires_at"] > now
                    and isinstance(entry.get("result"), dict)
                }
        except (OSError, json.JSONDecodeError, TypeError) as error:
            logger.warning("Detail-link cache could not be read: %s", type(error).__name__)
            self._entries = {}

    def get(self, key: str) -> dict | None:
        with self._guard:
            self._load()
            entry = self._entries.get(key)
            if not entry:
                return None
            if entry["expires_at"] <= time.time():
                self._entries.pop(key, None)
                self._persist()
                return None
            return copy.deepcopy(entry["result"])

    def save(self, key: str, result: dict) -> None:
        now = time.time()
        with self._guard:
            self._load()
            self._entries[key] = {
                "saved_at": now,
                "expires_at": now + CACHE_TTL_SECONDS,
                "result": copy.deepcopy(result),
            }
            self._entries = {
                cached_key: entry
                for cached_key, entry in self._entries.items()
                if entry.get("expires_at", 0) > now
            }
            self._persist()

    def _persist(self) -> None:
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            temporary_file = CACHE_FILE.with_suffix(CACHE_FILE.suffix + ".tmp")
            temporary_file.write_text(
                json.dumps(
                    {"version": 1, "entries": self._entries},
                    ensure_ascii=False,
                    separators=(",", ":"),
                ),
                encoding="utf-8",
            )
            os.replace(temporary_file, CACHE_FILE)
        except OSError as error:
            logger.exception("Detail-link cache could not be persisted: %s", type(error).__name__)


detail_link_cache = DetailLinkCache()
