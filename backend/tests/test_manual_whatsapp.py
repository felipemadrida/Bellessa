from datetime import datetime, time, timedelta

from fastapi.testclient import TestClient


def test_manual_whatsapp_queue_and_evidence(client: TestClient, auth_headers: dict):
    today = client.get("/api/appointments?date=" + datetime.now().strftime("%Y-%m-%d"), headers=auth_headers)
    # La fecha exacta del seed depende del día de ejecución; usamos la agenda del dashboard
    dashboard = client.get("/api/dashboard", headers=auth_headers)
    assert dashboard.status_code == 200

    # Busca una cita futura en un rango amplio usando la API pública de disponibilidad.
    clients = client.get("/api/clients", headers=auth_headers).json()
    assert clients
    appointments = client.get(
        "/api/appointments?date=" + (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
        headers=auth_headers,
    )
    appointment_id = None
    if appointments.status_code == 200 and appointments.json():
        appointment_id = appointments.json()[0]["id"]

    payload = {
        "client_id": clients[0]["id"],
        "template_key": "reminder_24h",
    }
    if appointment_id:
        payload = {"appointment_id": appointment_id, "template_key": "reminder_24h"}

    created = client.post("/api/whatsapp/manual", headers=auth_headers, json=payload)
    assert created.status_code == 201, created.text
    message = created.json()
    assert message["status"] == "pending"
    assert message["kind"] == "manual"
    assert message["wa_url"].startswith("https://wa.me/")
    assert "Salón" in message["body"] or "cita" in message["body"].lower()

    prepared = client.post(
        f"/api/whatsapp/manual/{message['id']}/prepare", headers=auth_headers
    )
    assert prepared.status_code == 200
    assert prepared.json()["status"] == "prepared"

    opened = client.post(
        f"/api/whatsapp/manual/{message['id']}/opened", headers=auth_headers
    )
    assert opened.status_code == 200
    assert opened.json()["status"] == "opened"

    confirmed = client.post(
        f"/api/whatsapp/manual/{message['id']}/confirm", headers=auth_headers
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["status"] == "confirmed"
    assert confirmed.json()["sent_at"] is not None

    listing = client.get("/api/whatsapp/manual", headers=auth_headers)
    assert listing.status_code == 200
    assert any(item["id"] == message["id"] for item in listing.json())


def test_manual_whatsapp_failure_is_not_confirmed(client: TestClient, auth_headers: dict):
    clients = client.get("/api/clients", headers=auth_headers).json()
    created = client.post(
        "/api/whatsapp/manual",
        headers=auth_headers,
        json={
            "client_id": clients[0]["id"],
            "template_key": "review",
        },
    )
    assert created.status_code == 201

    failed = client.post(
        f"/api/whatsapp/manual/{created.json()['id']}/failed",
        headers=auth_headers,
        json={"reason": "El número no tiene WhatsApp"},
    )
    assert failed.status_code == 200
    assert failed.json()["status"] == "failed"
    assert failed.json()["sent_at"] is None
    assert "WhatsApp" in failed.json()["error"]
