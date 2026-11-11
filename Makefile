# Shortcuts for the commands in CLAUDE.md. Run `make` to list them.
.DEFAULT_GOAL := help
.PHONY: help install dev test lint typecheck build check docker

help: ## List targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-10s %s\n", $$1, $$2}'

install: ## Install exact locked dependencies (npm ci)
	npm ci

dev: ## Run Next on :3000 (needs .env.local for real login; see .env.example)
	npm run dev

test: ## Run Vitest
	npm test

lint: ## ESLint
	npm run lint

typecheck: ## TypeScript check
	npm run typecheck

build: ## Production build
	npm run build

check: lint typecheck test ## Everything to run before you push

# shortcut: NEXT_PUBLIC_* and API_URL are baked in at build time and .env.local is not copied
# into the image, so this image runs in prototype mode. Add build args when we deploy (Phase 7).
docker: ## Build the production image (prototype mode, see comment)
	docker build -t recruitment-frontend .
