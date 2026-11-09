# ============================================================
#  SUBLI-TECH v2 — routers/pedidos.py
#  Endpoints:
#    POST /pedidos/              (crear pedido desde carrito)
#    GET  /pedidos/mis-pedidos   (pedidos del cliente logueado)
#    GET  /pedidos/{id}/detalle  (líneas de un pedido)
#  Reemplaza: php/crear_pedido.php + mis_pedidos.php
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional

from conexion import get_db
from dependencies import obtener_usuario_actual, solo_cliente
from schemas.pedido_schema import PedidoCreate

# Importar tabla de descuentos para validar código al crear pedido
_CODIGOS_DESCUENTO: dict = {
    "SUBLI10":    {"descuento": 10,  "tipo": "porcentaje"},
    "BIENVENIDO": {"descuento": 50,  "tipo": "fijo"},
    "SUBLI20":    {"descuento": 20,  "tipo": "porcentaje"},
    "PRIMERA":    {"descuento": 15,  "tipo": "porcentaje"},
    "NAVIDAD":    {"descuento": 100, "tipo": "fijo"},
}

router = APIRouter(prefix="/pedidos", tags=["Pedidos"])

TALLAS_VALIDAS  = {"XS", "S", "M", "L", "XL", "XXL", "Única"}
METODOS_VALIDOS = {"QR", "Transferencia", "Efectivo"}


