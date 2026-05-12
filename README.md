# justbuildit 🚀

> AI-powered project and task management platform.

## Architecture

```
justbuildit/
├── frontend/       # Next.js 13+ App Router (Vercel)
├── backend/        # FastAPI + Celery (AWS EC2 / ECS)
├── ai-service/     # ML microservice (FastAPI + scikit-learn)
├── infra/          # Docker, Terraform, GitHub Actions
├── docs/           # Architecture & API documentation
└── scripts/        # Dev utilities
```

## Quick Start (Local)

```bash
cp .env.example .env
docker compose up --build
```

Built by PratikAmane05

| Service      | URL                      |
|--------------|--------------------------|
| Frontend     | http://localhost:3000    |
| Backend API  | http://localhost:8000    |
| AI Service   | http://localhost:8001    |
| API Docs     | http://localhost:8000/docs |

## Tech Stack

| Layer        | Technology                              |
|--------------|-----------------------------------------|
| Frontend     | Next.js 13, TypeScript, Zustand, Tailwind CSS |
| Backend      | FastAPI, SQLAlchemy, Alembic, Celery    |
| AI           | FastAPI, scikit-learn, pandas, joblib   |
| Database     | PostgreSQL                              |
| Cache/Queue  | Redis                                   |
| Auth         | JWT + Google OAuth2                     |
| Infra        | Docker, Terraform (AWS), GitHub Actions |

## GitHub Integration & Webhooks

JustBuildIt features a powerful **bidirectional sync** with GitHub. 

When you connect a GitHub repository to your project:
1. **Automated Issue Creation**: Tasks tracked in JustBuildIt will automatically create corresponding GitHub Issues.
2. **Automated Status Syncing via Git Commits**:
   - `git commit -m "working on #1"` → Moves Task #1 to **IN_PROGRESS** automatically.
   - `git commit -m "fixes #1"` → Moves Task #1 instantly to **DONE**. 
     (Supported closing keywords: `fix`, `fixes`, `fixed`, `close`, `closes`, `closed`, `resolve`, `resolves`, `resolved`).
3. **Pull Requests**: Referencing `#1` inside a Pull Request automatically moves the task to **IN_REVIEW**. When the PR is merged, the task moves to **DONE**.

### ⚠️ Testing Webhooks Locally 
GitHub's servers physically cannot send updates over the internet to your local backend (`localhost:8002`). To receive these webhooks locally:
1. Get a public URL for your local backend using an SSH tunnel:
   `ssh -p 443 -R0:localhost:8002 -o StrictHostKeyChecking=no -o ServerAliveInterval=30 a.pinggy.io`
2. In `backend/.env`, set: `BACKEND_PUBLIC_URL="https://[YOUR_URL].pinggy.link"`
3. If you have already connected your repo, update the Webhook URL in your **GitHub Repository Settings -> Webhooks** to point to your new tunnel URL: `/api/v1/github/webhook`.

## Environment Variables

See `.env.example` for all required variables.

## Docs

- [Architecture](docs/architecture.md)
- [API Spec](docs/api-spec.md)
- [DB Schema](docs/db-schema.md)
- [AI Model](docs/ai-model.md)

## Development

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload

# AI Service
cd ai-service && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```
