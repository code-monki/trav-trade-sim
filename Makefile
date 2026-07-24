.DEFAULT_GOAL := help

# NOTE: macOS ships GNU Make 3.81 (frozen pre-GPLv3), which predates
# .ONESHELL (3.82+) — every recipe line normally runs in its own throwaway
# shell. Multi-statement targets below use classic `\`-continued, `;`-joined
# single logical lines instead, so they work on 3.81 as well as modern Make.

# The Worker has no CI — .github/workflows/deploy.yml only builds/deploys the
# frontend (Vite -> GitHub Pages) on push to master. These targets are the
# only orchestration for the backend, so `make deploy` is the one command
# that should ever be needed to ship a change touching worker/ or d1/.
D1_DB      := trav-trade-sim
WORKER_URL := https://trav-trade-sim.codemonki.workers.dev

.PHONY: help install dev build preview test test-watch coverage test-e2e test-e2e-ui test-all \
        worker-install worker-dev worker-deploy migrate-status migrate deploy

help:
	@echo "Traveller Trade Simulator"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "  install        Install npm dependencies (frontend)"
	@echo "  dev            Start Vite development server (hot-reload)"
	@echo "  build          Production build to dist/"
	@echo "  preview        Serve the production build locally"
	@echo "  test           Run unit + component tests (single pass)"
	@echo "  test-watch     Run unit + component tests in watch mode"
	@echo "  coverage       Run tests with coverage report (HTML + text)"
	@echo "  test-e2e       Run Playwright E2E tests (starts dev server)"
	@echo "  test-e2e-ui    Open Playwright UI mode for interactive E2E"
	@echo "  test-all       Run unit, component, and E2E tests"
	@echo ""
	@echo "  worker-install Install npm dependencies (Cloudflare Worker backend)"
	@echo "  worker-dev     Run the Worker locally (wrangler dev)"
	@echo "  migrate-status List d1/*.sql migrations and whether each is applied remotely"
	@echo "  migrate        Apply any not-yet-applied d1/*.sql migrations, in order"
	@echo "  worker-deploy  Deploy the Worker, then verify /api/health reports schema_ok"
	@echo "  deploy         Full ship sequence: test -> migrate -> worker-deploy"
	@echo "                 (frontend then deploys itself via GitHub Actions on push)"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

preview:
	npm run preview

test:
	npm test

test-watch:
	npm run test:watch

coverage:
	npm run coverage

test-e2e:
	npx playwright test

test-e2e-ui:
	npx playwright test --ui

test-all: test test-e2e

worker-install:
	cd worker && npm install

worker-dev:
	cd worker && npm run dev

# Read-only — safe to run anytime. Requires jq.
migrate-status:
	@applied=$$(cd worker && npx wrangler d1 execute $(D1_DB) --remote --command "SELECT id FROM schema_migrations" --json | jq -r '.[0].results[].id'); \
	for f in d1/[0-9][0-9][0-9]_*.sql; do \
		id=$$(basename "$$f" | cut -c1-3); \
		if echo "$$applied" | grep -qx "$$id"; then \
			echo "  [applied]  $$f"; \
		else \
			echo "  [PENDING]  $$f"; \
		fi; \
	done

# Applies every d1/*.sql migration not yet in the remote ledger, in file
# order, stopping on first failure. Several migrations are not idempotent
# (e.g. ALTER TABLE ADD COLUMN) — this is why we diff against the ledger
# rather than just re-running everything.
migrate:
	@applied=$$(cd worker && npx wrangler d1 execute $(D1_DB) --remote --command "SELECT id FROM schema_migrations" --json | jq -r '.[0].results[].id'); \
	for f in d1/[0-9][0-9][0-9]_*.sql; do \
		id=$$(basename "$$f" | cut -c1-3); \
		if echo "$$applied" | grep -qx "$$id"; then \
			echo "  [skip]     $$f (already applied)"; \
		else \
			echo "  [applying] $$f"; \
			(cd worker && npx wrangler d1 execute $(D1_DB) --remote --file=../$$f) || exit 1; \
		fi; \
	done

worker-deploy:
	cd worker && npx wrangler deploy
	@echo "Verifying deployed Worker's schema check..."
	@sleep 2
	curl -sf $(WORKER_URL)/api/health | jq .

deploy: test migrate worker-deploy
	@echo "Deploy complete. Frontend deploys itself via GitHub Actions on push to master."
