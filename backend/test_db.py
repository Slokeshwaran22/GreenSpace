
from pathlib import Path

from dotenv import load_dotenv
from app.database import get_connection

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")


def test_database():
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute("SELECT DATABASE()")
        result = cursor.fetchone()

        print("Database connected successfully!")
        print("Current database:", result[0])

    except Exception as error:
        print("Database connection failed:", error)

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


if __name__ == "__main__":
    test_database()
