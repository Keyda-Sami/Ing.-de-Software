/**
 * ============================================================
 *  SUBLI-TECH v2 — js/main.js
 *  Idéntico al original /js/main.js EXCEPTO:
 *   - initSessionHeader(): ya no llama a 'php/session.php'.
 *     Ahora lee el token del localStorage y llama a GET /auth/me
 *     para obtener los datos del usuario y construir el menú.
 *  El resto del archivo (scroll, menú móvil, carrito badge,
 *  filtros, reveal, counters, parallax, spotlight, tilt) es
 *  100% idéntico al original.
 * ============================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────
   UTILIDADES
   ────────────────────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function showToast(message, type = 'default', duration = 3500) {
  const container = $('#toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  const icons = { success: '✅', error: '❌', default: '🔔' };
  toast.innerHTML = `<span style="font-size:1.1rem">${icons[type] || icons.default}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}

/* ──────────────────────────────────────────────────────────
   HEADER — scroll + sticky
   ────────────────────────────────────────────────────────── */
function initHeader() {
  const header    = $('#header');
  const headerCTA = $('#header-cta');
  if (!header) return;
  const onScroll = () => {
    const scrolled = window.scrollY > 60;
    header.classList.toggle('scrolled', scrolled);
    if (headerCTA) {
      const heroH = document.querySelector('.hero')?.offsetHeight || 600;
      headerCTA.style.display = window.scrollY > heroH * 0.6 ? 'inline-flex' : 'none';
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ──────────────────────────────────────────────────────────
   MENÚ MÓVIL
   ────────────────────────────────────────────────────────── */
function initMobileMenu() {
  const toggle    = $('#menu-toggle');
  const mobileNav = $('#mobile-nav');
  if (!toggle || !mobileNav) return;
  let isOpen = false;
  const openMenu = () => {
    isOpen = true; toggle.classList.add('open'); mobileNav.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden';
  };
  const closeMenu = () => {
    isOpen = false; toggle.classList.remove('open'); mobileNav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false'); document.body.style.overflow = '';
  };
  toggle.addEventListener('click', () => isOpen ? closeMenu() : openMenu());
  $$('.nav-link', mobileNav).forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('click', e => {
    if (isOpen && !mobileNav.contains(e.target) && !toggle.contains(e.target)) closeMenu();
  });
}

/* ──────────────────────────────────────────────────────────
   CARRITO — badge dinámico desde localStorage
   ────────────────────────────────────────────────────────── */
function initCartBadge() {
  const badge = $('#cart-badge');
  if (!badge) return;
  const updateBadge = () => {
    try {
      const cart  = JSON.parse(localStorage.getItem('sublitech_cart') || '[]');
      const total = cart.reduce((sum, item) => sum + (item.cantidad || 1), 0);
      badge.textContent = total;
      badge.style.display = total > 0 ? 'flex' : 'none';
    } catch { badge.style.display = 'none'; }
  };
  updateBadge();
  window.addEventListener('storage', updateBadge);
  window.addEventListener('cart:updated', updateBadge);
}

/* ──────────────────────────────────────────────────────────
   FILTROS DE CATÁLOGO
   ────────────────────────────────────────────────────────── */
function initCatalogFilters() {
  const filterBtns = $$('.filter-btn');
  if (!filterBtns.length) return;
  function applyFilter(filter) {
    const products = $$('.product-card');
    products.forEach((card, i) => {
      const cat     = card.dataset.category;
      const matches = filter === 'todos' || cat === filter;
      if (matches) {
        card.style.display   = '';
        card.style.opacity   = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
          card.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
          card.style.opacity    = '1';
          card.style.transform  = 'translateY(0)';
        }, i * 60);
      } else {
        card.style.opacity    = '0';
        card.style.transform  = 'translateY(10px)';
        setTimeout(() => { card.style.display = 'none'; }, 300);
      }
    });
  }
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.filter);
    });
  });
  window.addEventListener('catalogo:cargado', () => {
    const activeBtn = $$('.filter-btn').find(b => b.classList.contains('active'));
    const filter = activeBtn ? activeBtn.dataset.filter : 'todos';
    applyFilter(filter);
    if (typeof initCardTilt === 'function') initCardTilt();
    if (typeof initReveal  === 'function') initReveal();
  });
}

