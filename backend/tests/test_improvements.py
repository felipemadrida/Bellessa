from datetime import date, datetime, timedelta

from fastapi.testclient import TestClient


def _today(client: TestClient, headers: dict) -> date:
    return date.fromisoformat(client.get("/api/dashboard", headers=headers).json()["date"])


def test_time_off_blocks_and_unblocks_availability(client: TestClient, auth_headers: dict):
    today = _today(client, auth_headers)
    services = client.get("/api/services", headers=auth_headers).json()
    staff = client.get("/api/staff", headers=auth_headers).json()
    service = services[0]
    member = staff[0]

    day = None
    slots = []
    for offset in range(15, 35):
        candidate = today + timedelta(days=offset)
        response = client.get(
            "/api/availability",
            headers=auth_headers,
            params={"service_id": service["id"], "staff_id": member["id"], "date": candidate.isoformat()},
        )
        assert response.status_code == 200
        if response.json()["slots"]:
            day = candidate
            slots = response.json()["slots"]
            break
    assert day is not None, "No hay un día libre para probar el bloqueo"

    blocked = client.post(
        f"/api/staff/{member['id']}/time-off",
        headers=auth_headers,
        json={"start_date": day.isoformat(), "end_date": day.isoformat(), "reason": "Curso de color"},
    )
    assert blocked.status_code == 201, blocked.text
    block_id = blocked.json()["id"]
    block_start = datetime.fromisoformat(blocked.json()["start_at"].replace("Z", "+00:00"))
    block_end = datetime.fromisoformat(blocked.json()["end_at"].replace("Z", "+00:00"))
    assert (block_end - block_start).total_seconds() == 86400

    after_block = client.get(
        "/api/availability",
        headers=auth_headers,
        params={"service_id": service["id"], "staff_id": member["id"], "date": day.isoformat()},
    )
    assert after_block.status_code == 200
    assert after_block.json()["slots"] == []

    listing = client.get(f"/api/staff/{member['id']}/time-off", headers=auth_headers)
    assert listing.status_code == 200
    assert any(item["id"] == block_id for item in listing.json())

    deleted = client.delete(
        f"/api/staff/{member['id']}/time-off/{block_id}", headers=auth_headers
    )
    assert deleted.status_code == 204

    restored = client.get(
        "/api/availability",
        headers=auth_headers,
        params={"service_id": service["id"], "staff_id": member["id"], "date": day.isoformat()},
    )
    assert restored.json()["slots"] != []


def test_time_off_rejects_day_with_active_appointments(client: TestClient, auth_headers: dict):
    today = _today(client, auth_headers)
    active = None
    active_day = None
    for offset in range(1, 8):
        day = today + timedelta(days=offset)
        agenda = client.get(
            f"/api/appointments?date={day.isoformat()}", headers=auth_headers
        ).json()
        active = next(
            (item for item in agenda if item["status"] in ("pending", "confirmed")), None
        )
        if active:
            active_day = day
            break
    assert active is not None, "El seed no tiene citas futuras para probar"

    blocked = client.post(
        f"/api/staff/{active['staff']['id']}/time-off",
        headers=auth_headers,
        json={"start_date": active_day.isoformat(), "end_date": active_day.isoformat()},
    )
    assert blocked.status_code == 409
    assert "cita" in blocked.json()["detail"].lower()


def test_client_cannot_have_overlapping_appointments(client: TestClient, auth_headers: dict):
    today = _today(client, auth_headers)
    services = client.get("/api/services", headers=auth_headers).json()
    staff = client.get("/api/staff", headers=auth_headers).json()
    service = next(item for item in services if item["name"] == "Corte de dama")
    first_staff = staff[0]
    second_staff = staff[1]

    created_client = client.post(
        "/api/clients",
        headers=auth_headers,
        json={"name": "Prueba Traslape", "phone": "55 7373 8282"},
    )
    assert created_client.status_code == 201, created_client.text
    client_id = created_client.json()["id"]

    chosen_day = None
    chosen_slot = None
    for offset in range(15, 35):
        day = today + timedelta(days=offset)
        first = client.get(
            "/api/availability",
            headers=auth_headers,
            params={"service_id": service["id"], "staff_id": first_staff["id"], "date": day.isoformat()},
        )
        second = client.get(
            "/api/availability",
            headers=auth_headers,
            params={"service_id": service["id"], "staff_id": second_staff["id"], "date": day.isoformat()},
        )
        first_starts = {slot["start_utc"] for slot in first.json()["slots"]}
        common = [
            slot for slot in second.json()["slots"] if slot["start_utc"] in first_starts
        ]
        if common:
            chosen_day = day
            chosen_slot = common[0]
            break
    assert chosen_day is not None, "No hay un horario común para probar el traslape"

    first_booking = client.post(
        "/api/appointments",
        headers=auth_headers,
        json={
            "client_id": client_id,
            "service_id": service["id"],
            "staff_id": first_staff["id"],
            "start_at": chosen_slot["start_utc"],
            "status": "confirmed",
        },
    )
    assert first_booking.status_code == 201, first_booking.text

    second_booking = client.post(
        "/api/appointments",
        headers=auth_headers,
        json={
            "client_id": client_id,
            "service_id": service["id"],
            "staff_id": second_staff["id"],
            "start_at": chosen_slot["start_utc"],
            "status": "confirmed",
        },
    )
    assert second_booking.status_code == 409
    assert "clienta" in second_booking.json()["detail"].lower()


def test_audit_log_and_owner_only_access(client: TestClient, auth_headers: dict):
    logs = client.get("/api/audit", headers=auth_headers)
    assert logs.status_code == 200
    assert any(entry["action"] == "sesion.iniciada" for entry in logs.json())

    created = client.post(
        "/api/clients",
        headers=auth_headers,
        json={"name": "Auditoría Prueba", "phone": "55 6464 7373"},
    )
    assert created.status_code == 201

    after = client.get("/api/audit", headers=auth_headers).json()
    entry = next(item for item in after if item["action"] == "clienta.creada")
    assert entry["entity_id"] == created.json()["id"]
    assert entry["user_name"] == "Lucía Herrera"
    assert entry["created_at"].endswith("Z")

    staff_login = client.post(
        "/api/auth/login",
        json={"email": "ximena@salonlucia.mx", "password": "demo1234"},
    )
    assert staff_login.status_code == 200, staff_login.text
    staff_headers = {"Authorization": f"Bearer {staff_login.json()['access_token']}"}
    forbidden = client.get("/api/audit", headers=staff_headers)
    assert forbidden.status_code == 403
