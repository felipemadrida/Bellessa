from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..audit import record_audit
from ..database import get_db
from ..deps import get_current_business, get_current_user
from ..models import Business, Product, StockMovement, User
from ..schemas import (
    InventorySummaryOut,
    ProductCreate,
    ProductOut,
    ProductUpdate,
    StockMovementCreate,
    StockMovementOut,
)

router = APIRouter(prefix="/inventory", tags=["inventario"])


def _get_product(db: Session, business: Business, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None or product.business_id != business.id:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    return product


def _clean_sku(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip().upper()
    return cleaned or None


def _sku_exists(
    db: Session, business: Business, sku: str, exclude_id: int | None = None
) -> bool:
    query = select(Product.id).where(Product.business_id == business.id, Product.sku == sku)
    if exclude_id is not None:
        query = query.where(Product.id != exclude_id)
    return db.scalar(query) is not None


def _movement_payload(movement: StockMovement) -> StockMovementOut:
    return StockMovementOut(
        id=movement.id,
        product_id=movement.product_id,
        product_name=movement.product.name if movement.product else None,
        kind=movement.kind,
        quantity=movement.quantity,
        reason=movement.reason,
        reference=movement.reference,
        created_at=movement.created_at,
    )


@router.get("/products", response_model=list[ProductOut])
def list_products(
    q: str | None = Query(default=None, max_length=80),
    low_stock: bool = Query(default=False),
    include_inactive: bool = Query(default=False),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
) -> list[Product]:
    query = select(Product).where(Product.business_id == business.id)
    if not include_inactive:
        query = query.where(Product.active.is_(True))
    if q:
        term = f"%{q.strip().lower()}%"
        query = query.where(
            func.lower(Product.name).like(term)
            | func.lower(func.coalesce(Product.sku, "")).like(term)
            | func.lower(Product.category).like(term)
        )
    if low_stock:
        query = query.where(Product.stock <= Product.min_stock)
    return list(db.scalars(query.order_by(Product.name.asc())).all())


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
) -> Product:
    return _get_product(db, business, product_id)


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(
    payload: ProductCreate,
    business: Business = Depends(get_current_business),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Product:
    sku = _clean_sku(payload.sku)
    if sku and _sku_exists(db, business, sku):
        raise HTTPException(status_code=409, detail="Ese SKU ya existe en el salón.")
    product = Product(
        business_id=business.id,
        name=payload.name.strip(),
        sku=sku,
        category=payload.category.strip() or "General",
        description=payload.description.strip() if payload.description else None,
        price_cents=payload.price_cents,
        cost_cents=payload.cost_cents,
        stock=payload.stock,
        min_stock=payload.min_stock,
        unit=payload.unit.strip() or "pieza",
    )
    try:
        db.add(product)
        db.flush()
        if payload.stock:
            db.add(
                StockMovement(
                    business_id=business.id,
                    product_id=product.id,
                    kind="in",
                    quantity=payload.stock,
                    reason="Inventario inicial",
                    user_id=user.id,
                )
            )
        record_audit(
            db,
            business_id=business.id,
            user_id=user.id,
            action="inventario.producto_creado",
            entity_type="product",
            entity_id=product.id,
            detail=product.name,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="No se pudo crear el producto.") from exc
    db.refresh(product)
    return product


@router.patch("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    business: Business = Depends(get_current_business),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Product:
    product = _get_product(db, business, product_id)
    if payload.sku is not None:
        sku = _clean_sku(payload.sku)
        if sku and _sku_exists(db, business, sku, exclude_id=product.id):
            raise HTTPException(status_code=409, detail="Ese SKU ya existe en el salón.")
        product.sku = sku
    if payload.name is not None:
        product.name = payload.name.strip()
    if payload.category is not None:
        product.category = payload.category.strip() or "General"
    if payload.description is not None:
        product.description = payload.description.strip() or None
    if payload.price_cents is not None:
        product.price_cents = payload.price_cents
    if payload.cost_cents is not None:
        product.cost_cents = payload.cost_cents
    if payload.min_stock is not None:
        product.min_stock = payload.min_stock
    if payload.unit is not None:
        product.unit = payload.unit.strip() or "pieza"
    if payload.active is not None:
        product.active = payload.active
    record_audit(
        db,
        business_id=business.id,
        user_id=user.id,
        action="inventario.producto_actualizado",
        entity_type="product",
        entity_id=product.id,
        detail=product.name,
    )
    db.commit()
    db.refresh(product)
    return product


@router.delete("/products/{product_id}", status_code=204)
def deactivate_product(
    product_id: int,
    business: Business = Depends(get_current_business),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    product = _get_product(db, business, product_id)
    product.active = False
    record_audit(
        db,
        business_id=business.id,
        user_id=user.id,
        action="inventario.producto_desactivado",
        entity_type="product",
        entity_id=product.id,
        detail=product.name,
    )
    db.commit()
    return Response(status_code=204)


@router.post("/products/{product_id}/movements", response_model=StockMovementOut, status_code=201)
def create_movement(
    product_id: int,
    payload: StockMovementCreate,
    business: Business = Depends(get_current_business),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StockMovementOut:
    product = _get_product(db, business, product_id)
    if not product.active:
        raise HTTPException(status_code=409, detail="El producto está inactivo.")
    if payload.kind in {"in", "out"} and payload.quantity <= 0:
        raise HTTPException(status_code=422, detail="La cantidad debe ser mayor a cero.")
    if payload.kind == "adjustment" and payload.quantity == 0:
        raise HTTPException(status_code=422, detail="El ajuste no puede ser cero.")

    delta = -payload.quantity if payload.kind == "out" else payload.quantity
    new_stock = product.stock + delta
    if new_stock < 0:
        raise HTTPException(
            status_code=409,
            detail=f"Stock insuficiente: hay {product.stock} {product.unit}.",
        )
    product.stock = new_stock
    movement = StockMovement(
        business_id=business.id,
        product_id=product.id,
        kind=payload.kind,
        quantity=payload.quantity,
        reason=payload.reason.strip() if payload.reason else None,
        reference=payload.reference.strip() if payload.reference else None,
        user_id=user.id,
    )
    db.add(movement)
    record_audit(
        db,
        business_id=business.id,
        user_id=user.id,
        action="inventario.movimiento",
        entity_type="product",
        entity_id=product.id,
        detail=f"{payload.kind} {payload.quantity} · stock={new_stock}",
    )
    db.commit()
    db.refresh(movement)
    return _movement_payload(movement)


@router.get("/movements", response_model=list[StockMovementOut])
def list_movements(
    product_id: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
) -> list[StockMovementOut]:
    query = select(StockMovement).where(StockMovement.business_id == business.id)
    if product_id is not None:
        query = query.where(StockMovement.product_id == product_id)
    movements = list(
        db.scalars(
            query.order_by(StockMovement.created_at.desc(), StockMovement.id.desc()).limit(limit)
        ).all()
    )
    return [_movement_payload(movement) for movement in movements]


@router.get("/summary", response_model=InventorySummaryOut)
def inventory_summary(
    business: Business = Depends(get_current_business),
    db: Session = Depends(get_db),
) -> InventorySummaryOut:
    products = list(
        db.scalars(select(Product).where(Product.business_id == business.id)).all()
    )
    active = [product for product in products if product.active]
    low_stock = sum(1 for product in active if product.stock <= product.min_stock)
    stock_units = sum(product.stock for product in active)
    value = sum(product.stock * (product.cost_cents or product.price_cents) for product in active)
    return InventorySummaryOut(
        products=len(products),
        active_products=len(active),
        low_stock=low_stock,
        stock_units=stock_units,
        inventory_value_cents=value,
    )
