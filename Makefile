# Horizon Makefile
# Development commands for the Horizon time tracking system

.PHONY: help dev test test-watch deploy deploy-dashboard deploy-all schema-init db-create setup lint typecheck clean

# Default target - show help
help:
	@echo "Horizon Development Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development server with hot reload"
	@echo "  make test         - Run all tests"
	@echo "  make test-watch   - Run tests in watch mode"
	@echo "  make lint         - Run linter (TypeScript check)"
	@echo "  make typecheck    - Run TypeScript type checking"
	@echo ""
	@echo "Database:"
	@echo "  make db-create    - Create D1 database (run once)"
	@echo "  make schema-init  - Initialize database schema"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy            - Deploy Worker to Cloudflare"
	@echo "  make deploy-dashboard  - Deploy dashboard to Cloudflare Pages"
	@echo "  make deploy-all        - Deploy both Worker and dashboard"
	@echo "  make setup             - Initial setup (install dependencies)"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean        - Remove generated files"

# Development server with hot reload
dev:
	npm run dev

# Run all tests
test:
	npm test

# Run tests in watch mode
test-watch:
	npm run test:watch

# TypeScript type checking
typecheck:
	npx tsc --noEmit

# Lint check (using TypeScript)
lint: typecheck

# Deploy Worker to Cloudflare
deploy:
	npm run deploy

# Deploy dashboard to Cloudflare Pages
deploy-dashboard:
	cd dashboard && wrangler pages deploy

# Deploy both Worker and dashboard
deploy-all: deploy deploy-dashboard

# Create D1 database (run once during initial setup)
db-create:
	wrangler d1 create horizon
	@echo ""
	@echo "IMPORTANT: Copy the database_id from above to wrangler.toml"

# Initialize database schema
schema-init:
	wrangler d1 execute horizon --file=schema.sql

# Initialize schema for local development
schema-init-local:
	wrangler d1 execute horizon --file=schema.sql --local

# Initial setup
setup:
	npm install

# Clean generated files
clean:
	rm -rf node_modules
	rm -rf .wrangler
