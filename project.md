# Project Report: JustBuildIt

## 1. Project Overview
* **What the project does:** JustBuildIt is an AI-powered project and task management platform that integrates tightly with GitHub and uses machine learning to assist in project planning and execution.
* **The main problem it solves:** It addresses inefficiencies in software project management by automating task state updates through GitHub webhooks and utilizing AI to predict task delays, identify bottlenecks, estimate duration, and recommend task assignments. 
* **The target users:** Software developers, engineering teams, project managers, and scrum masters.
* **Core Purpose:** JustBuildIt aims to streamline the development workflow by providing a bidirectional sync with GitHub and acting as an intelligent assistant that flags risks and recommends actions, reducing manual project tracking overhead and improving sprint predictability.

## 2. Features / Modules
* **Organization & Project Management**
  * **Purpose:** Grouping users and tasks into specific workspaces.
  * **How it works:** Users can create organizations, invite members, and create multiple projects within them.
  * **Files/Components:** `backend/app/models/organization.py`, `backend/app/models/project.py`.
* **Task Management & Tracking**
  * **Purpose:** Creating, assigning, and tracking individual work items.
  * **How it works:** Tasks have properties like complexity, story points, priority, status, and risk factors. They support subtasks and dependencies.
  * **Files/Components:** `backend/app/models/task.py`, `backend/app/api/v1/endpoints/tasks.py`.
* **GitHub Integration (Bidirectional Sync)**
  * **Purpose:** Syncing task statuses automatically based on Git activity.
  * **How it works:** Processes GitHub webhooks. E.g., `git commit -m "fixes #1"` automatically moves Task #1 to `DONE`. Mentioning a task in a PR moves it to `IN_REVIEW`.
  * **Files/Components:** `backend/app/models/github_integration.py`, `backend/app/api/v1/endpoints/github.py`.
* **AI Prediction & Recommendation**
  * **Purpose:** Anticipating project risks and advising on assignments.
  * **How it works:** Separate microservice that loads pre-trained models to predict task delay probabilities, duration, bottleneck risks, sprint outcomes, and recommends assignees and next tasks.
  * **Files/Components:** `ai-service/app/api/endpoints/predict.py`, `ai-service/app/api/endpoints/recommend.py`.
  * **External models used:** XGBoost, LightGBM Ranker, Siamese MLPs (loaded from `.pkl` files).

## 3. Technology Stack
* **Frontend framework:** React with Vite, TypeScript, React Router (Note: The `README.md` mentions Next.js 13, but the actual codebase in `frontend/package.json` uses Vite + React SPA).
* **Backend framework:** FastAPI (Python).
* **Database:** PostgreSQL (with SQLAlchemy and Alembic for migrations).
* **Authentication method:** JWT + Google OAuth2.
* **AI/ML models used:** scikit-learn, XGBoost, LightGBM, NetworkX.
* **Cache / Queue:** Redis, Celery.
* **UI libraries:** Tailwind CSS, Radix UI primitives, Framer Motion, Lucide React.
* **Deployment tools:** Docker Compose, Nginx. (Terraform and GitHub actions mentioned for AWS).
* **Other important packages:** `pydantic`, `axios`, `zod`, `react-hook-form`.

## 4. Architecture
* **Overall system architecture:** Microservices-based architecture orchestrated via Docker Compose.
* **Frontend/backend/data flow:** The React SPA communicates via REST API with the FastAPI backend. The FastAPI backend queries the PostgreSQL database and Redis. For ML predictions, the backend forwards requests to the dedicated AI-Service microservice.
* **Microservices:**
  * **Backend Service** (`localhost:8002`): Handles core business logic, DB, auth, and GitHub webhooks.
  * **AI Service** (`localhost:8001`): A decoupled FastAPI microservice explicitly for serving ML predictions.
  * **Celery Worker**: Background job processor.
* **Key folder structure:**
  * `/backend/app/`: Core backend application logic (models, api, core).
  * `/ai-service/app/`: Machine learning inference service.
  * `/frontend/src/`: React frontend application.

## 5. Functional Requirements
*(Inferred from code structure and models)*
* **User actions supported:** Registration, login, creating organizations, inviting members, managing projects.
* **Data creation/editing/deletion:** Full CRUD for Projects, Tasks, Comments, and GitHub integration webhooks.
* **Automation:** Webhook processing for automatic task status updates (`TODO` -> `IN_PROGRESS` -> `IN_REVIEW` -> `DONE`).
* **AI Functionality:** 
  * Task delay prediction based on complexity and risk factors.
  * Bottleneck identification based on graph dependencies.
  * Assignee recommendation based on skill matching and workload.
  * Sprint outcome estimation.
* **Real-time or asynchronous actions:** Asynchronous task processing using Celery and Redis.

## 6. Non-Functional Requirements
*(Extracted evidence)*
* **Scalability:** Segregating the ML inference into its own `ai-service` container prevents ML processing from blocking core CRUD APIs. Background workers (Celery) are used to handle async jobs.
* **Maintainability:** Clear modular separation (`/backend`, `/frontend`, `/ai-service`), strict typings using Pydantic, and database schema management using Alembic.
* **Deployment:** Containerized using Docker, reverse-proxied using Nginx.
* **Responsiveness:** Frontend utilizes `framer-motion` for animations and `React` for SPA responsiveness.

