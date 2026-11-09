/**
 * ============================================================
 *  SUBLI-TECH v2 — js/carrito.js
 *  Lógica de carrito.html:
 *   - Renderiza items desde localStorage
 *   - Controles de cantidad, eliminar, vaciar
 *   - Resumen económico (anticipo 50%, saldo)
 *   - Sistema de DESCUENTOS con código promo
 *   - Código QR dinámico para método de pago QR
 *   - POST /pedidos/ al confirmar (con descuento y stock)
 *  Reemplaza: php/procesar_pedido.php + inline script de carrito.html
 * ============================================================
 */

'use strict';

/* ──────────────────────────────────────────────────────────
   ESTADO LOCAL
   ────────────────────────────────────────────────────────── */
const CART_KEY = 'sublitech_cart';

// Estado del descuento aplicado
let descuentoActivo = {
  codigo:      null,
  monto:       0,
  tipo:        null,
  descripcion: '',
};

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event('cart:updated'));
}

/* ──────────────────────────────────────────────────────────
   HELPER: URL de imagen
   ────────────────────────────────────────────────────────── */
function resolverImagen(imagen_url) {
  if (!imagen_url) return '../img/placeholder.jpg';
  if (imagen_url.startsWith('http')) return imagen_url;
  if (typeof imgUrl === 'function') return imgUrl(imagen_url);
  // Fallback: intentar construir con API_BASE
  const base = window.API_BASE || 'http://localhost:8000';
  const ruta  = imagen_url.replace(/^img\//, '');
  return `${base}/img/${ruta}`;
}

/* ──────────────────────────────────────────────────────────
   RENDERIZADO DE ITEMS
   HTML idéntico al original de carrito.html
   ────────────────────────────────────────────────────────── */
function colorDot(color) {
  const colorMap = { blanco:'#F8FAFC', negro:'#1E293B', rojo:'#EF4444',
    azul:'#3B82F6', verde:'#10B981', amarillo:'#F59E0B', rosado:'#EC4899',
    gris:'#94A3B8', celeste:'#38BDF8', naranja:'#F97316' };
  const c = color?.toLowerCase() || 'blanco';
  return `<span class="color-dot" style="background:${colorMap[c] || '#E2E8F0'};border:1px solid rgba(0,0,0,0.1);"></span>`;
}

function renderItem(item, idx) {
  const img      = resolverImagen(item.imagen_url || item.imagen);
  const subtotal = (item.precio_unitario * item.cantidad).toFixed(0);
  return `
    <div class="cart-item" data-idx="${idx}">
      <div class="cart-item-img">
        <img src="${img}" alt="${item.nombre}" onerror="this.src='../img/placeholder.jpg'"/>
      </div>
      <div class="cart-item-info">
        <div class="cart-item-header">
          <span class="cart-item-name">${item.nombre}</span>
          <button class="cart-item-remove" data-idx="${idx}" aria-label="Eliminar">🗑️</button>
        </div>
        <div class="cart-item-specs">
          <span class="spec-chip">📐 Talla: ${item.talla || 'M'}</span>
          <span class="spec-chip">${colorDot(item.color_base)}${item.color_base || 'Blanco'}</span>
        </div>
        <div class="design-badge warn">⚠️ Diseño pendiente de envío</div>
        <div class="cart-item-bottom">
          <div class="qty-control">
            <button class="qty-btn qty-minus" data-idx="${idx}">−</button>
            <span class="qty-value">${item.cantidad}</span>
            <button class="qty-btn qty-plus"  data-idx="${idx}">+</button>
          </div>
          <div class="cart-item-price">
            <span class="unit-price">Bs. ${item.precio_unitario.toFixed(0)} c/u</span>
            <span class="subtotal-price">Bs. ${subtotal}</span>
          </div>
        </div>
      </div>
    </div>`;
}

/* ──────────────────────────────────────────────────────────
   RESUMEN ECONÓMICO (con descuento)
   ────────────────────────────────────────────────────────── */
function actualizarResumen(cart) {
  const totalItems  = cart.reduce((s, i) => s + i.cantidad, 0);
  const subtotal    = cart.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
  const descuento   = descuentoActivo.monto || 0;
  const totalMonto  = Math.max(0, subtotal - descuento);
  const anticipo    = totalMonto * 0.5;
  const saldo       = totalMonto - anticipo;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('summary-items',    `${totalItems} producto${totalItems !== 1 ? 's' : ''}`);
  set('summary-subtotal', `Bs. ${subtotal.toFixed(0)}`);
  set('summary-anticipo', `Bs. ${anticipo.toFixed(0)}`);
  set('summary-saldo',    `Bs. ${saldo.toFixed(0)}`);
  set('summary-total',    `Bs. ${totalMonto.toFixed(0)}`);

  // Mostrar/ocultar fila de descuento en el resumen
  const filaDesc = document.getElementById('summary-descuento-row');
  const montoDesc = document.getElementById('summary-descuento');
  if (filaDesc && montoDesc) {
    if (descuento > 0) {
      filaDesc.style.display = '';
      montoDesc.textContent  = `− Bs. ${descuento.toFixed(0)}`;
    } else {
      filaDesc.style.display = 'none';
    }
  }

  // Modal de confirmación
  set('confirm-items-n',  totalItems);
  set('confirm-subtotal', `Bs. ${totalMonto.toFixed(0)}`);
  set('confirm-anticipo', `Bs. ${anticipo.toFixed(0)}`);
}

/* ──────────────────────────────────────────────────────────
   RENDER COMPLETO
   ────────────────────────────────────────────────────────── */
function renderCarrito() {
  const cart      = getCart();
  const empty     = document.getElementById('cart-empty');
  const content   = document.getElementById('cart-content');
  const itemsEl   = document.getElementById('cart-items');
  const confirmBtn = document.getElementById('btn-confirmar');

  if (!empty) return;

  if (cart.length === 0) {
    empty.classList.remove('hidden');
    if (content) content.classList.add('hidden');
    if (confirmBtn) confirmBtn.disabled = true;
    return;
  }

  empty.classList.add('hidden');
  if (content) { content.classList.remove('hidden'); content.style.display = 'contents'; }
  if (itemsEl) itemsEl.innerHTML = cart.map((item, i) => renderItem(item, i)).join('');
  if (confirmBtn) confirmBtn.disabled = false;

  actualizarResumen(cart);
  attachItemEvents();
}

/* ──────────────────────────────────────────────────────────
   EVENTOS DE ITEMS (delegados)
   ────────────────────────────────────────────────────────── */
function attachItemEvents() {
  const itemsEl = document.getElementById('cart-items');
  if (!itemsEl) return;

  itemsEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-idx]');
    if (!btn) return;
    const idx  = parseInt(btn.dataset.idx);
    let   cart = getCart();

    if (btn.classList.contains('cart-item-remove')) {
      cart.splice(idx, 1);
    } else if (btn.classList.contains('qty-plus')) {
      cart[idx].cantidad++;
    } else if (btn.classList.contains('qty-minus')) {
      cart[idx].cantidad--;
      if (cart[idx].cantidad <= 0) cart.splice(idx, 1);
    }

    saveCart(cart);
    renderCarrito();
  });
}

