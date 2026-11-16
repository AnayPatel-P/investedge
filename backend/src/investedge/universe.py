"""S&P 500 constituent list.

Primary source: the maintained `datasets/s-and-p-500-companies` CSV on GitHub.
Fallback: the Wikipedia constituents table.
"""

import io
import logging

import pandas as pd
import requests

log = logging.getLogger(__name__)

PRIMARY_URL = (
    "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv"
)
WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
HEADERS = {"User-Agent": "InvestEdge/0.1 (educational project)"}


def _normalize(df: pd.DataFrame, symbol: str, name: str, sector: str) -> pd.DataFrame:
    out = df[[symbol, name, sector]].copy()
    out.columns = ["symbol", "name", "sector"]
    out["symbol"] = out["symbol"].str.strip().str.upper()
    return out.drop_duplicates("symbol").sort_values("symbol").reset_index(drop=True)


def fetch_constituents() -> pd.DataFrame:
    try:
        resp = requests.get(PRIMARY_URL, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text))
        return _normalize(df, "Symbol", "Security", "GICS Sector")
    except Exception as exc:  # noqa: BLE001 - any failure falls back
        log.warning("Primary constituent source failed (%s); trying Wikipedia", exc)
    resp = requests.get(WIKI_URL, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    table = pd.read_html(io.StringIO(resp.text), attrs={"id": "constituents"})[0]
    return _normalize(table, "Symbol", "Security", "GICS Sector")


def to_yahoo(symbol: str) -> str:
    """Yahoo uses '-' for share classes (BRK.B -> BRK-B)."""
    return symbol.replace(".", "-")
