from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from mysql.connector import Error

from app.database import get_connection
from app.dependencies import get_current_user


router = APIRouter(prefix="/profile", tags=["Profile"])


class UpdateProfileRequest(BaseModel):
    name: str = Field(min_length=3, max_length=100)
    phone: str = Field(pattern=r"^[0-9]{10}$")


@router.get("/me")
def get_my_profile(
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Get the currently logged-in user's profile."""

    return {
        "id": current_user["id"],
        "name": current_user["name"],
        "phone": current_user["phone"],
        "email": current_user["email"],
        "role": current_user["role"],
    }


@router.put("/me")
def update_my_profile(
    profile: UpdateProfileRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """Update only the logged-in user's name and phone."""

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            UPDATE users
            SET name = %s, phone = %s
            WHERE id = %s
            """,
            (
                profile.name.strip(),
                profile.phone,
                current_user["id"],
            ),
        )

        connection.commit()

        return {
            "message": "Profile updated successfully.",
            "name": profile.name.strip(),
            "phone": profile.phone,
        }

    except Error as error:
        if connection:
            connection.rollback()

        print(f"Profile update database error: {error}")

        raise HTTPException(
            status_code=503,
            detail="Unable to update profile right now.",
        ) from error

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()