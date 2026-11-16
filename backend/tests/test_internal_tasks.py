from fastapi.testclient import TestClient

from app.config import settings


def test_internal_tick_requires_secret(client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "test-cron-secret")

    rejected = client.get("/api/internal/tick")
    assert rejected.status_code == 401

    accepted = client.get(
        "/api/internal/tick",
        headers={"Authorization": "Bearer test-cron-secret"},
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["ok"] is True
    assert isinstance(accepted.json()["stats"], dict)

    bootstrap = client.post(
        "/api/internal/bootstrap",
        headers={"Authorization": "Bearer test-cron-secret"},
    )
    assert bootstrap.status_code == 200
    assert bootstrap.json()["ok"] is True


def test_health_reports_database(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["database"] == "ok"
    assert response.json()["whatsapp"] in {"mock", "cloud"}
