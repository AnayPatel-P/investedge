.PHONY: install dev api web refresh spike test lint build

BACKEND = cd backend &&

install:  ## Install backend (uv) and frontend (npm) deps
	$(BACKEND) uv sync
	cd frontend && npm ci

dev:  ## API on :8000 + web app on http://localhost:5173 (Ctrl-C stops both)
	$(MAKE) -j2 api web

api:  ## FastAPI with auto-reload on :8000
	$(BACKEND) uv run uvicorn investedge.api:app --reload --port 8000

web:  ## Vite dev server on :5173 (proxies /api to :8000)
	cd frontend && npm run dev

refresh:  ## Nightly job: universe + incremental prices + all forecasts + run report (all 503)
	$(BACKEND) uv run investedge refresh

spike:  ## Time every model on the sample tickers
	$(BACKEND) uv run investedge spike

test:  ## Backend + frontend tests
	$(BACKEND) uv run pytest -q
	cd frontend && npm test

build:  ## Type-check and build the web app
	cd frontend && npm run build

lint:
	$(BACKEND) uv run ruff check src tests && uv run ruff format --check src tests && uv run mypy src
	cd frontend && npm run typecheck
