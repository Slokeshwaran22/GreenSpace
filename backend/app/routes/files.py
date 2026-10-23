
import hashlib
import os
import re
import uuid
from datetime import date
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from mysql.connector import Error

from app.database import get_connection
from app.security import decode_access_token

router = APIRouter(prefix="/files", tags=["File Management"])

BACKEND_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BACKEND_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

COOKIE_NAME = "greenspace_session"
MAX_FILE_SIZE = 10 * 1024 * 1024

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".xlsx"}

CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_current_user(request: Request) -> dict:
    """Authenticate the request using the existing session cookie."""
    token = request.cookies.get(COOKIE_NAME)

    if not token:
        raise HTTPException(status_code=401, detail="Please log in first.")

    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (ValueError, TypeError, KeyError, Exception) as exc:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session. Please log in again.",
        ) from exc

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT u.id, u.name, u.email, u.role
            FROM users u
            JOIN user_sessions s ON s.user_id = u.id
            WHERE s.token_hash = %s
              AND s.user_id = %s
              AND s.expires_at > NOW()
            """,
            (hash_token(token), user_id),
        )

        user = cursor.fetchone()

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Your session is invalid or expired.",
            )

        return user

    except HTTPException:
        raise
    except Error as exc:
        print(f"Authentication database error: {exc}")
        raise HTTPException(
            status_code=503,
            detail="Unable to verify your session.",
        ) from exc
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def get_file_record(file_id: int) -> dict:
    """Retrieve a file and its uploader details."""
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                uf.id,
                uf.original_filename,
                uf.stored_filename,
                uf.file_path,
                uf.file_type,
                uf.file_size,
                uf.uploaded_by,
                uf.uploaded_at,
                u.name AS uploader_name,
                u.email AS uploader_email
            FROM uploaded_files uf
            JOIN users u ON u.id = uf.uploaded_by
            WHERE uf.id = %s
            """,
            (file_id,),
        )

        record = cursor.fetchone()

        if not record:
            raise HTTPException(status_code=404, detail="File not found.")

        return record

    except HTTPException:
        raise
    except Error as exc:
        print(f"File lookup database error: {exc}")
        raise HTTPException(
            status_code=503,
            detail="Unable to retrieve file information.",
        ) from exc
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def get_safe_file_path(record: dict) -> Path:
    """Prevent access to paths outside the uploads directory."""
    try:
        upload_root = UPLOAD_DIR.resolve()
        file_path = Path(record["file_path"]).resolve()
        file_path.relative_to(upload_root)
    except (ValueError, OSError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid file path.")

    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Stored file not found.")

    return file_path


def validate_file_signature(extension: str, content: bytes) -> bool:
    """Check that the uploaded file starts with the expected signature."""
    if extension == ".pdf":
        return content.startswith(b"%PDF-")

    if extension == ".png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")

    if extension in {".jpg", ".jpeg"}:
        return content.startswith(b"\xff\xd8\xff")

    if extension == ".xlsx":
        return content.startswith(b"PK")

    return False


def clean_filename(filename: str) -> str:
    """Keep a readable filename without accepting a supplied path."""
    name = Path(filename.replace("\\", "/")).name
    name = re.sub(r"[\x00-\x1f\x7f]", "", name).strip()

    if not name or name in {".", ".."}:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    return name


