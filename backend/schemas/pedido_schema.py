# ============================================================
#  SUBLI-TECH v2 — Esquemas Pydantic: Pedidos
# ============================================================

from pydantic import BaseModel, Field
from typing import List, Optional


class ItemPedido(BaseModel):
    id_producto: int
    nombre: Optional[str] = None
    precio_unitario: float = Field(..., gt=0, description="Precio en Bolivianos")
    cantidad: int = Field(..., gt=0)
    talla: Optional[str] = "M"
    color_base: Optional[str] = "Blanco"


class PedidoCreate(BaseModel):
    items: List[ItemPedido]
    metodo_pago: str = Field(..., description="QR | Transferencia | Efectivo")
    notas: Optional[str] = ""
    codigo_descuento: Optional[str] = None   # Código promo (ej. "SUBLI10")
    descuento_monto: Optional[float] = 0.0   # Monto del descuento calculado
