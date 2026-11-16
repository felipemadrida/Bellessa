from fastapi.testclient import TestClient


def _platform_headers(client: TestClient) -> dict:
    response = client.post(
        "/api/platform/login",
        json={"email": "admin@bellessa.mx", "password": "admin1234"},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_platform_login_overview_and_tenant_management(client: TestClient, auth_headers: dict):
    platform_headers = _platform_headers(client)

    me = client.get("/api/platform/me", headers=platform_headers)
    assert me.status_code == 200
    assert me.json()["email"] == "admin@bellessa.mx"

    overview = client.get("/api/platform/overview", headers=platform_headers)
    assert overview.status_code == 200, overview.text
    body = overview.json()
    assert body["total_tenants"] == 1
    assert body["active_tenants"] == 1
    assert body["plan_counts"]["salon"] == 1
    assert body["revenue_30d_cents"] > 0

    tenants = client.get("/api/platform/tenants", headers=platform_headers)
    assert tenants.status_code == 200
    tenant = tenants.json()[0]
    assert tenant["slug"] == "salon-lucia"
    assert tenant["plan"] == "salon"
    assert tenant["owner_email"] == "demo@bellessa.mx"
    assert tenant["clients_count"] > 0

    updated = client.patch(
        f"/api/platform/tenants/{tenant['business_id']}",
        headers=platform_headers,
        json={"plan": "pro", "status": "active"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["plan"] == "pro"

    suspended = client.patch(
        f"/api/platform/tenants/{tenant['business_id']}",
        headers=platform_headers,
        json={"status": "suspended"},
    )
    assert suspended.status_code == 200
    blocked = client.get("/api/dashboard", headers=auth_headers)
    assert blocked.status_code == 403
    assert "suspendido" in blocked.json()["detail"].lower()

    restored = client.patch(
        f"/api/platform/tenants/{tenant['business_id']}",
        headers=platform_headers,
        json={"status": "active"},
    )
    assert restored.status_code == 200
    assert client.get("/api/dashboard", headers=auth_headers).status_code == 200


def test_platform_and_tenant_tokens_are_separate(client: TestClient, auth_headers: dict):
    platform_headers = _platform_headers(client)

    tenant_cannot_platform = client.get("/api/platform/overview", headers=auth_headers)
    assert tenant_cannot_platform.status_code == 403

    platform_cannot_tenant = client.get("/api/dashboard", headers=platform_headers)
    assert platform_cannot_tenant.status_code == 401


def test_platform_rejects_bad_credentials(client: TestClient):
    response = client.post(
        "/api/platform/login",
        json={"email": "admin@bellessa.mx", "password": "incorrecta"},
    )
    assert response.status_code == 401
