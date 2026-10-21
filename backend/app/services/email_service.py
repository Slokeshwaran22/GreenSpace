import os
import smtplib
import ssl
from email.message import EmailMessage


def _send_email(receiver_email: str, subject: str, body: str) -> None:
    sender_email = os.getenv("SMTP_EMAIL")
    app_password = os.getenv("SMTP_APP_PASSWORD")

    if not sender_email or not app_password:
        raise RuntimeError(
            "SMTP_EMAIL or SMTP_APP_PASSWORD is missing in .env"
        )

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender_email
    message["To"] = receiver_email
    message.set_content(body)

    context = ssl.create_default_context()

    with smtplib.SMTP_SSL(
        "smtp.gmail.com",
        465,
        context=context,
        timeout=20,
    ) as server:
        server.login(sender_email, app_password)
        server.send_message(message)


def send_otp_email(receiver_email: str, otp: str) -> None:
    """Send an OTP for password reset."""
    _send_email(
        receiver_email,
        "GreenSpace Password Reset OTP",
        f"""Hello,

Your GreenSpace password reset OTP is: {otp}

This OTP is valid for 10 minutes.

If you did not request a password reset, please ignore this email.
""",
    )


def send_login_otp_email(receiver_email: str, otp: str) -> None:
    """Send an OTP for login verification."""
    _send_email(
        receiver_email,
        "GreenSpace Login Verification OTP",
        f"""Hello,

Your GreenSpace login verification OTP is: {otp}

This OTP is valid for 10 minutes.

If you did not attempt to log in, please ignore this email.
""",
    )
