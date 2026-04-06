"""
Basic API tests for CI pipeline.
Run with: pytest tests/ -v
"""

import os
import sys
import pytest

# Ensure backend directory is in path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_imports():
    """Verify all core modules can be imported without errors."""
    from auth import verify_password, get_password_hash, create_access_token
    from models import User, ChatSession, Base


def test_password_hashing():
    """Verify password hashing and verification works."""
    from auth import verify_password, get_password_hash

    password = "test_password_123"
    hashed = get_password_hash(password)

    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong_password", hashed) is False


def test_jwt_token_creation():
    """Verify JWT token creation."""
    from auth import create_access_token
    from jose import jwt, JWTError

    token = create_access_token(data={"sub": "test@example.com"})
    assert token is not None
    assert isinstance(token, str)
    assert len(token) > 0

    # Decode and verify
    secret = os.environ.get("JWT_SECRET", "super-secret-key-pour-ce-tp-1234")
    payload = jwt.decode(token, secret, algorithms=["HS256"])
    assert payload["sub"] == "test@example.com"
    assert "exp" in payload


def test_rag_chunking():
    """Verify text chunking logic."""
    from rag import chunk_text

    text = "Lorem ipsum dolor sit amet. " * 100  # ~2800 chars
    chunks = chunk_text(text, chunk_size=800, overlap=100)

    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) <= 900  # chunk_size + tolerance
        assert len(chunk) > 50


def test_database_url_construction():
    """Verify database URL is built from env vars."""
    from models import SQLALCHEMY_DATABASE_URL

    assert "postgresql://" in SQLALCHEMY_DATABASE_URL
    assert "@" in SQLALCHEMY_DATABASE_URL


def test_fastapi_app_creation():
    """Verify FastAPI app can be created."""
    # This tests that main.py can be imported (app initialization)
    # In CI, the DB must be available for init_db() to succeed
    db_host = os.environ.get("DB_HOST", "localhost")
    db_port = os.environ.get("DB_PORT", "5432")

    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    db_reachable = sock.connect_ex((db_host, int(db_port))) == 0
    sock.close()

    if db_reachable:
        from main import app
        assert app.title == "LexBot MA - Backend V2"
    else:
        pytest.skip("Database not reachable — skipping app creation test")