/* ──────────────────────────────────────────────────────────
   SCROLL REVEAL — IntersectionObserver
   ────────────────────────────────────────────────────────── */
function initReveal() {
  const SELECTORS = '.reveal, .reveal-left, .reveal-right, .reveal-scale';
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll(SELECTORS).forEach(el => el.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
      });
    },
    { threshold: 0.10, rootMargin: '0px 0px -32px 0px' }
  );
  document.querySelectorAll(SELECTORS).forEach(el => observer.observe(el));
}

/* ──────────────────────────────────────────────────────────
   CONTADOR ANIMADO (Hero stats)
   ────────────────────────────────────────────────────────── */
function animateCounter(el, target, duration = 1600) {
  const startTime = performance.now();
  el.closest('.stat-num')?.classList.add('counting');
  const step = (currentTime) => {
    const elapsed  = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * eased);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = target;
      setTimeout(() => el.closest('.stat-num')?.classList.remove('counting'), 600);
    }
  };
  requestAnimationFrame(step);
}

function initCounters() {
  const statNums = $$('.stat-num span');
  if (!statNums.length) return;
  const targets = [850, 98, 3];
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = statNums.indexOf(entry.target);
        if (idx !== -1) animateCounter(entry.target, targets[idx]);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  statNums.forEach(el => observer.observe(el));
}

/* ──────────────────────────────────────────────────────────
   SMOOTH SCROLL
   ────────────────────────────────────────────────────────── */
function initSmoothScroll() {
  $$('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

/* ──────────────────────────────────────────────────────────
   NAV LINK ACTIVE
   ────────────────────────────────────────────────────────── */
function initActiveNav() {
  const sections = $$('section[id]');
  const navLinks = $$('.nav-link[href^="#"]');
  if (!sections.length || !navLinks.length) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
        });
      }
    });
  }, { threshold: 0.35 });
  sections.forEach(sec => observer.observe(sec));
}

/* ──────────────────────────────────────────────────────────
   PRODUCT CARD — Tilt 3D + Spring reset
   ────────────────────────────────────────────────────────── */
