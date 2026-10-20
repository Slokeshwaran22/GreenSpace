
from fastapi import APIRouter, Depends, HTTPException
from mysql.connector import Error
from pydantic import BaseModel, Field

from app.database import get_connection
from app.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/projects", tags=["Projects"])


class ProjectInput(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str = Field(default="", max_length=5000)
    location: str = Field(default="", max_length=200)


@router.get("")
def list_projects(
    current_user: dict = Depends(get_current_user),
):
    # Any authenticated user can view projects.
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT id, name, description, location, created_by, created_at
            FROM projects
            ORDER BY id DESC
            """
        )

        return {"projects": cursor.fetchall()}

    except Error as error:
        print(f"List projects error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to load projects.",
        ) from error

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@router.post("")
def create_project(
    data: ProjectInput,
    admin: dict = Depends(require_admin),
):
    # Only admins can create projects.
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO projects (name, description, location, created_by)
            VALUES (%s, %s, %s, %s)
            """,
            (
                data.name.strip(),
                data.description.strip(),
                data.location.strip(),
                admin["id"],
            ),
        )

        connection.commit()

        return {
            "message": "Project created successfully.",
            "id": cursor.lastrowid,
        }

    except Error as error:
        if connection:
            connection.rollback()

        print(f"Create project error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to create project.",
        ) from error

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@router.put("/{project_id}")
def update_project(
    project_id: int,
    data: ProjectInput,
    admin: dict = Depends(require_admin),
):
    # Only admins can update projects.
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            UPDATE projects
            SET name = %s, description = %s, location = %s
            WHERE id = %s
            """,
            (
                data.name.strip(),
                data.description.strip(),
                data.location.strip(),
                project_id,
            ),
        )

        connection.commit()

        if cursor.rowcount == 0:
            check = connection.cursor()
            try:
                check.execute(
                    "SELECT id FROM projects WHERE id = %s",
                    (project_id,),
                )
                exists = check.fetchone()
            finally:
                check.close()

            if not exists:
                raise HTTPException(
                    status_code=404,
                    detail="Project not found.",
                )

        return {"message": "Project updated successfully."}

    except HTTPException:
        raise

    except Error as error:
        if connection:
            connection.rollback()

        print(f"Update project error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to update project.",
        ) from error

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    admin: dict = Depends(require_admin),
):
    # Only admins can delete projects.
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            "DELETE FROM projects WHERE id = %s",
            (project_id,),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Project not found.",
            )

        connection.commit()

        return {"message": "Project deleted successfully."}

    except HTTPException:
        raise

    except Error as error:
        if connection:
            connection.rollback()

        print(f"Delete project error: {error}")
        raise HTTPException(
            status_code=500,
            detail="Unable to delete project.",
        ) from error

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()
