/**
 * ============================================================
 *  SUBLI-TECH v2 — js/producto.js
 *  Lógica de personalización: tallas, colores, carga de diseño
 *  Consume la API de FastAPI via js/api.js (API.producto)
 * ============================================================
 */

'use strict';

/* ── Helpers y Constantes compartidas ── */
const COLOR_MAP = {
  'Blanco':                         '#FFFFFF',
  'Negro':                          '#1E293B',
  'Rojo':                           '#EF4444',
  'Azul':                           '#3B82F6',
  'Verde':                          '#10B981',
  'Amarillo':                       '#F59E0B',
  'Rosado':                         '#EC4899',
  'Naranja':                        '#F97316',
  'Azul Marino':                    '#1E3A5F',
  'Gris':                           '#6B7280',
  'Morado':                         '#8B5CF6',
  'Blanco (fondo personalizable)':  '#F8F5FF',
  'Negro/Negro malla':              '#1E293B',
  'Azul/Blanco malla':              '#3B82F6',
  'Blanco/Gris malla':              '#F1F0F5',
  'Negro (efecto mágico)':          '#1E293B',
};

function formatPrice(n) {
  return 'Bs. ' + Number(n).toLocaleString('es-BO', { maximumFractionDigits: 0 });
}

function getCart() {
  try { return JSON.parse(localStorage.getItem('sublitech_cart') || '[]'); }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem('sublitech_cart', JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent('cart:updated'));
}

/* ── Estado de la sesión de personalización ── */
const state = {
  producto:           null,
  generoSeleccionado: 'Hombre', // ← NUEVO
  tallaSeleccionada:  null,
  colorSeleccionado:  'Blanco',
  cantidad:           1,
  archivoDiseno:      null,
  previewURL:         null,
};

/* ────────────────────────────────────────────────────────────
   INICIALIZACIÓN
   ──────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  initGeneroSelector(); 
  const params = new URLSearchParams(window.location.search);
  const id     = parseInt(params.get('id')) || 1;

  try {
    const data = await API.producto(id);
    if (!data.success || !data.producto) {
      showError('Producto no encontrado.');
      return;
    }
    state.producto = data.producto;
  } catch (e) {
    showError('Error de conexión con el backend.');
    return;
  }

  renderProductPage(state.producto);
  initSizeSelector();
  initColorSelector();
  initFileUpload();
  initQuantity();
  initAddToCart();
  initTabs();
  initMockup();   // Fase 3: mockup interactivo
  updatePrice();
});

/* ────────────────────────────────────────────────────────────
   RENDER DINÁMICO DE LA PÁGINA
   ──────────────────────────────────────────────────────────── */
/* ────────────────────────────────────────────────────────────
   RENDER DINÁMICO DE LA PÁGINA
   ──────────────────────────────────────────────────────────── */
