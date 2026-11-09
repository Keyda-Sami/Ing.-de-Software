# ============================================================
#  SUBLI-TECH v2 — routers/productos.py
#  Endpoints: GET /productos/        (catálogo público)
#             GET /productos/{id}    (detalle de producto)
#  Reemplaza: catálogo embebido en index.html / producto.html
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import json

from conexion import get_db

router = APIRouter(prefix="/productos", tags=["Catálogo"])


# ── GET /productos/ ───────────────────────────────────────────
@router.get("/")
def listar_productos(
    categoria: Optional[str] = Query(None, description="polera|taza|gorra|bolso|cojin|otro"),
    db=Depends(get_db),
):
    """
    Retorna el catálogo de productos activos.
    Acepta ?categoria=polera para filtrar (igual que los botones de filtro del frontend).
    """
    with db.cursor() as cur:
        if categoria and categoria != "todos":
            cur.execute(
                "SELECT id, nombre, descripcion, categoria, precio_base, stock, imagen_url "
                "FROM productos_blancos WHERE activo = 1 AND categoria = %s ORDER BY nombre ASC",
                (categoria,),
            )
        else:
            cur.execute(
                "SELECT id, nombre, descripcion, categoria, precio_base, stock, imagen_url "
                "FROM productos_blancos WHERE activo = 1 ORDER BY nombre ASC"
            )
        productos = cur.fetchall()

    for p in productos:
        p["precio_base"] = float(p["precio_base"])
        p["categoriaLabel"] = p["categoria"].capitalize()
        p["imagen"] = p.get("imagen_url") or ""

    return {"productos": productos, "total": len(productos)}


# ── GET /productos/{id} ───────────────────────────────────────
@router.get("/{producto_id}")
def detalle_producto(producto_id: int, db=Depends(get_db)):
    """
    Retorna el detalle completo de un producto adaptado para producto.html.
    """
    with db.cursor() as cur:
        cur.execute(
            "SELECT * FROM productos_blancos WHERE id = %s AND activo = 1",
            (producto_id,),
        )
        prod = cur.fetchone()

    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    tallas_default = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    if prod.get('categoria') in ['taza', 'gorra', 'cojin', 'bandera', 'otro']:
        tallas_default = ['Única']

    colores_default = ['Blanco', 'Negro', 'Rojo', 'Azul', 'Verde']

    imagesByColor = {}
    if prod.get('imagenes_colores'):
        try:
            imagesByColor = json.loads(prod['imagenes_colores'])
        except Exception:
            pass
    if not imagesByColor:
        for c in colores_default:
            imagesByColor[c] = prod.get('imagen_url') or ""

    guia_tallas = {
        'S': '48cm ancho x 68cm largo',
        'M': '50cm ancho x 70cm largo',
        'L': '52cm ancho x 72cm largo',
        'XL': '54cm ancho x 74cm largo',
        'Única': 'Medida estándar'
    }

    producto_formateado = {
        'id': prod['id'],
        'nombre': prod['nombre'],
        'categoria': prod.get('categoria', 'otro'),
        'categoriaLabel': (prod.get('categoria') or 'otro').capitalize(),
        'precio_base': float(prod['precio_base']),
        'stock': int(prod.get('stock') or 0),
        'descripcion': prod.get('descripcion') or '',
        'descripcion_larga': prod.get('descripcion') or '',
        'imagen': prod.get('imagen_url') or '',
        'imagen_url': prod.get('imagen_url') or '',
        'rating': 5.0,
        'reviews': 120,
        'tallas': tallas_default,
        'colores': colores_default,
        'guia_tallas': guia_tallas,
        'imagesByColor': imagesByColor,
    }

    return {"success": True, "producto": producto_formateado}
