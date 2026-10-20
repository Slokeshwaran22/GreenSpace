
from fastapi import APIRouter, HTTPException
from mysql.connector import IntegrityError, Error

from app.database import get_connection
from app.schemas import RegisterRequest
from app.security import (
    normalize_email,
    is_valid_gmail,
    validate_password,
    hash_password,
)

router = APIRouter()


@router.post("/register")
def register_user(data: RegisterRequest):
    username = data.username.strip()
    phone = data.phone.strip()
    email = normalize_email(data.email)
    password = data.password

    if not username or not username.replace(" ", "").isalpha():
        raise HTTPException(
            status_code=400,
            detail="Username must contain only letters and spaces.",
        )

    if not phone.isdigit() or len(phone) != 10:
        raise HTTPException(
            status_code=400,
            detail="Phone number must contain exactly 10 digits.",
        )

    if not is_valid_gmail(email):
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid Gmail address.",
        )

    if not validate_password(password):
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
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO users (name, phone, email, password_hash)
            VALUES (%s, %s, %s, %s)
            """,
            (username, phone, email, hash_password(password)),
        )

        user_id = cursor.lastrowid
        connection.commit()

        return {
            "message": "Registration successful.",
            "user": {
                "id": user_id,
                "username": username,
                "phone": phone,
                "email": email,
            },
        }

    except IntegrityError as error:
        if connection:
            connection.rollback()

        if error.errno == 1062:
            raise HTTPException(
                status_code=409,
                detail="Email or phone number already exists.",
            ) from error

        raise HTTPException(
            status_code=500,
            detail="Database integrity error.",
        ) from error

    except Error as error:
        if connection:
            connection.rollback()

        print(f"Registration database error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to register user.",
        ) from error

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()
