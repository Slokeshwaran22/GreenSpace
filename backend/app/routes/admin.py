
from fastapi import APIRouter, Depends, HTTPException
from mysql.connector import Error

from app.database import get_connection
from app.dependencies import require_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/dashboard")
def admin_dashboard(
    admin: dict = Depends(require_admin),
):
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        # Count all registered accounts.
        cursor.execute("SELECT COUNT(*) AS total FROM users")
        total_users = cursor.fetchone()["total"]

        # Count unique users with unexpired sessions.
        cursor.execute("""
            SELECT COUNT(DISTINCT user_id) AS total
            FROM user_sessions
            WHERE expires_at > NOW()
        """)
        active_users = cursor.fetchone()["total"]

        # Retrieve registered user details.
        cursor.execute("""
            SELECT id, name, email, phone, role
            FROM users
            ORDER BY id DESC
        """)
        users = cursor.fetchall()

        return {
            "total_registered_users": total_users,
            "currently_logged_in": active_users,
            "users": users,
        }

    except Error as error:
        print(f"Admin dashboard error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to load admin dashboard.",
        ) from error

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()
