from datetime import date, timedelta

from fastapi.testclient import TestClient


def _find_slots(client: TestClient, headers: dict, service_id: int, staff_id: int, needed: int = 2):
    today = date.fromisoformat(
        client.get("/api/dashboard", headers=headers).json()["date"]
    )
    for offset in range(2, 12):
        day = today + timedelta(days=offset)
        response = client.get(
            "/api/availability",
            params={"service_id": service_id, "staff_id": staff_id, "date": day.isoformat()},
            headers=headers,
        )
        assert response.status_code == 200, response.text
        slots = response.json()["slots"]
        if len(slots) >= needed:
            return day, slots
    raise AssertionError("No se encontraron horarios disponibles para la prueba")


def test_full_appointment_payment_flow(client: TestClient, auth_headers: dict):
    services = client.get("/api/services", headers=auth_headers).json()
    staff = client.get("/api/staff", headers=auth_headers).json()
    clients = client.get("/api/clients", headers=auth_headers).json()
    service = next(item for item in services if item["name"] == "Manicure gel")
    member = staff[2]
    clienta = clients[0]

    day, slots = _find_slots(client, auth_headers, service["id"], member["id"])
    first = slots[0]

    created = client.post(
        "/api/appointments",
        headers=auth_headers,
        json={
            "client_id": clienta["id"],
            "service_id": service["id"],
            "staff_id": member["id"],
            "start_at": first["start_utc"],
            "notes": "Diseño minimalista",
            "status": "confirmed",
        },
    )
    assert created.status_code == 201, created.text
    appointment = created.json()
    assert appointment["status"] == "confirmed"
    assert appointment["price_cents"] == service["price_cents"]
    assert appointment["client"]["name"] == clienta["name"]

    duplicate = client.post(
        "/api/appointments",
        headers=auth_headers,
        json={
            "client_id": clients[1]["id"],
            "service_id": service["id"],
            "staff_id": member["id"],
            "start_at": first["start_utc"],
        },
    )
    assert duplicate.status_code == 409

    second = slots[1]
    moved = client.patch(
        f"/api/appointments/{appointment['id']}",
        headers=auth_headers,
        json={"start_at": second["start_utc"]},
    )
    assert moved.status_code == 200, moved.text
    moved_body = moved.json()
    assert moved_body["start_at"].startswith(second["start_utc"][:19])

    payment = client.post(
        "/api/payments",
        headers=auth_headers,
        json={
            "appointment_id": appointment["id"],
            "amount_cents": service["price_cents"],
            "tip_cents": 5000,
            "method": "cash",
        },
    )
    assert payment.status_code == 201, payment.text
    payment_body = payment.json()
    assert payment_body["total_cents"] == service["price_cents"] + 5000

    again = client.post(
        "/api/payments",
        headers=auth_headers,
        json={"appointment_id": appointment["id"], "method": "cash"},
    )
    assert again.status_code == 409

    detail = client.get(f"/api/appointments/{appointment['id']}", headers=auth_headers).json()
    assert detail["status"] == "completed"
    assert detail["payment"]["id"] == payment_body["id"]

    receipt = client.get(f"/api/payments/{payment_body['id']}/receipt", headers=auth_headers)
    assert receipt.status_code == 200
    assert "IVA" in receipt.text
    assert "TOTAL" in receipt.text
    assert "XAXX010101000" in receipt.text or "HELJ850312MDFRRN05" in receipt.text

    cash = client.get("/api/cash/summary", headers=auth_headers)
    assert cash.status_code == 200
    assert any(item["id"] == payment_body["id"] for item in cash.json()["payments"])
    assert cash.json()["payments_count"] >= 1

    whatsapp = client.get(
        f"/api/appointments/{appointment['id']}/whatsapp?template=recordatorio",
        headers=auth_headers,
    )
    assert whatsapp.status_code == 200
    assert whatsapp.json()["url"].startswith("https://wa.me/52")


def test_availability_respects_closed_sundays(client: TestClient, auth_headers: dict):
    today = date.fromisoformat(client.get("/api/dashboard", headers=auth_headers).json()["date"])
    days_until_sunday = (6 - today.weekday()) % 7 or 7
    sunday = today + timedelta(days=days_until_sunday)
    service_id = client.get("/api/services", headers=auth_headers).json()[0]["id"]
    response = client.get(
        "/api/availability",
        params={"service_id": service_id, "date": sunday.isoformat()},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["slots"] == []
