.PHONY: install dev refresh spike test lint

BACKEND = cd backend &&

install:  ## Install backend deps (requires uv)
	$(BACKEND) uv sync

dev:  ## Run the API + skeleton page at http://localhost:8000
	$(BACKEND) uv run uvicorn investedge.api:app --reload --port 8000

refresh:  ## Universe + prices + all forecasts (Phase 1: sample tickers)
	$(BACKEND) uv run investedge refresh

spike:  ## Time every model on the sample tickers
	$(BACKEND) uv run investedge spike

test:
	$(BACKEND) uv run pytest -q

lint:
	$(BACKEND) uv run ruff check src tests && uv run ruff format --check src tests && uv run mypy src