/* ──────────────────────────────────────────────────────────
   SISTEMA DE DESCUENTOS
   ────────────────────────────────────────────────────────── */
function initDescuentos() {
  const input  = document.getElementById('promo-codigo');
  const btn    = document.getElementById('btn-aplicar-promo');
  const msg    = document.getElementById('promo-mensaje');
  const btnRem = document.getElementById('btn-remover-promo');

  if (!btn || !input) return;

  btn.addEventListener('click', async () => {
    const codigo = input.value.trim().toUpperCase();
    if (!codigo) {
      mostrarMensajePromo('Ingresa un código válido.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = '⏳';

    try {
      const data = await API.validarDescuento(codigo);
      if (!data.ok) throw new Error('Código inválido.');

      const cart     = getCart();
      const subtotal = cart.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);

      let montoDesc = 0;
      if (data.tipo === 'porcentaje') {
        montoDesc = subtotal * data.descuento / 100;
      } else {
        montoDesc = data.descuento;
      }
      montoDesc = Math.min(montoDesc, subtotal);

      descuentoActivo = {
        codigo:      data.codigo,
        monto:       montoDesc,
        tipo:        data.tipo,
        descripcion: data.descripcion,
      };

      mostrarMensajePromo(`✅ ${data.descripcion} aplicado`, 'success');
      input.disabled = true;
      btn.style.display = 'none';
      if (btnRem) btnRem.style.display = '';

      actualizarResumen(cart);

    } catch (err) {
      descuentoActivo = { codigo: null, monto: 0, tipo: null, descripcion: '' };
      mostrarMensajePromo(err.message || 'Código inválido o expirado.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Aplicar';
    }
  });

  // Remover descuento
  btnRem?.addEventListener('click', () => {
    descuentoActivo = { codigo: null, monto: 0, tipo: null, descripcion: '' };
    input.value    = '';
    input.disabled = false;
    btn.style.display = '';
    btnRem.style.display = 'none';
    mostrarMensajePromo('', '');
    actualizarResumen(getCart());
  });
}

function mostrarMensajePromo(msg, tipo) {
  const el = document.getElementById('promo-mensaje');
  if (!el) return;
  el.textContent = msg;
  el.style.color = tipo === 'success' ? '#10B981' : tipo === 'error' ? '#EF4444' : '#64748B';
  el.style.display = msg ? '' : 'none';
}

/* ──────────────────────────────────────────────────────────
   CÓDIGO QR (Pago por QR)
   Genera un QR dinámico usando la API de qrserver.com cuando
   el usuario selecciona "QR" como método de pago.
   ────────────────────────────────────────────────────────── */
function generarQR() {
  const cart     = getCart();
  const subtotal = cart.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
  const descuento = descuentoActivo.monto || 0;
  const total    = Math.max(0, subtotal - descuento);
  const anticipo = Math.ceil(total * 0.5);

  // Datos de pago (personalizar con cuenta real)
  const textoQR = [
    'Subli-Tech Bolivia',
    'Pago anticipo pedido',
    `Total: Bs. ${total.toFixed(0)}`,
    `Anticipo (50%): Bs. ${anticipo}`,
    'Tigo Money: 70123456',
    'BCP: 1234567890',
  ].join(' | ');

  const encoded = encodeURIComponent(textoQR);
  const qrURL   = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}`;

  const container = document.getElementById('pay-qr-container');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align:center;padding:16px 0;">
      <p style="font-size:0.82rem;color:#64748B;margin-bottom:12px;">
        📱 Escanea para pagar el anticipo de <strong style="color:#7A00FF;">Bs. ${anticipo}</strong>
      </p>
      <div style="display:inline-block;background:#fff;padding:12px;border-radius:12px;border:2px solid #E0D7FF;">
        <img
          src="${qrURL}"
          alt="Código QR de pago"
          width="180" height="180"
          style="display:block;border-radius:8px;"
          onerror="this.parentElement.innerHTML='<p style=color:#EF4444>❌ No se pudo generar el QR. Verifica tu conexión.</p>'"
        />
      </div>
      <p style="font-size:0.78rem;color:#94A3B8;margin-top:10px;">
        Tigo Money: <strong>70123456</strong> · BCP: <strong>1234567890</strong>
      </p>
    </div>`;
}

/* ──────────────────────────────────────────────────────────
   MÉTODO DE PAGO — mostrar info dinámica
   ────────────────────────────────────────────────────────── */
function initPaymentOptions() {
  const radios  = document.querySelectorAll('input[name="metodo_pago"]');
  const infos   = document.querySelectorAll('.pay-method-info');
  const warn    = document.getElementById('pay-required-warn');
  const btnConf = document.getElementById('btn-confirmar');

  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      infos.forEach(el => el.classList.add('hidden'));
      const info = document.getElementById(`pay-info-${radio.value}`);
      if (info) info.classList.remove('hidden');
      if (warn) warn.classList.remove('visible');

      const metodo = document.getElementById('confirm-metodo');
      if (metodo) metodo.textContent = radio.value;

      // Generar QR si se selecciona método QR
      if (radio.value === 'QR') generarQR();

      // Habilitar botón confirmar si el carrito tiene items
      if (btnConf && getCart().length > 0) btnConf.disabled = false;
    });
  });
}