function initCardTilt() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  $$('.product-card').forEach(card => {
    let rafId = null;
    card.addEventListener('mousemove', e => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x    = (e.clientX - rect.left) / rect.width  - 0.5;
        const y    = (e.clientY - rect.top)  / rect.height - 0.5;
        card.style.transition = 'transform 0.08s ease';
        card.style.transform  = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-8px) scale(1.01)`;
      });
    });
    card.addEventListener('mouseleave', () => {
      if (rafId) cancelAnimationFrame(rafId);
      card.style.transition = 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1)';
      card.style.transform  = '';
      setTimeout(() => { card.style.transition = ''; card.style.transform = ''; }, 560);
    });
  });
}

/* ──────────────────────────────────────────────────────────
   SESIÓN — Header dinámico (v2: JWT en lugar de session.php)
   ────────────────────────────────────────────────────────── */
function initSessionHeader() {
  // Si no hay token, no hacer nada (usuario invitado)
  const token = getToken();
  if (!token) return;

  // Llamar a /auth/me para verificar el token y obtener datos frescos
  API.me()
    .then(data => {
      if (!data || !data.loggedIn) return;

      const navLinks = document.querySelectorAll('#nav-login, #m-nav-login');
      navLinks.forEach(el => {
        const isDesktop = el.id === 'nav-login';
        if (isDesktop) {
          el.outerHTML = buildUserMenu(data);
        } else {
          const area = data.rol === 'admin' ? 'dashboard.html' : 'mis_pedidos.html';
          el.outerHTML = `
            <a href="${area}" class="nav-link" id="m-nav-area">👤 ${data.nombre.split(' ')[0]}</a>
            <a href="#" class="nav-link" id="m-nav-logout" data-action="logout" style="color:#EF4444;">🚪 Cerrar Sesión</a>
          `;
          document.getElementById('m-nav-logout')?.addEventListener('click', e => {
            e.preventDefault();
            borrarSesion();
            window.location.href = 'login.html?logout=1';
          });
        }
      });

      // Activar toggle del menú de usuario
      initUserMenuToggle();
    })
    .catch(() => {
      // Token inválido o expirado — limpiar silenciosamente
      borrarSesion();
    });
}

function buildUserMenu(data) {
  const firstName = data.nombre.split(' ')[0];
  const area      = data.rol === 'admin' ? 'dashboard.html' : 'mis_pedidos.html';
  const areaLabel = data.rol === 'admin' ? '📈 Dashboard' : '📦 Mis Pedidos';
  const roleBadge = data.rol === 'admin'
    ? '<span style="font-size:0.65rem;background:rgba(122,0,255,0.15);color:#7A00FF;padding:2px 7px;border-radius:999px;font-weight:700;">ADMIN</span>'
    : '<span style="font-size:0.65rem;background:rgba(16,185,129,0.12);color:#10B981;padding:2px 7px;border-radius:999px;font-weight:700;">CLIENTE</span>';

  return `
    <div class="user-menu-wrap" id="user-menu-wrap" style="position:relative;">
      <button class="user-menu-btn" id="user-menu-btn"
        style="display:flex;align-items:center;gap:8px;background:rgba(122,0,255,0.08);border:1.5px solid rgba(122,0,255,0.20);padding:7px 14px;border-radius:999px;font-family:'Poppins',sans-serif;font-size:0.85rem;font-weight:700;color:#7A00FF;cursor:pointer;transition:all 0.25s;"
        aria-haspopup="true" aria-expanded="false" aria-label="Menú de usuario">
        <span style="width:28px;height:28px;background:linear-gradient(135deg,#7A00FF,#FF007F);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.75rem;font-weight:900;flex-shrink:0;">
          ${firstName[0].toUpperCase()}
        </span>
        ${firstName}
        <svg width="10" height="6" viewBox="0 0 10 6" style="transition:transform 0.25s;flex-shrink:0;"><path d="M1 1l4 4 4-4" stroke="#7A00FF" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
      </button>
      <div id="user-dropdown"
        style="display:none;position:absolute;top:calc(100%+8px);right:0;min-width:220px;background:#fff;border:1px solid #E8E0FF;border-radius:16px;box-shadow:0 16px 40px rgba(122,0,255,0.18);z-index:9999;overflow:hidden;animation:dropIn 0.2s ease;"
        role="menu">
        <style>@keyframes dropIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}</style>
        <div style="padding:14px 16px;border-bottom:1px solid #F0EAFF;">
          <div style="font-family:'Poppins',sans-serif;font-size:0.88rem;font-weight:700;color:#1E293B;margin-bottom:3px;">${data.nombre}</div>
          <div style="font-size:0.74rem;color:#94A3B8;margin-bottom:6px;">${data.email}</div>
          ${roleBadge}
        </div>
        <a href="${area}" role="menuitem"
          style="display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:0.85rem;font-weight:600;color:#1E293B;transition:background 0.2s;"
          onmouseover="this.style.background='#F8F5FF'" onmouseout="this.style.background=''">
          ${areaLabel}
        </a>
        <a href="carrito.html" role="menuitem"
          style="display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:0.85rem;font-weight:600;color:#1E293B;transition:background 0.2s;"
          onmouseover="this.style.background='#F8F5FF'" onmouseout="this.style.background=''">
          🛒 Mi Carrito
        </a>
        <div style="border-top:1px solid #F0EAFF;">
          <a href="#" id="user-logout-link" role="menuitem"
            style="display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:0.85rem;font-weight:600;color:#EF4444;transition:background 0.2s;"
            onmouseover="this.style.background='rgba(239,68,68,0.06)'" onmouseout="this.style.background=''">
            🚪 Cerrar Sesión
          </a>
        </div>
      </div>
    </div>`;
}

function initUserMenuToggle() {
  document.addEventListener('click', e => {
    const wrap = document.getElementById('user-menu-wrap');
    const btn  = document.getElementById('user-menu-btn');
    const drop = document.getElementById('user-dropdown');
    if (!wrap || !btn || !drop) return;
    if (btn.contains(e.target)) {
      const isOpen = drop.style.display === 'block';
      drop.style.display = isOpen ? 'none' : 'block';
      btn.setAttribute('aria-expanded', !isOpen);
      const svg = btn.querySelector('svg');
      if (svg) svg.style.transform = isOpen ? '' : 'rotate(180deg)';
    } else if (!wrap.contains(e.target)) {
      drop.style.display = 'none';
      btn.setAttribute('aria-expanded', 'false');
      const svg = btn.querySelector('svg');
      if (svg) svg.style.transform = '';
    }
  });

  // Logout desde menú desplegable
  document.addEventListener('click', e => {
    if (e.target.closest('#user-logout-link')) {
      e.preventDefault();
      borrarSesion();
      window.location.href = 'login.html?logout=1';
    }
  });
}

/* ──────────────────────────────────────────────────────────
   HERO PARALLAX suave
   ────────────────────────────────────────────────────────── */
function initHeroParallax() {
  const hero = document.querySelector('.hero');
  const heroVisual = document.querySelector('.hero-visual');
  if (!hero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrolled = window.scrollY;
        if (scrolled < hero.offsetHeight) {
          if (heroVisual) heroVisual.style.transform = `translateY(${scrolled * 0.12}px)`;
          const card = hero.querySelector('.hero-card-mockup');
          if (card) card.style.transform = `translateY(${-scrolled * 0.08}px)`;
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

/* ──────────────────────────────────────────────────────────
   CURSOR SPOTLIGHT
   ────────────────────────────────────────────────────────── */
function initCursorSpotlight() {
  const darkSections = document.querySelectorAll('.process, .hero');
  if (!darkSections.length || window.matchMedia('(pointer: coarse)').matches) return;
  darkSections.forEach(section => {
    section.style.position = 'relative';
    const spotlight = document.createElement('div');
    spotlight.style.cssText = [
      'position:absolute', 'width:360px', 'height:360px', 'border-radius:50%',
      'pointer-events:none',
      'background:radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
      'transform:translate(-50%,-50%)', 'z-index:0', 'opacity:0', 'transition:opacity 0.4s ease',
      'will-change:left,top',
    ].join(';');
    section.appendChild(spotlight);
    let rafId = null;
    section.addEventListener('mousemove', e => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = section.getBoundingClientRect();
        spotlight.style.left    = (e.clientX - rect.left)  + 'px';
        spotlight.style.top     = (e.clientY - rect.top)   + 'px';
        spotlight.style.opacity = '1';
      });
    }, { passive: true });
    section.addEventListener('mouseleave', () => { spotlight.style.opacity = '0'; });
  });
}
/* ──────────────────────────────────────────────────────────
   INIT
   ────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initMobileMenu();
  initCartBadge();
  initCatalogFilters();
  initReveal();
  initCounters();
  initSmoothScroll();
  initActiveNav();
  initCardTilt();
  initHeroParallax();
  initCursorSpotlight();
  initSessionHeader();   // ← v2: JWT en lugar de session.php

  if (!sessionStorage.getItem('st_welcomed')) {
    setTimeout(() => {
      showToast('¡Bienvenido a Subli-Tech Bolivia! Explora nuestro catálogo 🎨', 'success', 4000);
      sessionStorage.setItem('st_welcomed', '1');
    }, 1400);
  }
});