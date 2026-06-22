import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta
from jose import jwt
from app.core.config import settings
from app.models.models import User

logger = logging.getLogger(__name__)

# File path to log sent emails for local review
EMAIL_LOG_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../emails.log"))

def generate_action_token(user_id: str, action: str) -> str:
    payload = {
        "sub": user_id,
        "action": action,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def verify_action_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except Exception as e:
        logger.error(f"Failed to verify email action token: {e}")
        return None

class EmailService:
    @staticmethod
    def _log_email_to_file(to_email: str, subject: str, body: str, html_body: str = None):
        """Helper to write all simulated emails to a local file for verification."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        divider = "=" * 80
        log_entry = f"\n{divider}\nTIMESTAMP: {timestamp}\nTO: {to_email}\nSUBJECT: {subject}\n{divider}\n"
        log_entry += f"BODY:\n{body}\n"
        if html_body:
            log_entry += f"\nHTML BODY:\n{html_body}\n"
        log_entry += f"{divider}\n"
        
        try:
            with open(EMAIL_LOG_FILE, "a", encoding="utf-8") as f:
                f.write(log_entry)
        except Exception as e:
            logger.error(f"Failed to write email to log file: {e}")
            
        # Print summary to stdout for dev server visibility
        print(f"\n[EMAIL SIMULATION] Sent to: {to_email} | Subject: {subject}")

    @staticmethod
    def _send_email(to_email: str, subject: str, text_body: str, html_body: str = None):
        """Sends an email using configured SMTP parameters, or logs it as a fallback."""
        smtp_host = os.getenv("SMTP_HOST")
        smtp_port = os.getenv("SMTP_PORT")
        smtp_user = os.getenv("SMTP_USER")
        smtp_password = os.getenv("SMTP_PASSWORD")
        smtp_from = os.getenv("SMTP_FROM", "noreply@satprepai.com")
        
        # Always log to local file for development auditability
        EmailService._log_email_to_file(to_email, subject, text_body, html_body)
        
        if smtp_host and smtp_port and smtp_user and smtp_password:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = smtp_from
                msg["To"] = to_email
                
                msg.attach(MIMEText(text_body, "plain"))
                if html_body:
                    msg.attach(MIMEText(html_body, "html"))
                    
                port = int(smtp_port)
                if port == 465:
                    server = smtplib.SMTP_SSL(smtp_host, port)
                else:
                    server = smtplib.SMTP(smtp_host, port)
                    server.starttls()
                    
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_from, to_email, msg.as_string())
                server.quit()
                logger.info(f"Real email successfully sent to {to_email} via SMTP.")
            except Exception as e:
                logger.error(f"SMTP send failed, fell back to local logs: {e}")
        else:
            logger.info("SMTP environment variables not fully configured. Email logged locally.")

    @staticmethod
    def send_admin_approval_request_email(user: User, request=None):
        """Sends a user registration approval request email to the administrator."""
        admin_email = settings.ADMIN_NOTIFICATION_EMAIL
        subject = "New User Registration Awaiting Approval – SATPrep AI"
        
        # Resolve backend URL to generate quick action buttons
        if request:
            backend_base = str(request.base_url).rstrip("/")
        else:
            backend_base = "http://localhost:8000"
            
        approve_token = generate_action_token(user.id, "approve")
        reject_token = generate_action_token(user.id, "reject")
        
        approve_url = f"{backend_base}/v1/auth/action?token={approve_token}"
        reject_url = f"{backend_base}/v1/auth/action?token={reject_token}"
        dashboard_url = f"{settings.FRONTEND_URL}/admin?user_id={user.id}"
        
        reg_time = user.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if user.created_at else datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
        ip_addr = user.registration_ip or "Not Available"
        user_agent = user.registration_user_agent or "Not Available"
        
        text_body = (
            f"New User Registration Awaiting Approval\n\n"
            f"User ID: {user.id}\n"
            f"Full Name: {user.full_name or '—'}\n"
            f"Email: {user.email}\n"
            f"Role: {user.role}\n"
            f"Registration Time: {reg_time}\n"
            f"IP Address: {ip_addr}\n"
            f"Browser/Device: {user_agent}\n"
            f"Approval Status: Pending\n\n"
            f"Quick Actions:\n"
            f"- Approve User: {approve_url}\n"
            f"- Reject User: {reject_url}\n"
            f"- View Details (Admin Dashboard): {dashboard_url}\n"
        )
        
        html_body = f"""
        <html>
            <body style="font-family: sans-serif; background-color: #f8fafc; padding: 2rem; color: #1e293b;">
                <div style="max-width: 600px; margin: 0 auto; background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
                    <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 1rem; margin-bottom: 1.5rem;">
                        <h2 style="color: #1e3a8a; margin: 0;">New User Registration Awaiting Approval</h2>
                        <span style="font-size: 0.85rem; color: #64748b;">SATPrep AI Platform</span>
                    </div>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem;">
                        <tr style="background-color: #f1f5f9;"><td style="padding: 0.5rem 1rem; font-weight: bold; width: 40%;">User ID</td><td style="padding: 0.5rem 1rem; font-family: monospace; font-size: 0.85rem;">{user.id}</td></tr>
                        <tr><td style="padding: 0.5rem 1rem; font-weight: bold;">Full Name</td><td style="padding: 0.5rem 1rem;">{user.full_name or '—'}</td></tr>
                        <tr style="background-color: #f1f5f9;"><td style="padding: 0.5rem 1rem; font-weight: bold;">Email Address</td><td style="padding: 0.5rem 1rem;">{user.email}</td></tr>
                        <tr><td style="padding: 0.5rem 1rem; font-weight: bold;">Selected Role</td><td style="padding: 0.5rem 1rem; text-transform: capitalize;">{user.role}</td></tr>
                        <tr style="background-color: #f1f5f9;"><td style="padding: 0.5rem 1rem; font-weight: bold;">Registration Date</td><td style="padding: 0.5rem 1rem;">{reg_time}</td></tr>
                        <tr><td style="padding: 0.5rem 1rem; font-weight: bold;">IP Address</td><td style="padding: 0.5rem 1rem;">{ip_addr}</td></tr>
                        <tr style="background-color: #f1f5f9;"><td style="padding: 0.5rem 1rem; font-weight: bold;">Device / Browser</td><td style="padding: 0.5rem 1rem; font-size: 0.85rem; color: #475569;">{user_agent}</td></tr>
                        <tr><td style="padding: 0.5rem 1rem; font-weight: bold;">Approval Status</td><td style="padding: 0.5rem 1rem;"><span style="background-color: #fef3c7; color: #d97706; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.85rem; font-weight: bold;">Pending Approval</span></td></tr>
                    </table>
                    
                    <div style="margin-top: 2rem; border-top: 1px solid #e2e8f0; padding-top: 1.5rem;">
                        <h4 style="margin: 0 0 1rem 0; color: #475569;">Admin Quick Actions</h4>
                        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                            <a href="{approve_url}" style="display: inline-block; background-color: #16a34a; color: white; text-decoration: none; padding: 0.6rem 1.2rem; border-radius: 0.375rem; font-weight: bold; font-size: 0.9rem; margin-right: 0.5rem;">✅ Approve User</a>
                            <a href="{reject_url}" style="display: inline-block; background-color: #dc2626; color: white; text-decoration: none; padding: 0.6rem 1.2rem; border-radius: 0.375rem; font-weight: bold; font-size: 0.9rem; margin-right: 0.5rem;">❌ Reject User</a>
                            <a href="{dashboard_url}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 0.6rem 1.2rem; border-radius: 0.375rem; font-weight: bold; font-size: 0.9rem;">👁 View User Details</a>
                        </div>
                    </div>
                </div>
            </body>
        </html>
        """
        EmailService._send_email(admin_email, subject, text_body, html_body)

    @staticmethod
    def send_user_pending_email(user: User):
        """Sends email to user notifying that their registration is pending administrator approval."""
        subject = "Registration Received – Approval Pending"
        text_body = (
            f"Hello {user.full_name or user.email},\n\n"
            f"Your registration on SATPrep AI was successful!\n\n"
            f"Your account is currently awaiting administrator approval. "
            f"You will receive another confirmation email once your account has been approved or rejected.\n\n"
            f"Please note that you cannot log in until administrator approval is granted.\n\n"
            f"Thank you for your patience!\n"
            f"The SATPrep AI Team"
        )
        
        html_body = f"""
        <html>
            <body style="font-family: sans-serif; background-color: #f8fafc; padding: 2rem; color: #1e293b;">
                <div style="max-width: 600px; margin: 0 auto; background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
                    <h2 style="color: #1e3a8a; margin-top: 0;">Registration Received – Approval Pending</h2>
                    <p>Dear {user.full_name or 'User'},</p>
                    <p>Thank you for registering with <strong>SATPrep AI</strong>! Your registration was successful.</p>
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 1rem; margin: 1.5rem 0; border-radius: 0.375rem;">
                        <p style="margin: 0; font-weight: bold; color: #b45309;">Awaiting Administrator Approval</p>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; color: #78350f;">
                            Your account is currently being reviewed. You cannot log in until an administrator approves your account.
                            We will send you an email as soon as the review is complete.
                        </p>
                    </div>
                    <p>If you have any questions, please contact our support team.</p>
                    <p style="margin-top: 2rem; font-size: 0.9rem; color: #64748b;">Best regards,<br>The SATPrep AI Team</p>
                </div>
            </body>
        </html>
        """
        EmailService._send_email(user.email, subject, text_body, html_body)

    @staticmethod
    def send_user_approved_email(user: User):
        """Sends email to user welcoming them after account approval."""
        subject = "Your SATPrep AI Account Has Been Approved"
        login_url = f"{settings.FRONTEND_URL}/login"
        
        text_body = (
            f"Welcome to SATPrep AI!\n\n"
            f"Hello {user.full_name or user.email},\n\n"
            f"We are excited to inform you that your registration request has been APPROVED!\n\n"
            f"Assigned Role: {user.role.capitalize()}\n"
            f"Login URL: {login_url}\n\n"
            f"Getting Started:\n"
            f"1. Visit the login page at {login_url}\n"
            f"2. Log in using your registered email and password.\n"
            f"3. Start experiencing adaptive mock SAT tests and review your analytical dashboards!\n\n"
            f"Best of luck with your preparation!\n"
            f"The SATPrep AI Team"
        )
        
        html_body = f"""
        <html>
            <body style="font-family: sans-serif; background-color: #f8fafc; padding: 2rem; color: #1e293b;">
                <div style="max-width: 600px; margin: 0 auto; background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
                    <h2 style="color: #16a34a; margin-top: 0;">🎉 Your SATPrep AI Account Has Been Approved!</h2>
                    <p>Dear {user.full_name or 'User'},</p>
                    <p>We are thrilled to welcome you to <strong>SATPrep AI</strong>! Your account has been approved by the administrator.</p>
                    
                    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 1.25rem; margin: 1.5rem 0; border-radius: 0.5rem;">
                        <p style="margin: 0; font-weight: bold; color: #15803d;">Account Details</p>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.95rem;">Assigned Role: <strong style="text-transform: capitalize;">{user.role}</strong></p>
                    </div>
                    
                    <h4 style="margin: 1.5rem 0 0.5rem 0; color: #1e3a8a;">Getting Started Instructions:</h4>
                    <ol style="margin: 0 0 1.5rem 0; padding-left: 1.25rem; line-height: 1.5;">
                        <li>Navigate to the <a href="{login_url}" style="color: #2563eb; font-weight: bold; text-decoration: underline;">SATPrep AI Login Page</a>.</li>
                        <li>Sign in using your email and password.</li>
                        <li>Take your first adaptive practice mock and explore AI-powered analytics.</li>
                    </ol>
                    
                    <div style="text-align: center; margin-top: 2rem;">
                        <a href="{login_url}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 0.75rem 1.75rem; border-radius: 0.5rem; font-weight: bold;">Log In Now</a>
                    </div>
                    
                    <p style="margin-top: 2rem; font-size: 0.9rem; color: #64748b;">Good luck with your study goals!<br>The SATPrep AI Team</p>
                </div>
            </body>
        </html>
        """
        EmailService._send_email(user.email, subject, text_body, html_body)

    @staticmethod
    def send_user_rejected_email(user: User, reason: str = None):
        """Sends email to user notifying that their registration was not approved."""
        subject = "Your Registration Request Was Not Approved"
        reason_text = f"Reason: {reason}" if reason else "No specific reason was provided."
        
        text_body = (
            f"Hello {user.full_name or user.email},\n\n"
            f"Thank you for your interest in SATPrep AI.\n\n"
            f"Unfortunately, your registration request has not been approved at this time.\n"
            f"{reason_text}\n\n"
            f"If you believe this was an error or would like to contact support, please reply to this email.\n\n"
            f"The SATPrep AI Team"
        )
        
        html_body = f"""
        <html>
            <body style="font-family: sans-serif; background-color: #f8fafc; padding: 2rem; color: #1e293b;">
                <div style="max-width: 600px; margin: 0 auto; background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
                    <h2 style="color: #dc2626; margin-top: 0;">Your Registration Request Was Not Approved</h2>
                    <p>Dear {user.full_name or 'User'},</p>
                    <p>Thank you for your interest in registering for <strong>SATPrep AI</strong>.</p>
                    <p>We regret to inform you that your registration request was declined at this time.</p>
                    
                    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 1rem; margin: 1.5rem 0; border-radius: 0.375rem;">
                        <p style="margin: 0; font-weight: bold; color: #991b1b;">Rejection Status</p>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; color: #7f1d1d;">{reason_text}</p>
                    </div>
                    
                    <p>If you have any questions or feel this decision was made in error, please feel free to reach out to our support team.</p>
                    <p style="margin-top: 2rem; font-size: 0.9rem; color: #64748b;">Best regards,<br>The SATPrep AI Team</p>
                </div>
            </body>
        </html>
        """
        EmailService._send_email(user.email, subject, text_body, html_body)
