"""Guardrails around the AI tutor: advice filter, per-IP rate limits, daily spend cap, and a
small SQLite store for usage accounting and cached summaries.

SQLite (not the pipeline's DuckDB) so the API can write while the nightly batch holds DuckDB.
"""

import re
import sqlite3
import threading
import time
from collections import defaultdict, deque
from datetime import UTC, datetime

from investedge.config import settings

# USD per million tokens (claude-opus-5-5). Cache writes 1.25x input, reads 0.05x.
PRICES = {"input": 4.0, "output": 20.0, "cache_write": 5.0, "cache_read": 0.2}

SAFE_REPLACEMENT = (
    "I can't tell you whether to buy, sell or hold a stock - that's personal investment advice, "
    "and InvestEdge is a learning tool. What I can do is walk you through this stock's risk, what "
    "the forecast models show, and how often they've actually been right. Want me to?"
)

# Phrases that read as a recommendation. Deliberately narrow: explaining "buy" or quoting the
# user's question must not trip it.
_ADVICE_PATTERNS = [
    r"\byou should (?:definitely |probably |consider(?:ing)? )?(?:buy|sell|hold|invest in|purchase|short)\b",
    r"\bI(?: would|'d|’d)? (?:recommend|suggest|advise) (?:you )?(?:to )?(?:buy|sell|hold|buying|selling|holding|investing)\b",
    r"\b(?:strong|good time to) (?:buy|sell)\b",
    r"\b(?:it'?s|this is) a (?:great|good|bad|terrible) (?:buy|investment|stock to (?:buy|own))\b",
    r"\bprice target (?:of|is) \$?\d",
    r"\b(?:buy|sell) (?:it |now|today|immediately)\b",
]
_ADVICE_RE = re.compile("|".join(_ADVICE_PATTERNS), re.IGNORECASE)


def looks_like_advice(text: str) -> bool:
    return bool(_ADVICE_RE.search(text))


class RateLimiter:
    """Sliding one-hour window per (key, bucket). In-memory: fine for a single API process."""

    def __init__(self) -> None:
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, bucket: str, limit: int, now: float | None = None) -> bool:
        now = time.time() if now is None else now
        with self._lock:
            q = self._hits[(key, bucket)]
            while q and q[0] <= now - 3600:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            return True


class Store:
    def __init__(self, path=None) -> None:
        self.path = path or settings.data_dir / "ai.sqlite"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        with self._conn() as c:
            c.executescript(
                """
                CREATE TABLE IF NOT EXISTS usage (
                    ts TEXT, day TEXT, kind TEXT, model TEXT,
                    input_tokens INT, output_tokens INT, cache_write INT, cache_read INT, cost REAL
                );
                CREATE TABLE IF NOT EXISTS summaries (
                    symbol TEXT, profile TEXT, as_of TEXT, model TEXT, text TEXT, created TEXT,
                    PRIMARY KEY (symbol, profile, as_of)
                );
                """
            )

    def _conn(self) -> sqlite3.Connection:
        return sqlite3.connect(self.path)

    @staticmethod
    def today() -> str:
        return datetime.now(UTC).date().isoformat()

    def spent_today(self) -> float:
        with self._conn() as c:
            row = c.execute(
                "SELECT coalesce(sum(cost), 0) FROM usage WHERE day = ?", [self.today()]
            ).fetchone()
        return float(row[0])

    def record(self, kind: str, model: str, usage) -> float:
        """Record one API response's usage; returns its cost in USD."""
        inp = getattr(usage, "input_tokens", 0) or 0
        out = getattr(usage, "output_tokens", 0) or 0
        cw = getattr(usage, "cache_creation_input_tokens", 0) or 0
        cr = getattr(usage, "cache_read_input_tokens", 0) or 0
        cost = (
            inp * PRICES["input"]
            + out * PRICES["output"]
            + cw * PRICES["cache_write"]
            + cr * PRICES["cache_read"]
        ) / 1e6
        with self._lock, self._conn() as c:
            c.execute(
                "INSERT INTO usage VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [datetime.now(UTC).isoformat(), self.today(), kind, model, inp, out, cw, cr, cost],
            )
        return cost

    def get_summary(self, symbol: str, profile: str, as_of: str) -> str | None:
        with self._conn() as c:
            row = c.execute(
                "SELECT text FROM summaries WHERE symbol = ? AND profile = ? AND as_of = ?",
                [symbol, profile, as_of],
            ).fetchone()
        return row[0] if row else None

    def put_summary(self, symbol: str, profile: str, as_of: str, model: str, text: str) -> None:
        with self._lock, self._conn() as c:
            c.execute(
                "INSERT OR REPLACE INTO summaries VALUES (?, ?, ?, ?, ?, ?)",
                [symbol, profile, as_of, model, text, datetime.now(UTC).isoformat()],
            )


class BudgetExceeded(Exception):
    pass


def check_budget(store: Store) -> None:
    if store.spent_today() >= settings.ai_daily_budget_usd:
        raise BudgetExceeded(f"Daily AI budget of ${settings.ai_daily_budget_usd:.2f} reached")
