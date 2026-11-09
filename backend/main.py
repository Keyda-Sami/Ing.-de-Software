# ============================================================
#  SUBLI-TECH v2 — main.py
#  Punto de entrada de la API FastAPI.
#  Ejecutar: uvicorn main:app --reload --port 8000
# ============================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from routers import auth, productos, pedidos, admin_pedidos, admin_productos, descuentos
from conexion import test_connection

app = FastAPI(
    title="Subli-Tech API v2",
    description="API RESTful — Backend Python/FastAPI para Subli-Tech Bolivia",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── CORS ─────────────────────────────────────────────────────
# Permite orígenes locales (file:// aparece como "null" en headers de CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:5500",
        "http://127.0.0.1",
        "http://127.0.0.1:5500",
        "null",          # file:// protocol → Origin: null
        "*",             # Desarrollo: quitar en producción
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Servir imágenes estáticas del frontend ────────────────────
FRONTEND_IMG = os.path.join(os.path.dirname(__file__), "..", "frontend", "img")
if os.path.isdir(FRONTEND_IMG):
    app.mount("/img", StaticFiles(directory=FRONTEND_IMG), name="images")

# ── Registrar routers ─────────────────────────────────────────
app.include_router(auth.router)
app.include_router(productos.router)
app.include_router(pedidos.router)
app.include_router(admin_pedidos.router)
app.include_router(admin_productos.router)
app.include_router(descuentos.router)


# ── Health check ──────────────────────────────────────────────
@app.get("/", tags=["Sistema"])
def raiz():
    db_ok = test_connection()
    return {
        "api":     "Subli-Tech v2",
        "estado":  "✅ En línea",
        "db":      "✅ Conectada" if db_ok else "❌ Sin conexión",
        "docs":    "/api/docs",
    }
