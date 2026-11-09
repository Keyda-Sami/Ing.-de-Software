/**
 * ============================================================
 *  SUBLI-TECH v2 — js/dashboard.js
 *  Lógica del panel administrativo (dashboard.html):
 *   - Protección de ruta (solo admin)
 *   - GET /admin/pedidos/stats       → KPIs y badges
 *   - GET /admin/pedidos/           → tabla de pedidos (con filtros y búsqueda)
 *   - PUT /admin/pedidos/{id}/estado → cambiar estado
 *   - POST /admin/pedidos/{id}/diseno → subir URL de diseño propuesto
 *   - GET /admin/pedidos/{id}/detalle → ver detalle completo en modal
 *   - GET /admin/productos/         → lista editable de productos
 *   - PUT /admin/productos/{id}     → editar producto
 *  Reemplaza: dashboard.php + gestionar_catalogo.php (PHP SSR → JS + FastAPI)
 * ============================================================
 */

'use strict';

/* ──────────────────────────────────────────────────────────
   ESTADO LOCAL
   ────────────────────────────────────────────────────────── */
let _pedidos         = [];
let _statsConfig     = {};
let _searchTimeout   = null;
let _filtroEstado    = 'todos';
let _currentDisenoId = null;

const ESTADOS_LIST = [
  'En proceso',
  'En diseño',
  'Esperando Aprobación',
  'En impresión',
  'En planchado',
  'En costura',
  'Listo para entrega',
];

const ESTADOS_CONFIG_FALLBACK = {
  'En proceso':            { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   icon: '🔴', next: 'En diseño' },
  'En diseño':             { color: '#7A00FF', bg: 'rgba(122,0,255,0.12)',   icon: '🎨', next: 'Esperando Aprobación' },
  'Esperando Aprobación':  { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  icon: '⏳', next: 'En impresión' },
  'En impresión':          { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  icon: '🟡', next: 'En planchado' },
  'En planchado':          { color: '#F97316', bg: 'rgba(249,115,22,0.12)',  icon: '🟠', next: 'En costura' },
  'En costura':            { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  icon: '🧵', next: 'Listo para entrega' },
  'Listo para entrega':    { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  icon: '✅', next: null },
};

/* ──────────────────────────────────────────────────────────
   UTILIDADES
   ────────────────────────────────────────────────────────── */
function formatBs(n) {
  return `Bs. ${Number(n).toLocaleString('es-BO', { minimumFractionDigits: 0 })}`;
}

function formatDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Toast */
function showToast(msg, type = 'default', duration = 3500) {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.setAttribute('role', 'alert');
  const icons = { success: '✅', error: '❌', default: '🔔' };
  t.innerHTML = `<span>${icons[type] || '🔔'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.classList.add('leaving');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

/* ──────────────────────────────────────────────────────────
   RENDER KPIs
   ────────────────────────────────────────────────────────── */
function renderStats(stats) {
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('stat-total',         stats.total || 0);
  set('stat-produccion',    stats.en_produccion || 0);
  set('stat-listos',        stats.listos || 0);
  set('stat-nuevos',        stats.nuevos || 0);

  const totalK = (stats.ingresos_total || 0) >= 1000 ? `${((stats.ingresos_total || 0) / 1000).toFixed(0)}K` : (stats.ingresos_total || 0);
  const antK = (stats.anticipos || 0) >= 1000 ? `${((stats.anticipos || 0) / 1000).toFixed(0)}K` : (stats.anticipos || 0);
  set('stat-ingresos',      `$${totalK}`);
  const antEl = document.getElementById('stat-anticipos-sub');
  if (antEl) antEl.textContent = `Anticip. $${antK} cobrados`;

  const totalBadge = document.getElementById('sidebar-total-badge');
  if (totalBadge) totalBadge.textContent = stats.total || 0;
}

/* ──────────────────────────────────────────────────────────
   RENDER TABLA DE PEDIDOS (HTML idéntico a dashboard.php)
   ────────────────────────────────────────────────────────── */
function renderPedidos(pedidos) {
  const tbody = document.getElementById('orders-tbody');
  const countEl = document.getElementById('table-count');
  if (countEl) countEl.textContent = `${pedidos.length} resultado(s)`;

  if (!tbody) return;

  if (!pedidos.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="table-empty">
            <div class="table-empty-icon">📭</div>
            <h4>No hay pedidos</h4>
            <p>No se encontraron pedidos con el filtro seleccionado.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pedidos.map(p => {
    const cfg = _statsConfig[p.estado] || ESTADOS_CONFIG_FALLBACK[p.estado] || ESTADOS_CONFIG_FALLBACK['En proceso'];
    const nextCfg = cfg.next ? (_statsConfig[cfg.next] || ESTADOS_CONFIG_FALLBACK[cfg.next] || {}) : null;
    const initial = (p.cliente || 'U')[0].toUpperCase();

    return `
      <tr data-id="${p.id}" id="row-${p.id}">
        <td><span class="order-id">#${String(p.id).padStart(3, '0')}</span></td>

        <td>
          <div class="client-cell">
            <div class="client-avatar">${initial}</div>
            <div>
              <div class="client-name">${escapeHtml(p.cliente)}</div>
              <div class="client-email">${escapeHtml(p.email)}</div>
            </div>
          </div>
        </td>

        <td>
          ${p.items || 0} artículo(s)<br>
          <span style="font-size:0.72rem;color:var(--text-light);">${p.lineas || 1} línea(s)</span>
        </td>

        <td>
          <div class="status-select-wrap">
            <select
              class="estado-select estado-select-row"
              data-id="${p.id}"
              id="select-estado-${p.id}"
              style="color:${cfg.color};background:${cfg.bg};"
              aria-label="Estado del pedido"
            >
              ${ESTADOS_LIST.map(e => {
                const ec = _statsConfig[e] || ESTADOS_CONFIG_FALLBACK[e] || {};
                return `<option value="${e}" ${p.estado === e ? 'selected' : ''}>${ec.icon || '·'} ${e}</option>`;
              }).join('')}
            </select>
          </div>
        </td>

        <td>
          <div class="monto-cell">${formatBs(p.monto_total)}</div>
        </td>

        <td>
          <div class="anticipo-cell">${formatBs(p.monto_anticipo)}</div>
          ${p.anticipo_pagado
            ? '<span class="pagado-badge">Pagado ✓</span>'
            : '<span class="pendiente-badge">Pendiente</span>'}
        </td>

        <td>
          <div class="date-cell">${formatDateShort(p.created_at)}</div>
          <div class="date-time">${formatTime(p.created_at)}</div>
        </td>

        <td>
          <div class="notes-cell" title="${escapeHtml(p.notas || '')}">
            ${p.notas ? escapeHtml(p.notas) : '<span style="color:var(--text-light)">—</span>'}
          </div>
        </td>

        <td>
          <div class="actions-cell">
            ${cfg.next ? `
              <button
                class="btn-advance"
                data-id="${p.id}"
                data-next="${escapeHtml(cfg.next)}"
                id="advance-${p.id}"
                style="background:${nextCfg ? nextCfg.bg : '#e0f2fe'};color:${nextCfg ? nextCfg.color : '#0284c7'};"
                title="Avanzar a: ${escapeHtml(cfg.next)}"
              >
                ${nextCfg ? nextCfg.icon : '▶'} Avanzar
              </button>
            ` : '<span style="font-size:0.72rem;color:var(--success);font-weight:600;">✅ Completo</span>'}

            ${['En proceso', 'En diseño', 'Esperando Aprobación'].includes(p.estado) ? `
              <button
                class="btn-detail btn-upload-diseno"
                data-id="${p.id}"
                data-current-url="${escapeHtml(p.url_diseno || '')}"
                id="upload-diseno-${p.id}"
                title="Subir URL del diseño"
                style="background:rgba(139,92,246,0.08);border-color:rgba(139,92,246,0.25);"
              >🖼️</button>
            ` : ''}

            <button class="btn-detail btn-ver-detalle" data-id="${p.id}" id="detail-${p.id}" title="Ver detalle">🔍</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  attachTableEvents();
}

/* ──────────────────────────────────────────────────────────
   EVENTOS DE LA TABLA
   ────────────────────────────────────────────────────────── */
