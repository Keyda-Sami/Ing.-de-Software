/**
 * ============================================================
 *  SUBLI-TECH v2 — js/mis_pedidos.js
 *  Lógica de mis_pedidos.html:
 *   - Protección de ruta (redirige si no hay sesión)
 *   - GET /pedidos/mis-pedidos → renderiza tarjetas con pipeline
 *   - Logout → borrar token + redirigir
 *   - Modales: editar notas, cancelar pedido
 *   - Aprobación y Rechazo de diseño con observación
 *  Reemplaza: mis_pedidos.php (PHP SSR → JS + FastAPI)
 * ============================================================
 */

'use strict';

/* ──────────────────────────────────────────────────────────
   CONSTANTES DE ESTADO (idéntico a mis_pedidos.php)
   ────────────────────────────────────────────────────────── */
const STAGES = [
  { slug: 'En proceso',           icon: '📝', label: 'En proceso',  color: '#7A00FF' },
  { slug: 'En diseño',            icon: '🎨', label: 'En diseño',   color: '#A020F0' },
  { slug: 'Esperando Aprobación', icon: '⏳', label: 'Aprobación',  color: '#8B5CF6' },
  { slug: 'En impresión',         icon: '🖨️', label: 'Impresión',   color: '#FF007F' },
  { slug: 'En planchado',         icon: '♨️', label: 'Planchado',   color: '#F59E0B' },
  { slug: 'En costura',           icon: '🧵', label: 'Costura',      color: '#06B6D4' },
  { slug: 'Listo para entrega',   icon: '✅', label: '¡Listo!',      color: '#10B981' },
];

const STATUS_CLASS = {
  'En proceso':           'proceso',
  'En diseño':            'diseno',
  'Esperando Aprobación': 'proceso',
  'En impresión':         'impresion',
  'En planchado':         'planchado',
  'En costura':           'costura',
  'Listo para entrega':   'listo',
};

const CAT_ICONS = {
  polera: '👕', taza: '☕', gorra: '🧢',
  bolso:  '👜', cojin: '🛋️', otro:  '📦',
};

const METOD_ICONS = {
  QR: '📱', Transferencia: '🏦', Efectivo: '💵',
};

let currentOrderId = null;

