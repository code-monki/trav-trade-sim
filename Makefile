.DEFAULT_GOAL := help

.PHONY: help install dev build preview test test-watch coverage test-e2e test-e2e-ui test-all

help:
	@echo "Traveller Trade Simulator"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "  install        Install npm dependencies"
	@echo "  dev            Start Vite development server (hot-reload)"
	@echo "  build          Production build to dist/"
	@echo "  preview        Serve the production build locally"
	@echo "  test           Run unit + component tests (single pass)"
	@echo "  test-watch     Run unit + component tests in watch mode"
	@echo "  coverage       Run tests with coverage report (HTML + text)"
	@echo "  test-e2e       Run Playwright E2E tests (starts dev server)"
	@echo "  test-e2e-ui    Open Playwright UI mode for interactive E2E"
	@echo "  test-all       Run unit, component, and E2E tests"

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
