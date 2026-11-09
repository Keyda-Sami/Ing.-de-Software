/**
 * ============================================================
 *  SUBLI-TECH v2 — js/catalogo.js
 *  Carga el catálogo de productos desde GET /productos/
 *  e inyecta las tarjetas en el DOM de index.html.
 *  Reemplaza: catálogo estático embebido en el HTML.
 * ============================================================
 */

'use strict';

/* ──────────────────────────────────────────────────────────
   RENDERIZADO DE TARJETA
   El HTML es 100% idéntico al que genera el actual index.html.
   ────────────────────────────────────────────────────────── */
function renderProductCard(prod) {
  const precio = `Bs. ${parseFloat(prod.precio_base).toFixed(0)}`;

  // Truco infalible: Extraer SOLO el nombre del archivo (ej. prod_6a1f...jpg) 
  // ignorando cualquier ruta rota que mande la base de datos.
  let nombreArchivo = prod.imagen_url ? prod.imagen_url.split('/').pop() : '';
  let imgSrc = nombreArchivo ? `img/productos/${nombreArchivo}` : `img/logo.png`;

  const sinStock = !prod.stock || prod.stock <= 0;

  return `
    <article class="product-card reveal" data-category="${prod.categoria}" data-id="${prod.id}">
      <a href="producto.html?id=${prod.id}" class="product-card-link" aria-label="Ver ${prod.nombre}">
        <div class="product-img-wrap">
          <img
            src="${imgSrc}"
            alt="${prod.nombre}"
            class="product-img"
            loading="lazy"
            onerror="this.src='img/logo.png'; this.onerror=null;"
          />
          <span class="product-badge ${sinStock ? 'badge-agotado' : 'badge-new'}">
            ${sinStock ? '⚠️ Agotado' : '✨ Disponible'}
          </span>
        </div>
        <div class="product-info">
          <div class="product-category">${capitalize(prod.categoria)}</div>
          <h3 class="product-name">${prod.nombre}</h3>
          <p class="product-desc">${prod.descripcion ? prod.descripcion.substring(0, 80) + '…' : ''}</p>
          <div class="product-footer">
            <div class="product-price">
              <span class="price-label">Desde</span>
              <span class="price-value">${precio}</span>
              <span class="price-currency">BOB</span>
            </div>
            <button
              class="btn-add-cart"
              onclick="agregarAlCarrito(event, ${prod.id}, '${prod.nombre}', ${prod.precio_base}, '${imgSrc}')"
              ${sinStock ? 'disabled title="Sin stock disponible"' : ''}
              style="${sinStock ? 'opacity:0.4;cursor:not-allowed;' : ''}"
            >
              ${sinStock ? '🚫' : '🛒'}
            </button>
          </div>
        </div>
      </a>
    </article>`;
}
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

/* ──────────────────────────────────────────────────────────
   AGREGAR AL CARRITO (desde tarjeta de catálogo)
   ────────────────────────────────────────────────────────── */
function agregarAlCarrito(e, id, nombre, precio, imagen) {
  e.preventDefault();
  e.stopPropagation();

  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('sublitech_cart') || '[]'); } catch { }

  const idx = cart.findIndex(item => item.id_producto === id && item.talla === 'M');
  if (idx >= 0) {
    cart[idx].cantidad++;
  } else {
    cart.push({ id_producto: id, nombre, precio_unitario: precio,
                cantidad: 1, talla: 'M', color_base: 'Blanco', imagen_url: imagen });
  }

  localStorage.setItem('sublitech_cart', JSON.stringify(cart));
  window.dispatchEvent(new Event('cart:updated'));

  if (typeof showToast === 'function') {
    showToast(`"${nombre}" agregado al carrito 🛒`, 'success');
  }
}

/* ──────────────────────────────────────────────────────────
   ESTADO DE CARGA / ERROR / VACÍO
   ────────────────────────────────────────────────────────── */
function mostrarSkeleton(container, n = 6) {
  container.innerHTML = Array.from({ length: n }, () => `
    <div class="product-card skeleton">
      <div class="product-img-wrap" style="background:#F1EEFF;min-height:220px;border-radius:16px 16px 0 0;"></div>
      <div class="product-info" style="padding:18px;display:flex;flex-direction:column;gap:10px;">
        <div style="height:12px;background:#E8E0FF;border-radius:4px;width:40%;"></div>
        <div style="height:18px;background:#E8E0FF;border-radius:4px;width:80%;"></div>
        <div style="height:12px;background:#F0EAFF;border-radius:4px;"></div>
        <div style="height:12px;background:#F0EAFF;border-radius:4px;width:60%;"></div>
      </div>
    </div>`).join('');
}

function mostrarError(container) {
  container.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:60px 24px;">
      <div style="font-size:3rem;margin-bottom:16px;">⚠️</div>
      <h3 style="font-family:'Poppins',sans-serif;font-size:1.2rem;margin-bottom:8px;color:#1E293B;">
        No se pudo cargar el catálogo
      </h3>
      <p style="color:#64748B;font-size:0.9rem;margin-bottom:24px;">
        Verifica que el backend FastAPI esté corriendo en <code>localhost:8000</code>.
      </p>
      <button onclick="cargarCatalogo()" class="btn btn-cta" style="padding:12px 24px;">
        🔄 Reintentar
      </button>
    </div>`;
}

/* ──────────────────────────────────────────────────────────
   CARGA DEL CATÁLOGO
   ────────────────────────────────────────────────────────── */
async function cargarCatalogo(categoria = null) {
  const container = document.getElementById('products-grid');
  if (!container) return;

  mostrarSkeleton(container);

  try {
    const { productos } = await API.productos(categoria);
    if (!productos || productos.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px 24px;">
          <div style="font-size:3rem;margin-bottom:16px;">📦</div>
          <h3 style="font-family:'Poppins',sans-serif;">Sin productos en esta categoría</h3>
        </div>`;
      return;
    }

    container.innerHTML = productos.map(renderProductCard).join('');
    window.dispatchEvent(new Event('catalogo:cargado'));
  } catch (err) {
    console.error('Error al cargar catálogo:', err);
    mostrarError(container);
  }
}

/* ──────────────────────────────────────────────────────────
   INIT — conectar con los botones de filtro
   ────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Carga inicial
  cargarCatalogo();

  // Filtros de categoría (ya existen en el HTML de index.html)
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      // La API acepta ?categoria=<valor> o sin parámetro para "todos"
      cargarCatalogo(filter === 'todos' ? null : filter);
    });
  });
});
