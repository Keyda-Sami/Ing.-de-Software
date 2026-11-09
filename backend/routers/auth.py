# ============================================================
#  SUBLI-TECH v2 — routers/auth.py
#  Endpoints: POST /auth/login, /auth/register, /auth/logout
#             GET  /auth/me
#  Reemplaza: php/auth.php + php/session.php
# ============================================================

from fastapi import APIRouter, HTTPException, Depends, status
from passlib.context import CryptContext
from datetime import datetime, timedelta
import jwt

from conexion import get_db
from dependencies import SECRET_KEY, ALGORITHM, obtener_usuario_actual
from schemas.auth_schema import UsuarioLogin, UsuarioRegistro

ACCESS_TOKEN_EXPIRE_MINUTES = 120

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter(prefix="/auth", tags=["Autenticación"])


# ── Helpers ──────────────────────────────────────────────────
def _crear_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ── POST /auth/register ───────────────────────────────────────
@router.post("/register", status_code=status.HTTP_201_CREATED)
def registrar_usuario(user: UsuarioRegistro, db=Depends(get_db)):
    if len(user.password) < 6:
        raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres.")

    with db.cursor() as cur:
        cur.execute("SELECT id FROM usuarios WHERE email = %s", (user.email,))
        if cur.fetchone():
            raise HTTPException(400, "Este email ya está registrado. Inicia sesión.")

        hashed = pwd_context.hash(user.password)
        try:
            cur.execute(
                "INSERT INTO usuarios (nombre, email, password, rol, telefono, ciudad) "
                "VALUES (%s, %s, %s, 'cliente', %s, %s)",
                (user.nombre, user.email, hashed, user.telefono, user.ciudad),
            )
            db.commit()
            new_id = cur.lastrowid
        except Exception as e:
            db.rollback()
            print(f"Error al registrar: {e}")
            raise HTTPException(500, "Error del servidor al registrar usuario.")

    token = _crear_token({"sub": user.email, "id": new_id, "nombre": user.nombre, "rol": "cliente"})
    return {"mensaje": "Registro exitoso", "access_token": token, "token_type": "bearer",
            "rol": "cliente", "nombre": user.nombre}


# ── POST /auth/login ──────────────────────────────────────────
@router.post("/login")
def iniciar_sesion(user: UsuarioLogin, db=Depends(get_db)):
    with db.cursor() as cur:
        cur.execute(
            "SELECT id, nombre, email, password, rol FROM usuarios WHERE email = %s LIMIT 1",
            (user.email,),
        )
        db_user = cur.fetchone()

    if not db_user or not pwd_context.verify(user.password, db_user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas. Verifica tu email y contraseña.",
        )

    token = _crear_token({
        "sub":    db_user["email"],
        "id":     db_user["id"],
        "nombre": db_user["nombre"],
        "rol":    db_user["rol"],
    })
    return {
        "mensaje":      "Login exitoso",
        "access_token": token,
        "token_type":   "bearer",
        "rol":          db_user["rol"],
        "nombre":       db_user["nombre"],
    }


# ── POST /auth/logout ─────────────────────────────────────────
@router.post("/logout")
def cerrar_sesion():
    # Stateless: el cliente borra el token del localStorage
    return {"mensaje": "Sesión cerrada. Elimina el token en el cliente."}


# ── GET /auth/me ──────────────────────────────────────────────
@router.get("/me")
def perfil_usuario(usuario: dict = Depends(obtener_usuario_actual)):
    """
    Reemplaza php/session.php — devuelve datos del usuario desde el JWT.
    El frontend llama esto al cargar para saber si hay sesión activa.
    """
    return {
        "loggedIn": True,
        "id":       usuario.get("id"),
        "nombre":   usuario.get("nombre"),
        "email":    usuario.get("sub"),
        "rol":      usuario.get("rol"),
    }
