from __future__ import annotations

import os

os.environ["BELLESSA_SEED_DEMO"] = "false"
# Credenciales exclusivas de la suite: nunca coinciden con producción.
os.environ["BELLESSA_PLATFORM_ADMIN_EMAIL"] = "admin@test.invalid"
os.environ["BELLESSA_PLATFORM_ADMIN_PASSWORD"] = "test-only-admin-pass"
os.environ["BELLESSA_DATABASE_URL"] = "sqlite:///./test-bootstrap.db"
os.environ["BELLESSA_JWT_SECRET"] = "test-secret"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.seed import seed_demo, seed_platform

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


@pytest.fixture()
def db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    seed_demo(session)
    seed_platform(session)
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        test_client.close()
        app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "demo@bellessa.mx", "password": "demo1234"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
