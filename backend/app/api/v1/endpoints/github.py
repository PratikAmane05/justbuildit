"""
GitHub integration endpoints.

Routes:
  POST   /github/webhook                   — receive GitHub webhook events (HMAC verified)
  GET    /github/repos?token=...           — list repos accessible with a PAT
  POST   /github/connect/{project_id}      — link a repo to a project
  GET    /github/status/{project_id}       — get integration status + recent events
  DELETE /github/disconnect/{project_id}   — remove integration
  POST   /github/import-issues/{project_id} — pull open GH issues as tasks
  GET    /github/analytics/{project_id}    — repo analytics dashboard data
"""
import hashlib
import hmac
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_db, get_current_user_id
from app.integrations.github.webhook_handler import handle_github_event
from app.models.github_integration import GitHubIntegration, GitHubEvent
from app.models.task import Task
from app.models.project import Project

router = APIRouter()
log = logging.getLogger("app.github")

GH_API = "https://api.github.com"


def _gh_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


# ── Webhook (existing, keep as-is) ────────────────────────────────────────────

@router.post("/webhook")
async def github_webhook(
    request: Request,
    x_hub_signature_256: str = Header(None),
    x_github_event: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()
    if settings.GITHUB_WEBHOOK_SECRET:
        mac = hmac.new(
            settings.GITHUB_WEBHOOK_SECRET.encode(), body, hashlib.sha256
        )
        expected = "sha256=" + mac.hexdigest()
        if not hmac.compare_digest(expected, x_hub_signature_256 or ""):
            raise HTTPException(status_code=403, detail="Invalid webhook signature")

    payload = await request.json()
    await handle_github_event(event=x_github_event, payload=payload, db=db)
    return {"message": "ok"}


# ── List repos accessible with a PAT ──────────────────────────────────────────

@router.get("/repos")
async def list_github_repos(
    token: str = Query(..., description="GitHub Personal Access Token"),
    user_id: str = Depends(get_current_user_id),
):
    """Return repos the PAT can access (owned + collaborator + org member)."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{GH_API}/user/repos",
            headers=_gh_headers(token),
            params={"per_page": 100, "sort": "updated", "affiliation": "owner,collaborator,organization_member"},
        )
        if resp.status_code == 401:
            raise HTTPException(status_code=400, detail="Invalid GitHub token")
        resp.raise_for_status()
        repos = resp.json()

    return [
        {
            "full_name": r["full_name"],
            "name": r["name"],
            "owner": r["owner"]["login"],
            "private": r["private"],
            "url": r["html_url"],
            "description": r.get("description") or "",
            "open_issues_count": r.get("open_issues_count", 0),
            "default_branch": r.get("default_branch", "main"),
        }
        for r in repos
    ]


# ── Connect a repo to a project ────────────────────────────────────────────────

class ConnectRepoRequest(BaseModel):
    token: str          # GitHub PAT
    repo_full_name: str # e.g. "octocat/hello-world"
    webhook_secret: Optional[str] = None  # custom secret for HMAC


@router.post("/connect/{project_id}")
async def connect_github_repo(
    project_id: str,
    payload: ConnectRepoRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Link a GitHub repo to a project. Registers a webhook automatically."""
    # Verify project exists
    proj_res = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify repo accessibility
    owner, repo = payload.repo_full_name.split("/", 1)
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(f"{GH_API}/repos/{owner}/{repo}", headers=_gh_headers(payload.token))
        if r.status_code == 404:
            raise HTTPException(status_code=404, detail="GitHub repo not found or token lacks access")
        r.raise_for_status()
        repo_data = r.json()

    # Remove existing integration for this project
    existing = await db.execute(
        select(GitHubIntegration).where(GitHubIntegration.project_id == project_id)
    )
    old = existing.scalar_one_or_none()
    if old:
        await db.delete(old)
        await db.flush()

    webhook_secret = payload.webhook_secret or settings.GITHUB_WEBHOOK_SECRET or "justbuildit-webhook"

    # Register webhook on the repo via GitHub API
    webhook_url = f"{settings.BACKEND_PUBLIC_URL}/api/v1/github/webhook"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            hook_resp = await client.post(
                f"{GH_API}/repos/{owner}/{repo}/hooks",
                headers=_gh_headers(payload.token),
                json={
                    "name": "web",
                    "active": True,
                    "events": ["push", "pull_request", "issues"],
                    "config": {
                        "url": webhook_url,
                        "content_type": "json",
                        "secret": webhook_secret,
                        "insecure_ssl": "0",
                    },
                },
            )
        if hook_resp.status_code not in (200, 201, 422):  # 422 = webhook already exists
            log.warning(f"Webhook registration returned {hook_resp.status_code}: {hook_resp.text[:200]}")
    except Exception as e:
        log.warning(f"Webhook auto-registration failed (integration still created): {e}")

    integration = GitHubIntegration(
        project_id=project_id,
        organization_id=project.organization_id,
        repo_name=payload.repo_full_name,
        repo_url=repo_data["html_url"],
        access_token=payload.token,
        webhook_secret=webhook_secret,
        is_active=True,
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)

    return {
        "integration_id": integration.id,
        "repo_name": integration.repo_name,
        "repo_url": integration.repo_url,
        "is_active": integration.is_active,
        "connected_at": integration.created_at,
    }


# ── Get integration status + recent events ────────────────────────────────────

@router.get("/status/{project_id}")
async def get_github_status(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(
        select(GitHubIntegration).where(GitHubIntegration.project_id == project_id)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        return {"connected": False}

    # Get last 20 events
    events_res = await db.execute(
        select(GitHubEvent)
        .where(GitHubEvent.integration_id == integration.id)
        .order_by(GitHubEvent.created_at.desc())
        .limit(20)
    )
    events = events_res.scalars().all()

    return {
        "connected": True,
        "repo_name": integration.repo_name,
        "repo_url": integration.repo_url,
        "is_active": integration.is_active,
        "connected_at": integration.created_at.isoformat() if integration.created_at else None,
        "events": [
            {
                "type": e.event_type,
                "author": e.author,
                "message": e.message,
                "branch": e.branch,
                "pr_number": e.pr_number,
                "sha": e.sha[:7] if e.sha else None,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
    }


# ── Disconnect ─────────────────────────────────────────────────────────────────

@router.delete("/disconnect/{project_id}", status_code=204)
async def disconnect_github_repo(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(
        select(GitHubIntegration).where(GitHubIntegration.project_id == project_id)
    )
    integration = result.scalar_one_or_none()
    if integration:
        await db.execute(delete(GitHubEvent).where(GitHubEvent.integration_id == integration.id))
        await db.delete(integration)
        await db.commit()


# ── Import open GitHub issues as tasks ────────────────────────────────────────

@router.post("/import-issues/{project_id}")
async def import_github_issues(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Import all open GitHub issues as TODO tasks (skips already-imported ones)."""
    result = await db.execute(
        select(GitHubIntegration).where(GitHubIntegration.project_id == project_id)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="No GitHub integration for this project")

    owner, repo = integration.repo_name.split("/", 1)
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(
            f"{GH_API}/repos/{owner}/{repo}/issues",
            headers=_gh_headers(integration.access_token),
            params={"state": "open", "per_page": 100},
        )
        resp.raise_for_status()
        issues = [i for i in resp.json() if "pull_request" not in i]  # exclude PRs

    proj_res = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_res.scalar_one_or_none()

    created = 0
    skipped = 0
    for issue in issues:
        num = issue["number"]
        # Check if task already exists for this issue
        existing = await db.execute(
            select(Task).where(
                Task.project_id == project_id,
                Task.github_issue_number == num,
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        # Guess priority from labels
        labels = [l["name"].lower() for l in issue.get("labels", [])]
        priority = "MEDIUM"
        if any(l in labels for l in ["critical", "urgent", "p0"]):
            priority = "CRITICAL"
        elif any(l in labels for l in ["high", "important", "p1"]):
            priority = "HIGH"
        elif any(l in labels for l in ["low", "minor", "p3"]):
            priority = "LOW"

        task = Task(
            project_id=project_id,
            organization_id=integration.organization_id,
            created_by=project.created_by,
            title=issue["title"][:512],
            description=issue.get("body") or f"GitHub Issue #{num}",
            status="TODO",
            priority=priority,
            github_issue_number=num,
        )
        db.add(task)
        created += 1

    await db.commit()
    return {"imported": created, "skipped_existing": skipped, "total_issues": len(issues)}


# ── Repository Analytics Endpoint ─────────────────────────────────────────────

@router.get("/analytics/{project_id}")
async def get_github_analytics(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Fetch rich analytics for the connected GitHub repo:
    - Repo metadata (stars, forks, watchers, size, language)
    - Commit activity — last 90 days aggregated by day + by weekday
    - Pull request breakdown (open/closed/merged)
    - Issue breakdown (open/closed)
    - Top 10 contributors (by commit count)
    - Language distribution (bytes per language → percentage)
    - Branch list (name + protected status)
    - Release history (last 5)
    """
    import asyncio
    from collections import defaultdict
    from datetime import datetime, timezone, timedelta

    result = await db.execute(
        select(GitHubIntegration).where(GitHubIntegration.project_id == project_id)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="No GitHub integration for this project")

    owner, repo = integration.repo_name.split("/", 1)
    hdrs = _gh_headers(integration.access_token)

    async def _get(client: httpx.AsyncClient, path: str, params: dict = None):
        try:
            r = await client.get(f"{GH_API}{path}", headers=hdrs, params=params or {})
            if r.status_code != 200:
                return None
            return r.json()
        except Exception:
            return None

    async with httpx.AsyncClient(timeout=20.0) as client:
        (
            repo_data,
            commits_raw,
            pulls_raw,
            issues_raw,
            contributors_raw,
            languages_raw,
            branches_raw,
            releases_raw,
        ) = await asyncio.gather(
            _get(client, f"/repos/{owner}/{repo}"),
            _get(client, f"/repos/{owner}/{repo}/commits",
                 {"per_page": 100, "since": (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%SZ")}),
            _get(client, f"/repos/{owner}/{repo}/pulls",   {"state": "all", "per_page": 100}),
            _get(client, f"/repos/{owner}/{repo}/issues",  {"state": "all", "per_page": 100, "filter": "all"}),
            _get(client, f"/repos/{owner}/{repo}/contributors", {"per_page": 10}),
            _get(client, f"/repos/{owner}/{repo}/languages"),
            _get(client, f"/repos/{owner}/{repo}/branches",    {"per_page": 50}),
            _get(client, f"/repos/{owner}/{repo}/releases",    {"per_page": 5}),
        )

    # ── Repo overview ──────────────────────────────────────────────────────────
    overview = {}
    if isinstance(repo_data, dict):
        overview = {
            "full_name":        repo_data.get("full_name"),
            "description":      repo_data.get("description", ""),
            "stars":            repo_data.get("stargazers_count", 0),
            "forks":            repo_data.get("forks_count", 0),
            "watchers":         repo_data.get("subscribers_count", 0),
            "open_issues":      repo_data.get("open_issues_count", 0),
            "size_kb":          repo_data.get("size", 0),
            "primary_language": repo_data.get("language"),
            "default_branch":   repo_data.get("default_branch", "main"),
            "html_url":         repo_data.get("html_url"),
            "created_at":       repo_data.get("created_at"),
            "updated_at":       repo_data.get("updated_at"),
            "license":          (repo_data.get("license") or {}).get("spdx_id"),
            "visibility":       repo_data.get("visibility", "public"),
            "topics":           repo_data.get("topics", []),
        }

    # ── Commits: aggregated by day + by weekday ────────────────────────────────
    day_counts: dict[str, int] = defaultdict(int)
    weekday_counts = [0] * 7  # Mon=0 … Sun=6
    author_commit_counts: dict[str, int] = defaultdict(int)

    commits = commits_raw if isinstance(commits_raw, list) else []
    for c in commits:
        date_str = (c.get("commit", {}).get("author") or {}).get("date", "")
        author = (c.get("commit", {}).get("author") or {}).get("name", "Unknown")
        author_commit_counts[author] += 1
        if date_str:
            try:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                day_counts[dt.strftime("%Y-%m-%d")] += 1
                weekday_counts[dt.weekday()] += 1
            except ValueError:
                pass

    # Fill last 90 days (even zero-commit days) for a smooth chart
    commit_timeline = []
    for i in range(89, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        commit_timeline.append({"date": d, "count": day_counts.get(d, 0)})

    weekday_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    commit_by_weekday = [
        {"day": weekday_labels[i], "count": weekday_counts[i]} for i in range(7)
    ]

    # ── Pull requests ──────────────────────────────────────────────────────────
    pulls = [p for p in (pulls_raw if isinstance(pulls_raw, list) else [])
             if "pull_request" not in p]  # safety filter
    pulls_all = pulls_raw if isinstance(pulls_raw, list) else []
    pr_open   = sum(1 for p in pulls_all if p.get("state") == "open")
    pr_merged = sum(1 for p in pulls_all if p.get("pull_request", {}).get("merged_at") or p.get("merged_at"))
    pr_closed = sum(1 for p in pulls_all if p.get("state") == "closed") - pr_merged
    recent_prs = [
        {
            "number": p.get("number"),
            "title":  p.get("title", "")[:80],
            "state":  p.get("state"),
            "author": (p.get("user") or {}).get("login"),
            "created_at": p.get("created_at"),
        }
        for p in pulls_all[:8]
    ]

    # ── Issues (exclude PRs) ───────────────────────────────────────────────────
    issues_all = [i for i in (issues_raw if isinstance(issues_raw, list) else [])
                  if "pull_request" not in i]
    issue_open   = sum(1 for i in issues_all if i.get("state") == "open")
    issue_closed = sum(1 for i in issues_all if i.get("state") == "closed")

    # Label frequency
    label_freq: dict[str, int] = defaultdict(int)
    for issue in issues_all:
        for lbl in issue.get("labels", []):
            label_freq[lbl["name"]] += 1
    top_labels = sorted(label_freq.items(), key=lambda x: -x[1])[:8]

    # ── Contributors ───────────────────────────────────────────────────────────
    contributors = []
    if isinstance(contributors_raw, list):
        contributors = [
            {
                "login":        c.get("login"),
                "avatar_url":   c.get("avatar_url"),
                "contributions": c.get("contributions", 0),
                "profile_url":  c.get("html_url"),
            }
            for c in contributors_raw[:10]
        ]

    # ── Languages ──────────────────────────────────────────────────────────────
    languages: list[dict] = []
    if isinstance(languages_raw, dict) and languages_raw:
        total_bytes = sum(languages_raw.values())
        LANG_COLORS = {
            "Python": "#3572A5", "TypeScript": "#2b7489", "JavaScript": "#f1e05a",
            "Rust": "#dea584", "Go": "#00ADD8", "Java": "#b07219",
            "C++": "#f34b7d", "CSS": "#563d7c", "HTML": "#e34c26",
            "Ruby": "#701516", "Swift": "#ffac45", "Kotlin": "#A97BFF",
            "Shell": "#89e051", "Dockerfile": "#384d54", "YAML": "#cb171e",
        }
        languages = [
            {
                "name":       lang,
                "bytes":      b,
                "percentage": round(b / total_bytes * 100, 1),
                "color":      LANG_COLORS.get(lang, "#8b949e"),
            }
            for lang, b in sorted(languages_raw.items(), key=lambda x: -x[1])
        ]

    # ── Branches ───────────────────────────────────────────────────────────────
    branches = []
    if isinstance(branches_raw, list):
        branches = [
            {
                "name":      b.get("name"),
                "protected": b.get("protected", False),
                "sha":       (b.get("commit") or {}).get("sha", "")[:7],
            }
            for b in branches_raw[:20]
        ]

    # ── Releases ───────────────────────────────────────────────────────────────
    releases = []
    if isinstance(releases_raw, list):
        releases = [
            {
                "tag":          r.get("tag_name"),
                "name":         r.get("name") or r.get("tag_name"),
                "prerelease":   r.get("prerelease", False),
                "published_at": r.get("published_at"),
                "url":          r.get("html_url"),
            }
            for r in releases_raw[:5]
        ]

    return {
        "overview":          overview,
        "commit_timeline":   commit_timeline,
        "commit_by_weekday": commit_by_weekday,
        "total_commits_90d": len(commits),
        "pull_requests":     {"open": pr_open, "closed": pr_closed, "merged": pr_merged, "recent": recent_prs},
        "issues":            {"open": issue_open, "closed": issue_closed, "top_labels": top_labels},
        "contributors":      contributors,
        "languages":         languages,
        "branches":          branches,
        "releases":          releases,
    }
