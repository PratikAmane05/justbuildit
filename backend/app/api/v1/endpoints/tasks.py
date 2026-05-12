from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.dependencies import get_db, get_current_user_id
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate, TaskStatusUpdate
from app.services.task_service import TaskService

router = APIRouter()


async def _resolve_org_for_project(db: AsyncSession, project_id: str, user_id: str) -> str:
    """Return the organization_id for the given project, falling back to user's first org."""
    from app.models.project import Project
    from sqlalchemy import select
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project:
        return project.organization_id
    from app.services.organization_service import OrganizationService
    org_svc = OrganizationService(db)
    orgs = await org_svc.list_for_user(user_id)
    if not orgs:
        raise HTTPException(status_code=400, detail="Cannot determine organization for task")
    return orgs[0].id


@router.get("/", response_model=List[TaskOut])
async def list_tasks(
    project_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    svc = TaskService(db)
    return await svc.list(user_id=user_id, project_id=project_id)


@router.post("/", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    svc = TaskService(db)
    payload.created_by = user_id
    if not payload.organization_id:
        payload.organization_id = await _resolve_org_for_project(db, payload.project_id, user_id)
    return await svc.create(payload)


@router.get("/{task_id}/", response_model=TaskOut)
async def get_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    svc = TaskService(db)
    task = await svc.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/{task_id}/", response_model=TaskOut)
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    svc = TaskService(db)
    return await svc.update(task_id, payload)


@router.patch("/{task_id}/status/", response_model=TaskOut)
async def update_task_status(
    task_id: str,
    payload: TaskStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    svc = TaskService(db)
    return await svc.update_status(task_id, payload.status)


@router.delete("/{task_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    svc = TaskService(db)
    await svc.delete(task_id)


# ── AI Task Generation (AWS Bedrock — Nova Micro) ──────────────────────────────

class AIGenerateRequest(BaseModel):
    project_name: str
    project_description: Optional[str] = None
    count: int = 5
    # ML context — used by Bedrock to produce richer, ML-optimized output
    team_skills: List[str] = []
    project_type: Optional[str] = None
    current_modules: List[str] = []
    sprint_remaining_days: Optional[int] = None
    preferred_assignee_skills: List[str] = []


class AIGeneratedTask(BaseModel):
    title: str
    description: str
    priority: str                           # LOW | MEDIUM | HIGH | CRITICAL
    estimated_time: Optional[float] = None  # hours
    # ML feature fields
    tags: List[str] = []
    task_type: Optional[str] = None         # frontend|backend|devops|bug|testing
    complexity_label: Optional[str] = None  # easy|medium|hard
    required_skills: List[str] = []
    risk_factors: List[str] = []
    subtasks: List[str] = []
    estimated_story_points: Optional[int] = None


class AIGenerateResponse(BaseModel):
    tasks: List[AIGeneratedTask]


# Smart mock fallback — used when credentials are missing or Bedrock call fails
_MOCK_TASKS = [
    {"title": "Set up project repository and CI/CD pipeline",   "description": "Initialize Git repo, configure GitHub Actions for automated testing and deployment pipelines.",        "priority": "HIGH",     "estimated_time": 4.0},
    {"title": "Design system architecture and database schema",  "description": "Define ERD, API contracts, and service boundaries. Document architectural decisions and trade-offs.", "priority": "HIGH",     "estimated_time": 8.0},
    {"title": "Implement core authentication flow",              "description": "Build login, registration, and JWT token management with refresh tokens and secure storage.",          "priority": "HIGH",     "estimated_time": 6.0},
    {"title": "Build primary dashboard UI",                     "description": "Design and implement the main user dashboard with key metrics, charts, and navigation.",               "priority": "MEDIUM",   "estimated_time": 5.0},
    {"title": "Write unit and integration tests",                "description": "Achieve 80% code coverage for all critical paths, services, and API endpoints.",                       "priority": "MEDIUM",   "estimated_time": 6.0},
    {"title": "Set up monitoring and error tracking",            "description": "Integrate Sentry for error tracking and configure uptime monitoring with alert notifications.",         "priority": "LOW",      "estimated_time": 2.0},
    {"title": "Write API documentation and README",              "description": "Produce comprehensive API docs using OpenAPI, plus a developer setup guide and README.",               "priority": "LOW",      "estimated_time": 3.0},
    {"title": "Configure deployment infrastructure",             "description": "Set up Docker containers, Kubernetes manifests or cloud deployment scripts for production.",           "priority": "CRITICAL", "estimated_time": 10.0},
    {"title": "Implement role-based access control",            "description": "Define user roles and permissions; guard all sensitive API endpoints with proper authorization.",        "priority": "CRITICAL", "estimated_time": 7.0},
    {"title": "Conduct security audit and penetration testing",  "description": "Review code for OWASP Top 10 vulnerabilities and run automated security scans before launch.",         "priority": "HIGH",     "estimated_time": 5.0},
]


def _build_bedrock_prompt(
    project_name: str,
    description: str,
    count: int,
    team_skills: list,
    project_type: str,
    current_modules: list,
    sprint_remaining_days: int | None,
    preferred_assignee_skills: list,
) -> str:
    context_block = f"""
Context:
- Project Type: {project_type or 'Software Application'}
- Team Skills: {', '.join(team_skills) if team_skills else 'Not specified'}
- Current Modules: {', '.join(current_modules) if current_modules else 'None'}
- Sprint Days Remaining: {sprint_remaining_days if sprint_remaining_days else 'Not specified'}
- Preferred Assignee Skills: {', '.join(preferred_assignee_skills) if preferred_assignee_skills else 'Any'}
"""
    return f"""You are an AI assistant that converts project descriptions into structured engineering tasks optimized for downstream machine learning systems used in project management.

Project Name: {project_name}
Project Description: {description}
{context_block}
Generate exactly {count} tasks. Respond with ONLY a valid JSON array (no markdown, no commentary, no code fences).
Each object must have EXACTLY these keys:
- "title": string (concise engineering action phrase, starts with a verb, max 10 words)
- "description": string (2-3 sentences of specific technical detail for this project)
- "priority": exactly one of "LOW", "MEDIUM", "HIGH", "CRITICAL"
- "estimated_time": float (realistic hours to complete)
- "tags": array of strings (relevant technical tags, e.g. ["Node.js", "REST API", "PostgreSQL"])
- "task_type": exactly one of "frontend", "backend", "devops", "testing", "bug"
- "complexity_label": exactly one of "easy", "medium", "hard"
- "required_skills": array of strings (skills needed, inferred from team_skills where possible)
- "risk_factors": array of strings (specific risks that could cause delay or failure, e.g. ["third-party API dependency", "no existing test coverage"])
- "subtasks": array of strings (ordered step-by-step execution plan, 3-6 steps)
- "estimated_story_points": integer from 1 to 13 (Fibonacci: 1,2,3,5,8,13)

Rules:
- Do not return explanations, only the JSON array
- Use team_skills to infer required_skills — do not hallucinate technologies outside them unless necessary
- Priority distribution: 1-2 CRITICAL, 2-3 HIGH, 2-3 MEDIUM, 1-2 LOW
- risk_factors must reference real engineering risks (third-party APIs, auth complexity, data migration, etc.)
- subtasks must be actionable and logically ordered"""



@router.post("/ai-generate/", response_model=AIGenerateResponse)
async def ai_generate_tasks(
    payload: AIGenerateRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Generate tasks using AWS Bedrock (Amazon Nova Micro via APAC inference profile)."""
    import json, re, asyncio, logging
    from concurrent.futures import ThreadPoolExecutor
    from app.core.config import settings

    log = logging.getLogger("app.ai")

    # Read from pydantic-settings (NOT os.getenv — pydantic loads .env at startup)
    aws_key    = settings.AWS_ACCESS_KEY_ID
    aws_secret = settings.AWS_SECRET_ACCESS_KEY
    aws_region = settings.AWS_DEFAULT_REGION or "ap-south-1"
    model_id   = settings.BEDROCK_MODEL_ID

    log.info(f"AI generate — key_id='{aws_key[:12]}...' region='{aws_region}' model='{model_id[:40]}...'")

    # No credentials → smart mock
    if not aws_key or not aws_secret:
        log.warning("AWS credentials not configured — returning mock tasks")
        count = min(payload.count, len(_MOCK_TASKS))
        return AIGenerateResponse(tasks=[AIGeneratedTask(**t) for t in _MOCK_TASKS[:count]])

    prompt = _build_bedrock_prompt(
        project_name=payload.project_name,
        description=payload.project_description or "No description provided.",
        count=payload.count,
        team_skills=payload.team_skills,
        project_type=payload.project_type or "",
        current_modules=payload.current_modules,
        sprint_remaining_days=payload.sprint_remaining_days,
        preferred_assignee_skills=payload.preferred_assignee_skills,
    )

    def _call_bedrock() -> str:
        """Run synchronous boto3 call in a thread pool — keeps the async loop unblocked."""
        import boto3
        client = boto3.client(
            service_name="bedrock-runtime",
            region_name=aws_region,
            aws_access_key_id=aws_key,
            aws_secret_access_key=aws_secret,
        )
        resp = client.converse(
            modelId=model_id,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={
                "maxTokens": 4096,
                "temperature": 0.7,
                "topP": 0.9,
                "stopSequences": [],
            },
            additionalModelRequestFields={},
        )
        return resp["output"]["message"]["content"][0]["text"]

    try:
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=1) as pool:
            raw_text = await loop.run_in_executor(pool, _call_bedrock)

        log.info(f"Bedrock raw response length: {len(raw_text)}")

        # Strip any markdown code fences ```json ... ```
        clean = re.sub(r"```(?:json)?", "", raw_text).strip().rstrip("`").strip()

        # Extract the JSON array robustly (handles surrounding text)
        array_match = re.search(r"\[.*\]", clean, re.DOTALL)
        if not array_match:
            raise ValueError(f"No JSON array in response: {clean[:200]}")

        tasks_raw = json.loads(array_match.group())

        # Sanitise and normalise all fields
        valid_priorities = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
        valid_task_types = {"frontend", "backend", "devops", "testing", "bug"}
        valid_complexity = {"easy", "medium", "hard"}
        for t in tasks_raw:
            if t.get("priority") not in valid_priorities:
                t["priority"] = "MEDIUM"
            if t.get("task_type") not in valid_task_types:
                t["task_type"] = "backend"
            if t.get("complexity_label") not in valid_complexity:
                t["complexity_label"] = "medium"
            if "estimated_time" in t:
                try:
                    t["estimated_time"] = float(t["estimated_time"])
                except (TypeError, ValueError):
                    t["estimated_time"] = 4.0
            if "estimated_story_points" in t:
                try:
                    t["estimated_story_points"] = int(t["estimated_story_points"])
                except (TypeError, ValueError):
                    t["estimated_story_points"] = 3
            # Ensure list fields are actually lists
            for list_field in ("tags", "required_skills", "risk_factors", "subtasks"):
                if not isinstance(t.get(list_field), list):
                    t[list_field] = []

        tasks = [AIGeneratedTask(**t) for t in tasks_raw[:payload.count]]
        log.info(f"Bedrock returned {len(tasks)} ML-structured tasks for project '{payload.project_name}'")
        return AIGenerateResponse(tasks=tasks)

    except Exception as exc:
        log.error(f"Bedrock AI generation failed: {exc}", exc_info=True)
        # Surface the real error so it can be debugged
        raise HTTPException(status_code=500, detail=f"Bedrock AI generation failed: {str(exc)}")

class AITaskContext(BaseModel):
    title: str
    description: Optional[str] = None
    complexity_label: Optional[str] = None
    risk_factors: Optional[List[str]] = None
    subtasks: Optional[list] = None
    story_points: Optional[int] = None

class AIChatRequest(BaseModel):
    message: str
    task_context: AITaskContext

class AIChatResponse(BaseModel):
    reply: str

@router.post("/{task_id}/ai-chat", response_model=AIChatResponse)
async def ai_task_chat(
    task_id: str,
    payload: AIChatRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Answer questions about a specific task using AWS Bedrock."""
    import json, asyncio, logging
    from concurrent.futures import ThreadPoolExecutor
    from app.core.config import settings

    log = logging.getLogger("app.ai.chat")

    aws_key    = settings.AWS_ACCESS_KEY_ID
    aws_secret = settings.AWS_SECRET_ACCESS_KEY
    aws_region = settings.AWS_DEFAULT_REGION or "ap-south-1"
    model_id   = settings.BEDROCK_MODEL_ID

    if not aws_key or not aws_secret:
        return AIChatResponse(reply="I am your AI assistant! (Mock mode: AWS Bedrock credentials not configured).")

    ctx = payload.task_context
    prompt = f"""
You are an expert AI assistant helping a software engineer with a specific task.
Task Details:
- Title: {ctx.title}
- Description: {ctx.description or 'None'}
- Complexity: {ctx.complexity_label or 'Unknown'}
- Story Points: {ctx.story_points or 'Unknown'}
- Risks: {', '.join(ctx.risk_factors) if ctx.risk_factors else 'None'}
- Subtasks provided: {len(ctx.subtasks) if ctx.subtasks else 0}

User asks: {payload.message}
Provide a clear, direct, and helpful answer. Do not use markdown wrapping unless it's code.
"""

    def _call_bedrock() -> str:
        import boto3
        client = boto3.client(
            service_name="bedrock-runtime",
            region_name=aws_region,
            aws_access_key_id=aws_key,
            aws_secret_access_key=aws_secret,
        )
        resp = client.converse(
            modelId=model_id,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 1024, "temperature": 0.7},
        )
        return resp["output"]["message"]["content"][0]["text"]

    try:
        loop = asyncio.get_running_loop()
        with ThreadPoolExecutor() as pool:
            reply = await loop.run_in_executor(pool, _call_bedrock)
        return AIChatResponse(reply=reply)
    except Exception as exc:
        log.error(f"Bedrock chat failed: {exc}")
        raise HTTPException(status_code=500, detail="Failed to chat with AI assistant")

