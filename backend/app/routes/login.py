import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, Response
from mysql.connector import Error

from app.database import get_connection
from app.schemas import LoginRequest, VerifyOTPRequest
from app.security import (
    normalize_email,
    is_valid_gmail,
    verify_password,
    create_access_token,
    decode_access_token,
)
from app.services.email_service import send_login_otp_email

router = APIRouter()

COOKIE_NAME = "greenspace_session"

NORMAL_SESSION_MINUTES = 30
REMEMBER_ME_DAYS = 30

OTP_EXPIRY_MINUTES = 10
OTP_MAX_ATTEMPTS = 5


def hash_token(token: str) -> str:
    """Hash a JWT before storing it in the database."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_otp(otp: str) -> str:
    """Hash an OTP before storing it in the database."""
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


def set_login_cookie(
    response: Response,
    jwt_token: str,
    remember: bool,
) -> None:
    """Set the authentication cookie after successful login."""
    if remember:
        cookie_max_age = REMEMBER_ME_DAYS * 24 * 60 * 60
    else:
        cookie_max_age = NORMAL_SESSION_MINUTES * 60

    response.set_cookie(
        key=COOKIE_NAME,
        value=jwt_token,
        httponly=True,
        secure=False,  # Local HTTP development only
        samesite="lax",
        path="/",
        max_age=cookie_max_age,
    )


def create_login_session(
    cursor,
    user_id: int,
    remember: bool,
) -> str:
    """Create a JWT and insert its hashed session into the database."""
    if remember:
        session_duration = timedelta(days=REMEMBER_ME_DAYS)
    else:
        session_duration = timedelta(minutes=NORMAL_SESSION_MINUTES)

    jwt_token = create_access_token(
        user_id=str(user_id),
        remember_me=remember,
    )

    token_hash = hash_token(jwt_token)
    expires_at = datetime.now() + session_duration

    cursor.execute(
        """
        INSERT INTO user_sessions (user_id, token_hash, expires_at)
        VALUES (%s, %s, %s)
        """,
        (user_id, token_hash, expires_at),
    )

    return jwt_token


def public_user(user: dict) -> dict:
    """Return safe user information without the password hash."""
    return {
        "id": user["id"],
        "username": user["name"],
        "phone": user["phone"],
        "email": user["email"],
        "role": user.get("role", "user"),
    }


@router.post("/login")
def login(data: LoginRequest, response: Response):
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
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT id, name, phone, email, password_hash, role
            FROM users
            WHERE email = %s
            """,
            (email,),
        )
        user = cursor.fetchone()

        if not user or not verify_password(
            data.password,
            user["password_hash"],
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password.",
            )

        # Remember Me checked: login directly without OTP.
        if data.remember_me:
            jwt_token = create_login_session(
                cursor,
                user["id"],
                remember=True,
            )
            connection.commit()

            set_login_cookie(
                response,
                jwt_token,
                remember=True,
            )

            return {
                "message": "Login successful.",
                "user": public_user(user),
            }

        # Remember Me unchecked: send a login OTP.
        # Do not create a JWT session or authentication cookie here.
        otp = f"{secrets.randbelow(1_000_000):06d}"
        otp_digest = hash_otp(otp)

        cursor.execute(
            """
            INSERT INTO login_otps
                (email, otp_hash, expires_at, attempts, created_at)
            VALUES
                (
                    %s,
                    %s,
                    DATE_ADD(NOW(), INTERVAL %s MINUTE),
                    0,
                    NOW()
                )
            ON DUPLICATE KEY UPDATE
                otp_hash = VALUES(otp_hash),
                expires_at = VALUES(expires_at),
                attempts = 0,
                created_at = NOW()
            """,
            (email, otp_digest, OTP_EXPIRY_MINUTES),
        )

        connection.commit()
        otp_created = True

        # Close the database connection before sending email.
        cursor.close()
        cursor = None

        connection.close()
        connection = None

        send_login_otp_email(email, otp)

        return {
            "message": (
                "Login OTP sent to your registered Gmail. "
                "Verify the OTP to complete login."
            ),
            "otp_required": True,
            "email": email,
        }

    except HTTPException:
        raise

    except Error as error:
        if connection:
            connection.rollback()

        print(f"Login database error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Unable to log in.",
        ) from error

    except Exception as error:
        print(f"Login OTP email error: {error}")

        # Remove the pending OTP if sending the email failed.
        if otp_created:
            cleanup_connection = None
            cleanup_cursor = None

            try:
                cleanup_connection = get_connection()
                cleanup_cursor = cleanup_connection.cursor()

                cleanup_cursor.execute(
                    "DELETE FROM login_otps WHERE email = %s",
                    (email,),
                )
                cleanup_connection.commit()

            except Error as cleanup_error:
                if cleanup_connection:
                    cleanup_connection.rollback()

                print(f"Login OTP cleanup error: {cleanup_error}")

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
            detail="Unable to send login OTP. Check SMTP configuration.",
        ) from error

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