function stageIndex(estado) {
  return STAGES.findIndex(s => s.slug === estado);
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d.getDate()} ${meses[d.getMonth()]}. ${d.getFullYear()}`;
}

function formatBs(n) {
  return `Bs. ${Number(n).toLocaleString('es-BO', { minimumFractionDigits: 0 })}`;
}

/* Toast */
function showToast(message, type = 'default', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const bg = { success: '#10B981', error: '#EF4444', default: '#7A00FF' };
  toast.style.cssText = `
    display:flex;align-items:center;gap:10px;
    background:${bg[type] || bg.default};color:#fff;
    padding:12px 18px;border-radius:12px;
    font-family:'Poppins',sans-serif;font-size:0.85rem;font-weight:600;
    box-shadow:0 8px 24px rgba(0,0,0,0.18);
    pointer-events:all;max-width:320px;
    animation: slideIn 0.35s ease;
  `;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ──────────────────────────────────────────────────────────
   RENDER PIPELINE DE ETAPAS (CSS: .pipeline, .pipe-step, .pipe-dot)
   ────────────────────────────────────────────────────────── */
function renderPipeline(estado) {
  const idx = stageIndex(estado);
  return STAGES.map((s, i) => {
    const done   = i < idx;
    const active = i === idx;
    const stepClass = done ? 'done' : active ? 'active' : 'pending';
    const lineClass = done ? 'done' : active ? 'active-progress' : '';
    return `
      <div class="pipe-step ${stepClass}" role="listitem" aria-label="${s.label}">
        <div class="pipe-dot">
          <span class="pipe-dot-inner">${done ? '✓' : s.icon}</span>
        </div>
        <span class="pipe-label">${s.label}</span>
      </div>
      ${i < STAGES.length - 1 ? `<div class="pipe-line ${lineClass}"></div>` : ''}
    `;
  }).join('');
}

/* ──────────────────────────────────────────────────────────
   RENDER ITEMS DEL PEDIDO (.items-list, .item-row)
   ────────────────────────────────────────────────────────── */
function renderItems(items) {
  if (!items || items.length === 0) {
    return '<p style="font-size:0.82rem;color:var(--text-light);padding:10px 0;">Sin detalles disponibles.</p>';
  }
  return items.map(it => {
    const cat = (it.categoria || 'otro').toLowerCase();
    const catIcon = CAT_ICONS[cat] || '📦';
    const subtotal = it.precio_unitario * it.cantidad;
    return `
      <div class="item-row">
        <div class="item-cat-icon">${catIcon}</div>
        <div class="item-info">
          <div class="item-name">${escapeHtml(it.producto_nombre || 'Producto')}</div>
          <div class="item-meta">${it.cantidad}u · Talla ${escapeHtml(it.talla || 'M')} · ${escapeHtml(it.color_base || 'Blanco')}</div>
        </div>
        <div class="item-price">${formatBs(subtotal)}</div>
      </div>
    `;
  }).join('');
}

/* ──────────────────────────────────────────────────────────
   RENDER TARJETA DE PEDIDO (HTML 100% IDÉNTICO AL PHP)
   ────────────────────────────────────────────────────────── */
function renderOrderCard(p) {
  const badgeClass  = STATUS_CLASS[p.estado] || 'proceso';
  const saldo       = p.monto_total - p.monto_anticipo;
  const isEditable  = (p.estado === 'En proceso');
  const urlDiseno   = p.url_diseno || null;
  const esAprobable = (p.estado === 'Esperando Aprobación' && !!urlDiseno);

  return `
    <article class="order-card" id="order-${p.id}">
      <!-- Cabecera -->
      <div class="order-head">
        <div class="order-head-left">
          <span class="order-number">Pedido #${String(p.id).padStart(4, '0')}</span>
          <span class="order-date">📅 ${formatDate(p.created_at)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="status-badge ${badgeClass}">
            <span class="pulse-dot"></span>
            ${escapeHtml(p.estado)}
          </span>
        </div>
      </div>

      <!-- Pipeline de producción -->
      <div class="pipeline-wrap">
        <p class="pipeline-title">🏭 Progreso de producción</p>
        <div class="pipeline" role="list" aria-label="Etapas de producción">
          ${renderPipeline(p.estado)}
        </div>
      </div>

      <!-- Cuerpo del pedido -->
      <div class="order-body">
        ${p.notas ? `<div class="notas-text">💬 ${escapeHtml(p.notas)}</div>` : ''}

        <!-- Lista de productos -->
        <div class="items-list">
          ${renderItems(p.items)}
        </div>

        <!-- Resumen financiero -->
        <div class="order-finance">
          <div class="finance-cell">
            <div class="finance-label">Total pedido</div>
            <div class="finance-value">${formatBs(p.monto_total)}</div>
          </div>
          <div class="finance-cell anticipo">
            <div class="finance-label">Anticipo 50%</div>
            <div class="finance-value">${formatBs(p.monto_anticipo)}</div>
          </div>
          <div class="finance-cell saldo">
            <div class="finance-label">Saldo al retirar</div>
            <div class="finance-value">${formatBs(saldo)}</div>
          </div>
        </div>

        <!-- Fila: método de pago + estado anticipo -->
        <div class="metodo-row">
          <div style="display:flex;align-items:center;gap:8px;">
            ${p.metodo_pago ? `
              <span class="metodo-badge">
                ${METOD_ICONS[p.metodo_pago] || '💳'} ${escapeHtml(p.metodo_pago)}
              </span>` : ''}
            <span class="pay-status-pill ${p.anticipo_pagado ? 'paid' : 'unpaid'}">
              ${p.anticipo_pagado ? '✅ Anticipo pagado' : '⏳ Anticipo pendiente'}
            </span>
          </div>
          <span style="font-size:0.72rem;color:var(--text-light);">
            Actualizado: ${formatDate(p.updated_at || p.created_at)}
          </span>
        </div>

        <!-- Panel Aprobación de Diseño -->
        ${esAprobable ? `
          <div id="panel-diseno-${p.id}" style="background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(122,0,255,0.04));border:2px solid rgba(139,92,246,0.30);border-radius:var(--radius-md);padding:18px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
              <span style="font-size:1.2rem;">⏳</span>
              <div>
                <div style="font-family:var(--font-title);font-size:0.88rem;font-weight:800;color:#5500BB;">Diseño propuesto — Requiere tu aprobación</div>
                <div style="font-size:0.76rem;color:var(--text-muted);">Revisa el diseño y apruébalo para que comencemos la impresión.</div>
              </div>
            </div>
            <a href="${escapeHtml(urlDiseno)}" target="_blank" rel="noopener" style="display:block;margin-bottom:12px;">
              <img
                src="${escapeHtml(urlDiseno)}"
                alt="Diseño propuesto pedido #${p.id}"
                style="width:100%;max-height:220px;object-fit:contain;border-radius:10px;border:1px solid rgba(139,92,246,0.20);background:#F8F5FF;"
                onerror="this.style.display='none';document.getElementById('diseno-link-${p.id}').style.display='flex';"
              />
            </a>
            <a id="diseno-link-${p.id}" href="${escapeHtml(urlDiseno)}" target="_blank" rel="noopener"
               style="display:none;align-items:center;gap:8px;padding:10px 14px;background:rgba(139,92,246,0.08);border-radius:8px;font-size:0.84rem;color:#5500BB;font-weight:600;margin-bottom:12px;">
              🔗 Ver diseño en enlace externo ↗️
            </a>
            <button
              class="btn-edit-order"
              onclick="aprobarDiseno(${p.id}, this)"
              id="btn-aprobar-${p.id}"
              style="background:linear-gradient(135deg,#10B981,#059669);width:100%;justify-content:center;margin-bottom:8px;"
            >
              ✅ Aprobar Diseño — Iniciar Impresión
            </button>
            <button
              type="button"
              onclick="toggleRechazo(${p.id})"
              id="btn-rechazar-toggle-${p.id}"
              style="width:100%;background:rgba(239,68,68,0.07);border:1.5px solid rgba(239,68,68,0.25);color:#DC2626;font-family:var(--font-title);font-size:0.85rem;font-weight:700;padding:10px;border-radius:50px;cursor:pointer;transition:all 0.2s;"
            >
              ❌ Rechazar Diseño (con observación)
            </button>
            <div id="panel-rechazo-${p.id}" style="display:none;margin-top:12px;padding:14px;background:rgba(239,68,68,0.05);border:1.5px solid rgba(239,68,68,0.20);border-radius:12px;">
              <label style="font-size:0.78rem;font-weight:700;color:#DC2626;display:block;margin-bottom:6px;">
                📝 Observación para el diseñador *
              </label>
              <textarea
                id="obs-${p.id}"
                placeholder="Ej: El logo debe ser más grande, cambiar el color del fondo a azul marino..."
                rows="3"
                style="width:100%;padding:10px 12px;border:1.5px solid rgba(239,68,68,0.30);border-radius:10px;font-family:var(--font-body);font-size:0.85rem;resize:vertical;outline:none;"
              ></textarea>
              <button
                type="button"
                onclick="rechazarDiseno(${p.id}, this)"
                id="btn-rechazar-${p.id}"
                style="width:100%;margin-top:10px;background:#EF4444;color:#fff;border:none;padding:10px;border-radius:50px;font-family:var(--font-title);font-size:0.85rem;font-weight:700;cursor:pointer;"
              >
                📨 Enviar Rechazo
              </button>
              <p style="font-size:0.74rem;color:#94A3B8;margin-top:6px;text-align:center;">El equipo recibirá tu observación y preparará un nuevo diseño.</p>
            </div>
          </div>
        ` : (urlDiseno ? `
          <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.20);border-radius:var(--radius-sm);margin-bottom:14px;font-size:0.82rem;color:#065F46;">
            ✅ Diseño aprobado — <a href="${escapeHtml(urlDiseno)}" target="_blank" rel="noopener" style="color:var(--primary);font-weight:600;">Ver diseño ↗</a>
          </div>
        ` : '')}

        <!-- Acciones -->
        <div class="order-actions">
          ${isEditable ? `
            <button class="btn-edit-order"
              onclick="openEditModal(${p.id}, '${escapeQuote(p.notas || '')}')"
              id="btn-edit-${p.id}"
              aria-label="Editar pedido #${p.id}">
              ✏️ Editar Pedido
            </button>` : ''}
          <button class="btn-view-detail"
            onclick="toggleDetail(${p.id})"
            id="btn-detail-${p.id}">
            📋 Ver detalle completo
          </button>
        </div>

      </div><!-- /order-body -->
    </article>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeQuote(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

/* ──────────────────────────────────────────────────────────
   RENDER STATS DEL HERO
   ────────────────────────────────────────────────────────── */
function renderStats(stats, nombre) {
  const firstName = (nombre || 'Usuario').split(' ')[0];
  const el = document.getElementById('hero-title');
  if (el) el.innerHTML = `¡Hola, <em>${escapeHtml(firstName)}</em>! 👋`;

  const setVal = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  setVal('stat-total',       stats.total       || 0);
  setVal('stat-produccion',  stats.en_produccion || 0);
  setVal('stat-listos',      stats.listos       || 0);
}

/* ──────────────────────────────────────────────────────────
   CARGA PRINCIPAL
   ────────────────────────────────────────────────────────── */
async function cargarMisPedidos() {
  const container = document.getElementById('orders-list');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align:center;padding:60px;">
      <div style="font-size:2rem;margin-bottom:12px;">⏳</div>
      <p style="color:var(--text-muted);">Cargando tus pedidos…</p>
    </div>
  `;

  try {
    const { pedidos, stats, usuario } = await API.misPedidos();
    renderStats(stats, usuario);

    const titleEl = document.getElementById('orders-section-title');
    if (titleEl) titleEl.textContent = `📋 Mis Pedidos (${pedidos ? pedidos.length : 0})`;

    if (!pedidos || pedidos.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <h3>Aún no tienes pedidos</h3>
          <p>Explora nuestro catálogo y personaliza poleras, tazas, gorras y más con tu diseño.</p>
          <a href="index.html#catalogo" class="btn-go-shop">🛍️ Ver catálogo →</a>
        </div>
      `;
      return;
    }

    container.innerHTML = pedidos.map(renderOrderCard).join('');
  } catch (err) {
    console.error('Error al cargar pedidos:', err);
    if (err.message.includes('sesión') || err.message.includes('401')) {
      borrarSesion();
      window.location.href = `login.html?error=${encodeURIComponent('Tu sesión expiró. Vuelve a iniciar sesión.')}`;
      return;
    }
    container.innerHTML = `
      <div style="text-align:center;padding:60px;">
        <div style="font-size:3rem;margin-bottom:16px;">⚠️</div>
        <h3 style="font-family:var(--font-title);">Error al cargar pedidos</h3>
        <p style="color:var(--text-muted);margin-bottom:24px;">${err.message}</p>
        <button onclick="cargarMisPedidos()" class="btn-go-shop">🔄 Reintentar</button>
      </div>
    `;
  }
}

