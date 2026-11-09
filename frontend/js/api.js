/**
 * ============================================================
 *  SUBLI-TECH v2 — js/api.js
 *  Cliente HTTP centralizado (Fetch API).
 *  TODOS los archivos JS consumen la API a través de este módulo.
 *  Ningún otro archivo hace fetch() directamente.
 * ============================================================
 */

'use strict';

/** URL base del backend FastAPI */
const API_BASE = 'https://subli-tech-backend.onrender.com';

/**
 * Exponer API_BASE globalmente para que otros módulos
 * puedan construir URLs de imágenes.
 */
window.API_BASE = API_BASE;

/** Clave usada en localStorage para guardar el token JWT */
const TOKEN_KEY = 'st_token';
/** Clave usada en localStorage para guardar los datos del usuario */
const USER_KEY  = 'st_user';

/* ──────────────────────────────────────────────────────────
   GESTIÓN DE SESIÓN (token + datos de usuario)
   ────────────────────────────────────────────────────────── */

/**
 * Guarda el token y los datos del usuario tras login/registro.
 * @param {string} token        - JWT access_token
 * @param {{ nombre, rol, email }} userData
 */
function guardarSesion(token, userData) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY,  JSON.stringify(userData));
}

/** Elimina el token y los datos del usuario (logout). */
function borrarSesion() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Retorna el token JWT o null si no hay sesión. */
function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

/** Retorna los datos del usuario { nombre, rol, email } o null. */
function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

/** Retorna true si hay una sesión activa. */
function isLoggedIn() {
  return !!getToken();
}

/* ──────────────────────────────────────────────────────────
   FUNCIÓN CENTRAL DE PETICIÓN
   ────────────────────────────────────────────────────────── */

/**
 * Realiza una petición HTTP a la API de Subli-Tech.
 *
 * @param {string}  path          - Ruta del endpoint, ej: '/auth/login'
 * @param {object}  [options]     - Opciones adicionales de fetch
 * @param {string}  [options.method='GET']
 * @param {object}  [options.body]  - Se serializa automáticamente a JSON
 * @param {boolean} [options.auth=false]  - Si true, adjunta el Bearer token
 * @param {boolean} [options.isForm=false] - Si true, body es FormData (no serializar)
 * @returns {Promise<any>}  - Respuesta parseada como JSON
 * @throws {Error}          - Con el `detail` del error HTTP del backend
 */
async function apiFetch(path, { method = 'GET', body, auth = false, isForm = false } = {}) {
  const url     = `${API_BASE}${path}`;
  const headers = {};

  // Adjuntar token si se requiere autenticación
  if (auth) {
    const token = getToken();
    if (!token) throw new Error('No hay sesión activa. Por favor, inicia sesión.');
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Serializar body como JSON (a menos que sea FormData)
  let fetchBody;
  if (body) {
    if (isForm) {
      fetchBody = body; // body ya es FormData
    } else {
      headers['Content-Type'] = 'application/json';
      fetchBody = JSON.stringify(body);
    }
  }

  const response = await fetch(url, { method, headers, body: fetchBody });

  // Manejar respuestas de error HTTP
  if (!response.ok) {
    // Si es 401, limpiar sesión y redirigir al login
    if (response.status === 401) {
      borrarSesion();
      if (!window.location.pathname.includes('login')) {
        window.location.href = 'login.html?error=' + encodeURIComponent('Sesión expirada. Inicia sesión nuevamente.');
      }
    }
    let detail = `Error ${response.status}`;
    try {
      const errData = await response.json();
      detail = errData.detail || detail;
    } catch {/* no-op */}
    throw new Error(detail);
  }

  return response.json();
}

/* ──────────────────────────────────────────────────────────
   MÉTODOS DE CONVENIENCIA (sugar)
   ────────────────────────────────────────────────────────── */

const API = {
  // ── Auth ────────────────────────────────────────────────
  login:    (email, password)        => apiFetch('/auth/login',    { method: 'POST', body: { email, password } }),
  register: (data)                   => apiFetch('/auth/register', { method: 'POST', body: data }),
  logout:   ()                       => apiFetch('/auth/logout',   { method: 'POST' }),
  me:       ()                       => apiFetch('/auth/me',       { auth: true }),

  // ── Catálogo ─────────────────────────────────────────────
  productos:   (categoria)           => apiFetch(`/productos/${categoria ? '?categoria=' + categoria : ''}`),
  producto:    (id)                  => apiFetch(`/productos/${id}`),

  // ── Pedidos (cliente) ─────────────────────────────────────
  crearPedido:    (data)             => apiFetch('/pedidos/',          { method: 'POST', body: data, auth: true }),
  misPedidos:     ()                 => apiFetch('/pedidos/mis-pedidos', { auth: true }),
  detallePedido:  (id)               => apiFetch(`/pedidos/${id}/detalle`, { auth: true }),
  actualizarNotas:(id, notas)        => apiFetch(`/pedidos/${id}/notas`, { method: 'PUT', body: { notas }, auth: true }),
  cancelarPedido: (id)               => apiFetch(`/pedidos/${id}`, { method: 'DELETE', auth: true }),
  aprobarDiseno:  (id)               => apiFetch(`/pedidos/${id}/aprobar-diseno`, { method: 'POST', auth: true }),
  rechazarDiseno: (id, observacion)  => apiFetch(`/pedidos/${id}/rechazar-diseno`, { method: 'POST', body: { observacion }, auth: true }),

  // ── Descuentos ────────────────────────────────────────────
  validarDescuento: (codigo)         => apiFetch('/descuentos/validar', { method: 'POST', body: { codigo } }),

  // ── Admin — Pedidos ───────────────────────────────────────
  adminStats:          ()            => apiFetch('/admin/pedidos/stats',  { auth: true }),
  adminPedidos:        (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([,v]) => v != null && v !== ''))
    ).toString();
    return apiFetch(`/admin/pedidos/${qs ? '?' + qs : ''}`, { auth: true });
  },
  adminCambiarEstado: (id, estado)   => apiFetch(`/admin/pedidos/${id}/estado`, {
    method: 'PUT', body: { estado }, auth: true,
  }),
  adminSubirDiseno:   (id, url_diseno) => apiFetch(`/admin/pedidos/${id}/diseno`, {
    method: 'POST', body: { url_diseno }, auth: true,
  }),
  adminDetallePedido: (id)           => apiFetch(`/admin/pedidos/${id}/detalle`, { auth: true }),

  // ── Admin — Productos ─────────────────────────────────────
  adminProductos:   ()               => apiFetch('/admin/productos/', { auth: true }),
  adminEditarProducto: (id, formData) => apiFetch(`/admin/productos/${id}`, {
    method: 'PUT', body: formData, auth: true, isForm: true,
  }),
};

/**
 * Construye la URL completa de una imagen del backend.
 * @param {string} imagen_url - Ruta relativa tal como viene de la API (ej: "img/productos/xx.jpg")
 * @returns {string} URL absoluta para usar en <img src="...">
 */
function imgUrl(imagen_url) {
  if (!imagen_url) return '../img/placeholder.jpg';
  // Si ya es una URL absoluta, retornar tal cual
  if (imagen_url.startsWith('http')) return imagen_url;
  // Eliminar "img/" del inicio si existe y construir URL del backend
  const ruta = imagen_url.replace(/^img\//, '');
  return `${API_BASE}/img/${ruta}`;
}
