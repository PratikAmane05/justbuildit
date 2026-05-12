from app.workers.celery_app import celery_app
from app.utils.logger import get_logger

logger = get_logger(__name__)


@celery_app.task(bind=True, max_retries=3)
def sync_github_issues(self, project_id: str, repo: str, token: str):
    """Sync GitHub issues for a project to local tasks."""
    try:
        logger.info(f"Syncing GitHub issues for project {project_id}, repo {repo}")
        # TODO: Implement actual sync
    except Exception as exc:
        logger.error(f"Sync failed: {exc}")
        raise self.retry(exc=exc, countdown=60)


@celery_app.task
def recalculate_project_progress(project_id: str):
    """Recalculate project completion percentage based on task statuses."""
    logger.info(f"Recalculating progress for project {project_id}")
    # TODO: query tasks, compute %, update project.progress


@celery_app.task
def send_due_date_reminders():
    """Check for tasks due today/tomorrow and send reminders."""
    logger.info("Checking due date reminders...")
    # TODO: query upcoming due tasks, send notifications


@celery_app.task(bind=True, max_retries=3)
def send_email_task(self, to_email: str, subject: str, body: str, is_html: bool = True):
    """
    Background task to send an email. 
    Retries up to 3 times in case of temporary SMTP network failures.
    """
    from app.services.email_service import EmailService
    try:
        logger.info(f"Preparing to send email to {to_email}")
        success = EmailService.send_email_sync(to_email, subject, body, is_html)
        if not success:
            raise Exception("SMTP failed to send email. Check logs.")
    except Exception as exc:
        logger.error(f"Email failed: {exc}")
        raise self.retry(exc=exc, countdown=60)
