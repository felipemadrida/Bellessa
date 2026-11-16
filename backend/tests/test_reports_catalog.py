from datetime import date, timedelta

from fastapi.testclient import TestClient


def test_dashboard_month_and_top_services(client: TestClient, auth_headers: dict):
    dashboard = client.get("/api/dashboard", headers=auth_headers)
    assert dashboard.status_code == 200
    body = dashboard.json()
    assert body["revenue_month_cents"] >= body["revenue_today_cents"]
    assert len(body["revenue_last_7_days"]) == 7
    assert isinstance(body["expected_cash_cents"], int)
    assert 0 <= body["occupancy_pct"] <= 100


def test_report_summary_and_csv(client: TestClient, auth_headers: dict):
    summary = client.get("/api/reports/summary", headers=auth_headers)
    assert summary.status_code == 200
    body = summary.json()
    assert body["revenue_cents"] > 0
    assert body["payments_count"] > 0
    assert set(body["by_method"].keys()) == {"cash", "card", "transfer", "other"}
    assert len(body["by_day"]) == 30
    assert len(body["staff"]) == 3

    export = client.get("/api/reports/export.csv", headers=auth_headers)
    assert export.status_code == 200
    assert export.content.startswith(b"\xef\xbb\xbf")
    text = export.content.decode("utf-8-sig")
    assert "TOTALES" in text
    assert "Clienta" in text

    bad = client.get(
        "/api/reports/summary?start=2026-11-20&end=2026-11-01", headers=auth_headers
    )
    assert bad.status_code == 422


def test_client_catalog_rules(client: TestClient, auth_headers: dict):
    created = client.post(
        "/api/clients",
        headers=auth_headers,
        json={
            "name": "Luciana Prueba",
            "phone": "55 8181 9191",
            "birthday": "1995-09-15",
            "tags": "Nueva,Color",
            "notes": "Prefiere citas por la tarde",
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["phone"] == "5581819191"

    duplicate = client.post(
        "/api/clients",
        headers=auth_headers,
        json={"name": "Otra Luciana", "phone": "5581819191"},
    )
    assert duplicate.status_code == 409

    detail = client.get(f"/api/clients/{created.json()['id']}", headers=auth_headers)
    assert detail.status_code == 200
    assert detail.json()["stats"]["visits"] == 0
    assert detail.json()["stats"]["loyalty_points"] == 0
    assert detail.json()["stats"]["loyalty_level"] == "nueva"
    assert detail.json()["stats"]["loyalty_next_reward_in"] == 5

    service = client.post(
        "/api/services",
        headers=auth_headers,
        json={
            "name": "Botox capilar",
            "category": "Tratamientos",
            "duration_min": 90,
            "price_cents": 120000,
            "buffer_min": 15,
        },
    )
    assert service.status_code == 201, service.text
    assert service.json()["price_cents"] == 120000

    updated = client.patch(
        f"/api/services/{service.json()['id']}",
        headers=auth_headers,
        json={"price_cents": 135000, "active": False},
    )
    assert updated.status_code == 200
    assert updated.json()["active"] is False

    staff = client.post(
        "/api/staff",
        headers=auth_headers,
        json={
            "name": "Karla Prueba",
            "email": "karla@salonlucia.mx",
            "password": "karla12345",
            "commission_bps": 2500,
            "color": "#5C8374",
        },
    )
    assert staff.status_code == 201, staff.text
    assert len(staff.json()["working_hours"]) == 7

    hours = client.put(
        f"/api/staff/{staff.json()['id']}/hours",
        headers=auth_headers,
        json=[
            {"weekday": 0, "closed": False, "start_minute": 600, "end_minute": 1080},
            {"weekday": 1, "closed": True, "start_minute": 600, "end_minute": 1080},
        ],
    )
    assert hours.status_code == 200
    assert len(hours.json()) == 2


def test_no_show_flow_and_metrics(client: TestClient, auth_headers: dict):
    today = date.fromisoformat(client.get("/api/dashboard", headers=auth_headers).json()["date"])
    agenda = client.get(f"/api/appointments?date={today.isoformat()}", headers=auth_headers).json()
    confirmed = next(item for item in agenda if item["status"] in ("confirmed", "pending"))
    response = client.post(
        f"/api/appointments/{confirmed['id']}/status",
        headers=auth_headers,
        json={"status": "no_show", "reason": "No llegó"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "no_show"
    assert "No llegó" in (response.json()["notes"] or "")

    invalid = client.post(
        f"/api/appointments/{confirmed['id']}/status",
        headers=auth_headers,
        json={"status": "confirmed"},
    )
    assert invalid.status_code == 409

    report = client.get(
        f"/api/reports/summary?start={(today - timedelta(days=1)).isoformat()}&end={today.isoformat()}",
        headers=auth_headers,
    )
    assert report.status_code == 200
    assert report.json()["no_show_appointments"] >= 1
