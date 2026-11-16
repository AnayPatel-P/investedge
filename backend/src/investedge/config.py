"""Central settings, read from environment / .env (see .env.example)."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="INVESTEDGE_", env_file=PROJECT_ROOT / ".env", extra="ignore"
    )

    data_dir: Path = PROJECT_ROOT / "data"
    history_years: int = 5
    forecast_horizon: int = 30  # trading days
    forecast_levels: tuple[int, ...] = (80, 95)
    benchmark: str = "SPY"  # market proxy for beta; fetched but not part of the universe
    backtest_origins: int = 12  # monthly rolling origins over the last year
    backtest_spacing: int = 21  # trading days between origins (~1 month)
    backtest_max_age_days: int = 7  # nightly refresh re-runs the backtest when older
    # Phase 1 works on a small, sector-diverse sample before scaling to all ~503 tickers.
    sample_tickers: tuple[str, ...] = (
        "AAPL",
        "MSFT",
        "NVDA",
        "AMZN",
        "GOOGL",
        "META",
        "JPM",
        "BRK.B",
        "JNJ",
        "UNH",
        "XOM",
        "PG",
        "KO",
        "WMT",
        "HD",
        "CAT",
        "NEE",
        "LIN",
        "AMT",
        "DIS",
    )

    @property
    def db_path(self) -> Path:
        return self.data_dir / "investedge.duckdb"


settings = Settings()
