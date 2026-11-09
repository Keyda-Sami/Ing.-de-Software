# ============================================================
#  SUBLI-TECH v2 — routers/admin_pedidos.py
#  Endpoints:
#    GET /admin/pedidos/           (lista completa con filtros)
#    GET /admin/pedidos/stats      (KPIs del dashboard)
#    PUT /admin/pedidos/{id}/estado (cambiar estado de producción)
#  Reemplaza: dashboard.php (SSR PHP → JS + FastAPI)
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from conexion import get_db
from dependencies import obtener_usuario_actual, solo_admin

router = APIRouter(prefix="/admin/pedidos", tags=["Admin — Pedidos"])

ESTADOS_VALIDOS = [
    "En proceso", "En diseño", "Esperando Aprobación",
    "En impresión", "En planchado", "En costura", "Listo para entrega",
]

ESTADOS_CONFIG = {
    "En proceso":            {"color": "#EF4444", "bg": "rgba(239,68,68,0.12)",   "icon": "🔴", "next": "En diseño"},
    "En diseño":             {"color": "#7A00FF", "bg": "rgba(122,0,255,0.12)",   "icon": "🎨", "next": "Esperando Aprobación"},
    "Esperando Aprobación":  {"color": "#8B5CF6", "bg": "rgba(139,92,246,0.12)",  "icon": "⏳", "next": "En impresión"},
    "En impresión":          {"color": "#F59E0B", "bg": "rgba(245,158,11,0.12)",  "icon": "🟡", "next": "En planchado"},
    "En planchado":          {"color": "#F97316", "bg": "rgba(249,115,22,0.12)",  "icon": "🟠", "next": "En costura"},
    "En costura":            {"color": "#3B82F6", "bg": "rgba(59,130,246,0.12)",  "icon": "🧵", "next": "Listo para entrega"},
    "Listo para entrega":    {"color": "#10B981", "bg": "rgba(16,185,129,0.12)",  "icon": "✅", "next": None},
}


class EstadoUpdate(BaseModel):
    estado: str


# ── GET /admin/pedidos/stats ──────────────────────────────────
@router.get("/stats")
def estadisticas(
    usuario: dict = Depends(obtener_usuario_actual),
    db=Depends(get_db),
):
    solo_admin(usuario)

    with db.cursor() as cur:
        cur.execute("""
            SELECT
                COUNT(*)                                                         AS total,
                SUM(CASE WHEN estado != 'Listo para entrega' THEN 1 ELSE 0 END) AS en_produccion,
                SUM(CASE WHEN estado = 'Listo para entrega'  THEN 1 ELSE 0 END) AS listos,
                SUM(CASE WHEN estado = 'En proceso'          THEN 1 ELSE 0 END) AS nuevos,
                COALESCE(SUM(monto_total),    0)                                 AS ingresos_total,
                COALESCE(SUM(monto_anticipo), 0)                                 AS anticipos
            FROM pedidos
        """)
        stats = cur.fetchone()

        cur.execute("SELECT estado, COUNT(*) AS total FROM pedidos GROUP BY estado")
        counts_raw = cur.fetchall()

    counts = {r["estado"]: r["total"] for r in counts_raw}

    for key in ("ingresos_total", "anticipos"):
        stats[key] = float(stats[key])

    return {"stats": stats, "counts": counts, "estados_config": ESTADOS_CONFIG}


# ── GET /admin/pedidos/ ───────────────────────────────────────
@router.get("/")
def listar_pedidos(
    estado:  Optional[str] = Query(None),
    q:       Optional[str] = Query(None),
    usuario: dict = Depends(obtener_usuario_actual),
    db=Depends(get_db),
):
    solo_admin(usuario)

    conditions = []
    params     = []

    if estado and estado != "todos":
        conditions.append("p.estado = %s")
        params.append(estado)

    if q:
        conditions.append("(u.nombre LIKE %s OR u.email LIKE %s OR CAST(p.id AS CHAR) = %s)")
        params += [f"%{q}%", f"%{q}%", q]

    where_sql = "WHERE " + " AND ".join(conditions) if conditions else ""

    sql = f"""
        SELECT
            p.id, p.estado, p.monto_total, p.monto_anticipo,
            p.anticipo_pagado, p.notas, p.url_diseno,
            p.created_at, p.updated_at,
            u.nombre AS cliente, u.email, u.telefono,
            COUNT(dp.id)     AS lineas,
            SUM(dp.cantidad) AS items
        FROM pedidos p
        JOIN usuarios u ON u.id = p.id_usuario
        LEFT JOIN detalle_pedido dp ON dp.id_pedido = p.id
        {where_sql}
        GROUP BY p.id
        ORDER BY
            CASE p.estado
                WHEN 'En proceso'           THEN 1
                WHEN 'En diseño'            THEN 2
                WHEN 'Esperando Aprobación' THEN 3
                WHEN 'En impresión'         THEN 4
                WHEN 'En planchado'         THEN 5
                WHEN 'En costura'           THEN 6
                WHEN 'Listo para entrega'   THEN 7
            END, p.created_at DESC
        LIMIT 100
    """

    with db.cursor() as cur:
        cur.execute(sql, params)
        pedidos = cur.fetchall()

        for p in pedidos:
            p["monto_total"]    = float(p["monto_total"])
            p["monto_anticipo"] = float(p["monto_anticipo"])
            if p["created_at"]:
                p["created_at"] = p["created_at"].isoformat()
            if p["updated_at"]:
                p["updated_at"] = p["updated_at"].isoformat()
            # Config de estado (color, icono, next)
            p["estado_config"] = ESTADOS_CONFIG.get(p["estado"], {})

    return {"pedidos": pedidos, "total": len(pedidos)}


