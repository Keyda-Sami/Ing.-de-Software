# ============================================================
#  SUBLI-TECH v2 — routers/descuentos.py
#  Endpoint: POST /descuentos/validar
#  Valida un código promocional y retorna el descuento aplicable.
# ============================================================

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/descuentos", tags=["Descuentos"])

# ── Tabla de códigos promocionales ──────────────────────────
# Formato: "CODIGO": {"descuento": valor, "tipo": "porcentaje"|"fijo"}
# "porcentaje" => descuento en %, "fijo" => descuento en Bs.
CODIGOS_VALIDOS: dict = {
    "SUBLI10":    {"descuento": 10,  "tipo": "porcentaje", "descripcion": "10% de descuento"},
    "BIENVENIDO": {"descuento": 50,  "tipo": "fijo",       "descripcion": "Bs. 50 de descuento"},
    "SUBLI20":    {"descuento": 20,  "tipo": "porcentaje", "descripcion": "20% de descuento"},
    "PRIMERA":    {"descuento": 15,  "tipo": "porcentaje", "descripcion": "15% primera compra"},
    "NAVIDAD":    {"descuento": 100, "tipo": "fijo",       "descripcion": "Bs. 100 de descuento"},
}


class CodigoDescuentoIn(BaseModel):
    codigo: str


# ── POST /descuentos/validar ──────────────────────────────────
@router.post("/validar")
def validar_descuento(payload: CodigoDescuentoIn):
    """
    Valida un código promocional.
    Retorna { ok, descuento, tipo, descripcion } si es válido.
    Retorna HTTP 400 si el código no existe o es inválido.
    """
    codigo = payload.codigo.strip().upper()
    if not codigo:
        raise HTTPException(status_code=400, detail="Debes ingresar un código promocional.")

    info = CODIGOS_VALIDOS.get(codigo)
    if not info:
        raise HTTPException(status_code=400, detail="Código inválido o expirado.")

    return {
        "ok":          True,
        "codigo":      codigo,
        "descuento":   info["descuento"],
        "tipo":        info["tipo"],
        "descripcion": info["descripcion"],
    }
