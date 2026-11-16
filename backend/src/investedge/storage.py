"""DuckDB storage. The batch job writes; the API only reads."""

from collections.abc import Iterator
from contextlib import contextmanager

import duckdb
import pandas as pd

from investedge.config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS tickers (
    symbol VARCHAR PRIMARY KEY,
    name VARCHAR,
    sector VARCHAR
);
CREATE TABLE IF NOT EXISTS prices (
    symbol VARCHAR,
    date DATE,
    open DOUBLE, high DOUBLE, low DOUBLE, close DOUBLE,
    volume BIGINT,
    PRIMARY KEY (symbol, date)
);
CREATE TABLE IF NOT EXISTS forecasts (
    symbol VARCHAR,
    model VARCHAR,
    run_date DATE,
    date DATE,
    mean DOUBLE,
    lo_80 DOUBLE, hi_80 DOUBLE,
    lo_95 DOUBLE, hi_95 DOUBLE,
    PRIMARY KEY (symbol, model, date)
);
"""


@contextmanager
def connect(read_only: bool = False) -> Iterator[duckdb.DuckDBPyConnection]:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(settings.db_path), read_only=read_only)
    try:
        if not read_only:
            con.execute(SCHEMA)
        yield con
    finally:
        con.close()


def replace_rows(
    con: duckdb.DuckDBPyConnection, table: str, df: pd.DataFrame, keys: list[str]
) -> None:
    """Upsert a DataFrame into `table` by deleting rows matching `keys` first."""
    if df.empty:
        return
    con.register("incoming", df)
    key_match = " AND ".join(f"t.{k} = i.{k}" for k in keys)
    distinct_keys = f"SELECT DISTINCT {', '.join(keys)} FROM incoming"
    con.execute(f"DELETE FROM {table} t USING ({distinct_keys}) i WHERE {key_match}")
    cols = ", ".join(df.columns)
    con.execute(f"INSERT INTO {table} ({cols}) SELECT {cols} FROM incoming")
    con.unregister("incoming")
