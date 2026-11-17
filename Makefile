.PHONY: dev install format test

# Run the dashboard (http://localhost:3000/uk/milburn-review)
dev:
	bun run dev

# Install dependencies
install:
	uv sync --locked --extra dev
	bun install --frozen-lockfile

# Format code
format:
	uv run black src/ tests/
	uv run ruff check --fix src/ tests/

# Run tests
test:
	uv run pytest
