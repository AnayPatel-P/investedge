"""`investedge` command-line entry point."""

import logging

import typer

from investedge import pipeline
from investedge.config import settings
from investedge.models.forecasters import MODELS

app = typer.Typer(help="InvestEdge data pipeline", no_args_is_help=True)
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def _symbols(sample: bool) -> list[str]:
    if sample:
        return list(settings.sample_tickers)
    from investedge import storage

    with storage.connect(read_only=True) as con:
        return [r[0] for r in con.execute("SELECT symbol FROM tickers ORDER BY symbol").fetchall()]


@app.command()
def universe() -> None:
    """Load the S&P 500 constituent list."""
    typer.echo(f"Loaded {pipeline.load_universe()} constituents")


@app.command()
def fetch(sample: bool = typer.Option(True, help="Only the Phase 1 sample tickers")) -> None:
    """Download daily OHLCV history."""
    n, failed = pipeline.load_prices(_symbols(sample))
    typer.echo(f"Stored prices for {n} symbols; failed: {failed or 'none'}")


@app.command()
def forecast(
    sample: bool = typer.Option(True, help="Only the Phase 1 sample tickers"),
    models: str = typer.Option("naive,arima", help="Comma-separated: " + ",".join(MODELS)),
) -> None:
    """Fit forecasting models and store results."""
    errs = pipeline.run_forecasts(_symbols(sample), models.split(","))
    typer.echo(f"Forecasts done; errors: {len(errs)}")
    for e in errs:
        typer.echo(f"  {e}")


@app.command()
def refresh(sample: bool = typer.Option(True, help="Only the Phase 1 sample tickers")) -> None:
    """Universe + prices + forecasts in one go."""
    universe()
    fetch(sample=sample)
    forecast(sample=sample, models=",".join(MODELS))


@app.command()
def spike(models: str = typer.Option(",".join(MODELS))) -> None:
    """Time each model on the sample tickers and extrapolate to the full index."""
    df = pipeline.time_models(list(settings.sample_tickers), models.split(","))
    summary = df.groupby("model")["seconds"].agg(["mean", "median", "max"])
    summary["est_503_serial_min"] = summary["mean"] * 503 / 60
    typer.echo(summary.round(3).to_string())
    total = summary["est_503_serial_min"].sum()
    typer.echo(f"\nAll models, 503 tickers, single core: ~{total:.1f} min")
