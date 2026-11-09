# ============================================================
#  SUBLI-TECH v2 — Conexión a Base de Datos (Producción)
# ============================================================

import os
import pymysql
import pymysql.cursors
from fastapi import HTTPException

# Leemos las variables de entorno. Si no existen (ej. en tu PC local), usa los valores por defecto.
DB_HOST    = os.getenv("DB_HOST", "localhost")
DB_PORT    = int(os.getenv("DB_PORT", 3307))
DB_NAME    = os.getenv("DB_NAME", "sublitech")
DB_USER    = os.getenv("DB_USER", "root")
DB_PASS    = os.getenv("DB_PASSWORD", "")
DB_CHARSET = "utf8mb4"

# Configuración de SSL (Aiven lo requiere)
# Esto le dice a PyMySQL que use SSL sin verificar el certificado CA (más fácil para probar)
SSL_CONFIG = {"ssl": {"ssl_mode": "REQUIRED"}} 

def get_db():
    """
    Generador/Dependency Injection para FastAPI.
    """
    connection = None
    try:
        connection = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASS,
            database=DB_NAME,
            charset=DB_CHARSET,
            cursorclass=pymysql.cursors.DictCursor,
            **SSL_CONFIG  # <--- Aquí aplicamos el SSL
        )
        yield connection
    except Exception as e:
        print(f"Error de conexión BD: {e}")
        raise HTTPException(
            status_code=500,
            detail="No se pudo conectar a la base de datos."
        )
    finally:
        if connection and connection.open:
            connection.close()

def test_connection() -> bool:
    try:
        conn = pymysql.connect(
            host=DB_HOST, port=DB_PORT, user=DB_USER,
            password=DB_PASS, database=DB_NAME, charset=DB_CHARSET,
            **SSL_CONFIG
        )
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        conn.close()
        return True
    except Exception:
        return False
        