.PHONY: help install setup run dev stop clean test docs deploy

help:
	@echo "Resume Parser & Job Matcher - Available Commands"
	@echo "=================================================="
	@echo "make setup          - Initial setup (install deps, create DB)"
	@echo "make dev            - Start development servers"
	@echo "make run            - Run with Docker Compose"
	@echo "make stop           - Stop Docker containers"
	@echo "make clean          - Remove containers and volumes"
	@echo "make test           - Run tests"
	@echo "make backend        - Start backend only"
	@echo "make frontend       - Start frontend only"
	@echo "make sync-jobs      - Sync jobs from external sources (aggregators, Greenhouse/Lever/Ashby company boards, Adzuna/Reed/Jooble)"
	@echo "make logs           - View Docker logs"
	@echo "make shell-backend  - Access backend container shell"
	@echo "make shell-db       - Access database shell"

# Setup
setup:
	@echo "Setting up project..."
	cd backend && python -m venv venv
	cd backend && source venv/bin/activate && pip install -r requirements.txt
	cd backend && python -m spacy download en_core_web_sm
	cd frontend && npm install
	@echo "✓ Setup complete!"

# Development
dev:
	@echo "Starting development servers..."
	docker-compose up --build

run:
	docker-compose up -d
	@echo "✓ Services started"
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost:5173"
	@echo "Docs: http://localhost:8000/docs"

stop:
	docker-compose down

clean:
	docker-compose down -v
	rm -rf backend/uploads/*
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +

# Individual services
backend:
	cd backend && uvicorn main:app --reload

frontend:
	cd frontend && npm run dev

# Database
sync-jobs:
	docker-compose exec backend python data/sync_jobs.py

# Testing
test:
	cd backend && pytest -v
	cd frontend && npm run test

# Logs
logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

logs-db:
	docker-compose logs -f postgres

# Shell access
shell-backend:
	docker-compose exec backend bash

shell-db:
	docker-compose exec postgres psql -U resumematcher -d resume_matcher

# Documentation
docs:
	@echo "Backend API docs available at: http://localhost:8000/docs"

# Deployment
deploy:
	@echo "Deploying to production..."
	docker-compose -f docker-compose.yml up -d
	@echo "✓ Deployment complete"

# Development utilities
format:
	cd backend && black .
	cd backend && isort .

lint:
	cd backend && flake8 .
	cd frontend && npm run lint

# Health checks
health:
	@curl -s http://localhost:8000/health | jq .
	@echo "Frontend: http://localhost:5173"