# ── PUT /admin/pedidos/{id}/estado ────────────────────────────
@router.put("/{pedido_id}/estado")
def actualizar_estado(
    pedido_id: int,
    body: EstadoUpdate,
    usuario: dict = Depends(obtener_usuario_actual),
    db=Depends(get_db),
):
    solo_admin(usuario)

    if body.estado not in ESTADOS_VALIDOS:
        raise HTTPException(400, f"Estado inválido. Usa uno de: {', '.join(ESTADOS_VALIDOS)}.")

    with db.cursor() as cur:
        cur.execute("SELECT id FROM pedidos WHERE id = %s", (pedido_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Pedido no encontrado.")

        cur.execute(
            "UPDATE pedidos SET estado = %s, updated_at = NOW() WHERE id = %s",
            (body.estado, pedido_id),
        )
        db.commit()

    return {
        "ok":        True,
        "pedido_id": pedido_id,
        "estado":    body.estado,
        "config":    ESTADOS_CONFIG.get(body.estado, {}),
        "mensaje":   f"Pedido #{pedido_id} actualizado a '{body.estado}'.",
    }


# ── POST /admin/pedidos/{id}/diseno ───────────────────────────
@router.post("/{pedido_id}/diseno")
def subir_diseno(
    pedido_id: int,
    payload: dict,
    usuario: dict = Depends(obtener_usuario_actual),
    db=Depends(get_db),
):
    solo_admin(usuario)
    url_diseno = str(payload.get("url_diseno", "")).strip()[:500]
    if not url_diseno:
        raise HTTPException(400, "Debes proporcionar una URL válida para el diseño.")

    with db.cursor() as cur:
        cur.execute("SELECT id FROM pedidos WHERE id = %s", (pedido_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Pedido no encontrado.")

        cur.execute(
            """UPDATE pedidos
               SET url_diseno = %s, estado = 'Esperando Aprobación', updated_at = NOW()
               WHERE id = %s""",
            (url_diseno, pedido_id),
        )
        db.commit()

    return {
        "ok": True,
        "pedido_id": pedido_id,
        "estado": "Esperando Aprobación",
        "url_diseno": url_diseno,
        "mensaje": "Diseño subido. El pedido ahora está en espera de aprobación del cliente.",
    }


# ── GET /admin/pedidos/{id}/detalle ───────────────────────────
@router.get("/{pedido_id}/detalle")
def admin_detalle_pedido(
    pedido_id: int,
    usuario: dict = Depends(obtener_usuario_actual),
    db=Depends(get_db),
):
    solo_admin(usuario)

    with db.cursor() as cur:
        cur.execute(
            """SELECT p.*, u.nombre AS cliente_nombre, u.email AS cliente_email, u.telefono AS cliente_telefono
               FROM pedidos p
               JOIN usuarios u ON u.id = p.id_usuario
               WHERE p.id = %s""",
            (pedido_id,),
        )
        pedido = cur.fetchone()
        if not pedido:
            raise HTTPException(404, "Pedido no encontrado.")

        cur.execute(
            """SELECT dp.*, pb.nombre AS producto_nombre, pb.categoria, pb.imagen_url
               FROM detalle_pedido dp
               JOIN productos_blancos pb ON pb.id = dp.id_producto
               WHERE dp.id_pedido = %s""",
            (pedido_id,),
        )
        items = cur.fetchall()

    pedido["monto_total"]    = float(pedido["monto_total"])
    pedido["monto_anticipo"] = float(pedido["monto_anticipo"])
    if pedido.get("created_at"):
        pedido["created_at"] = pedido["created_at"].isoformat()
    if pedido.get("updated_at"):
        pedido["updated_at"] = pedido["updated_at"].isoformat()

    for it in items:
        it["precio_unitario"] = float(it["precio_unitario"])
        it["subtotal"]        = float(it["subtotal"]) if it.get("subtotal") else 0.0

    return {"pedido": pedido, "items": items}
