# ============================================================
#  SUBLI-TECH v2 — Esquemas Pydantic: Autenticación
# ============================================================

from pydantic import BaseModel, EmailStr


class UsuarioLogin(BaseModel):
    email: EmailStr
    password: str


class UsuarioRegistro(BaseModel):
    nombre: str
    email: EmailStr
    password: str
    telefono: str = ""
    ciudad: str = "Cochabamba"


class TokenResponse(BaseModel):
    mensaje: str
    access_token: str
    token_type: str = "bearer"
    rol: str
    nombre: str
