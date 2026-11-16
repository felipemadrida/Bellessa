from datetime import date, timedelta

from fastapi.testclient import TestClient


def _public_slot(client: TestClient, service_id: int, staff_id: int):
    today = date.today()
    for offset in range(3, 14):
        day = today + timedelta(days=offset)
        response = client.get(
            f"/api/public/salon-lucia/availability",
            params={"service_id": service_id, "staff_id": staff_id, "date": day.isoformat()},
        )
        if response.status_code == 200 and response.json()["slots"]:
            return day, response.json()["slots"][0]
    raise AssertionError("Sin horarios públicos para la prueba")


def test_public_booking_and_owner_visibility(client: TestClient, auth_headers: dict):
    public = client.get("/api/public/salon-lucia")
    assert public.status_code == 200
    data = public.json()
    assert data["name"] == "Salón Lucía"
    assert any(service["name"] == "Balayage" for service in data["services"])
    assert len(data["staff"]) == 3

    service = next(item for item in data["services"] if item["name"] == "Manicure gel")
    member = data["staff"][1]
    day, slot = _public_slot(client, service["id"], member["id"])

    payload = {
        "service_id": service["id"],
        "staff_id": member["id"],
        "start_at": slot["start_utc"],
        "name": "Ana Sofía Prueba",
        "phone": "55 9090 1010",
        "email": "ana@correo.mx",
        "notes": "Primera visita",
    }
    booked = client.post("/api/public/salon-lucia/book", json=payload)
    assert booked.status_code == 201, booked.text
    body = booked.json()
    assert len(body["confirmation_code"]) == 8
    assert body["appointment"]["status"] == "pending"
    assert body["whatsapp_url"].startswith("https://wa.me/52")

    duplicate = client.post(
        "/api/public/salon-lucia/book",
        json={**payload, "name": "Otra Persona", "phone": "55 9090 2020"},
    )
    assert duplicate.status_code == 409

    agenda = client.get(
        f"/api/appointments?date={day.isoformat()}", headers=auth_headers
    )
    assert agenda.status_code == 200
    found = [a for a in agenda.json() if a["id"] == body["appointment"]["id"]]
    assert len(found) == 1
    assert found[0]["source"] == "public"

    updated_client = client.get("/api/clients?q=9090", headers=auth_headers)
    assert updated_client.status_code == 200
    assert updated_client.json()[0]["phone"] == "5590901010"


def test_public_business_is_real_public_page(client: TestClient):
    missing = client.get("/api/public/no-existe")
    assert missing.status_code == 404
    page = client.get("/api/public/salon-lucia")
    assert page.status_code == 200
    assert page.json()["slot_step"] if "slot_step" in page.json() else True
    assert page.json()["timezone"] == "America/Mexico_City"