/* ──────────────────────────────────────────────────────────
   MODAL DE EDICIÓN DE NOTAS & CANCELAR
   ────────────────────────────────────────────────────────── */
window.openEditModal = function(orderId, currentNotas) {
  currentOrderId = orderId;
  const numEl = document.getElementById('modal-order-num');
  if (numEl) numEl.textContent = '#' + String(orderId).padStart(4, '0');
  const textarea = document.getElementById('modal-notas');
  if (textarea) {
    textarea.value = currentNotas || '';
    updateCharCount();
    setTimeout(() => textarea.focus(), 200);
  }
  const modal = document.getElementById('edit-modal');
  if (modal) modal.classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeModal = function() {
  const modal = document.getElementById('edit-modal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
  currentOrderId = null;
};

function updateCharCount() {
  const textarea = document.getElementById('modal-notas');
  const countEl = document.getElementById('modal-char-count');
  if (textarea && countEl) {
    countEl.textContent = `${textarea.value.length} / 500 caracteres`;
  }
}

window.saveEdit = async function() {
  if (!currentOrderId) return;
  const textarea = document.getElementById('modal-notas');
  const notas = textarea ? textarea.value.trim() : '';
  const btn = document.getElementById('btn-modal-save');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }

  try {
    await API.actualizarNotas(currentOrderId, notas);
    showToast('✅ Pedido actualizado correctamente', 'success');
    closeModal();
    cargarMisPedidos();
  } catch (err) {
    showToast('❌ ' + (err.message || 'No se pudo guardar'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar cambios'; }
  }
};

window.confirmCancel = async function() {
  if (!currentOrderId) return;
  const num = '#' + String(currentOrderId).padStart(4, '0');
  if (!confirm(`¿Seguro que deseas cancelar el Pedido ${num}?\n\nEsta acción no se puede deshacer.`)) return;

  try {
    await API.cancelarPedido(currentOrderId);
    showToast('🗑️ Pedido cancelado correctamente', 'success');
    closeModal();
    cargarMisPedidos();
  } catch (err) {
    showToast('❌ ' + (err.message || 'No se pudo cancelar'), 'error');
  }
};

/* ──────────────────────────────────────────────────────────
   FLUJO DE DISEÑO: APROBAR / RECHAZAR
   ────────────────────────────────────────────────────────── */
window.aprobarDiseno = async function(pedidoId, btnEl) {
  if (!confirm('¿Confirmas que el diseño está correcto y autorizas comenzar la impresión?')) return;

  btnEl.disabled  = true;
  btnEl.innerHTML = '⏳ Procesando aprobación...';

  try {
    await API.aprobarDiseno(pedidoId);
    showToast('✅ ¡Diseño aprobado! El equipo comenzará la impresión de inmediato.', 'success');
    cargarMisPedidos();
  } catch (err) {
    showToast('❌ ' + (err.message || 'No se pudo aprobar. Intenta de nuevo.'), 'error');
    btnEl.disabled  = false;
    btnEl.innerHTML = '✅ Aprobar Diseño — Iniciar Impresión';
  }
};

window.toggleRechazo = function(pedidoId) {
  const panel = document.getElementById(`panel-rechazo-${pedidoId}`);
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') {
      panel.querySelector('textarea')?.focus();
    }
  }
};

window.rechazarDiseno = async function(pedidoId, btn) {
  const obs = document.getElementById(`obs-${pedidoId}`)?.value?.trim();
  if (!obs) {
    showToast('❌ Escribe una observación antes de rechazar.', 'error');
    document.getElementById(`obs-${pedidoId}`)?.focus();
    return;
  }

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Enviando...';

  try {
    await API.rechazarDiseno(pedidoId, obs);
    showToast('📬 Rechazo enviado. El equipo trabajará en un nuevo diseño.', 'success', 4000);
    cargarMisPedidos();
  } catch (err) {
    showToast('❌ ' + (err.message || 'No se pudo enviar el rechazo.'), 'error');
    btn.disabled = false;
    btn.textContent = original;
  }
};

window.toggleDetail = function(orderId) {
  showToast('📋 Los detalles completos están visibles en la tarjeta', 'default');
};

/* ──────────────────────────────────────────────────────────
   LOGOUT & HEADER
   ────────────────────────────────────────────────────────── */
function initLogout() {
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
   INIT
   ────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (!isLoggedIn()) {
    window.location.href = `login.html?error=${encodeURIComponent('Debes iniciar sesión para ver tus pedidos.')}`;
    return;
  }
  const user = getUser();
  if (user?.rol === 'admin') {
    window.location.href = 'dashboard.html';
    return;
  }

  // Flash de registro exitoso
  const params = new URLSearchParams(window.location.search);
  if (params.get('registro') === '1') {
    const banner = document.getElementById('flash-banner');
    if (banner) banner.style.display = 'flex';
  }

  // Contador de caracteres textarea
  const textarea = document.getElementById('modal-notas');
  if (textarea) textarea.addEventListener('input', updateCharCount);

  // Cerrar modal al hacer clic en overlay o presionar ESC
  const editModal = document.getElementById('edit-modal');
  if (editModal) {
    editModal.addEventListener('click', e => {
      if (e.target === editModal) closeModal();
    });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  initLogout();
  cargarMisPedidos();
});