@router.post("/upload")
async def upload_file(request: Request, file: UploadFile = File(...)):
    user = get_current_user(request)

    if not file.filename:
        raise HTTPException(status_code=400, detail="Choose a file to upload.")

    original_filename = clean_filename(file.filename)
    extension = Path(original_filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Allowed formats: PDF, PNG, JPG, JPEG and XLSX.",
        )

    stored_filename = f"{uuid.uuid4().hex}{extension}"
    destination = UPLOAD_DIR / stored_filename
    total_size = 0
    first_chunk = b""

    connection = None
    cursor = None

    try:
        with destination.open("wb") as output:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                if not first_chunk:
                    first_chunk = chunk

                total_size += len(chunk)

                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="The maximum file size is 10 MB.",
                    )

                output.write(chunk)

        if total_size == 0:
            raise HTTPException(status_code=400, detail="The file is empty.")

        if not validate_file_signature(extension, first_chunk):
            raise HTTPException(
                status_code=400,
                detail="The file content does not match its extension.",
            )

        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO uploaded_files
                (original_filename, stored_filename, file_path,
                 file_type, file_size, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                original_filename,
                stored_filename,
                str(destination.resolve()),
                extension.lstrip("."),
                total_size,
                user["id"],
            ),
        )

        file_id = cursor.lastrowid
        connection.commit()

        return {
            "message": "File uploaded successfully.",
            "file": {
                "id": file_id,
                "filename": original_filename,
                "file_type": extension.lstrip("."),
                "file_size": total_size,
                "uploaded_by": user["id"],
                "uploader_name": user["name"],
                "uploader_email": user["email"],
            },
        }

    except HTTPException:
        if destination.exists():
            destination.unlink()
        raise
    except Error as exc:
        if connection:
            connection.rollback()
        if destination.exists():
            destination.unlink()
        print(f"File upload database error: {exc}")
        raise HTTPException(
            status_code=503,
            detail="Unable to save the file information.",
        ) from exc
    except OSError as exc:
        if destination.exists():
            destination.unlink()
        print(f"File storage error: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Unable to store the uploaded file.",
        ) from exc
    finally:
        await file.close()
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@router.get("")
def list_files(
    request: Request,
    search: str | None = Query(default=None, max_length=255),
    uploader: str | None = Query(default=None, max_length=255),
    file_type: str | None = Query(default=None, max_length=20),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
):
    """All authenticated users can search and list all uploaded files."""
    get_current_user(request)

    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=400,
            detail="The start date must not be after the end date.",
        )

    conditions = []
    params = []

    if search and search.strip():
        term = f"%{search.strip()}%"
        conditions.append(
            "(uf.original_filename LIKE %s "
            "OR u.name LIKE %s OR u.email LIKE %s)"
        )
        params.extend([term, term, term])

    if uploader and uploader.strip():
        term = f"%{uploader.strip()}%"
        conditions.append("(u.name LIKE %s OR u.email LIKE %s)")
        params.extend([term, term])

    if file_type and file_type.strip():
        conditions.append("LOWER(uf.file_type) = %s")
        params.append(file_type.strip().lower().lstrip("."))

    if date_from:
        conditions.append("uf.uploaded_at >= %s")
        params.append(date_from.isoformat() + " 00:00:00")

    if date_to:
        conditions.append(
            "uf.uploaded_at < DATE_ADD(%s, INTERVAL 1 DAY)"
        )
        params.append(date_to.isoformat())

    sql = """
        SELECT
            uf.id,
            uf.original_filename AS filename,
            uf.file_type,
            uf.file_size,
            uf.uploaded_by,
            uf.uploaded_at,
            u.name AS uploader_name,
            u.email AS uploader_email
        FROM uploaded_files uf
        JOIN users u ON u.id = uf.uploaded_by
    """

    if conditions:
        sql += " WHERE " + " AND ".join(conditions)

    sql += " ORDER BY uf.uploaded_at DESC"

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(sql, tuple(params))
        records = cursor.fetchall()

        return {"files": records}

    except Error as exc:
        print(f"File list database error: {exc}")
        raise HTTPException(
            status_code=503,
            detail="Unable to list files.",
        ) from exc
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@router.get("/{file_id}/view")
def view_file(file_id: int, request: Request):
    """View supported images and PDFs in the browser."""
    get_current_user(request)
    record = get_file_record(file_id)
    path = get_safe_file_path(record)

    extension = path.suffix.lower()

    if extension not in {".pdf", ".png", ".jpg", ".jpeg"}:
        raise HTTPException(
            status_code=415,
            detail="Preview is available only for PDF and image files.",
        )

    filename = clean_filename(record["original_filename"])

    return FileResponse(
        path=str(path),
        media_type=CONTENT_TYPES[extension],
        filename=filename,
        content_disposition_type="inline",
    )


@router.get("/{file_id}/download")
def download_file(file_id: int, request: Request):
    """All authenticated users can download any uploaded file."""
    get_current_user(request)
    record = get_file_record(file_id)
    path = get_safe_file_path(record)

    return FileResponse(
        path=str(path),
        media_type="application/octet-stream",
        filename=clean_filename(record["original_filename"]),
        content_disposition_type="attachment",
    )


@router.delete("/{file_id}")
def delete_file(file_id: int, request: Request):
    """Owners can delete their files; admins can delete any file."""
    user = get_current_user(request)
    record = get_file_record(file_id)

    is_owner = int(record["uploaded_by"]) == int(user["id"])
    is_admin = str(user["role"]).lower() == "admin"

    if not is_owner and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="You can delete only your own files.",
        )

    path = get_safe_file_path(record)

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        # Repeat the permission check in the DELETE query.
        if is_admin:
            cursor.execute(
                "DELETE FROM uploaded_files WHERE id = %s",
                (file_id,),
            )
        else:
            cursor.execute(
                """
                DELETE FROM uploaded_files
                WHERE id = %s AND uploaded_by = %s
                """,
                (file_id, user["id"]),
            )

        if cursor.rowcount == 0:
            connection.rollback()
            raise HTTPException(
                status_code=404,
                detail="File not found or permission denied.",
            )

        connection.commit()

    except HTTPException:
        raise
    except Error as exc:
        if connection:
            connection.rollback()
        print(f"File deletion database error: {exc}")
        raise HTTPException(
            status_code=503,
            detail="Unable to delete the file record.",
        ) from exc
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()

    try:
        if path.exists():
            path.unlink()
    except OSError as exc:
        # The database record is already deleted.
        print(f"File cleanup error for {path}: {exc}")
        raise HTTPException(
            status_code=500,
            detail="The file record was deleted, but the stored file needs cleanup.",
        ) from exc

    return {"message": "File deleted successfully.", "id": file_id}
