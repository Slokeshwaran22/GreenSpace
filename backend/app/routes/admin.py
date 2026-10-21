from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from mysql.connector import Error

from app.database import get_connection
from app.dependencies import require_admin


router = APIRouter(prefix="/admin", tags=["Admin"])


# Request model for sending a message.
class SendMessageRequest(BaseModel):
    recipient_id: Optional[int] = Field(default=None, gt=0)
    message_type: Literal["announcement", "general"] = "general"
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=10000)


@router.get("/admindashboard")
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



@router.get("/messages")
def get_admin_messages(
    admin: dict = Depends(require_admin),
):
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                m.id,
                m.sender_id,
                m.recipient_id,
                m.message_type,
                m.title,
                m.body,
                COUNT(DISTINCT mr.user_id) AS recipient_count,
                GROUP_CONCAT(
                    DISTINCT u.name
                    ORDER BY u.name
                    SEPARATOR ', '
                ) AS recipient_names
            FROM messages m
            LEFT JOIN message_recipients mr
                ON mr.message_id = m.id
            LEFT JOIN users u
                ON u.id = mr.user_id
            WHERE m.sender_id = %s
            GROUP BY
                m.id,
                m.sender_id,
                m.recipient_id,
                m.message_type,
                m.title,
                m.body
            ORDER BY m.id DESC
            LIMIT 50
        """, (admin["id"],))

        messages = cursor.fetchall()

        return {"messages": messages}

    except Error as error:
        print(f"Admin messages error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to load sent messages.",
        ) from error

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


@router.post("/messages")
def send_message(
    message: SendMessageRequest,
    admin: dict = Depends(require_admin),
):
    connection = None
    cursor = None

    # Remove accidental leading/trailing whitespace.
    title = message.title.strip()
    body = message.body.strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Message title cannot be empty.",
        )

    if not body:
        raise HTTPException(
            status_code=400,
            detail="Message body cannot be empty.",
        )

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        # Determine recipients.
        if message.recipient_id is None:
            # NULL recipient_id means a broadcast message.
            # Send to regular users, excluding administrators.
            cursor.execute("""
                SELECT id
                FROM users
                WHERE LOWER(TRIM(role)) = 'user'
            """)
            recipients = cursor.fetchall()

        else:
            # Check that the selected recipient exists and is a regular user.
            cursor.execute("""
                SELECT id
                FROM users
                WHERE id = %s
                  AND LOWER(TRIM(role)) = 'user'
                LIMIT 1
            """, (message.recipient_id,))

            recipient = cursor.fetchone()

            if not recipient:
                raise HTTPException(
                    status_code=404,
                    detail="Selected user was not found.",
                )

            recipients = [recipient]

        if not recipients:
            raise HTTPException(
                status_code=400,
                detail="No eligible users were found.",
            )

        # Create the message.
        cursor.execute("""
            INSERT INTO messages (
                sender_id,
                recipient_id,
                message_type,
                title,
                body
            )
            VALUES (%s, %s, %s, %s, %s)
        """, (
            admin["id"],
            message.recipient_id,
            message.message_type,
            title,
            body,
        ))

        message_id = cursor.lastrowid

        # Create an individual read-status record for each recipient.
        cursor.executemany("""
            INSERT INTO message_recipients (
                message_id,
                user_id
            )
            VALUES (%s, %s)
        """, [
            (message_id, recipient["id"])
            for recipient in recipients
        ])

        # Save the message and all recipient records together.
        connection.commit()

        return {
            "message": "Message sent successfully.",
            "message_id": message_id,
            "message_type": message.message_type,
            "recipient_count": len(recipients),
        }

    except HTTPException:
        if connection and connection.is_connected():
            connection.rollback()
        raise

    except Error as error:
        if connection and connection.is_connected():
            connection.rollback()

        print(f"Admin send message error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Unable to send message.",
        ) from error

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()



@router.get("/messages")
def get_admin_messages(
    admin: dict = Depends(require_admin),
):
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                m.id,
                m.sender_id,
                m.recipient_id,
                m.message_type,
                m.title,
                m.body,
                COUNT(DISTINCT mr.user_id) AS recipient_count,
                GROUP_CONCAT(
                    DISTINCT u.name
                    ORDER BY u.name
                    SEPARATOR ', '
                ) AS recipient_names
            FROM messages m
            LEFT JOIN message_recipients mr
                ON mr.message_id = m.id
            LEFT JOIN users u
                ON u.id = mr.user_id
            WHERE m.sender_id = %s
            GROUP BY
                m.id,
                m.sender_id,
                m.recipient_id,
                m.message_type,
                m.title,
                m.body
            ORDER BY m.id DESC
            LIMIT 50
        """, (admin["id"],))

        messages = cursor.fetchall()

        return {"messages": messages}

    except Error as error:
        print(f"Admin messages error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to load sent messages.",
        ) from error

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()
