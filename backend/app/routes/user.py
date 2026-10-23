
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user

router = APIRouter(prefix="/user", tags=["User"])


@router.get("/dashboard")
def get_user_dashboard(
    current_user: dict[str, Any] = Depends(get_current_user),
):
    """
    Return dashboard information for the logged-in normal user.
    """

    # Only normal users can access this endpoint.
    if current_user.get("role", "user") != "user":
        raise HTTPException(
            status_code=403,
            detail="This endpoint is only for normal users",
        )

    return {
        "message": "User dashboard data retrieved successfully",
        "user": {
            "id": current_user["id"],
            "username": current_user.get("name"),
            "email": current_user.get("email"),
            "phone": current_user.get("phone"),
            "role": current_user.get("role", "user"),
        },
    }