function renderProductPage(p) {
  document.title = `${p.nombre} — Subli-Tech`;
  // Ocultar selector de género si el producto no es una polera
  const generoSection = document.getElementById('genero-section');
  if (generoSection) {
    if (p.categoria && p.categoria.toLowerCase().includes('polera')) {
      generoSection.style.display = 'flex'; // Mostrar si es polera
    } else {
      generoSection.style.display = 'none';  // Ocultar si es taza, gorra, cojín, etc.
    }
  }

  // SOLUCIÓN: Forzamos la lectura directa desde la carpeta frontend ignorando la ruta del backend
  const imgEl = document.getElementById('prod-img');
  if (imgEl) {
    let nombreArchivo = p.imagen_url || p.imagen;
    nombreArchivo = nombreArchivo ? nombreArchivo.split('/').pop() : '';
    imgEl.src = nombreArchivo ? `img/productos/${nombreArchivo}` : `img/logo.png`;
    imgEl.alt = p.nombre;
    imgEl.onerror = () => { imgEl.src = 'img/logo.png'; }; // Fallback seguro
  }

  setText('prod-nombre',    p.nombre);
  setText('prod-categoria', p.categoriaLabel || p.categoria);
  setText('prod-desc',      p.descripcion);

  const stars = '★'.repeat(Math.floor(p.rating || 5)) + ((p.rating || 5) % 1 >= 0.5 ? '½' : '');
  setText('prod-rating', `${stars} ${p.rating || 5.0} (${p.reviews || 120} reseñas)`);

  updatePrice();
  setText('bc-producto', p.nombre);
  setText('tab-desc-body', p.descripcion_larga || p.descripcion);

  renderGuiaTallas(p);
  renderTallas(p.tallas || ['M']);
// Forzamos una paleta de colores amplia para poleras y gorras
  const coloresDisponibles = ['Blanco', 'Negro', 'Rojo', 'Azul', 'Verde', 'Amarillo', 'Rosado', 'Morado', 'Gris'];
  renderColores(coloresDisponibles);

  const firstTalla = (p.tallas || [])[0];
  if (firstTalla) selectTalla(firstTalla);

  // ── Control de stock ─────────────────────────────────────
  const stock = parseInt(p.stock) || 0;
  const btnAgregar = document.getElementById('btn-agregar');
  if (btnAgregar) {
    if (stock <= 0) {
      btnAgregar.disabled = true;
      btnAgregar.textContent = '🚫 Sin stock disponible';
      btnAgregar.style.opacity = '0.5';
      btnAgregar.style.cursor  = 'not-allowed';
      const badgeEl = document.getElementById('prod-stock-badge');
      if (badgeEl) {
        badgeEl.textContent = '⚠️ Producto agotado';
        badgeEl.style.display = 'inline-flex';
      }
    } else {
      const badgeEl = document.getElementById('prod-stock-badge');
      if (badgeEl) {
        badgeEl.textContent = `✅ Stock: ${stock} disponibles`;
        badgeEl.style.display = 'inline-flex';
        badgeEl.style.color = '#10B981';
      }
    }
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showError(msg) {
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Inter,sans-serif;flex-direction:column;gap:16px;color:#1E293B;">
      <span style="font-size:4rem;">😕</span>
      <h2>${msg}</h2>
      <a href="index.html" style="color:#7A00FF;font-weight:600;">← Volver al catálogo</a>
    </div>
  `;
}

/* ── Guía de tallas ── */
function renderGuiaTallas(p) {
  const tbody = document.getElementById('tallas-tbody');
  if (!tbody || !p.guia_tallas) return;
  tbody.innerHTML = Object.entries(p.guia_tallas).map(([talla, medida]) => `
    <tr>
      <td><strong>${talla}</strong></td>
      <td>${medida}</td>
    </tr>
  `).join('');
}

/* ── Botones de talla ── */
function renderTallas(tallas) {
  const container = document.getElementById('talla-options');
  if (!container) return;

  container.innerHTML = tallas.map(t => `
    <button class="talla-btn" data-talla="${t}" id="talla-${t}" aria-pressed="false">
      ${t}
    </button>
  `).join('');
}

/* ── Swatches de color ── */
function renderColores(colores) {
  const container = document.getElementById('color-options');
  if (!container) return;

  container.innerHTML = colores.map((c, i) => {
    const hex = COLOR_MAP[c] || '#E5E7EB';
    const isLight = hex === '#FFFFFF' || hex === '#F59E0B';
    return `
      <button
        class="color-swatch ${i === 0 ? 'selected' : ''}"
        data-color="${c}"
        id="color-${c.replace(/\s+/g, '-')}"
        aria-label="Color ${c}"
        aria-pressed="${i === 0}"
        style="--swatch-color: ${hex}; background:${hex}; border: 2.5px solid ${isLight ? '#E5E7EB' : hex};"
        title="${c}"
      >
        ${i === 0 ? '<span class="swatch-check">✓</span>' : ''}
      </button>
    `;
  }).join('');

  if (colores[0]) {
    state.colorSeleccionado = colores[0];
    setText('color-label', colores[0]);
  }
}

/* ────────────────────────────────────────────────────────────
   SELECTOR DE TALLA
   ──────────────────────────────────────────────────────────── */
function initSizeSelector() {
  document.getElementById('talla-options')?.addEventListener('click', e => {
    const btn = e.target.closest('.talla-btn');
    if (!btn) return;
    selectTalla(btn.dataset.talla);
  });
}

function selectTalla(talla) {
  state.tallaSeleccionada = talla;

  document.querySelectorAll('.talla-btn').forEach(btn => {
    const isSelected = btn.dataset.talla === talla;
    btn.classList.toggle('selected', isSelected);
    btn.setAttribute('aria-pressed', isSelected);
  });

  setText('talla-label', talla);

  const medida = state.producto?.guia_tallas?.[talla];
  if (medida) setText('talla-medida', `(${medida})`);
}

/* ────────────────────────────────────────────────────────────
   SELECTOR DE COLOR — Cambio de imagen real por color
   ──────────────────────────────────────────────────────────── */
function initColorSelector() {
  document.getElementById('color-options')?.addEventListener('click', e => {
    const btn = e.target.closest('.color-swatch');
    if (!btn) return;

    state.colorSeleccionado = btn.dataset.color;

    document.querySelectorAll('.color-swatch').forEach(b => {
      b.classList.remove('selected');
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '';
    });
    btn.classList.add('selected');
    btn.setAttribute('aria-pressed', 'true');
    btn.innerHTML = '<span class="swatch-check">✓</span>';

    setText('color-label', state.colorSeleccionado);
    swapProductImage(state.colorSeleccionado);
  });
}

function swapProductImage(colorName) {
  const imgEl = document.getElementById('prod-img');
  const wrap = imgEl?.parentElement;
  if (!wrap || !imgEl) return;

  // 1. Obtener color (Gris medio-oscuro para el Negro, así se mantienen las arrugas)
  let hexColor = COLOR_MAP[colorName] || 'transparent';
  if (colorName === 'Negro') hexColor = '#3a3a3a'; 

  // 2. Crear la capa de color si no existe
  let tintOverlay = wrap.querySelector('.color-tint-overlay');
  if (!tintOverlay) {
    tintOverlay = document.createElement('div');
    tintOverlay.className = 'color-tint-overlay';
    
    tintOverlay.style.position = 'absolute';
    tintOverlay.style.top = '0';
    tintOverlay.style.left = '0';
    tintOverlay.style.width = '100%';
    tintOverlay.style.height = '100%';
    tintOverlay.style.pointerEvents = 'none';
    tintOverlay.style.mixBlendMode = 'multiply';
    tintOverlay.style.zIndex = '2';
    
    wrap.style.position = 'relative';
    wrap.insertBefore(tintOverlay, imgEl.nextSibling);
  }

  // 3. Calcular la ruta correcta del PNG transparente
  const imgMap = state.producto.imagesByColor;
  let rawSrc = (imgMap && imgMap[colorName]) ? imgMap[colorName] : (state.producto.imagen_url || state.producto.imagen);
  let nombreArchivo = rawSrc ? rawSrc.split('/').pop() : '';
  let newSrc = nombreArchivo ? `img/productos/${nombreArchivo}` : `img/logo.png`;

  // 4. SOLUCIÓN AL HALO BLANCO: Quitamos el padding conflictivo
  imgEl.style.padding = '0';
  tintOverlay.style.padding = '0';

  // 5. Aplicar máscara y color
  tintOverlay.style.webkitMaskImage = `url('${newSrc}')`;
  tintOverlay.style.webkitMaskSize = 'contain';
  tintOverlay.style.webkitMaskPosition = 'center';
  tintOverlay.style.webkitMaskRepeat = 'no-repeat';
  
  tintOverlay.style.backgroundColor = (colorName === 'Blanco' || hexColor === '#FFFFFF') ? 'transparent' : hexColor;

  // 6. Transición suave
  imgEl.style.transition = 'opacity 0.25s ease';
  imgEl.style.opacity    = '0';

  setTimeout(() => {
    imgEl.src = newSrc;
    imgEl.onload = () => { imgEl.style.opacity = '1'; };
    imgEl.onerror = () => { imgEl.src = 'img/logo.png'; imgEl.style.opacity = '1'; };
    if (imgEl.complete) imgEl.style.opacity = '1';
  }, 250);
}

/* ────────────────────────────────────────────────────────────
   UPLOAD DE DISEÑO — Drag & Drop + Preview
   ──────────────────────────────────────────────────────────── */
function initFileUpload() {
  const zone    = document.getElementById('upload-zone');
  const input   = document.getElementById('diseno-input');
  const preview = document.getElementById('diseno-preview');
  const previewImg = document.getElementById('preview-img');
  const fileName   = document.getElementById('file-name');
  const fileSize   = document.getElementById('file-size');
  const removeBtn  = document.getElementById('remove-diseno');
  const errorMsg   = document.getElementById('upload-error');

  if (!zone || !input) return;

  const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  const MAX_SIZE_MB = 20;

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file) processFile(file);
  });

  removeBtn?.addEventListener('click', e => {
    e.stopPropagation();
    clearFile();
  });

  function processFile(file) {
    clearError();

    if (!VALID_TYPES.includes(file.type)) {
      showUploadError('Formato no válido. Sube una imagen JPG, PNG, WEBP o SVG.');
      return;
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_SIZE_MB) {
      showUploadError(`El archivo es muy grande (${sizeMB.toFixed(1)}MB). Máximo ${MAX_SIZE_MB}MB.`);
      return;
    }

    state.archivoDiseno = file;
    state.previewURL    = URL.createObjectURL(file);

    previewImg.src = state.previewURL;
    fileName.textContent = file.name;
    fileSize.textContent = sizeMB < 1
      ? `${(file.size / 1024).toFixed(0)} KB`
      : `${sizeMB.toFixed(1)} MB`;

    zone.classList.add('has-file');
    preview?.classList.remove('hidden');

    zone.style.borderColor = 'var(--success)';
    zone.style.background  = 'var(--success-bg)';
    setTimeout(() => {
      zone.style.borderColor = '';
      zone.style.background  = '';
    }, 1500);

    activateMockup(state.previewURL);
    showToast('✅ Diseño cargado — 🎨 Vista previa activa sobre el producto', 'success');
  }

  function clearFile() {
    state.archivoDiseno = null;
    if (state.previewURL) { URL.revokeObjectURL(state.previewURL); state.previewURL = null; }
    input.value = '';
    zone.classList.remove('has-file');
    preview?.classList.add('hidden');
    if (previewImg) previewImg.src = '';
    deactivateMockup();
  }

  function showUploadError(msg) {
    if (errorMsg) { errorMsg.textContent = msg; errorMsg.style.display = 'flex'; }
    zone.style.borderColor = 'var(--error)';
    setTimeout(() => { zone.style.borderColor = ''; clearError(); }, 3000);
  }

  function clearError() {
    if (errorMsg) { errorMsg.textContent = ''; errorMsg.style.display = 'none'; }
  }
}

/* ────────────────────────────────────────────────────────────
   CANTIDAD
   ──────────────────────────────────────────────────────────── */
function initQuantity() {
  document.getElementById('qty-dec')?.addEventListener('click', () => {
    if (state.cantidad > 1) { state.cantidad--; updateQty(); }
  });
  document.getElementById('qty-inc')?.addEventListener('click', () => {
    if (state.cantidad < 50) { state.cantidad++; updateQty(); }
  });
  document.getElementById('qty-input')?.addEventListener('change', e => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val >= 1 && val <= 50) {
      state.cantidad = val; updateQty();
    } else {
      e.target.value = state.cantidad;
    }
  });
}

function updateQty() {
  const input = document.getElementById('qty-input');
  if (input) input.value = state.cantidad;
  updatePrice();
}

/* ────────────────────────────────────────────────────────────
   PRECIO DINÁMICO
   ──────────────────────────────────────────────────────────── */
function updatePrice() {
  if (!state.producto) return;
  const total    = state.producto.precio_base * state.cantidad;
  const anticipo = Math.ceil(total * 0.5);

  setText('prod-precio',     formatPrice(state.producto.precio_base));
  setText('precio-total',    formatPrice(total));
  setText('precio-anticipo', formatPrice(anticipo));
  setText('precio-unidad',   `${formatPrice(state.producto.precio_base)} × ${state.cantidad}`);
}

/* ────────────────────────────────────────────────────────────
   AGREGAR AL CARRITO
   ──────────────────────────────────────────────────────────── */
function initAddToCart() {
  document.getElementById('btn-agregar')?.addEventListener('click', () => {
    if (!state.tallaSeleccionada) {
      const tallaSection = document.getElementById('talla-options');
      tallaSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      tallaSection?.animate([
        { outline: '3px solid var(--error)' },
        { outline: '3px solid transparent' }
      ], { duration: 1200, iterations: 2 });
      showToast('Por favor selecciona una talla antes de continuar', 'error');
      return;
    }

    const cart = getCart();

    const existingIdx = cart.findIndex(
      i => i.id_producto === state.producto.id &&
           i.talla === state.tallaSeleccionada &&
           (i.color === state.colorSeleccionado || i.color_base === state.colorSeleccionado)
    );

    if (existingIdx >= 0) {
      cart[existingIdx].cantidad += state.cantidad;
    } else {
cart.push({
      id_producto:     state.producto.id,
      nombre:          state.producto.nombre,
      categoria:       state.producto.categoria,
      imagen:          state.producto.imagen,
      imagen_url:      state.producto.imagen,
      genero:          state.generoSeleccionado, // ← NUEVO
      talla:           state.tallaSeleccionada,
      color:           state.colorSeleccionado,
      color_base:      state.colorSeleccionado,
      cantidad:        state.cantidad,
      precio_unitario: state.producto.precio_base,
      nombre_archivo:  state.archivoDiseno?.name || null,
    });
    }

    saveCart(cart);

    const btn = document.getElementById('btn-agregar');
    if (btn) {
      const original = btn.innerHTML;
      btn.innerHTML = '✅ ¡Agregado!';
      btn.style.background = 'var(--success)';
      setTimeout(() => {
        btn.innerHTML = original;
        btn.style.background = '';
      }, 2000);
    }

    showToast(`"${state.producto.nombre}" agregado al carrito 🛒`, 'success');
  });

  document.getElementById('btn-ir-carrito')?.addEventListener('click', () => {
    window.location.href = 'carrito.html';
  });
}

/* ────────────────────────────────────────────────────────────
   TABS
   ──────────────────────────────────────────────────────────── */
function initTabs() {
  const tabs    = document.querySelectorAll('.tab-btn');
  const panels  = document.querySelectorAll('.tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t  => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      document.getElementById(tab.dataset.tab)?.classList.add('active');
    });
  });
}

/* ────────────────────────────────────────────────────────────
   MOCKUP INTERACTIVO
   ──────────────────────────────────────────────────────────── */
const mockupState = {
  x:      50,
  y:      15,
  scale:  70,
  rotate: 0,
  opacity: 80,
};

function applyMockupTransform() {
  const wrap = document.getElementById('mockup-overlay-wrap');
  const container = document.getElementById('mockup-container');
  if (!wrap || !container) return;

  const cw = container.offsetWidth;
  const ch = container.offsetHeight;

  const px = (mockupState.x / 100) * cw;
  const py = (mockupState.y / 100) * ch;
  const sc = mockupState.scale / 100;

  wrap.style.left      = '0';
  wrap.style.top       = '0';
  wrap.style.width     = '70%';
  wrap.style.transform = `translate(${px}px, ${py}px) scale(${sc}) rotate(${mockupState.rotate}deg)`;
  wrap.style.transformOrigin = 'top left';

  const inX  = document.getElementById('ctrl-pos-x');
  const inY  = document.getElementById('ctrl-pos-y');
  const inS  = document.getElementById('ctrl-scale');
  const inR  = document.getElementById('ctrl-rotate');
  if (inX && document.activeElement !== inX) inX.value = Math.round(mockupState.x);
  if (inY && document.activeElement !== inY) inY.value = Math.round(mockupState.y);
  if (inS && document.activeElement !== inS) inS.value = Math.round(mockupState.scale);
  if (inR && document.activeElement !== inR) inR.value = Math.round(mockupState.rotate);
}

function initMockup() {
  const container = document.getElementById('mockup-container');
  if (!container) return;

  const slider     = document.getElementById('mockup-opacity');
  const opacityLbl = document.getElementById('mockup-opacity-label');
  slider?.addEventListener('input', () => {
    const img = document.getElementById('mockup-design-img');
    mockupState.opacity = parseInt(slider.value);
    if (img) img.style.opacity = (mockupState.opacity / 100).toFixed(2);
    if (opacityLbl) opacityLbl.textContent = slider.value + '%';
  });

  function bindNumInput(id, key, min, max) {
    document.getElementById(id)?.addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        mockupState[key] = Math.max(min, Math.min(max, val));
        applyMockupTransform();
      }
    });
  }
  bindNumInput('ctrl-pos-x',  'x',       -100, 200);
  bindNumInput('ctrl-pos-y',  'y',       -100, 200);
  bindNumInput('ctrl-scale',  'scale',     10, 200);
  bindNumInput('ctrl-rotate', 'rotate', -180, 180);

  document.getElementById('btn-reset-mockup')?.addEventListener('click', () => {
    mockupState.x      = 15;
    mockupState.y      = 15;
    mockupState.scale  = 70;
    mockupState.rotate = 0;
    applyMockupTransform();
  });

  let isDragging = false;
  let isResizing = false;
  let dragStartMX, dragStartMY, dragStartX, dragStartY;
  let resizeStartX, resizeStartScale;

  document.addEventListener('mousedown', e => {
    const wrap   = document.getElementById('mockup-overlay-wrap');
    const handle = document.getElementById('mockup-resize-handle');
    if (!wrap || wrap.classList.contains('hidden')) return;

    if (handle && handle.contains(e.target)) {
      isResizing    = true;
      resizeStartX  = e.clientX;
      resizeStartScale = mockupState.scale;
      e.preventDefault();
    } else if (wrap.contains(e.target)) {
      isDragging    = true;
      dragStartMX   = e.clientX;
      dragStartMY   = e.clientY;
      dragStartX    = mockupState.x;
      dragStartY    = mockupState.y;
      e.preventDefault();
    }
  });

  document.addEventListener('mousemove', e => {
    const container = document.getElementById('mockup-container');
    if (!container) return;
    const cw = container.offsetWidth;
    const ch = container.offsetHeight;

    if (isDragging) {
      const dx = e.clientX - dragStartMX;
      const dy = e.clientY - dragStartMY;
      mockupState.x = dragStartX + (dx / cw * 100);
      mockupState.y = dragStartY + (dy / ch * 100);
      applyMockupTransform();
    }
    if (isResizing) {
      const dx = e.clientX - resizeStartX;
      mockupState.scale = Math.max(10, Math.min(200, resizeStartScale + dx / 3));
      applyMockupTransform();
    }
  });

  document.addEventListener('mouseup', () => { isDragging = false; isResizing = false; });

  let touchStartMX, touchStartMY, touchStartX, touchStartY;

  document.addEventListener('touchstart', e => {
    const wrap = document.getElementById('mockup-overlay-wrap');
    if (!wrap || wrap.classList.contains('hidden')) return;
    if (!wrap.contains(e.target)) return;
    const touch = e.touches[0];
    isDragging   = true;
    touchStartMX = touch.clientX;
    touchStartMY = touch.clientY;
    touchStartX  = mockupState.x;
    touchStartY  = mockupState.y;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const container = document.getElementById('mockup-container');
    if (!container) return;
    const cw = container.offsetWidth;
    const ch = container.offsetHeight;
    const touch = e.touches[0];
    mockupState.x = touchStartX + ((touch.clientX - touchStartMX) / cw * 100);
    mockupState.y = touchStartY + ((touch.clientY - touchStartMY) / ch * 100);
    applyMockupTransform();
  }, { passive: true });

  document.addEventListener('touchend', () => { isDragging = false; });
}

function activateMockup(url) {
  const wrap     = document.getElementById('mockup-overlay-wrap');
  const img      = document.getElementById('mockup-design-img');
  const badge    = document.getElementById('mockup-active-badge');
  const controls = document.getElementById('mockup-controls');
  const slider   = document.getElementById('mockup-opacity');
  if (!wrap || !img) return;

  img.src = url;
  if (slider) img.style.opacity = (parseInt(slider.value) / 100).toFixed(2);

  mockupState.x      = 15;
  mockupState.y      = 15;
  mockupState.scale  = 70;
  mockupState.rotate = 0;

  wrap.classList.remove('hidden');
  badge?.classList.remove('hidden');
  controls?.classList.remove('hidden');

  applyMockupTransform();
  document.getElementById('mockup-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deactivateMockup() {
  const wrap     = document.getElementById('mockup-overlay-wrap');
  const img      = document.getElementById('mockup-design-img');
  const badge    = document.getElementById('mockup-active-badge');
  const controls = document.getElementById('mockup-controls');
  if (wrap) { wrap.classList.add('hidden'); wrap.style.transform = ''; }
  if (img)  img.src = '';
  badge?.classList.add('hidden');
  controls?.classList.add('hidden');
}

function showToast(message, type = 'default', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  const icons = { success: '✅', error: '❌', default: '🔔' };
  toast.innerHTML = `<span style="font-size:1.1rem">${icons[type] || '🔔'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

/* ────────────────────────────────────────────────────────────
   SELECTOR DE GÉNERO / CORTE
   ──────────────────────────────────────────────────────────── */
function initGeneroSelector() {
  document.getElementById('genero-options')?.addEventListener('click', e => {
    const btn = e.target.closest('.genero-btn');
    if (!btn) return;
    
    const genero = btn.dataset.genero;
    state.generoSeleccionado = genero;

    // Actualizar estilos visuales de los botones
    document.querySelectorAll('.genero-btn').forEach(b => {
      const isSelected = b.dataset.genero === genero;
      b.classList.toggle('selected', isSelected);
      b.style.borderColor = isSelected ? '#7A00FF' : '#E2E8F0';
      b.style.background = isSelected ? '#F8F5FF' : '#fff';
      b.style.color = isSelected ? '#7A00FF' : '#64748B';
    });

    const label = document.getElementById('genero-label');
    if (label) label.textContent = genero === 'Mujer' ? 'Mujer (Corte entallado)' : 'Hombre / Unisex';
  });
}