import os
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv
from mysql.connector import Error

# Load .env from the backend folder
BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")


def get_connection():
    """Create and return a MySQL database connection."""
    try:
        connection = mysql.connector.connect(
            host=os.getenv("DB_HOST", "127.0.0.1"),
            port=int(os.getenv("DB_PORT", "3306")),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME", "greenspace_auth"),
        )
        return connection

    except Error as error:
        print(f"MySQL connection failed: {error}")
        raise
