/**
 * ============================================================
 *  SUBLI-TECH v2 — js/auth.js
 *  Lógica de login.html:
 *   - Formulario Login  → POST /auth/login
 *   - Formulario Registro → POST /auth/register
 *   - Tabs, password toggle, strength bar, demo fill
 *  Reemplaza: php/auth.php (action=login, action=register)
 * ============================================================
 */

'use strict';

/* ──────────────────────────────────────────────────────────
   UTILIDADES DE ALERTA
   ────────────────────────────────────────────────────────── */
function showAlert(id, msg, type = 'error') {
  const el    = document.getElementById(id);
  const msgEl = document.getElementById(id + '-msg');
  if (!el) return;
  el.className  = `auth-alert ${type} visible`;
  if (msgEl) msgEl.textContent = msg;
}
function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.className = `auth-alert ${el.className.includes('error') ? 'error' : 'success'}`;
}

/* ──────────────────────────────────────────────────────────
   REDIRECCIONAMIENTO POR ROL
   Reemplaza: header('Location: ...') de PHP
   ────────────────────────────────────────────────────────── */
function redirigirPorRol(rol) {
  if (rol === 'admin') {
    window.location.href = 'dashboard.html';
  } else {
    window.location.href = 'mis_pedidos.html';
  }
}

/* ──────────────────────────────────────────────────────────
   TABS (Login / Registro)
   ────────────────────────────────────────────────────────── */
function initTabs() {
  const tabs   = document.querySelectorAll('.auth-tab');
  const panels = document.querySelectorAll('.auth-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const target = document.getElementById('panel-' + tab.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  // Enlace "Regístrate gratis →"
  document.getElementById('go-to-register')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('tab-register-btn')?.click();
  });
}

/* ──────────────────────────────────────────────────────────
   PASSWORD TOGGLE
   ────────────────────────────────────────────────────────── */
function initPwdToggle(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn   = document.getElementById(btnId);
  if (!input || !btn) return;
  btn.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? '🙈' : '👁️';
  });
}

/* ──────────────────────────────────────────────────────────
   STRENGTH BAR (barra de fortaleza de contraseña)
   ────────────────────────────────────────────────────────── */
function initStrengthBar() {
  const input = document.getElementById('reg-password');
  const fill  = document.getElementById('strength-fill');
  const label = document.getElementById('strength-label');
  if (!input || !fill) return;

  input.addEventListener('input', () => {
    const v = input.value;
    let score = 0;
    if (v.length >= 6)   score++;
    if (v.length >= 10)  score++;
    if (/[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;

    const levels = [
      { w: '0%',   bg: 'transparent', text: '' },
      { w: '25%',  bg: '#EF4444',     text: 'Muy débil' },
      { w: '50%',  bg: '#F59E0B',     text: 'Débil' },
      { w: '75%',  bg: '#3B82F6',     text: 'Buena' },
      { w: '100%', bg: '#10B981',     text: 'Excelente' },
    ];
    const lvl = levels[Math.min(score, 4)];
    fill.style.width      = lvl.w;
    fill.style.background = lvl.bg;
    if (label) label.textContent = lvl.text;
  });
}

/* ──────────────────────────────────────────────────────────
   RELLENO DEMO
   ────────────────────────────────────────────────────────── */
function initDemoFill() {
  document.getElementById('btn-demo-admin')?.addEventListener('click', () => {
    document.getElementById('login-email').value    = 'admin@sublitech.bo';
    document.getElementById('login-password').value = 'password123';
  });
  document.getElementById('btn-demo-cliente')?.addEventListener('click', () => {
    document.getElementById('login-email').value    = 'maria@gmail.com';
    document.getElementById('login-password').value = 'password123';
  });
}

/* ──────────────────────────────────────────────────────────
   BANNER DE LOGOUT (si viene con ?logout=1 en la URL)
   ────────────────────────────────────────────────────────── */
function checkLogoutBanner() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('logout') === '1') {
    const banner = document.getElementById('logout-banner');
    if (banner) banner.classList.add('visible');
    borrarSesion();
  }
  // También mostrar errores por parámetro ?error=
  if (params.get('error')) {
    showAlert('login-alert', decodeURIComponent(params.get('error')));
  }
}

/* ──────────────────────────────────────────────────────────
   REDIRIGIR SI YA HAY SESIÓN
   ────────────────────────────────────────────────────────── */
function checkSesionActiva() {
  if (!isLoggedIn()) return;
  const user = getUser();
  if (user?.rol) redirigirPorRol(user.rol);
}

/* ──────────────────────────────────────────────────────────
   FORMULARIO LOGIN → POST /auth/login
   ────────────────────────────────────────────────────────── */
function initLoginForm() {
  const form = document.getElementById('login-form');
  const btn  = document.getElementById('btn-login');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    hideAlert('login-alert');

    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      showAlert('login-alert', 'Por favor completa todos los campos.');
      return;
    }

    btn.classList.add('loading');
    btn.disabled = true;

    try {
      const data = await API.login(email, password);
      // Guardar sesión en localStorage (reemplaza $_SESSION de PHP)
      guardarSesion(data.access_token, {
        nombre: data.nombre,
        rol:    data.rol,
        email:  email,
      });
      redirigirPorRol(data.rol);
    } catch (err) {
      showAlert('login-alert', err.message || 'Credenciales incorrectas.');
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });
}

/* ──────────────────────────────────────────────────────────
   FORMULARIO REGISTRO → POST /auth/register
   ────────────────────────────────────────────────────────── */
function initRegisterForm() {
  const form = document.getElementById('register-form');
  const btn  = document.getElementById('btn-register');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    hideAlert('register-alert');

    const nombre   = document.getElementById('reg-nombre').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const telefono = document.getElementById('reg-telefono').value.trim();
    const ciudad   = document.getElementById('reg-ciudad').value;
    const password = document.getElementById('reg-password').value;
    const confirmEl = document.getElementById('reg-password-confirm');
    const confirm   = confirmEl ? confirmEl.value : password;
    const terms     = document.getElementById('reg-terms')?.checked;

    if (!nombre || !email || !password) {
      showAlert('register-alert', 'Por favor completa los campos obligatorios.');
      return;
    }
    if (password.length < 6) {
      showAlert('register-alert', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (confirmEl && password !== confirm) {
      showAlert('register-alert', 'Las contraseñas no coinciden.');
      return;
    }
    if (!terms) {
      showAlert('register-alert', 'Debes aceptar los términos y condiciones.');
      return;
    }

    btn.classList.add('loading');
    btn.disabled = true;

    try {
      const data = await API.register({ nombre, email, password, telefono, ciudad });
      guardarSesion(data.access_token, {
        nombre: data.nombre,
        rol:    data.rol,
        email:  email,
      });
      redirigirPorRol(data.rol);
    } catch (err) {
      showAlert('register-alert', err.message || 'Error al crear la cuenta. Intenta de nuevo.');
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });
}

/* ──────────────────────────────────────────────────────────
   INIT
   ────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  checkSesionActiva();
  checkLogoutBanner();
  initTabs();
  initPwdToggle('login-password',       'login-pwd-toggle');
  initPwdToggle('reg-password',         'reg-pwd-toggle');
  initPwdToggle('reg-password-confirm', 'reg-confirm-toggle');
  initStrengthBar();
  initDemoFill();
  initLoginForm();
  initRegisterForm();
});
