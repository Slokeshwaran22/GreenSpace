
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mysql.connector import Error

from app.database import get_connection
from app.routes.register import router as register_router
from app.routes.login import router as login_router
from app.routes.password_reset import router as password_reset_router
from app.routes.projects import router as projects_router
from app.routes.admin import router as admin_router
from app.routes.messages import router as messages_router
from app.routes.user import router as user_router
from app.routes.files import router as files_router
from app.routes.profile import router as profile_router
BACKEND_DIR = Path(__file__).resolve().parents[1]

load_dotenv(BACKEND_DIR / ".env")

# JWT security imports — load .env before importing security.py
from app.security import (
    create_access_token,
    decode_access_token,
    get_user_id_from_token,
)

app = FastAPI(title="GreenSpace Authentication API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "GreenSpace Authentication API is running."}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/test-db")
def test_database():
    connection = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        try:
            cursor.execute("SELECT DATABASE()")
            result = cursor.fetchone()
        finally:
            cursor.close()

        return {
            "message": "Database connection successful.",
            "database": result[0],
        }

    except Error as error:
        print(f"Database health-check error: {error}")
        raise HTTPException(
            status_code=503,
            detail="Database connection failed.",
        ) from error

    finally:
        if connection and connection.is_connected():
            connection.close()


app.include_router(register_router)
app.include_router(login_router)
app.include_router(password_reset_router)
app.include_router(projects_router)
app.include_router(admin_router)
app.include_router(messages_router)
app.include_router(user_router)
app.include_router(files_router)
app.include_router(profile_router)