@router.post("/login/verify-otp")
def verify_login_otp(
    data: VerifyOTPRequest,
    response: Response,
):
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
        connection.start_transaction()
        cursor = connection.cursor(dictionary=True)

        # Lock the OTP row so concurrent verification requests
        # cannot successfully consume the same OTP.
        cursor.execute(
            """
            SELECT otp_hash, expires_at, attempts
            FROM login_otps
            WHERE email = %s
            FOR UPDATE
            """,
            (email,),
        )
        otp_record = cursor.fetchone()

        if not otp_record:
            raise HTTPException(
                status_code=400,
                detail="Login OTP not found. Please log in again.",
            )

        if otp_record["expires_at"] <= datetime.now():
            cursor.execute(
                "DELETE FROM login_otps WHERE email = %s",
                (email,),
            )
            connection.commit()

            raise HTTPException(
                status_code=400,
                detail="Login OTP expired. Please log in again.",
            )

        if otp_record["attempts"] >= OTP_MAX_ATTEMPTS:
            cursor.execute(
                "DELETE FROM login_otps WHERE email = %s",
                (email,),
            )
            connection.commit()

            raise HTTPException(
                status_code=429,
                detail="Too many attempts. Please log in again.",
            )

        submitted_hash = hash_otp(data.otp)

        if not hmac.compare_digest(
            submitted_hash,
            otp_record["otp_hash"],
        ):
            cursor.execute(
                """
                UPDATE login_otps
                SET attempts = attempts + 1
                WHERE email = %s
                """,
                (email,),
            )
            connection.commit()

            raise HTTPException(
                status_code=400,
                detail="Incorrect login OTP.",
            )

        # The OTP is correct. Fetch the current user record.
        cursor.execute(
            """
            SELECT id, name, phone, email, role
            FROM users
            WHERE email = %s
            """,
            (email,),
        )
        user = cursor.fetchone()

        if not user:
            cursor.execute(
                "DELETE FROM login_otps WHERE email = %s",
                (email,),
            )
            connection.commit()

            raise HTTPException(
                status_code=401,
                detail="Account not found. Please register again.",
            )

        # Consume the OTP and create the normal 30-minute session
        # in the same database transaction.
        cursor.execute(
            "DELETE FROM login_otps WHERE email = %s",
            (email,),
        )

        jwt_token = create_login_session(
            cursor,
            user["id"],
            remember=False,
        )

        connection.commit()

        set_login_cookie(
            response,
            jwt_token,
            remember=False,
        )

        return {
            "message": "OTP verified. Login successful.",
            "user": public_user(user),
        }

    except HTTPException:
        if connection and connection.is_connected():
            connection.rollback()

        raise

    except Error as error:
        if connection and connection.is_connected():
            connection.rollback()

        print(f"Login OTP verification database error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Unable to verify login OTP.",
        ) from error

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


@router.get("/me")
def get_current_user(request: Request):
    jwt_token = request.cookies.get(COOKIE_NAME)

    if not jwt_token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated.",
        )

    payload = decode_access_token(jwt_token)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Session expired or invalid.",
        )

    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token.",
        )

    token_hash = hash_token(jwt_token)

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT u.id, u.name, u.phone, u.email, u.role
            FROM users u
            JOIN user_sessions s ON s.user_id = u.id
            WHERE s.token_hash = %s
              AND s.user_id = %s
              AND s.expires_at > NOW()
            """,
            (token_hash, user_id),
        )

        user = cursor.fetchone()
      

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Session expired or invalid.",
            )

        

        return {"user": public_user(user)}

    except HTTPException:
        raise

    except Error as error:
        print(f"Current user database error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve user.",
        ) from error

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


@router.post("/logout")
def logout(request: Request, response: Response):
    jwt_token = request.cookies.get(COOKIE_NAME)

    connection = None
    cursor = None

    try:
        if jwt_token:
            token_hash = hash_token(jwt_token)

            connection = get_connection()
            cursor = connection.cursor()

            cursor.execute(
                "DELETE FROM user_sessions WHERE token_hash = %s",
                (token_hash,),
            )
            connection.commit()

        response.delete_cookie(
            key=COOKIE_NAME,
            path="/",
            httponly=True,
            secure=False,  # Must match the cookie configuration
            samesite="lax",
        )

        return {"message": "Logout successful."}

    except Error as error:
        if connection:
            connection.rollback()

        print(f"Logout database error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Unable to log out.",
        ) from error

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()