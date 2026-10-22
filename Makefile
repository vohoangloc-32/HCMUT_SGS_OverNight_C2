.PHONY: setup dev lint typecheck test demo demo-1 demo-2 demo-3 demo-4 demo-5 reset docker-up docker-down

# ── Bootstrap ─────────────────────────────────────────────────────────────────
setup:
	@echo "==> Installing npm dependencies..."
	npm install
	@echo "==> Copying .env.example to .env (if not exists)..."
	@if [ ! -f .env ]; then cp .env.example .env && echo "  Created .env — fill in real values before running TideCloak."; fi
	@echo "==> Setup complete."

# ── Development ───────────────────────────────────────────────────────────────
dev:
	@echo "==> Starting gateway, MCP server, and guardian UI in development mode..."
	npm run dev

dev-gateway:
	npm run dev -w packages/gateway

dev-ui:
	npm run dev -w packages/guardian-ui

dev-mcp:
	npm run dev -w packages/mcp-server

# ── Quality ───────────────────────────────────────────────────────────────────
lint:
	npm run lint

typecheck:
	npm run typecheck

test:
	npm run test

# ── Docker ────────────────────────────────────────────────────────────────────
docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

# ── Demo Scenarios ────────────────────────────────────────────────────────────
demo-1:
	@echo "==> Scenario 1: Normal agent work (no approval needed)"
	bash scripts/scenario-1-normal.sh

demo-2:
	@echo "==> Scenario 2: Legitimate deploy with guardian quorum"
	bash scripts/scenario-2-legit-deploy.sh

demo-3:
	@echo "==> Scenario 3: Prompt injection attempt (blocked)"
	bash scripts/scenario-3-prompt-injection.sh

demo-4:
	@echo "==> Scenario 4: Manual attacker / single compromised guardian (blocked)"
	bash scripts/scenario-4-manual-attacker.sh

demo-5:
	@echo "==> Scenario 5 (stretch): Parameter swap after approval"
	bash scripts/scenario-5-param-swap.sh

demo-a:
	@echo "==> Scenario A: Real code change (fix off-by-one bug & merge)"
	bash scripts/real-code-change.sh

demo-b:
	@echo "==> Scenario B: Real code injection defense (risk signals & veto)"
	bash scripts/real-code-injection.sh

# ── Demo Recording Launcher ───────────────────────────────────────────────────
demo: reset
	@echo "==> Starting Key-Holder Gateway complete demo environment for recording..."
	@echo "    - Gateway on http://localhost:3001"
	@echo "    - Guardian UI on http://localhost:5173"
	@echo "    - Fake Production on http://localhost:4001/viewer"
	@echo "    - Fake External on http://localhost:4002/viewer"
	npm run demo

# ── Reset ─────────────────────────────────────────────────────────────────────
reset:
	@echo "==> Resetting demo state (deletes DB and docker volumes)..."
	rm -f packages/gateway/data/gateway.db packages/gateway/data/gateway.db.json
	@echo "==> Reset complete."
