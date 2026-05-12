import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import SessionLocal
from app.models.user import User
from app.models.project import Project
from app.models.github_integration import GitHubIntegration
from sqlalchemy import select

async def main():
    async with SessionLocal() as db:
        users = await db.execute(select(User))
        user = users.scalars().first()
        print(f"User: {user.email if user else 'None'}")
        
        projects = await db.execute(select(Project))
        project = projects.scalars().first()
        print(f"Project: {project.id if project else 'None'}")

        if project:
            integrations = await db.execute(select(GitHubIntegration).where(GitHubIntegration.project_id == project.id))
            integration = integrations.scalars().first()
            print(f"Integration: {integration.id if integration else 'None'}")

asyncio.run(main())
