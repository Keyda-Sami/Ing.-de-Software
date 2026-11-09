# ============================================================
#  SUBLI-TECH v2 — Conexión a Base de Datos
#  Reutilizado íntegramente de /php/conexion.py
# ============================================================

import pymysql
import pymysql.cursors
from fastapi import HTTPException

DB_HOST    = "localhost"
DB_PORT    = 3307
DB_NAME    = "sublitech"
DB_USER    = "root"
DB_PASS    = ""
DB_CHARSET = "utf8mb4"

def get_db():
    """
    Generador/Dependency Injection para FastAPI.
    Abre la conexión antes del endpoint y la cierra al finalizar.
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
            cursorclass=pymysql.cursors.DictCursor
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
            password=DB_PASS, database=DB_NAME, charset=DB_CHARSET
        )
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        conn.close()
        return True
    except Exception:
        return False
