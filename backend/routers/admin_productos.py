# ============================================================
#  SUBLI-TECH v2 — routers/admin_productos.py
#  Endpoints:
#    GET /admin/productos/        (lista para edición)
#    PUT /admin/productos/{id}    (editar producto + imagen)
#  Reemplaza: gestionar_catalogo.php + editar_producto.py
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from typing import Optional
import os, uuid, shutil, json

from conexion import get_db
from dependencies import obtener_usuario_actual, solo_admin

router = APIRouter(prefix="/admin/productos", tags=["Admin — Productos"])

# Las imágenes se guardan relativas al frontend de v2
UPLOAD_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "frontend", "img", "productos"
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ── GET /admin/productos/ ─────────────────────────────────────
@router.get("/")
def listar_productos_admin(
    usuario: dict = Depends(obtener_usuario_actual),
    db=Depends(get_db),
):
    solo_admin(usuario)

    with db.cursor() as cur:
        cur.execute(
            "SELECT id, nombre, descripcion, categoria, precio_base, stock, "
            "imagen_url, imagenes_colores, activo "
            "FROM productos_blancos ORDER BY nombre ASC"
        )
        productos = cur.fetchall()

    for p in productos:
        p["precio_base"] = float(p["precio_base"])

    return {"productos": productos}


# ── PUT /admin/productos/{id} ─────────────────────────────────
@router.put("/{producto_id}")
def editar_producto(
    producto_id: int,
    nombre:               str            = Form(...),
    descripcion:          str            = Form(""),
    categoria:            str            = Form("otro"),
    precio_base:          float          = Form(...),
    stock:                int            = Form(0),
    imagen_url_existente: Optional[str]  = Form(None),
    colores_nombres:      Optional[str]  = Form(None),
    colores_urls:         Optional[str]  = Form(None),
    imagen:               Optional[UploadFile] = File(None),
    usuario: dict = Depends(obtener_usuario_actual),
    db=Depends(get_db),
):
    solo_admin(usuario)

    if len(nombre.strip()) < 3:
        raise HTTPException(400, "El nombre debe tener al menos 3 caracteres.")
    if precio_base <= 0:
        raise HTTPException(400, "El precio debe ser mayor a 0.")

    try:
        with db.cursor() as cur:
            # 1. Imagen principal
            imagen_final = None
            if imagen and imagen.filename:
                ext      = imagen.filename.rsplit(".", 1)[-1]
                filename = f"prod_{uuid.uuid4().hex[:8]}.{ext}"
                path     = os.path.join(UPLOAD_DIR, filename)
                with open(path, "wb") as buf:
                    shutil.copyfileobj(imagen.file, buf)
                imagen_final = f"img/productos/{filename}"
            elif imagen_url_existente:
                imagen_final = imagen_url_existente
            else:
                cur.execute(
                    "SELECT imagen_url FROM productos_blancos WHERE id = %s",
                    (producto_id,),
                )
                row = cur.fetchone()
                imagen_final = row["imagen_url"] if row else None

            # 2. Imágenes por color (JSON)
            colores_json = None
            if colores_nombres and colores_urls:
                try:
                    nombres = json.loads(colores_nombres)
                    urls    = json.loads(colores_urls)
                    mapa    = {c.strip(): u.strip() for c, u in zip(nombres, urls)
                               if c.strip() and u.strip()}
                    if mapa:
                        colores_json = json.dumps(mapa, ensure_ascii=False)
                except json.JSONDecodeError:
                    pass

            # 3. UPDATE
            cur.execute(
                """UPDATE productos_blancos
                   SET nombre=%s, descripcion=%s, categoria=%s, precio_base=%s,
                       stock=%s, imagen_url=%s, imagenes_colores=%s
                   WHERE id=%s""",
                (nombre.strip(), descripcion.strip(), categoria.strip(),
                 precio_base, stock, imagen_final, colores_json, producto_id),
            )
            db.commit()

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error editar_producto: {e}")
        raise HTTPException(500, "Error de base de datos al actualizar el producto.")

    return {
        "ok":        True,
        "mensaje":   "Producto actualizado correctamente.",
        "imagen_url": imagen_final,
    }
