# ============================================================
#  SUBLI-TECH v2 — dependencies.py
#  Helper JWT compartido por todos los routers.
#  Reemplaza las sesiones PHP ($_SESSION) con tokens Bearer.
# ============================================================

from fastapi import HTTPException, status, Header
from typing import Optional
import jwt

SECRET_KEY = "tu_clave_secreta_super_segura_para_sublitech"
ALGORITHM  = "HS256"


def obtener_usuario_actual(authorization: Optional[str] = Header(None)) -> dict:
    """
    Extrae y valida el JWT del header 'Authorization: Bearer <token>'.
    Retorna el payload: { id, sub (email), nombre, rol }
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Debes iniciar sesión para acceder a este recurso.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión ha expirado. Por favor, vuelve a iniciar sesión.",
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido.",
        )


def solo_admin(usuario: dict = None) -> dict:
    """
    Wrapper que valida que el usuario tenga rol 'admin'.
    Usar después de obtener_usuario_actual.
    """
    if not usuario or usuario.get("rol") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Solo administradores.",
        )
    return usuario


def solo_cliente(usuario: dict = None) -> dict:
    """
    Wrapper que valida que el usuario sea 'cliente' (no admin).
    """
    if not usuario or usuario.get("rol") == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Los administradores no pueden realizar esta acción como cliente.",
        )
    return usuario