function attachTableEvents() {
  // Select de estado
  document.querySelectorAll('.estado-select-row').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = parseInt(sel.dataset.id);
      const nuevo = sel.value;
      sel.disabled = true;
      const ok = await cambiarEstado(id, nuevo);
      if (!ok) sel.value = sel.dataset.prev || sel.options[0].value;
      sel.disabled = false;
    });
    sel.addEventListener('focus', () => { sel.dataset.prev = sel.value; });
  });

  // Botón avanzar
  document.querySelectorAll('.btn-advance').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      const next = btn.dataset.next;
      btn.disabled = true;
      await cambiarEstado(id, next);
      btn.disabled = false;
    });
  });

  // Botón ver detalle
  document.querySelectorAll('.btn-ver-detalle').forEach(btn => {
    btn.addEventListener('click', () => verDetallePedido(parseInt(btn.dataset.id)));
  });

  // Botón subir diseño
  document.querySelectorAll('.btn-upload-diseno').forEach(btn => {
    btn.addEventListener('click', () => abrirModalDiseno(parseInt(btn.dataset.id), btn.dataset.currentUrl));
  });
}

async function cambiarEstado(id, nuevoEstado) {
  try {
    await API.adminCambiarEstado(id, nuevoEstado);
    showToast(`Pedido #${String(id).padStart(3, '0')} → ${nuevoEstado}`, 'success');
    cargarStats();
    cargarPedidos({ estado: _filtroEstado });
    return true;
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
    return false;
  }
}

/* ──────────────────────────────────────────────────────────
   MODAL DETALLE DE PEDIDO (con carga de productos)
   ────────────────────────────────────────────────────────── */
