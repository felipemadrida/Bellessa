from fastapi.testclient import TestClient


def test_inventory_crud_and_stock_movements(client: TestClient, auth_headers: dict):
    created = client.post(
        "/api/inventory/products",
        headers=auth_headers,
        json={
            "name": "Shampoo hidratante",
            "sku": "SH-001",
            "category": "Cuidado",
            "price_cents": 42000,
            "cost_cents": 21000,
            "stock": 10,
            "min_stock": 4,
            "unit": "botella",
        },
    )
    assert created.status_code == 201, created.text
    product = created.json()
    assert product["stock"] == 10
    assert product["sku"] == "SH-001"

    duplicate = client.post(
        "/api/inventory/products",
        headers=auth_headers,
        json={"name": "Otro", "sku": "sh-001", "stock": 1},
    )
    assert duplicate.status_code == 409

    out = client.post(
        f"/api/inventory/products/{product['id']}/movements",
        headers=auth_headers,
        json={"kind": "out", "quantity": 3, "reason": "Venta de mostrador"},
    )
    assert out.status_code == 201, out.text
    assert out.json()["quantity"] == 3

    adjustment = client.post(
        f"/api/inventory/products/{product['id']}/movements",
        headers=auth_headers,
        json={"kind": "adjustment", "quantity": -2, "reason": "Merma"},
    )
    assert adjustment.status_code == 201, adjustment.text

    detail = client.get(f"/api/inventory/products/{product['id']}", headers=auth_headers)
    assert detail.status_code == 200
    assert detail.json()["stock"] == 5

    insufficient = client.post(
        f"/api/inventory/products/{product['id']}/movements",
        headers=auth_headers,
        json={"kind": "out", "quantity": 100},
    )
    assert insufficient.status_code == 409

    updated = client.patch(
        f"/api/inventory/products/{product['id']}",
        headers=auth_headers,
        json={"name": "Shampoo hidratante 500 ml", "price_cents": 45000, "min_stock": 5},
    )
    assert updated.status_code == 200
    assert updated.json()["price_cents"] == 45000

    summary = client.get("/api/inventory/summary", headers=auth_headers)
    assert summary.status_code == 200
    assert summary.json()["active_products"] == 1
    assert summary.json()["stock_units"] == 5

    movements = client.get("/api/inventory/movements", headers=auth_headers)
    assert movements.status_code == 200
    assert len(movements.json()) >= 2

    deactivated = client.delete(
        f"/api/inventory/products/{product['id']}", headers=auth_headers
    )
    assert deactivated.status_code == 204
    visible = client.get("/api/inventory/products", headers=auth_headers)
    assert all(item["id"] != product["id"] for item in visible.json())
    inactive = client.get(
        "/api/inventory/products?include_inactive=true", headers=auth_headers
    )
    assert any(item["id"] == product["id"] for item in inactive.json())


def test_inventory_rejects_wrong_tenant_product(client: TestClient):
    business = client.post(
        "/api/auth/register",
        json={
            "business_name": "Salón Inventario Ajeno",
            "owner_name": "Dueña Ajena",
            "email": "inventario-ajeno@example.mx",
            "password": "secreto1234",
        },
    )
    assert business.status_code == 201, business.text
    token = business.json()["access_token"]
    other_headers = {"Authorization": f"Bearer {token}"}
    product = client.post(
        "/api/inventory/products",
        headers=other_headers,
        json={"name": "Producto ajeno", "stock": 2},
    )
    assert product.status_code == 201

    demo_login = client.post(
        "/api/auth/login", json={"email": "demo@bellessa.mx", "password": "demo1234"}
    )
    demo_headers = {"Authorization": f"Bearer {demo_login.json()['access_token']}"}
    assert (
        client.get(f"/api/inventory/products/{product.json()['id']}", headers=demo_headers).status_code
        == 404
    )
