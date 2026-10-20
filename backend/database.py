import os
import mysql.connector
from mysql.connector import Error


def get_connection():
    try:
        connection = mysql.connector.connect(
            host="127.0.0.1",
            port=3306,
            user="root",
            password=os.getenv("DB_PASSWORD"),
            database="greenspace_auth",
        )

        print("MySQL connected successfully!")
        return connection

    except Error as error:
        print(f"MySQL connection failed: {error}")
        raise
