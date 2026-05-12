from typing import List, Optional
import logging
from app.workers.tasks import send_email_task

logger = logging.getLogger(__name__)

def dispatch_email(subject: str, recipient_email: str, body_html: str):
    """
    Fire-and-forget: offloads email sending to Celery.
    Prevents API delays.
    """
    logger.info(f"Queueing email to {recipient_email} via Celery")
    send_email_task.delay(to_email=recipient_email, subject=subject, body=body_html, is_html=True)


async def notify_added_to_org(recipient_email: str, org_name: str, inviter_name: str):
    subject = f"You've been added to {org_name}"
    body = f"""
    <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #4F46E5;">Welcome to {org_name}!</h2>
            <p>Hi there,</p>
            <p><b>{inviter_name}</b> has added you to their organization on <b>justbuildit.</b></p>
            <p>You can now collaborate on projects, track tasks, and build faster together.</p>
            <br/>
            <p>Happy Building!<br/>The justbuildit. Team</p>
        </body>
    </html>
    """
    dispatch_email(subject, recipient_email, body)


async def notify_project_created(recipient_emails: List[str], project_name: str, org_name: str, creator_name: str):
    subject = f"New Project in {org_name}: {project_name}"
    body = f"""
    <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #4F46E5;">New Project Created</h2>
            <p>Hi team,</p>
            <p><b>{creator_name}</b> just created a new project <b>{project_name}</b> in the <b>{org_name}</b> organization.</p>
            <br/>
            <p>Log in to justbuildit to check it out and start collaborating!</p>
        </body>
    </html>
    """
    for email in recipient_emails:
        dispatch_email(subject, email, body)


async def notify_task_created(recipient_email: str, task_title: str, project_name: str, assigner_name: str):
    subject = f"New task assigned: {task_title}"
    body = f"""
    <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #4F46E5;">Task Assigned</h2>
            <p>Hi,</p>
            <p><b>{assigner_name}</b> has assigned a new task to you in <b>{project_name}</b>:</p>
            <p style="padding: 10px; background: #F3F4F6; border-radius: 4px;"><b>Task:</b> {task_title}</p>
            <br/>
            <p>Log in to justbuildit to start working on it.</p>
        </body>
    </html>
    """
    dispatch_email(subject, recipient_email, body)


async def notify_task_status_updated(recipient_email: str, task_title: str, new_status: str, updater_name: str):
    subject = f"Task Update: {task_title} moved to {new_status}"
    body = f"""
    <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #4F46E5;">Task Status Updated</h2>
            <p>Hi,</p>
            <p>The status of a task you are assigned to was just updated by <b>{updater_name}</b>.</p>
            <p style="padding: 10px; background: #F3F4F6; border-radius: 4px;">
                <b>Task:</b> {task_title}<br/>
                <b>New Status:</b> <span style="color: #10B981; font-weight: bold;">{new_status}</span>
            </p>
        </body>
    </html>
    """
    dispatch_email(subject, recipient_email, body)


async def notify_profile_updated(recipient_email: str, name: str):
    subject = "Your JustBuildIt Profile was updated"
    body = f"""
    <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #4F46E5;">Profile Information Updated</h2>
            <p>Hi {name},</p>
            <p>Your personal information on <b>justbuildit.</b> was recently updated. If you made this change, you can safely ignore this email.</p>
            <p style="color: #DC2626;">If you did not request this change, please reset your password immediately or contact support.</p>
        </body>
    </html>
    """
    dispatch_email(subject, recipient_email, body)


async def notify_login_alert(recipient_email: str, name: str, ip_address: Optional[str] = "Unknown Device"):
    subject = "New login to your JustBuildIt account"
    body = f"""
    <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #4F46E5;">New Login Detected</h2>
            <p>Hi {name},</p>
            <p>We detected a new login to your account from:</p>
            <p style="padding: 10px; background: #F3F4F6; border-radius: 4px;">
               <b>Device/IP:</b> {ip_address}
            </p>
            <p>If this was you, you don't need to do anything. If you don't recognize this activity, please change your password immediately.</p>
        </body>
    </html>
    """
    dispatch_email(subject, recipient_email, body)
