
import os
import smtplib
import ssl
from email.message import EmailMessage


def send_otp_email(receiver_email: str, otp: str) -> None:
    sender_email = os.getenv("SMTP_EMAIL")
    app_password = os.getenv("SMTP_APP_PASSWORD")

    if not sender_email or not app_password:
        raise RuntimeError(
            "SMTP_EMAIL or SMTP_APP_PASSWORD is missing in .env"
        )

    message = EmailMessage()
    message["Subject"] = "GreenSpace Password Reset OTP"
    message["From"] = sender_email
    message["To"] = receiver_email

    message.set_content(
        f"""Hello,

Your GreenSpace password reset OTP is: {otp}

This OTP is valid for 10 minutes.

If you did not request a password reset, please ignore this email.
"""
    )

    context = ssl.create_default_context()

    with smtplib.SMTP_SSL(
        "smtp.gmail.com",
        465,
        context=context,
        timeout=20,
    ) as server:
        server.login(sender_email, app_password)
        server.send_message(message)