## 7. Database Design
*(Extracted from SQLAlchemy models in `/backend/app/models/`)*
* **Users (`users` table):** Stores user identity. Important fields: `email`, `hashed_password`, `is_active`.
* **Organizations (`organizations` table):** Stores organization details.
* **Projects (`projects` table):** Links to organizations. Fields: `name`, `status`, `created_by`. Relationships: `organization`, `tasks`.
* **Tasks (`tasks` table):** The core entity. 
  * **Important fields:** `title`, `status`, `priority`, `story_points`, `estimated_time`, `github_issue_number`, `dependencies`, `risk_factors`, `complexity_label`.
  * **Relationships:** Belongs to `Project`, assigned to `User`.
* **GitHub Integration (`github_integrations` table):** Links a project to a GitHub repository to track webhooks.
* **Migrations:** Managed by Alembic (`/backend/alembic/`).

## 8. APIs and Routes
* **Core Backend Routes (`/backend/app/api/v1/router.py`):**
  * `/auth`: Authentication and user login.
  * `/organizations`: Manage organizations.
  * `/projects`: Project CRUD.
  * `/tasks`: Task CRUD and assignments.
  * `/analytics`: Dashboard and project metrics.
  * `/github`: Webhook listeners for bidirectional sync.
* **AI Service Routes (`/ai-service/app/api/endpoints/`):**
  * `POST /predict/delay`: Predicts if a task will be delayed.
  * `POST /predict/duration`: Predicts the actual duration of a task.
  * `POST /predict/bottleneck`: Identifies if a task is a bottleneck.
  * `POST /predict/sprint-outcome`: Analyzes a sprint's likelihood of success.
  * `POST /recommend/assignee`: Suggests the best team member for a task.
  * `POST /recommend/next-task`: Ranks the next best tasks for a user to work on.

## 9. AI / Logic / Algorithms
*(Found in `/ai-service/app/api/endpoints/`)*
* **Feature Fusion:** The AI service fuses structured data, Text embeddings (TF-IDF + LSA), Sequence events (status changes), and Graph encodings (dependencies).
* **Classification / Prediction Logic:**
  * **Delay:** Uses XGBoost + feature fusion (or fallback heuristic).
  * **Duration:** Uses XGBoost + text features.
  * **Bottleneck:** Uses XGBoost + Graph dependency features + text.
  * **Sprint Outcome:** Uses XGBoost and a Sequence MLP to evaluate team velocity history and task story points.
* **Recommendation Logic:**
  * **Assignee:** Uses a Siamese MLP. It calculates cosine similarity between task embeddings and developer skill embeddings, combined with workload heuristics.
  * **Next-Task:** Uses a LightGBM Ranker to rank available tasks based on priority, sequence, dependencies, and skill match.
* **Fallback Logic:** Every AI endpoint implements a fallback heuristic formula (e.g., scoring based on `complexity`, `dependency_depth`, `risk_factors`) if the `.pkl` models are unavailable.

## 10. Implementation Details
* **Major Modules:**
  * **Backend API (`backend/app/main.py`):** Uses FastAPI with `TenantMiddleware` for multi-tenancy. Lifespan events ensure DB connectivity on startup.
  * **AI Service Pipeline (`ai-service/app/pipelines/`):** Implements `TextEncoder`, `SequenceEncoder`, and `GraphEncoder` to process task metadata into NumPy arrays before passing to models.
  * **GitHub Webhook (`github.py`):** Parses payload keywords (e.g., `fixes #1`) to update PostgreSQL status records.

## 11. Testing / Results / Evaluation
* **Known limitations / Fallbacks:** The AI service elegantly handles missing models by applying mathematical heuristics (e.g., `prob = complexity / 2 * 0.35 + risk_count / 5 * ...`).
* **Test data:** The AI service directory contains pre-trained `.pkl` model weights (`assignee_model.pkl`, `delay_model.pkl`, `duration_model.pkl`, etc.) implying the models have been evaluated and packaged prior to deployment.
* **Local Testing:** Local webhooks require SSH tunneling (e.g., `pinggy.io`) because GitHub cannot reach `localhost`, as explicitly documented in `README.md`.

## 12. Conclusion Material
* **What the project achieves:** successfully unites standard agile project management with intelligent, predictive machine learning models and automated GitHub repository syncing.
* **Strengths:** Excellent modular architecture, robust fallback heuristics for AI models, and automated task state transition based on developer git commits.
* **Limitations:** Local testing of GitHub webhooks requires reverse proxy tunneling. The AI models are static `.pkl` files and might require external pipelines to be retrained.
* **Future enhancement ideas (supported by codebase):** Implementing continuous online learning for the ML models based on completed tasks' actual duration versus predicted duration (activity log tables are already present in DB).

## 13. References Needed
* **FastAPI:** https://fastapi.tiangolo.com/
* **Vite & React:** https://vitejs.dev/ / https://react.dev/
* **XGBoost:** https://xgboost.readthedocs.io/
* **LightGBM:** https://lightgbm.readthedocs.io/
* **NetworkX:** https://networkx.org/
* **SQLAlchemy:** https://www.sqlalchemy.org/
* **Tailwind CSS:** https://tailwindcss.com/
