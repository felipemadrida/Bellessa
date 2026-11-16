from fastapi.testclient import TestClient


def test_demo_login_and_me(client: TestClient):
    bad = client.post("/api/auth/login", json={"email": "demo@bellessa.mx", "password": "incorrecta"})
    assert bad.status_code == 401

    response = client.post(
        "/api/auth/login",
        json={"email": "demo@bellessa.mx", "password": "demo1234"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == "owner"
    assert body["business"]["slug"] == "salon-lucia"
    assert len(body["business"]["hours"]) == 7

    headers = {"Authorization": f"Bearer {body['access_token']}"}
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["business"]["name"] == "Salón Demo"


def test_register_creates_isolated_business(client: TestClient):
    response = client.post(
        "/api/auth/register",
        json={
            "business_name": "Estética Casa Nube",
            "owner_name": "Paola Ruiz",
            "email": "paola@casanube.mx",
            "password": "casanube123",
            "phone": "55 1010 2020",
            "city": "Ciudad de México",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["business"]["slug"] == "estetica-casa-nube"
    assert body["user"]["role"] == "owner"

    headers = {"Authorization": f"Bearer {body['access_token']}"}
    clients = client.get("/api/clients", headers=headers)
    assert clients.status_code == 200
    assert clients.json() == []

    services = client.get("/api/services", headers=headers)
    assert services.status_code == 200
    assert len(services.json()) >= 4

    # No puede ver la agenda del salón demo.
    agenda = client.get("/api/appointments?date=2026-01-05", headers=headers)
    assert agenda.status_code == 200
    assert agenda.json() == []


def test_protected_route_requires_token(client: TestClient):
    response = client.get("/api/dashboard")
    assert response.status_code == 401