async function verDetallePedido(id) {
  const modalOverlay = document.getElementById('modal-overlay');
  const modalBody    = document.getElementById('modal-body');
  const modalTitle   = document.getElementById('modal-title');
  if (!modalOverlay || !modalBody) return;

  if (modalTitle) modalTitle.textContent = `Detalle del Pedido #${String(id).padStart(4, '0')}`;
  modalBody.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:30px;">⏳ Cargando detalle…</p>';
  modalOverlay.classList.add('open');

  try {
    const data = await API.adminDetallePedido(id);
    const p = data.pedido;
    const items = data.items || [];

    modalBody.innerHTML = `
      <div class="modal-section">
        <h4>Información del Cliente</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <label>Nombre</label>
            <span>${escapeHtml(p.cliente_nombre)}</span>
          </div>
          <div class="detail-item">
            <label>Email</label>
            <span>${escapeHtml(p.cliente_email)}</span>
          </div>
          <div class="detail-item">
            <label>Teléfono</label>
            <span>${escapeHtml(p.cliente_telefono || 'No registrado')}</span>
          </div>
          <div class="detail-item">
            <label>Estado</label>
            <span style="font-weight:700;">${escapeHtml(p.estado)}</span>
          </div>
        </div>
      </div>

      <div class="modal-section">
        <h4>Productos del Pedido</h4>
        <table class="detail-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Talla</th>
              <th>Color</th>
              <th>Cant.</th>
              <th>Precio</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => `
              <tr>
                <td><strong>${escapeHtml(it.producto_nombre)}</strong></td>
                <td>${escapeHtml(it.talla)}</td>
                <td>${escapeHtml(it.color_base)}</td>
                <td>${it.cantidad}</td>
                <td>${formatBs(it.precio_unitario)}</td>
                <td>${formatBs(it.subtotal || it.precio_unitario * it.cantidad)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="modal-section">
        <h4>Resumen Económico</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <label>Monto Total</label>
            <span style="font-size:1.1rem;font-weight:800;color:var(--primary);">${formatBs(p.monto_total)}</span>
          </div>
          <div class="detail-item">
            <label>Anticipo (50%)</label>
            <span style="font-weight:700;color:var(--success);">${formatBs(p.monto_anticipo)} (${p.anticipo_pagado ? 'Pagado ✓' : 'Pendiente'})</span>
          </div>
          <div class="detail-item">
            <label>Método de Pago</label>
            <span>${escapeHtml(p.metodo_pago || 'No especificado')}</span>
          </div>
          <div class="detail-item">
            <label>Fecha Creación</label>
            <span>${formatDateShort(p.created_at)} ${formatTime(p.created_at)}</span>
          </div>
        </div>
      </div>

      ${p.notas ? `
        <div class="modal-section">
          <h4>Notas del Cliente</h4>
          <div style="background:var(--bg);padding:12px;border-radius:var(--radius-sm);border:1px solid var(--border);font-size:0.85rem;white-space:pre-wrap;">${escapeHtml(p.notas)}</div>
        </div>
      ` : ''}

      ${p.url_diseno ? `
        <div class="modal-section">
          <h4>Diseño Propuesto</h4>
          <a href="${escapeHtml(p.url_diseno)}" target="_blank" rel="noopener" style="color:var(--primary);font-weight:600;font-size:0.88rem;">🔗 Ver diseño externo ↗</a>
        </div>
      ` : ''}
    `;
  } catch (err) {
    modalBody.innerHTML = `<p style="text-align:center;color:var(--error);padding:20px;">Error al cargar: ${err.message}</p>`;
  }
}

/* ──────────────────────────────────────────────────────────
   MODAL DE SUBIDA DE DISEÑO
   ────────────────────────────────────────────────────────── */
function abrirModalDiseno(pedidoId, currentUrl) {
  _currentDisenoId = pedidoId;
  const overlay = document.getElementById('diseno-modal-overlay');
  const input   = document.getElementById('diseno-url-input');
  if (input) input.value = currentUrl || '';
  if (overlay) overlay.style.display = 'flex';
}

function cerrarModalDiseno() {
  const overlay = document.getElementById('diseno-modal-overlay');
  if (overlay) overlay.style.display = 'none';
  _currentDisenoId = null;
}

function initDisenoModal() {
  document.getElementById('diseno-modal-close')?.addEventListener('click', cerrarModalDiseno);
  document.getElementById('diseno-modal-cancel')?.addEventListener('click', cerrarModalDiseno);

  document.getElementById('diseno-submit-btn')?.addEventListener('click', async () => {
    if (!_currentDisenoId) return;
    const input = document.getElementById('diseno-url-input');
    const url = input ? input.value.trim() : '';
    if (!url) {
      showToast('Ingresa una URL válida para el diseño', 'error');
      return;
    }

    const btn = document.getElementById('diseno-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Enviando…'; }

    try {
      await API.adminSubirDiseno(_currentDisenoId, url);
      showToast(`Diseño subido para el Pedido #${_currentDisenoId} ✅`, 'success');
      cerrarModalDiseno();
      cargarStats();
      cargarPedidos({ estado: _filtroEstado });
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📤 Enviar Diseño'; }
    }
  });
}

/* ──────────────────────────────────────────────────────────
   CARGA DE PEDIDOS (con filtros)
   ────────────────────────────────────────────────────────── */
async function cargarPedidos(params = {}) {
  const tbody = document.getElementById('orders-tbody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted);">⏳ Cargando pedidos…</td></tr>`;
  }

  try {
    const { pedidos } = await API.adminPedidos(params);
    _pedidos = pedidos;
    renderPedidos(pedidos);
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--error);">${err.message}</td></tr>`;
    }
  }
}

/* ──────────────────────────────────────────────────────────
   CARGA DE STATS
   ────────────────────────────────────────────────────────── */
async function cargarStats() {
  try {
    const { stats, counts, estados_config } = await API.adminStats();
    _statsConfig = estados_config || ESTADOS_CONFIG_FALLBACK;
    renderStats(stats);

    // Contadores en botones de filtro
    document.querySelectorAll('.estado-filter-btn').forEach(btn => {
      const est = btn.dataset.estado;
      const countSpan = btn.querySelector('.filter-count');
      if (countSpan) {
        countSpan.textContent = est === 'todos' ? (stats.total || 0) : (counts[est] || 0);
      }
    });

    // Badges en el sidebar
    Object.entries(counts).forEach(([estado, total]) => {
      const badge = document.querySelector(`[data-estado-badge="${estado}"]`);
      if (badge) badge.textContent = total;
    });
  } catch (err) {
    console.error('Error stats:', err);
  }
}

/* ──────────────────────────────────────────────────────────
   FILTROS Y BÚSQUEDA
   ────────────────────────────────────────────────────────── */
