
import hashlib
import hmac
import secrets
from datetime import datetime

from fastapi import APIRouter, HTTPException
from mysql.connector import Error

from app.database import get_connection
from app.schemas import (
    ForgotPasswordRequest,
    VerifyOTPRequest,
    ResetPasswordRequest,
)
from app.security import (
    normalize_email,
    is_valid_gmail,
    validate_password,
    hash_password,
)
from app.services.email_service import send_otp_email

router = APIRouter()
OTP_EXPIRY_MINUTES = 10
GENERIC_OTP_MESSAGE = (
    "If the account exists, an OTP has been sent to the registered email."
)


@router.post("/forgot-password/send-otp")
def send_password_reset_otp(data: ForgotPasswordRequest):
    email = normalize_email(data.email)

    if not is_valid_gmail(email):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid Gmail address.",
        )

    connection = None
    cursor = None
    otp_created = False

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            "SELECT id FROM users WHERE email = %s",
            (email,),
        )
        user = cursor.fetchone()

        if not user:
            return {"message": GENERIC_OTP_MESSAGE}

        otp = f"{secrets.randbelow(1_000_000):06d}"
        otp_hash = hashlib.sha256(
            otp.encode("utf-8")
        ).hexdigest()

        cursor.execute(
            """
            INSERT INTO password_reset_otps
                (email, otp_hash, expires_at, attempts, verified)
            VALUES
                (%s, %s, DATE_ADD(NOW(), INTERVAL %s MINUTE), 0, 0)
            ON DUPLICATE KEY UPDATE
                otp_hash = VALUES(otp_hash),
                expires_at = VALUES(expires_at),
                attempts = 0,
                verified = 0
            """,
            (email, otp_hash, OTP_EXPIRY_MINUTES),
        )

        connection.commit()
        otp_created = True

        # Do not keep a database cursor/connection open while emailing.
        cursor.close()
        cursor = None
        connection.close()
        connection = None

        send_otp_email(email, otp)

        return {"message": GENERIC_OTP_MESSAGE}

    except Error as error:
        if connection:
            connection.rollback()

        print(f"OTP database error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to process the OTP request.",
        ) from error

    except Exception as error:
        print(f"OTP email error: {error}")

        if otp_created:
            cleanup_connection = None
            cleanup_cursor = None

            try:
                cleanup_connection = get_connection()
                cleanup_cursor = cleanup_connection.cursor()
                cleanup_cursor.execute(
                    "DELETE FROM password_reset_otps WHERE email = %s",
                    (email,),
                )
                cleanup_connection.commit()
            except Error as cleanup_error:
                if cleanup_connection:
                    cleanup_connection.rollback()
                print(f"OTP cleanup error: {cleanup_error}")
            finally:
                if cleanup_cursor:
                    cleanup_cursor.close()
                if (
                    cleanup_connection
                    and cleanup_connection.is_connected()
                ):
                    cleanup_connection.close()

        raise HTTPException(
            status_code=500,
            detail="Unable to send OTP email. Check SMTP configuration.",
        ) from error

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@router.post("/forgot-password/verify-otp")
def verify_password_reset_otp(data: VerifyOTPRequest):
    email = normalize_email(data.email)

    if not is_valid_gmail(email):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid Gmail address.",
        )

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT otp_hash, expires_at, attempts, verified
            FROM password_reset_otps
            WHERE email = %s
            """,
            (email,),
        )
        record = cursor.fetchone()

        if not record or record["expires_at"] <= datetime.now():
            raise HTTPException(
                status_code=400,
                detail="OTP is invalid or expired. Request a new OTP.",
            )

        if record["verified"]:
            return {"message": "OTP already verified."}

        if record["attempts"] >= 5:
            cursor.execute(
                "DELETE FROM password_reset_otps WHERE email = %s",
                (email,),
            )
            connection.commit()
            raise HTTPException(
                status_code=429,
                detail="Too many attempts. Request a new OTP.",
            )

        submitted_hash = hashlib.sha256(
            data.otp.encode("utf-8")
        ).hexdigest()

        if not hmac.compare_digest(
            submitted_hash, record["otp_hash"]
        ):
            cursor.execute(
                """
                UPDATE password_reset_otps
                SET attempts = attempts + 1
                WHERE email = %s
                """,
                (email,),
            )
            connection.commit()
            raise HTTPException(
                status_code=400,
                detail="Incorrect OTP.",
            )

        cursor.execute(
            """
            UPDATE password_reset_otps
            SET verified = 1
            WHERE email = %s
            """,
            (email,),
        )
        connection.commit()

        return {"message": "OTP verified successfully."}

    except HTTPException:
        raise

    except Error as error:
        if connection:
            connection.rollback()

        print(f"OTP verification database error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to verify OTP.",
        ) from error

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@router.post("/forgot-password/reset")
def reset_password(data: ResetPasswordRequest):
    email = normalize_email(data.email)

    if not is_valid_gmail(email):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid Gmail address.",
        )

    if data.new_password != data.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match.",
        )

    if not validate_password(data.new_password):
        raise HTTPException(
            status_code=400,
            detail=(
                "Password must contain uppercase, lowercase, "
                "a number and a special character."
            ),
        )

    connection = None
    cursor = None

    try:
        connection = get_connection()
        connection.start_transaction()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT verified, expires_at
            FROM password_reset_otps
            WHERE email = %s
            FOR UPDATE
            """,
            (email,),
        )
        otp_record = cursor.fetchone()

        if (
            not otp_record
            or not otp_record["verified"]
            or otp_record["expires_at"] <= datetime.now()
        ):
            raise HTTPException(
                status_code=400,
                detail="Verify a valid OTP before resetting the password.",
            )

        cursor.execute(
            """
            UPDATE users
            SET password_hash = %s
            WHERE email = %s
            """,
            (hash_password(data.new_password), email),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="User account not found.",
            )

        cursor.execute(
            "DELETE FROM password_reset_otps WHERE email = %s",
            (email,),
        )

        cursor.execute(
            """
            DELETE s FROM user_sessions s
            JOIN users u ON u.id = s.user_id
            WHERE u.email = %s
            """,
            (email,),
        )

        connection.commit()

        return {
            "message": "Password reset successful. Please log in again."
        }

    except HTTPException:
        if connection:
            connection.rollback()
        raise

    except Error as error:
        if connection:
            connection.rollback()

        print(f"Password reset database error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to reset password.",
        ) from error

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()
