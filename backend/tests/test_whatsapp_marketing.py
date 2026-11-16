from datetime import date, timedelta

from fastapi.testclient import TestClient


def test_whatsapp_mock_bot_books_appointment(client: TestClient, auth_headers: dict):
    today = date.fromisoformat(
        client.get("/api/dashboard", headers=auth_headers).json()["date"]
    )
    services = client.get("/api/services", headers=auth_headers).json()
    service = services[0]

    greeting = client.post(
        "/api/whatsapp/mock",
        headers=auth_headers,
        json={"phone": "55 9192 9394", "text": "Hola"},
    )
    assert greeting.status_code == 200, greeting.text
    assert "servicios" in greeting.json()["replies"][0].lower()

    selected = client.post(
        "/api/whatsapp/mock",
        headers=auth_headers,
        json={"phone": "55 9192 9394", "text": "1"},
    )
    assert selected.status_code == 200
    assert "Elige el día" in selected.json()["replies"][0]

    chosen_day = None
    for offset in range(0, 15):
        candidate = today + timedelta(days=offset)
        availability = client.get(
            "/api/availability",
            headers=auth_headers,
            params={"service_id": service["id"], "date": candidate.isoformat()},
        )
        if availability.status_code == 200 and availability.json()["slots"]:
            chosen_day = candidate
            break
    assert chosen_day is not None

    day_reply = client.post(
        "/api/whatsapp/mock",
        headers=auth_headers,
        json={"phone": "55 9192 9394", "text": chosen_day.isoformat()},
    )
    assert day_reply.status_code == 200
    assert "Horarios para" in day_reply.json()["replies"][0]

    import re

    match = re.search(r"(\d{2}:\d{2})", day_reply.json()["replies"][0])
    assert match, day_reply.text

    time_reply = client.post(
        "/api/whatsapp/mock",
        headers=auth_headers,
        json={"phone": "55 9192 9394", "text": match.group(1)},
    )
    assert time_reply.status_code == 200
    assert "¿Cómo te llamas?" in time_reply.json()["replies"][0]

    name_reply = client.post(
        "/api/whatsapp/mock",
        headers=auth_headers,
        json={"phone": "55 9192 9394", "text": "Ana Bot"},
    )
    assert name_reply.status_code == 200
    assert "Responde SI" in name_reply.json()["replies"][0]

    confirmed = client.post(
        "/api/whatsapp/mock",
        headers=auth_headers,
        json={"phone": "55 9192 9394", "text": "SI"},
    )
    assert confirmed.status_code == 200, confirmed.text
    assert "confirmada" in confirmed.json()["replies"][0].lower()

    agenda = client.get(
        f"/api/appointments?date={chosen_day.isoformat()}", headers=auth_headers
    )
    assert agenda.status_code == 200
    appointment = next(
        (item for item in agenda.json() if item["client"]["name"] == "Ana Bot"), None
    )
    assert appointment is not None
    assert appointment["source"] == "whatsapp"
    assert appointment["status"] == "confirmed"

    outbox = client.get("/api/whatsapp/outbox", headers=auth_headers)
    assert outbox.status_code == 200
    assert any(item["kind"] == "bot" for item in outbox.json())
    assert any(item["kind"] == "internal_reception" for item in outbox.json())
    assert all(item["provider"] == "mock" for item in outbox.json())


def test_whatsapp_status_and_webhook(client: TestClient, auth_headers: dict):
    status = client.get("/api/whatsapp/status", headers=auth_headers)
    assert status.status_code == 200
    body = status.json()
    assert body["provider"] == "mock"
    assert body["configured"] is True
    assert body["webhook_url"].endswith("/api/whatsapp/webhook")

    verification = client.get(
        "/api/whatsapp/webhook",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "bellessa-verify",
            "hub.challenge": "12345",
        },
    )
    assert verification.status_code == 200
    assert verification.text == "12345"

    rejected = client.get(
        "/api/whatsapp/webhook",
        params={"hub.mode": "subscribe", "hub.verify_token": "incorrecto", "hub.challenge": "1"},
    )
    assert rejected.status_code == 403

    webhook = client.post(
        "/api/whatsapp/webhook",
        json={
            "entry": [
                {
                    "changes": [
                        {
                            "value": {
                                "messages": [
                                    {
                                        "type": "text",
                                        "from": "5591929395",
                                        "text": {"body": "hola"},
                                    }
                                ]
                            }
                        }
                    ]
                }
            ]
        },
    )
    assert webhook.status_code == 200
    assert webhook.json()["processed"] == 1


def test_client_loyalty_summary(client: TestClient, auth_headers: dict):
    clients = client.get("/api/clients", headers=auth_headers).json()
    assert clients
    detail = client.get(f"/api/clients/{clients[0]['id']}", headers=auth_headers)
    assert detail.status_code == 200
    stats = detail.json()["stats"]
    assert stats["loyalty_points"] >= 0
    assert stats["loyalty_level"] in {"nueva", "frecuente", "vip"}
    assert 0 <= stats["loyalty_next_reward_in"] <= 5
    assert stats["loyalty_spent_12m_cents"] >= 0


def test_marketing_segments_and_campaign(client: TestClient, auth_headers: dict):
    templates = client.get("/api/marketing/templates", headers=auth_headers)
    assert templates.status_code == 200
    template_keys = {item["key"] for item in templates.json()}
    assert {"birthday_week", "winback_30", "winback_60", "winback_90", "loyalty"} <= template_keys

    segments = client.get("/api/marketing/segments", headers=auth_headers)
    assert segments.status_code == 200
    segment_keys = {item["key"] for item in segments.json()}
    assert {"all", "vip", "inactivas_30", "inactivas_60", "inactivas_90"} <= segment_keys
    assert any(item["key"] == "all" and item["count"] > 0 for item in segments.json())

    campaign = client.post(
        "/api/marketing/campaigns",
        headers=auth_headers,
        json={"template_key": "birthday", "segment": "all"},
    )
    assert campaign.status_code == 200, campaign.text
    assert campaign.json()["queued"] > 0
    assert campaign.json()["queued"] + campaign.json()["skipped"] > 0

    outbox = client.get("/api/whatsapp/outbox", headers=auth_headers).json()
    campaign_logs = [item for item in outbox if item["kind"] == "campaign"]
    assert campaign_logs
    assert any(item["template_key"] == "birthday" for item in campaign_logs)

    calendar = client.get("/api/marketing/calendar", headers=auth_headers)
    assert calendar.status_code == 200
    assert len(calendar.json()) == 12
