
from fastapi import APIRouter, Depends, HTTPException
from mysql.connector import Error

from app.database import get_connection
from app.dependencies import get_current_user

router = APIRouter(prefix="/messages", tags=["Messages"])


# Get messages for the currently logged-in user
@router.get("/")
def get_my_messages(
    current_user: dict = Depends(get_current_user),
):
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                m.id,
                m.message_type,
                m.title,
                m.body,
                m.created_at,
                mr.is_read,
                mr.read_at,
                sender.name AS sender_name
            FROM message_recipients AS mr
            INNER JOIN messages AS m
                ON m.id = mr.message_id
            INNER JOIN users AS sender
                ON sender.id = m.sender_id
            WHERE mr.user_id = %s
            ORDER BY m.created_at DESC, m.id DESC
            """,
            (current_user["id"],),
        )

        messages = cursor.fetchall()

        return {
            "messages": messages,
            "total": len(messages),
            "unread_count": sum(
                1 for message in messages
                if not message["is_read"]
            ),
        }

    except Error as error:
        print(f"Get messages error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to load messages.",
        ) from error

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# Mark one message as read
@router.patch("/{message_id}/read")
def mark_message_as_read(
    message_id: int,
    current_user: dict = Depends(get_current_user),
):
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT id, is_read
            FROM message_recipients
            WHERE message_id = %s
              AND user_id = %s
            """,
            (message_id, current_user["id"]),
        )

        recipient_message = cursor.fetchone()

        # The message must belong to this logged-in user.
        if not recipient_message:
            raise HTTPException(
                status_code=404,
                detail="Message not found.",
            )

        if not recipient_message["is_read"]:
            cursor.execute(
                """
                UPDATE message_recipients
                SET is_read = 1,
                    read_at = NOW()
                WHERE message_id = %s
                  AND user_id = %s
                """,
                (message_id, current_user["id"]),
            )

            connection.commit()

        return {
            "message": "Message marked as read.",
            "message_id": message_id,
            "is_read": True,
        }

    except HTTPException:
        raise

    except Error as error:
        if connection and connection.is_connected():
            connection.rollback()

        print(f"Mark message as read error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Unable to mark message as read.",
        ) from error

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()
