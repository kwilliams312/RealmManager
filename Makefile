.PHONY: up down build rebuild clean reset logs status stop start restart

# --- Primary Commands ---

up: ## Start the stack
	docker compose up -d

down: ## Stop the stack (keeps data)
	docker compose down

build: ## Build/rebuild the webui image
	docker compose up -d --build ac-webui

rebuild: ## Full rebuild of all images
	docker compose up -d --build

# --- Reset Commands ---

clean: ## Stop everything and remove all volumes (full data wipe)
	docker compose down -v
	-@CONTAINERS=$$(docker ps -a --format "{{.Names}}" | grep -E "worldserver-|db-import-[0-9]|client-data-init-[0-9]"); \
		[ -n "$$CONTAINERS" ] && docker rm -f $$CONTAINERS 2>/dev/null || true
	-@docker network rm realmmanager_ac-network 2>/dev/null || true
	-@docker volume rm realmmanager_ac-client-data 2>/dev/null || true
	@echo "All data wiped."

reset: clean up ## Full reset: wipe everything and start fresh
	@echo "Reset complete. Visit http://localhost:5555 for setup."

# --- Logs ---

logs: ## Tail webui logs
	docker logs -f ac-webui

logs-db: ## Tail database logs
	docker logs -f ac-database

logs-auth: ## Tail authserver logs
	docker logs -f ac-authserver

# --- Status ---

status: ## Show running containers
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "NAMES|ac-|webui"

# --- Development ---

dev: ## Run Next.js dev server (outside Docker)
	bun dev

typecheck: ## Run TypeScript type checker
	bun tsc --noEmit

# --- Help ---

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
