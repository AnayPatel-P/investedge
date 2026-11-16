"""`investedge` command-line entry point."""

import logging

import typer

from investedge import pipeline
from investedge.config import settings
from investedge.models.forecasters import MODELS

app = typer.Typer(help="InvestEdge data pipeline", no_args_is_help=True)
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
for noisy in ("yfinance", "cmdstanpy", "prophet", "matplotlib"):
    logging.getLogger(noisy).setLevel(logging.ERROR)

ALL_MODELS = ",".join(MODELS)
SAMPLE = typer.Option(False, "--sample", help="Only the 20 sample tickers")


def _symbols(sample: bool) -> list[str]:
    return list(settings.sample_tickers) if sample else pipeline.all_symbols()


@app.command()
def universe() -> None:
    """Load the S&P 500 constituent list."""
    typer.echo(f"Loaded {pipeline.load_universe()} constituents")


@app.command()
def fetch(sample: bool = SAMPLE) -> None:
    """Download new daily OHLCV (incremental; full history for new or re-adjusted symbols)."""
    r = pipeline.load_prices(_symbols(sample))
    typer.echo(
        f"full {len(r.full)}, incremental {len(r.incremental)}, re-adjusted {len(r.readjusted)}, "
        f"unchanged {len(r.unchanged)}, failed {r.failed or 'none'}"
    )


@app.command()
def forecast(
    sample: bool = SAMPLE,
    models: str = typer.Option(ALL_MODELS, help="Comma-separated: " + ALL_MODELS),
    workers: int = typer.Option(0, help="Worker processes (0 = CPU count - 1)"),
) -> None:
    """Fit forecasting models in parallel and store results."""
    results = pipeline.run_forecasts(_symbols(sample), models.split(","), workers or None)
    errors = [(r.symbol, m, e) for r in results for m, e in r.errors.items()]
    typer.echo(f"Forecasts done for {len(results)} symbols; errors: {len(errors)}")
    for e in errors[:20]:
        typer.echo(f"  {e}")


@app.command()
def refresh(
    sample: bool = SAMPLE,
    models: str = typer.Option(ALL_MODELS),
    workers: int = typer.Option(0, help="Worker processes (0 = CPU count - 1)"),
) -> None:
    """Nightly job: universe + incremental prices + all forecasts + run report."""
    symbols = list(settings.sample_tickers) if sample else None
    report = pipeline.refresh(symbols, models.split(","), workers or None)
    typer.echo(report.summary())


@app.command()
def spike(models: str = typer.Option(ALL_MODELS)) -> None:
    """Time each model on the sample tickers and extrapolate to the full index."""
    df = pipeline.time_models(list(settings.sample_tickers), models.split(","))
    summary = df.groupby("model")["seconds"].agg(["mean", "median", "max"])
    summary["est_503_serial_min"] = summary["mean"] * 503 / 60
    typer.echo(summary.round(3).to_string())
    total = summary["est_503_serial_min"].sum()
    typer.echo(f"\nAll models, 503 tickers, single core: ~{total:.1f} min")
