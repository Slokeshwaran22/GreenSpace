import hashlib
from typing import Any

from fastapi import Depends, HTTPException, Request
from mysql.connector import Error

from app.database import get_connection
from app.security import decode_access_token


COOKIE_NAME = "greenspace_session"


def get_current_user(request: Request) -> dict[str, Any]:
    """
    Authenticate the current request using the existing JWT cookie
    and its matching MySQL session.
    """

    # 1. Read the JWT from the HttpOnly cookie.
    token = request.cookies.get(COOKIE_NAME)

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please log in.",
        )

    # 2. Validate JWT signature, expiry and claims.
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token.",
        )

    try:
        token_user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token.",
        )

    # 3. Hash the token to match the value stored in MySQL.
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        # 4. Validate the session and ensure it belongs to this user.
        cursor.execute(
            """
            SELECT
                u.id,
                u.name,
                u.phone,
                u.email,
                u.role
            FROM users AS u
            INNER JOIN user_sessions AS s
                ON s.user_id = u.id
            WHERE s.token_hash = %s
              AND s.user_id = %s
              AND s.expires_at > NOW()
            LIMIT 1
            """,
            (token_hash, token_user_id),
        )

        user = cursor.fetchone()

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Session is invalid or expired. Please log in again.",
            )

        # Normalize role values before checking permissions.
        user["role"] = str(user["role"]).strip().lower()

        return user

    except HTTPException:
        raise

    except Error as error:
        print(f"Authentication database error: {error}")

        raise HTTPException(
            status_code=503,
            detail="Authentication service is temporarily unavailable.",
        ) from error

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


def require_admin(
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Allow access only to authenticated users with the admin role.
    """

    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin permission is required.",
        )

    return current_user
