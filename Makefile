.DEFAULT_GOAL := help

.PHONY: help install dev build preview test test-watch coverage

help:
	@echo "Traveller Trade Simulator"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "  install      Install npm dependencies"
	@echo "  dev          Start Vite development server (hot-reload)"
	@echo "  build        Production build to dist/"
	@echo "  preview      Serve the production build locally"
	@echo "  test         Run all tests (single pass)"
	@echo "  test-watch   Run tests in watch mode"
	@echo "  coverage     Run tests with coverage report (HTML + text)"

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
