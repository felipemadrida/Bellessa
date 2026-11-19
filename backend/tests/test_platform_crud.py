from fastapi.testclient import TestClient

PLATFORM_EMAIL = "admin@test.invalid"
PLATFORM_PASSWORD = "test-only-admin-pass"


def _platform_headers(client: TestClient) -> dict:
    response = client.post(
        "/api/platform/login",
        json={"email": PLATFORM_EMAIL, "password": PLATFORM_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_platform_create_update_archive_and_restore_tenant(client: TestClient):
    platform_headers = _platform_headers(client)

    created = client.post(
        "/api/platform/tenants",
        headers=platform_headers,
        json={
            "name": "Salón Aurora",
            "slug": "salon-aurora",
            "owner_name": "Ana Torres",
            "owner_email": "ana@aurora.mx",
            "owner_password": "aurora1234",
            "phone": "55 8888 7777",
            "city": "Guadalajara",
            "plan": "pro",
            "status": "trial",
            "notes": "Cliente de lanzamiento",
        },
    )
    assert created.status_code == 201, created.text
    tenant = created.json()
    assert tenant["name"] == "Salón Aurora"
    assert tenant["slug"] == "salon-aurora"
    assert tenant["plan"] == "pro"
    assert tenant["status"] == "trial"
    assert tenant["clients_count"] == 0
    assert tenant["generated_password"] is None

    owner_login = client.post(
        "/api/auth/login",
        json={"email": "ana@aurora.mx", "password": "aurora1234"},
    )
    assert owner_login.status_code == 200
    owner_headers = {"Authorization": f"Bearer {owner_login.json()['access_token']}"}
    assert client.get("/api/dashboard", headers=owner_headers).status_code == 200

    public = client.get("/api/public/salon-aurora")
    assert public.status_code == 200
    assert public.json()["name"] == "Salón Aurora"

    duplicate_slug = client.post(
        "/api/platform/tenants",
        headers=platform_headers,
        json={
            "name": "Otro salón",
            "slug": "salon-aurora",
            "owner_name": "Otra Dueña",
            "owner_email": "otra@example.mx",
            "plan": "free",
            "status": "trial",
        },
    )
    assert duplicate_slug.status_code == 409

    duplicate_email = client.post(
        "/api/platform/tenants",
        headers=platform_headers,
        json={
            "name": "Otro salón",
            "owner_name": "Otra Dueña",
            "owner_email": "ana@aurora.mx",
            "plan": "free",
            "status": "trial",
        },
    )
    assert duplicate_email.status_code == 409

    updated = client.patch(
        f"/api/platform/tenants/{tenant['business_id']}",
        headers=platform_headers,
        json={
            "name": "Aurora Studio",
            "slug": "aurora-studio",
            "owner_name": "Ana María Torres",
            "plan": "salon",
            "status": "active",
            "notes": "Plan anual",
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Aurora Studio"
    assert updated.json()["slug"] == "aurora-studio"
    assert updated.json()["owner_name"] == "Ana María Torres"
    assert updated.json()["plan"] == "salon"
    assert updated.json()["status"] == "active"

    archived = client.delete(
        f"/api/platform/tenants/{tenant['business_id']}",
        headers=platform_headers,
    )
    assert archived.status_code == 204
    assert client.get("/api/dashboard", headers=owner_headers).status_code == 403

    visible = client.get("/api/platform/tenants", headers=platform_headers)
    assert all(item["business_id"] != tenant["business_id"] for item in visible.json())
    archived_list = client.get(
        "/api/platform/tenants?include_archived=true", headers=platform_headers
    )
    archived_tenant = next(
        item for item in archived_list.json() if item["business_id"] == tenant["business_id"]
    )
    assert archived_tenant["status"] == "archived"

    restored = client.patch(
        f"/api/platform/tenants/{tenant['business_id']}",
        headers=platform_headers,
        json={"status": "active"},
    )
    assert restored.status_code == 200
    assert client.get("/api/dashboard", headers=owner_headers).status_code == 200


def test_platform_create_generates_temporary_password(client: TestClient):
    platform_headers = _platform_headers(client)
    created = client.post(
        "/api/platform/tenants",
        headers=platform_headers,
        json={
            "name": "Salón Generado",
            "owner_name": "Dueña Generada",
            "owner_email": "generada@example.mx",
            "plan": "free",
            "status": "trial",
        },
    )
    assert created.status_code == 201, created.text
    generated = created.json()["generated_password"]
    assert generated and len(generated) >= 8

    login = client.post(
        "/api/auth/login",
        json={"email": "generada@example.mx", "password": generated},
    )
    assert login.status_code == 200
