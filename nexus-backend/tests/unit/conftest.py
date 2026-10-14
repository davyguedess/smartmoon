"""Conftest for unit tests."""
import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.fixture
def mock_db():
    """Mock AsyncSession for unit tests (no real DB connection)."""
    db = AsyncMock()
    db.execute = AsyncMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    return db


@pytest.fixture
def mock_user():
    user = MagicMock()
    user.id = 1
    user.company_id = 1
    user.email = "test@nexus.ia"
    user.role = "admin"
    user.is_active = True
    return user
