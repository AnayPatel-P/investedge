"""API smoke tests against a tiny temporary DuckDB store."""

from datetime import date

import pandas as pd
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    from investedge import storage
    from investedge.config import settings

    monkeypatch.setattr(settings, "data_dir", tmp_path)
    with storage.connect() as con:
        con.execute("INSERT INTO tickers VALUES ('AAA', 'Alpha Corp', 'Tech')")
        bt = pd.DataFrame(
            {
                "symbol": "AAA",
                "model": ["naive", "naive", "arima", "arima"],
                "origin": [date(2026, 1, 2)] * 4,
                "step": [1, 2, 1, 2],
                "date": [date(2026, 1, 5), date(2026, 1, 6)] * 2,
                "actual": [10.0, 11.0] * 2,
                "mean": [10.0, 10.0, 10.5, 10.6],
                "lo_80": 9.0,
                "hi_80": 11.0,
                "lo_95": 8.0,
                "hi_95": 12.0,
            }
        )
        storage.replace_rows(con, "backtest_forecasts", bt, ["symbol", "model", "origin", "step"])
    from investedge.api import app

    return TestClient(app)


def test_backtest_endpoint_groups_by_origin_and_model(client) -> None:
    body = client.get("/api/stocks/aaa/backtest").json()
    assert body["origins"] == ["2026-01-02"]
    run = body["runs"]["2026-01-02"]
    assert set(run) == {"naive", "arima"}
    assert [r["step"] for r in run["arima"]] == [1, 2]
    assert run["arima"][1]["actual"] == 11.0


def test_backtest_endpoint_empty_for_unknown(client) -> None:
    assert client.get("/api/stocks/ZZZ/backtest").json()["origins"] == []


def test_search_and_bad_profile(client) -> None:
    assert client.get("/api/search?q=alp").json()[0]["symbol"] == "AAA"
    assert client.get("/api/screener?profile=yolo").status_code == 400