function initFiltros() {
  // Filtros de barra superior
  document.querySelectorAll('.estado-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.estado-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _filtroEstado = btn.dataset.estado;
      const q = document.getElementById('search-input')?.value?.trim();
      cargarPedidos({ estado: _filtroEstado, q });
    });
  });

  // Filtros del sidebar
  document.querySelectorAll('[data-sidebar-filter]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const estado = link.dataset.sidebarFilter;
      _filtroEstado = estado;

      // Activar botón correspondiente en la barra
      document.querySelectorAll('.estado-filter-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.estado === estado);
      });
      document.querySelectorAll('.sidebar-link').forEach(s => s.classList.remove('active'));
      link.classList.add('active');

      // Asegurar pestaña pedidos
      activarTab('pedidos');
      cargarPedidos({ estado });
    });
  });

  // Búsqueda
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(_searchTimeout);
      _searchTimeout = setTimeout(() => {
        cargarPedidos({ q: searchInput.value.trim(), estado: _filtroEstado });
      }, 400);
    });
  }

  // Refresh
  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    const btn = document.getElementById('btn-refresh');
    btn?.classList.add('spinning');
    cargarStats();
    cargarPedidos({ estado: _filtroEstado }).then(() => {
      setTimeout(() => btn?.classList.remove('spinning'), 600);
    });
  });
}

/* ──────────────────────────────────────────────────────────
   GESTIÓN DE PRODUCTOS (pestaña catálogo)
   ────────────────────────────────────────────────────────── */
