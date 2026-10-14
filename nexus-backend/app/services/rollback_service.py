import subprocess
from typing import Optional

class RollbackService:
    """Utility to rollback database migrations and redeploy previous Docker image.
    Uses Alembic for DB migrations and Docker CLI for image tag management.
    """

    @staticmethod
    def rollback_db(target_revision: str = "-1") -> None:
        """Revert database to the given Alembic revision (default: previous)."""
        subprocess.run(["alembic", "downgrade", target_revision], check=True)

    @staticmethod
    def redeploy_previous_image(previous_tag: str) -> None:
        """Pull and run the previous Docker image tag.
        Assumes the image is hosted in a registry accessible to the host.
        """
        subprocess.run(["docker", "pull", f"nexus-backend:{previous_tag}"], check=True)
        subprocess.run(["docker", "run", "-d", "--name", "nexus-backend-rollback", f"nexus-backend:{previous_tag}"], check=True)

    @staticmethod
    def full_rollback(db_revision: str = "-1", image_tag: str = "latest") -> None:
        """Perform full rollback: DB and container.
        This is a convenience wrapper; in production you would orchestrate via CI/CD.
        """
        RollbackService.rollback_db(db_revision)
        RollbackService.redeploy_previous_image(image_tag)
