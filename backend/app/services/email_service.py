import smtplib
import traceback
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

class EmailService:
    @staticmethod
    def send_email_sync(to_email: str, subject: str, body: str, is_html: bool = True) -> bool:
        """
        Sends an email synchronously using Python's built-in smtplib.
        Best used within a background worker (Celery) to avoid blocking the API.
        """
        if not settings.SMTP_HOST or not settings.SMTP_USER:
            logger.warning(f"SMTP configured improperly. Skipping email to {to_email}")
            return False

        msg = MIMEMultipart()
        msg['From'] = settings.SMTP_FROM_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject

        mime_type = 'html' if is_html else 'plain'
        msg.attach(MIMEText(body, mime_type))

        try:
            # Most modern SMTP servers (like Amazon SES, SendGrid, Gmail) use standard TLS on port 587
            if settings.SMTP_PORT == 587 or settings.SMTP_TLS:
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
                server.ehlo()
                server.starttls()
            else:
                # SSL on port 465
                server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)

            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()
            
            logger.info(f"Successfully sent email to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            logger.debug(traceback.format_exc())
            return False