async function cargarProductosAdmin() {
  const container = document.getElementById('productos-admin-list');
  if (!container) return;

  container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-muted);">⏳ Cargando catálogo…</p>';
  try {
    const { productos } = await API.adminProductos();
    if (!productos || !productos.length) {
      container.innerHTML = '<p style="text-align:center;padding:40px;color:var(--text-muted);">No hay productos en la base de datos.</p>';
      return;
    }

    container.innerHTML = productos.map(p => {
      const imgPath = p.imagen_url ? (p.imagen_url.startsWith('img/') ? p.imagen_url : `img/${p.imagen_url}`) : 'img/logo.png';
      return `
        <div class="producto-admin-row" style="display:flex;align-items:center;gap:16px;padding:16px;border-bottom:1px solid var(--border);background:#fff;border-radius:var(--radius-md);margin-bottom:10px;box-shadow:var(--shadow-sm);">
          <img src="${imgPath}" alt="${escapeHtml(p.nombre)}"
            style="width:58px;height:58px;object-fit:cover;border-radius:10px;background:#F8F5FF;border:1px solid var(--border);"
            onerror="this.src='img/logo.png'"/>
          <div style="flex:1;min-width:0;">
            <div style="font-family:var(--font-title);font-weight:700;font-size:0.95rem;color:var(--text);">${escapeHtml(p.nombre)}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);">Categoría: <strong>${escapeHtml(p.categoria)}</strong> · Stock: <strong>${p.stock}</strong></div>
            <div style="font-size:0.74rem;color:var(--text-light);">${escapeHtml(p.descripcion || '')}</div>
          </div>
          <div style="font-family:var(--font-title);font-weight:800;color:var(--primary);font-size:1.1rem;white-space:nowrap;">
            ${formatBs(p.precio_base)}
          </div>
          <button class="btn-editar-producto btn-new-order" data-id="${p.id}"
            style="font-size:0.80rem;padding:8px 16px;">
            ✏️ Editar
          </button>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.btn-editar-producto').forEach(btn => {
      btn.addEventListener('click', () => abrirModalEdicion(+btn.dataset.id, productos));
    });
  } catch (err) {
    container.innerHTML = `<p style="text-align:center;color:var(--error);padding:30px;">Error al cargar productos: ${err.message}</p>`;
  }
}

function abrirModalEdicion(id, productos) {
  const p = productos.find(x => x.id === id);
  if (!p) return;
  const modal = document.getElementById('edit-product-modal');
  const form  = document.getElementById('edit-product-form');
  if (!form || !modal) return;

  form.dataset.productoId = id;
  form.querySelector('[name="nombre"]').value              = p.nombre || '';
  form.querySelector('[name="descripcion"]').value         = p.descripcion || '';
  form.querySelector('[name="categoria"]').value           = p.categoria || 'polera';
  form.querySelector('[name="precio_base"]').value         = p.precio_base || 0;
  form.querySelector('[name="stock"]').value               = p.stock || 0;
  form.querySelector('[name="imagen_url_existente"]').value = p.imagen_url || '';
  modal.classList.add('open');
}

function initEditProductForm() {
  const form = document.getElementById('edit-product-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const id = form.dataset.productoId;
    const formData = new FormData(form);
    const btn = form.querySelector('[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }

    try {
      await API.adminEditarProducto(id, formData);
      showToast('Producto actualizado exitosamente ✅', 'success');
      document.getElementById('edit-product-modal')?.classList.remove('open');
      cargarProductosAdmin();
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar Cambios'; }
    }
  });

  document.getElementById('edit-product-close')?.addEventListener('click', () => {
    document.getElementById('edit-product-modal')?.classList.remove('open');
  });
}

/* ──────────────────────────────────────────────────────────
   HEADER & USER
   ────────────────────────────────────────────────────────── */
function initHeaderAdmin() {
  const user = getUser();
  if (!user) return;
  const firstName = user.nombre.split(' ')[0];
  const adminName = document.getElementById('admin-user-name');
  if (adminName) adminName.textContent = user.nombre;
  const welcomeName = document.getElementById('welcome-admin-name');
  if (welcomeName) welcomeName.textContent = firstName;
  const avatar = document.getElementById('topbar-avatar');
  if (avatar) avatar.textContent = firstName[0].toUpperCase();
}

function initLogoutAdmin() {
  document.querySelectorAll('[data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.preventDefault();
      try { await API.logout(); } catch { }
      borrarSesion();
      window.location.href = 'login.html?logout=1';
    });
  });
}

/* ──────────────────────────────────────────────────────────
   TABS PRINCIPALES (Pedidos vs Catálogo)
   ────────────────────────────────────────────────────────── */
function activarTab(tabName) {
  document.querySelectorAll('[data-dash-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.dashTab === tabName);
  });
  document.querySelectorAll('[data-dash-panel]').forEach(p => {
    p.style.display = p.dataset.dashPanel === tabName ? '' : 'none';
  });
  if (tabName === 'productos') {
    cargarProductosAdmin();
  }
}

function initDashTabs() {
  document.querySelectorAll('[data-dash-tab]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      activarTab(btn.dataset.dashTab);
    });
  });
}

/* ──────────────────────────────────────────────────────────
   SIDEBAR & MODALES GENÉRICOS
   ────────────────────────────────────────────────────────── */
function initSidebarMobile() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const menuBtn = document.getElementById('menu-toggle-btn');

  menuBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('open');
  });
  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
  });
}

function initModals() {
  const modalOverlay = document.getElementById('modal-overlay');
  const modalClose   = document.getElementById('modal-close');
  modalClose?.addEventListener('click', () => modalOverlay?.classList.remove('open'));
  modalOverlay?.addEventListener('click', e => {
    if (e.target === modalOverlay) modalOverlay.classList.remove('open');
  });

  const prodModal = document.getElementById('edit-product-modal');
  prodModal?.addEventListener('click', e => {
    if (e.target === prodModal) prodModal.classList.remove('open');
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      modalOverlay?.classList.remove('open');
      prodModal?.classList.remove('open');
      cerrarModalDiseno();
    }
  });
}

/* ──────────────────────────────────────────────────────────
   INIT
   ────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (!isLoggedIn()) {
    window.location.href = 'login.html?error=' + encodeURIComponent('Acceso restringido.');
    return;
  }
  const user = getUser();
  if (user?.rol !== 'admin') {
    window.location.href = 'mis_pedidos.html';
    return;
  }

  initHeaderAdmin();
  initLogoutAdmin();
  initSidebarMobile();
  initFiltros();
  initDashTabs();
  initModals();
  initDisenoModal();
  initEditProductForm();

  // Fecha y hora topbar
  const dateEl = document.getElementById('topbar-date');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()} · ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  }

  cargarStats();
  cargarPedidos();
});
