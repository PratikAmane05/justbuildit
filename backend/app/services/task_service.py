from typing import List, Optional
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.models.project import Project
from app.models.membership import Membership
from app.models.github_integration import GitHubIntegration
from app.models.activity_log import ActivityLog
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.github_service import GitHubService


class TaskService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, user_id: str, project_id: Optional[str] = None) -> List[Task]:
        """Return tasks scoped to the user's org memberships."""
        if project_id:
            # Return all tasks for this project
            result = await self.db.execute(
                select(Task)
                .where(Task.project_id == project_id, Task.is_deleted == False)
                .order_by(Task.created_at.desc())
            )
            return list(result.scalars().all())

        # No project_id → return tasks from all projects in user's orgs
        org_result = await self.db.execute(
            select(Membership.organization_id).where(Membership.user_id == user_id)
        )
        org_ids = [row[0] for row in org_result.fetchall()]
        if not org_ids:
            return []
        proj_result = await self.db.execute(
            select(Project.id)
            .where(Project.organization_id.in_(org_ids), Project.is_deleted == False)
        )
        proj_ids = [row[0] for row in proj_result.fetchall()]
        if not proj_ids:
            return []
        result = await self.db.execute(
            select(Task)
            .where(Task.project_id.in_(proj_ids), Task.is_deleted == False)
            .order_by(Task.created_at.desc())
        )
        return list(result.scalars().all())

    async def get(self, task_id: str) -> Optional[Task]:
        result = await self.db.execute(select(Task).where(Task.id == task_id))
        return result.scalar_one_or_none()

    async def create(self, payload: TaskCreate) -> Task:
        task = Task(**payload.model_dump())
        
        # Check if project has a GitHub integration
        int_result = await self.db.execute(
            select(GitHubIntegration).where(GitHubIntegration.project_id == payload.project_id)
        )
        integration = int_result.scalar_one_or_none()
        
        if integration and integration.access_token:
            try:
                gh = GitHubService(integration.access_token)
                owner, repo = integration.repo_name.split("/")
                gh_body = payload.description or ""
                gh_body += "\n\n*(Exported via JustBuildIt)*"
                issue_data = await gh.create_issue(owner, repo, payload.title, gh_body)
                task.github_issue_number = issue_data.get("number")
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to create GitHub issue for task: {e}")

        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)

        if task.assigned_to:
            try:
                from app.models.user import User
                res = await self.db.execute(select(User).where(User.id == task.assigned_to))
                assignee = res.scalar_one_or_none()
                pres = await self.db.execute(select(Project).where(Project.id == task.project_id))
                proj = pres.scalar_one_or_none()

                if assignee and assignee.email:
                    import asyncio
                    email_str = assignee.email
                    proj_name = proj.name if proj else "Project"
                    asyncio.create_task(self._notify_assignment(email_str, task.title, proj_name))
            except Exception:
                pass

        return task

    async def _notify_assignment(self, email: str, task_title: str, proj_name: str):
        try:
            from app.core.email import notify_task_created
            await notify_task_created(
                email, 
                task_title, 
                proj_name, 
                "A team member"
            )
        except Exception:
            pass


    async def update(self, task_id: str, payload: TaskUpdate) -> Task:
        task = await self.get(task_id)
        if not task:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Task not found")
        
        old_assignee = task.assigned_to
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(task, field, value)
        
        await self.db.commit()
        await self.db.refresh(task)

        if task.assigned_to and task.assigned_to != old_assignee:
            try:
                from app.models.user import User
                res = await self.db.execute(select(User).where(User.id == task.assigned_to))
                assignee = res.scalar_one_or_none()
                pres = await self.db.execute(select(Project).where(Project.id == task.project_id))
                proj = pres.scalar_one_or_none()

                if assignee and assignee.email:
                    import asyncio
                    email_str = assignee.email
                    proj_name = proj.name if proj else "Project"
                    asyncio.create_task(self._notify_assignment(email_str, task.title, proj_name))
            except Exception:
                pass

        return task

    async def update_status(self, task_id: str, status: str, user_id: str | None = None) -> Task:
        """Update task status and write activity log + ML timestamps."""
        task = await self.get(task_id)
        if not task:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Task not found")

        old_status = task.status
        now = datetime.now(timezone.utc)

        # Calculate how long the task was in the previous status
        time_in_status_hours: float | None = None
        if task.status_changed_at:
            delta = now - task.status_changed_at
            time_in_status_hours = round(delta.total_seconds() / 3600, 2)

        task.status = status
        task.status_changed_at = now

        # Record completion timestamp for ML training data
        if status == "DONE":
            task.completed_at = now

        # Write activity log silently (non-blocking — errors are swallowed)
        try:
            log = ActivityLog(
                organization_id=task.organization_id,
                user_id=user_id,
                action="task.status_changed",
                entity_type="TASK",
                entity_id=task.id,
                metadata_={
                    "from_status": old_status,
                    "to_status": status,
                    "time_in_status_hours": time_in_status_hours,
                    "complexity_label": task.complexity_label,
                    "story_points": task.story_points,
                    "risk_factor_count": len(task.risk_factors) if task.risk_factors else 0,
                },
            )
            self.db.add(log)
        except Exception:
            import logging
            logging.getLogger(__name__).warning("Failed to write activity log for status change")

        try:
            from app.core.email import notify_task_status_updated
            from app.models.user import User
            # Send notification to assignee if it's assigned to someone
            if task.assigned_to:
                res = await self.db.execute(select(User).where(User.id == task.assigned_to))
                assignee = res.scalar_one_or_none()
                if assignee and assignee.email:
                    # Best effort to fetch updater name
                    updater_name = "A team member"
                    if user_id:
                        updater_res = await self.db.execute(select(User).where(User.id == user_id))
                        updater = updater_res.scalar_one_or_none()
                        if updater:
                            updater_name = updater.name

                    await notify_task_status_updated(assignee.email, task.title, status, updater_name)
        except Exception:
            pass

        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def delete(self, task_id: str) -> None:
        task = await self.get(task_id)
        if task:
            task.is_deleted = True
            await self.db.commit()