/* ──────────────────────────────────────────────────────────
   CONFIRMAR PEDIDO → POST /pedidos/
   Reemplaza: php/procesar_pedido.php
   ────────────────────────────────────────────────────────── */
function initConfirmarPedido() {
  const btnAbrir  = document.getElementById('btn-confirmar');
  const overlay   = document.getElementById('confirm-overlay');
  const btnClose  = document.getElementById('confirm-close');
  const btnCloseX = document.getElementById('confirm-close-btn');
  const btnOk     = document.getElementById('confirm-ok');
  const warn      = document.getElementById('pay-required-warn');

  // Abrir modal de confirmación
  btnAbrir?.addEventListener('click', () => {
    const metodo = document.querySelector('input[name="metodo_pago"]:checked');
    if (!metodo) {
      if (warn) warn.classList.add('visible');
      return;
    }
    overlay?.classList.add('visible');
  });

  // Cerrar modal
  [btnClose, btnCloseX].forEach(el => {
    el?.addEventListener('click', () => overlay?.classList.remove('visible'));
  });
  overlay?.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('visible');
  });

  // Confirmar pedido real
  btnOk?.addEventListener('click', async () => {
    if (!isLoggedIn()) {
      window.location.href = `login.html?error=${encodeURIComponent('Debes iniciar sesión para confirmar el pedido.')}`;
      return;
    }

    const cart    = getCart();
    const metodo  = document.querySelector('input[name="metodo_pago"]:checked')?.value;
    if (!cart.length || !metodo) return;

    btnOk.disabled = true;
    btnOk.innerHTML = '<span>⏳ Enviando pedido...</span>';

    try {
      const payload = {
        items: cart.map(i => ({
          id_producto:     i.id_producto,
          nombre:          i.nombre,
          precio_unitario: i.precio_unitario,
          cantidad:        i.cantidad,
          talla:           i.talla || 'M',
          color_base:      i.color_base || 'Blanco',
        })),
        metodo_pago:      metodo,
        notas:            '',
        codigo_descuento: descuentoActivo.codigo || null,
        descuento_monto:  descuentoActivo.monto  || 0,
      };

      const data = await API.crearPedido(payload);

      // Limpiar carrito y descuento
      localStorage.removeItem(CART_KEY);
      descuentoActivo = { codigo: null, monto: 0, tipo: null, descripcion: '' };
      window.dispatchEvent(new Event('cart:updated'));

      // Mostrar mensaje de éxito
      const modal = document.querySelector('.confirm-modal');
      if (modal) {
        const descRow = data.descuento_monto > 0
          ? `<tr><td>Descuento aplicado</td><td style="color:#10B981;font-weight:700;">− Bs. ${Number(data.descuento_monto).toFixed(0)}</td></tr>`
          : '';
        modal.innerHTML = `
          <div class="confirm-modal-icon">🎉</div>
          <h3 id="confirm-title" style="font-family:'Poppins',sans-serif;font-size:1.3rem;text-align:center;margin-bottom:8px;color:#7A00FF;">
            ¡Pedido #${data.pedido_id} Registrado!
          </h3>
          <table style="width:100%;font-size:0.88rem;color:#475569;margin-bottom:20px;border-collapse:collapse;">
            ${descRow}
            <tr><td>Total</td><td style="font-weight:700;text-align:right;">Bs. ${Number(data.monto_total).toFixed(0)}</td></tr>
            <tr><td>Anticipo (50%)</td><td style="color:#7A00FF;font-weight:700;text-align:right;">Bs. ${Number(data.monto_anticipo).toFixed(0)}</td></tr>
            <tr><td>Método</td><td style="text-align:right;">${metodo}</td></tr>
          </table>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <a href="mis_pedidos.html" class="btn btn-cta" style="text-align:center;padding:14px;">
              📦 Ver Mis Pedidos
            </a>
            <a href="index.html#catalogo" style="text-align:center;font-family:'Poppins',sans-serif;font-size:0.85rem;font-weight:600;color:#7A00FF;padding:10px;border-radius:9999px;background:rgba(122,0,255,0.08);">
              ← Seguir comprando
            </a>
          </div>`;
      }
    } catch (err) {
      console.error('Error al confirmar pedido:', err);
      btnOk.disabled = false;
      btnOk.innerHTML = '✅ Sí, confirmar';
      if (typeof showToast === 'function') {
        showToast(err.message || 'Error al procesar el pedido.', 'error');
      } else {
        alert(err.message || 'Error al procesar el pedido.');
      }
    }
  });
}

/* ──────────────────────────────────────────────────────────
   VACIAR CARRITO
   ────────────────────────────────────────────────────────── */
function initVaciarCarrito() {
  document.getElementById('btn-limpiar')?.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres vaciar el carrito?')) {
      localStorage.removeItem(CART_KEY);
      descuentoActivo = { codigo: null, monto: 0, tipo: null, descripcion: '' };
      window.dispatchEvent(new Event('cart:updated'));
      renderCarrito();
    }
  });
}

/* ──────────────────────────────────────────────────────────
   INIT
   ────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderCarrito();
  initPaymentOptions();
  initConfirmarPedido();
  initVaciarCarrito();
  initDescuentos();

  // Actualizar si otra pestaña cambia el carrito
  window.addEventListener('storage', e => {
    if (e.key === CART_KEY) renderCarrito();
  });
});
