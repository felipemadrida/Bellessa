# Inventario

Módulo de productos y existencias del salón. No sustituye todavía una venta de mostrador con productos: registra el inventario y sus movimientos; la venta de servicios sigue en Caja.

## Pantalla

Ruta: `/inventario`.

- Resumen de productos activos, stock bajo, unidades y valor estimado.
- Búsqueda por nombre, SKU o categoría.
- Filtro de stock bajo.
- Alta y edición de producto.
- Movimiento de entrada, salida o ajuste.
- Desactivación lógica (soft delete).

## Reglas

- Los precios y costos se guardan en **centavos** para evitar punto flotante.
- `stock` es un entero; cada movimiento actualiza el stock en la misma transacción.
- **Entrada:** cantidad positiva, suma al stock.
- **Salida:** cantidad positiva, resta al stock. Si el resultado es negativo se rechaza.
- **Ajuste:** delta firmado; se usa para mermas, conteos físicos o correcciones.
- Un producto con `stock <= min_stock` aparece como stock bajo.
- Desactivar un producto no borra movimientos ni historial.
- El SKU es opcional, pero si existe debe ser único dentro del salón.
- Todos los movimientos quedan en `stock_movements` y en la bitácora de auditoría.

## Endpoints

```text
GET    /api/inventory/products?q=&low_stock=&include_inactive=
GET    /api/inventory/products/{id}
POST   /api/inventory/products
PATCH  /api/inventory/products/{id}
DELETE /api/inventory/products/{id}        # desactiva
POST   /api/inventory/products/{id}/movements
GET    /api/inventory/movements?product_id=&limit=
GET    /api/inventory/summary
```

## Modelo

| Tabla | Campos principales |
|---|---|
| `products` | business_id, nombre, SKU, categoría, precio, costo, stock, mínimo, unidad, activo |
| `stock_movements` | business_id, product_id, tipo, cantidad, motivo, referencia, user_id, fecha |

## Límites

- No hay proveedores, compras, órdenes de compra ni venta de productos desde Caja.
- No hay lotes, caducidades ni conversión entre unidades.
- El valor de inventario usa `costo` si existe; si no, el precio.
- La cobertura actual es suficiente para controlar el stock de un salón pequeño, no para una cadena con almacenes múltiples.
