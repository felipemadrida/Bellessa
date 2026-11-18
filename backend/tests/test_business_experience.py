from fastapi.testclient import TestClient


def test_business_experience_defaults(client: TestClient, auth_headers: dict):
    """El salón arranca con moneda, idioma y color por defecto."""
    response = client.get("/api/business", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["currency"] == "MXN"
    assert body["locale"] == "es-MX"
    assert body["brand_color"] == "#9C5566"


def test_business_experience_update(client: TestClient, auth_headers: dict):
    """La dueña puede cambiar moneda, idioma y color del salón."""
    updated = client.patch(
        "/api/business",
        headers=auth_headers,
        json={"currency": "USD", "locale": "en-US", "brand_color": "#123456"},
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["currency"] == "USD"
    assert body["locale"] == "en-US"
    assert body["brand_color"] == "#123456"

    refreshed = client.get("/api/business", headers=auth_headers)
    assert refreshed.json()["currency"] == "USD"


def test_business_experience_validation(client: TestClient, auth_headers: dict):
    """Moneda e idioma fuera de catálogo y colores inválidos se rechazan."""
    for payload in (
        {"currency": "EUR"},
        {"locale": "fr-FR"},
        {"brand_color": "azul"},
        {"brand_color": "#12345"},
    ):
        response = client.patch("/api/business", headers=auth_headers, json=payload)
        assert response.status_code == 422, f"{payload} debería fallar"


def test_public_business_exposes_experience(client: TestClient):
    """La página pública de reservas recibe moneda, idioma y color del salón."""
    response = client.get("/api/public/salon-lucia")
    assert response.status_code == 200
    body = response.json()
    assert body["currency"] == "MXN"
    assert body["locale"] == "es-MX"
    assert body["brand_color"] == "#9C5566"
