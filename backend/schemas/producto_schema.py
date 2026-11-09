# ============================================================
#  SUBLI-TECH v2 — Esquemas Pydantic: Productos
# ============================================================

from pydantic import BaseModel
from typing import Optional


class ProductoUpdate(BaseModel):
    nombre: str
    descripcion: Optional[str] = ""
    categoria: Optional[str] = "otro"
    precio_base: float
    stock: int = 0
    imagen_url_existente: Optional[str] = None