# ── POST /pedidos/ ────────────────────────────────────────────
@router.post("/", status_code=status.HTTP_201_CREATED)
def crear_pedido(
    pedido: PedidoCreate,
    usuario: dict = Depends(obtener_usuario_actual),
    db=Depends(get_db),
):
    """
    Crea un pedido a partir de los items del carrito (localStorage).
    Requiere JWT con rol 'cliente'.
    Reemplaza php/crear_pedido.php + procesar_pedido.php.
    """
    solo_cliente(usuario)

    if pedido.metodo_pago not in METODOS_VALIDOS:
        raise HTTPException(400, f"Método de pago inválido. Usa: {', '.join(METODOS_VALIDOS)}.")
    if not pedido.items:
        raise HTTPException(400, "El carrito está vacío.")

    user_id = usuario["id"]

    # ── Validar stock de cada item antes de crear el pedido ───
    try:
        with db.cursor() as cur:
            for item in pedido.items:
                cur.execute(
                    "SELECT stock, nombre FROM productos_blancos WHERE id = %s AND activo = 1",
                    (item.id_producto,),
                )
                prod = cur.fetchone()
                if not prod:
                    raise HTTPException(400, f"Producto ID {item.id_producto} no existe o está inactivo.")
                stock_disponible = int(prod.get("stock") or 0)
                if stock_disponible < item.cantidad:
                    raise HTTPException(
                        400,
                        f"Stock insuficiente para '{prod['nombre']}'. "
                        f"Disponible: {stock_disponible}, solicitado: {item.cantidad}."
                    )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error al verificar stock: {e}")

    # ── Calcular totales con descuento ────────────────────────
    subtotal = sum(i.precio_unitario * i.cantidad for i in pedido.items)

    descuento_monto = 0.0
    codigo_usado    = None
    if pedido.codigo_descuento:
        codigo = pedido.codigo_descuento.strip().upper()
        info   = _CODIGOS_DESCUENTO.get(codigo)
        if info:
            if info["tipo"] == "porcentaje":
                descuento_monto = round(subtotal * info["descuento"] / 100, 2)
            else:
                descuento_monto = float(info["descuento"])
            descuento_monto = min(descuento_monto, subtotal)  # no bajar de 0
            codigo_usado    = codigo

    monto_total    = round(subtotal - descuento_monto, 2)
    monto_anticipo = round(monto_total * 0.5, 2)

    # ── Notas enriquecidas con descuento ─────────────────────
    notas_base = pedido.notas or ""
    if codigo_usado:
        info_codigo = _CODIGOS_DESCUENTO[codigo_usado]
        notas_base = (
            f"[DESCUENTO {codigo_usado}: -{info_codigo['descuento']}"
            f"{'%' if info_codigo['tipo'] == 'porcentaje' else ' Bs.'} = Bs. {descuento_monto:.0f}] "
            + notas_base
        ).strip()[:500]

    try:
        with db.cursor() as cur:
            cur.execute(
                """INSERT INTO pedidos
                   (id_usuario, estado, monto_total, monto_anticipo, anticipo_pagado,
                    metodo_pago, notas, created_at, updated_at)
                   VALUES (%s, 'En proceso', %s, %s, 1, %s, %s, NOW(), NOW())""",
                (user_id, monto_total, monto_anticipo,
                 pedido.metodo_pago, notas_base or None),
            )
            pedido_id = cur.lastrowid

            for item in pedido.items:
                talla      = item.talla if item.talla in TALLAS_VALIDAS else "M"
                color_base = (item.color_base or "Blanco").strip()[:50] or "Blanco"
                cur.execute(
                    """INSERT INTO detalle_pedido
                       (id_pedido, id_producto, talla, color_base, cantidad, precio_unitario)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    (pedido_id, item.id_producto, talla, color_base,
                     item.cantidad, item.precio_unitario),
                )
                # Descontar stock
                cur.execute(
                    "UPDATE productos_blancos SET stock = stock - %s WHERE id = %s",
                    (item.cantidad, item.id_producto),
                )

            db.commit()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error crear_pedido: {e}")
        raise HTTPException(500, "Error de base de datos al guardar el pedido.")

    return {
        "ok":               True,
        "pedido_id":        pedido_id,
        "subtotal":         subtotal,
        "descuento_monto":  descuento_monto,
        "codigo_descuento": codigo_usado,
        "monto_total":      monto_total,
        "monto_anticipo":   monto_anticipo,
        "mensaje":          "¡Pedido creado exitosamente! Anticipo marcado como pagado.",
    }


# ── GET /pedidos/mis-pedidos ──────────────────────────────────
@router.get("/mis-pedidos")
def mis_pedidos(
    usuario: dict = Depends(obtener_usuario_actual),
    db=Depends(get_db),
):
    """
    Retorna todos los pedidos del cliente autenticado con sus items.
    Reemplaza la consulta SQL de mis_pedidos.php.
    """
    user_id = usuario["id"]

    with db.cursor() as cur:
        cur.execute(
            """SELECT p.id, p.estado, p.monto_total, p.monto_anticipo,
                      p.anticipo_pagado, p.metodo_pago, p.notas, p.url_diseno,
                      p.created_at, p.updated_at,
                      COUNT(dp.id)     AS lineas,
                      SUM(dp.cantidad) AS unidades
               FROM pedidos p
               LEFT JOIN detalle_pedido dp ON dp.id_pedido = p.id
               WHERE p.id_usuario = %s
               GROUP BY p.id
               ORDER BY p.created_at DESC""",
            (user_id,),
        )
        pedidos = cur.fetchall()

        # Cargar items de cada pedido
        for p in pedidos:
            cur.execute(
                """SELECT dp.talla, dp.color_base, dp.cantidad, dp.precio_unitario,
                          pb.nombre AS producto_nombre, pb.categoria, pb.imagen_url
                   FROM detalle_pedido dp
                   JOIN productos_blancos pb ON pb.id = dp.id_producto
                   WHERE dp.id_pedido = %s""",
                (p["id"],),
            )
            items = cur.fetchall()
            for it in items:
                it["precio_unitario"] = float(it["precio_unitario"])
            p["items"]         = items
            p["monto_total"]   = float(p["monto_total"])
            p["monto_anticipo"] = float(p["monto_anticipo"])
            if p["created_at"]:
                p["created_at"] = p["created_at"].isoformat()
            if p["updated_at"]:
                p["updated_at"] = p["updated_at"].isoformat()

    # Stats rápidas
    stats = {
        "total":         len(pedidos),
        "en_produccion": sum(1 for p in pedidos if p["estado"] != "Listo para entrega"),
        "listos":        sum(1 for p in pedidos if p["estado"] == "Listo para entrega"),
    }

    return {"pedidos": pedidos, "stats": stats, "usuario": usuario.get("nombre")}


# ── GET /pedidos/{id}/detalle ─────────────────────────────────
@router.get("/{pedido_id}/detalle")
def detalle_pedido(
    pedido_id: int,
    usuario: dict = Depends(obtener_usuario_actual),
    db=Depends(get_db),
):
    """
    Retorna las líneas de detalle de un pedido específico.
    Solo el dueño del pedido puede verlo.
    """
    user_id = usuario["id"]

    with db.cursor() as cur:
        cur.execute(
            "SELECT id FROM pedidos WHERE id = %s AND id_usuario = %s",
            (pedido_id, user_id),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Pedido no encontrado o no pertenece a tu cuenta.")

        cur.execute(
            """SELECT dp.talla, dp.color_base, dp.cantidad, dp.precio_unitario, dp.subtotal,
                      pb.nombre AS producto_nombre, pb.categoria, pb.imagen_url
               FROM detalle_pedido dp
               JOIN productos_blancos pb ON pb.id = dp.id_producto
               WHERE dp.id_pedido = %s""",
            (pedido_id,),
        )
        items = cur.fetchall()

    for it in items:
        it["precio_unitario"] = float(it["precio_unitario"])
        it["subtotal"]        = float(it["subtotal"]) if it["subtotal"] else 0.0

    return {"pedido_id": pedido_id, "items": items}


# ── PUT /pedidos/{id}/notas ───────────────────────────────────
@router.put("/{pedido_id}/notas")
def actualizar_notas(
    pedido_id: int,
    payload: dict,
    usuario: dict = Depends(obtener_usuario_actual),
    db=Depends(get_db),
):
    user_id = usuario["id"]
    notas = str(payload.get("notas", "")).strip()[:500]

    with db.cursor() as cur:
        cur.execute("SELECT id, estado FROM pedidos WHERE id = %s AND id_usuario = %s", (pedido_id, user_id))
        ped = cur.fetchone()
        if not ped:
            raise HTTPException(404, "Pedido no encontrado o no pertenece a tu cuenta.")
        if ped["estado"] != "En proceso":
            raise HTTPException(400, "Solo se pueden editar notas de pedidos en estado 'En proceso'.")

        cur.execute(
            "UPDATE pedidos SET notas = %s, updated_at = NOW() WHERE id = %s AND id_usuario = %s",
            (notas or None, pedido_id, user_id),
        )
        db.commit()

    return {"ok": True, "mensaje": "Notas actualizadas exitosamente."}


# ── DELETE /pedidos/{id} ──────────────────────────────────────
@router.delete("/{pedido_id}")
def cancelar_pedido(
    pedido_id: int,
    usuario: dict = Depends(obtener_usuario_actual),
    db=Depends(get_db),
):
    user_id = usuario["id"]

    try:
        with db.cursor() as cur:
            cur.execute("SELECT id, estado FROM pedidos WHERE id = %s AND id_usuario = %s", (pedido_id, user_id))
            ped = cur.fetchone()
            if not ped:
                raise HTTPException(404, "Pedido no encontrado o no pertenece a tu cuenta.")
            if ped["estado"] != "En proceso":
                raise HTTPException(400, "Solo se pueden cancelar pedidos en estado 'En proceso'.")

            cur.execute("DELETE FROM detalle_pedido WHERE id_pedido = %s", (pedido_id,))
            cur.execute("DELETE FROM pedidos WHERE id = %s AND id_usuario = %s", (pedido_id, user_id))
            db.commit()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error al cancelar pedido: {e}")

    return {"ok": True, "mensaje": "Pedido cancelado correctamente."}


# ── POST /pedidos/{id}/aprobar-diseno ─────────────────────────
@router.post("/{pedido_id}/aprobar-diseno")
def aprobar_diseno(
    pedido_id: int,
    usuario: dict = Depends(obtener_usuario_actual),
    db=Depends(get_db),
):
    user_id = usuario["id"]

    with db.cursor() as cur:
        cur.execute("SELECT id, estado FROM pedidos WHERE id = %s AND id_usuario = %s", (pedido_id, user_id))
        ped = cur.fetchone()
        if not ped:
            raise HTTPException(404, "Pedido no encontrado o no pertenece a tu cuenta.")
        if ped["estado"] != "Esperando Aprobación":
            raise HTTPException(400, "Este pedido no está esperando aprobación.")

        cur.execute(
            "UPDATE pedidos SET estado = 'En impresión', updated_at = NOW() WHERE id = %s AND id_usuario = %s",
            (pedido_id, user_id),
        )
        db.commit()

    return {"ok": True, "estado": "En impresión", "mensaje": "¡Diseño aprobado! Comenzando impresión."}


# ── POST /pedidos/{id}/rechazar-diseno ────────────────────────
@router.post("/{pedido_id}/rechazar-diseno")
def rechazar_diseno(
    pedido_id: int,
    payload: dict,
    usuario: dict = Depends(obtener_usuario_actual),
    db=Depends(get_db),
):
    user_id = usuario["id"]
    obs = str(payload.get("observacion", "")).strip()[:1000]
    if not obs:
        raise HTTPException(400, "Debes ingresar una observación para rechazar el diseño.")

    with db.cursor() as cur:
        cur.execute("SELECT id, estado, notas FROM pedidos WHERE id = %s AND id_usuario = %s", (pedido_id, user_id))
        ped = cur.fetchone()
        if not ped:
            raise HTTPException(404, "Pedido no encontrado o no pertenece a tu cuenta.")
        if ped["estado"] != "Esperando Aprobación":
            raise HTTPException(400, "Este pedido no está esperando aprobación.")

        nota_actual = ped.get("notas") or ""
        nueva_nota = f"{nota_actual}\n\n❌ RECHAZO: {obs}".strip()[:1000]

        cur.execute(
            """UPDATE pedidos
               SET estado = 'En diseño', url_diseno = NULL, notas = %s, updated_at = NOW()
               WHERE id = %s AND id_usuario = %s""",
            (nueva_nota, pedido_id, user_id),
        )
        db.commit()

    return {"ok": True, "estado": "En diseño", "mensaje": "Diseño rechazado. Tu observación fue enviada al diseñador."}
