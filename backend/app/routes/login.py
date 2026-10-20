
import hashlib
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, Response
from mysql.connector import Error

from app.database import get_connection
from app.schemas import LoginRequest
from app.security import (
    normalize_email,
    is_valid_gmail,
    verify_password,
    create_access_token,
    decode_access_token,
)

router = APIRouter()

COOKIE_NAME = "greenspace_session"

NORMAL_SESSION_MINUTES = 30
REMEMBER_ME_DAYS = 30


def hash_token(token: str) -> str:
    """Hash a token before storing it in the database."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@router.post("/login")
def login(data: LoginRequest, response: Response):
    email = normalize_email(data.email)

    if not is_valid_gmail(email):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid Gmail address.",
        )

    remember = bool(data.remember_me)

    if remember:
        session_duration = timedelta(days=REMEMBER_ME_DAYS)
        cookie_max_age = REMEMBER_ME_DAYS * 24 * 60 * 60
    else:
        session_duration = timedelta(minutes=NORMAL_SESSION_MINUTES)
        cookie_max_age = NORMAL_SESSION_MINUTES * 60

    connection = None
    cursor = None

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

        # Create a JWT for this authenticated user.
        jwt_token = create_access_token(
            user_id=str(user["id"]),
            remember_me=remember,
        )

        # Store only the hash of the JWT in the database.
        token_hash = hash_token(jwt_token)
        expires_at = datetime.now() + session_duration

        cursor.execute(
            """
            INSERT INTO user_sessions (user_id, token_hash, expires_at)
            VALUES (%s, %s, %s)
            """,
            (user["id"], token_hash, expires_at),
        )
        connection.commit()

        # Send the JWT in an HttpOnly cookie.
        response.set_cookie(
            key=COOKIE_NAME,
            value=jwt_token,
            httponly=True,
            secure=False,  # Local HTTP development only
            samesite="lax",
            path="/",
            max_age=cookie_max_age,
        )

        return {
            "message": "Login successful.",
            "user": {
                "id": user["id"],
                "username": user["name"],
                "phone": user["phone"],
                "email": user["email"],
                "role": user.get("role", "user"),
            },
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

    # Validate the JWT signature and expiration.
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

        # Check both the JWT's validity and the server-side session.
        # This allows logout to invalidate the session immediately.
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

        return {
            "user": {
                "id": user["id"],
                "username": user["name"],
                "phone": user["phone"],
                "email": user["email"],
                "role": user.get("role", "user"),
            }
        }

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
