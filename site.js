/* ============================================================
   MANJUSHREE BIOTECH — shared site script
   Loads data.json, hydrates per-page content, handles nav + admin CMS.
   Pattern carried over from the Nirvana Biotech template: same
   login -> verify -> edit -> save-to-GitHub flow, adapted to this
   site's data shape.
   ============================================================ */

const FALLBACK_AVATAR = "https://ui-avatars.com/api/?background=1E2733&color=C79A44&name=";
let SITE_DATA = null;

/* ---------------- admin config ---------------- */
// Set this to your deployed Cloudflare Worker URL (see WRANGLER_GUIDE.md).
const ADMIN_API_BASE = "manjushree-biotech-admin.rajindra04.workers.dev";
const SESSION_KEY = "mb_admin_session";
const PENDING_PATCH_KEY = "mb_pending_patch";   // unsaved field edits, deep-merged onto data.json
const PENDING_IMAGES_KEY = "mb_pending_images"; // unsaved image uploads, base64, keyed by repo path
let PENDING_IMAGES = loadPendingImages();
window.__editMode = false;
let EDIT_MODAL_OPEN = false;

function loadPendingImages() {
  try { return JSON.parse(sessionStorage.getItem(PENDING_IMAGES_KEY) || '{}'); }
  catch { return {}; }
}
function persistPendingImages() {
  sessionStorage.setItem(PENDING_IMAGES_KEY, JSON.stringify(PENDING_IMAGES));
}
function loadPendingPatch() {
  try { return JSON.parse(sessionStorage.getItem(PENDING_PATCH_KEY) || '{}'); }
  catch { return {}; }
}
function persistPendingPatch(patch) {
  sessionStorage.setItem(PENDING_PATCH_KEY, JSON.stringify(patch));
}
function hasPendingChanges() {
  const patch = loadPendingPatch();
  return Object.keys(patch).length > 0 || Object.keys(PENDING_IMAGES).length > 0;
}
// Deep-merge a sparse patch object onto the freshly-fetched data, so edits made
// on another page are still visible/saveable once you navigate elsewhere,
// until you hit Save or Discard.
function deepMerge(base, patch) {
  if (Array.isArray(patch)) return patch.slice();
  if (patch && typeof patch === 'object') {
    const out = (base && typeof base === 'object' && !Array.isArray(base)) ? { ...base } : {};
    for (const key of Object.keys(patch)) {
      out[key] = deepMerge(base ? base[key] : undefined, patch[key]);
    }
    return out;
  }
  return patch;
}

const PAGES = [
  { id: "home",     href: "index.html",             label: "Home" },
  { id: "trading",  href: "trading.html",            label: "Trading" },
  { id: "iso",      href: "iso-consultation.html",   label: "ISO Consultation" },
  { id: "research", href: "research.html",           label: "Research & Development" },
  { id: "about",    href: "about.html",              label: "About" },
  { id: "contact",  href: "contact.html",            label: "Contact" },
];

let SERVER_DATA = null; // last fetched, unmodified copy from data.json — merge base

async function loadSiteData() {
  try {
    const res = await fetch('data.json?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('no data.json');
    SERVER_DATA = await res.json();
  } catch (e) {
    console.warn('Falling back to embedded defaults', e);
    SERVER_DATA = window.__DEFAULT_DATA__ || {};
  }
  const patch = loadPendingPatch();
  SITE_DATA = Object.keys(patch).length ? deepMerge(SERVER_DATA, patch) : SERVER_DATA;
  hydrateBrand();
  if (typeof renderPage === 'function') renderPage(SITE_DATA);
}

function hydrateBrand() {
  document.querySelectorAll('[data-brand-name]').forEach(el => el.textContent = SITE_DATA.brandName || 'Manjushree Biotech');
  document.querySelectorAll('[data-brand-sub]').forEach(el => el.textContent = SITE_DATA.brandSub || '');
  document.querySelectorAll('[data-brand-logo]').forEach(el => {
    if (SITE_DATA.logoUrl) { el.src = SITE_DATA.logoUrl; el.style.display = ''; }
  });
  document.querySelectorAll('[data-brand-seal]').forEach(el => {
    el.style.display = SITE_DATA.logoUrl ? 'none' : '';
  });
  const email = SITE_DATA.contact?.email;
  if (email) {
    document.querySelectorAll('[data-footer-email]').forEach(el => { el.textContent = email; el.href = `mailto:${email}`; });
  }
  const location = SITE_DATA.contact?.location;
  if (location) {
    document.querySelectorAll('[data-footer-location]').forEach(el => { el.textContent = location; });
  }
}

function buildNav(activeId) {
  document.querySelectorAll('[data-navlinks]').forEach(container => {
    container.innerHTML = PAGES.map(p =>
      `<a href="${p.href}" class="${p.id === activeId ? 'is-active' : ''}">${p.label}</a>`
    ).join('');
  });
}

function setupMobileMenu() {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('.mobile-menu');
  if (!toggle || !menu) return;
  toggle.addEventListener('click', () => menu.classList.toggle('open'));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));
}

/* ============================================================
   ADMIN: login, edit mode, generic field editors, save-to-GitHub
   ============================================================ */

function getSessionToken() {
  const token = sessionStorage.getItem(SESSION_KEY);
  if (!token || !token.includes('.')) return null;
  const [payload] = token.split('.');
  const expires = parseInt(payload, 10);
  if (Number.isNaN(expires) || Math.floor(Date.now() / 1000) >= expires) {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
  return token;
}

function setupAdminUI() {
  const loginBtn = document.getElementById('admin-login-btn');
  const logoutBtn = document.getElementById('admin-logout-btn');
  const loginModal = document.getElementById('admin-login-modal');
  const passwordInput = document.getElementById('admin-password-input');
  if (loginBtn) loginBtn.addEventListener('click', openAdminLogin);
  if (logoutBtn) logoutBtn.addEventListener('click', adminLogout);
  if (loginModal) loginModal.addEventListener('click', e => { if (e.target === loginModal) closeAdminLogin(); });
  if (passwordInput) passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitAdminLogin(); });
  const saveBtn = document.getElementById('save-btn');
  const discardBtn = document.getElementById('discard-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveAllChanges);
  if (discardBtn) discardBtn.addEventListener('click', discardChanges);

  const storedToken = getSessionToken();
  if (storedToken) {
    verifyTokenWithServer(storedToken).then(isValid => {
      if (isValid) enterEditMode();
      else { sessionStorage.removeItem(SESSION_KEY); exitEditMode(); }
    });
  }
}

async function verifyTokenWithServer(token) {
  try {
    const resp = await fetch(`${ADMIN_API_BASE}/verify`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    return resp.ok;
  } catch (e) {
    console.warn('Could not verify admin session with server:', e);
    return false;
  }
}

function openAdminLogin() {
  const modal = document.getElementById('admin-login-modal');
  if (!modal) return;
  modal.classList.add('open');
  const input = document.getElementById('admin-password-input');
  const err = document.getElementById('admin-login-error');
  if (input) { input.value = ''; input.focus(); }
  if (err) err.classList.remove('show');
}
function closeAdminLogin() {
  document.getElementById('admin-login-modal')?.classList.remove('open');
}

async function submitAdminLogin() {
  const input = document.getElementById('admin-password-input');
  const err = document.getElementById('admin-login-error');
  const password = input ? input.value : '';
  try {
    const resp = await fetch(`${ADMIN_API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!resp.ok) {
      if (err) { err.textContent = 'Incorrect password.'; err.classList.add('show'); }
      return;
    }
    const { token } = await resp.json();
    sessionStorage.setItem(SESSION_KEY, token);
    closeAdminLogin();
    enterEditMode();
  } catch (e) {
    if (err) { err.textContent = 'Could not reach admin server. Check ADMIN_API_BASE in site.js and your connection.'; err.classList.add('show'); }
  }
}

function adminLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  exitEditMode();
}

function enterEditMode() {
  window.__editMode = true;
  document.body.classList.add('edit-mode');
  document.getElementById('admin-login-btn')?.classList.add('hidden');
  document.getElementById('admin-logout-btn')?.classList.remove('hidden');
  document.getElementById('save-bar')?.classList.add('open');
  const statusEl = document.getElementById('save-status');
  if (statusEl) {
    if (hasPendingChanges()) {
      statusEl.textContent = 'Editing — changes are not yet saved.';
      statusEl.classList.remove('is-saved');
    } else {
      statusEl.textContent = 'No unsaved changes.';
    }
  }
}
function exitEditMode() {
  window.__editMode = false;
  document.body.classList.remove('edit-mode');
  document.getElementById('admin-login-btn')?.classList.remove('hidden');
  document.getElementById('admin-logout-btn')?.classList.add('hidden');
  document.getElementById('save-bar')?.classList.remove('open');
}

/* ---- dotted-path helpers, e.g. "home.title" or "iso.packages.0.groups.0.items" ---- */
function getByPath(obj, path) {
  if (!obj) return null;
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}
function setByPath(obj, path, value) {
  if (!obj) return;
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function tryOpenEditModal() {
  if (EDIT_MODAL_OPEN) return false;
  EDIT_MODAL_OPEN = true;
  return true;
}
function releaseEditModalLock() { EDIT_MODAL_OPEN = false; }

/* ---- text editing (single field, e.g. a title or a paragraph) ---- */
function promptTextEdit(path, elementId, multiline) {
  if (!SITE_DATA || !tryOpenEditModal()) return;
  const currentValue = getByPath(SITE_DATA, path) ?? '';
  openTextEditorModal('Edit text', currentValue, multiline, (newValue) => {
    setByPath(SITE_DATA, path, newValue);
    if (elementId) {
      const el = document.getElementById(elementId);
      if (el) el.textContent = newValue;
    } else {
      rerenderFromMemory();
    }
    markUnsaved();
  });
}

/* ---- list editing (array of plain strings, e.g. a checklist or a
   package's line items) — edited as one newline-separated textarea ---- */
function promptListEdit(path) {
  if (!SITE_DATA || !tryOpenEditModal()) return;
  const currentArray = getByPath(SITE_DATA, path) || [];
  const currentValue = currentArray.join('\n');
  openTextEditorModal('Edit list (one item per line)', currentValue, true, (newValue) => {
    const items = newValue.split('\n').map(s => s.trim()).filter(Boolean);
    setByPath(SITE_DATA, path, items);
    rerenderFromMemory();
    markUnsaved();
  });
}

function openTextEditorModal(heading, initialValue, multiline, onConfirm) {
  document.querySelectorAll('.text-edit-overlay').forEach(el => el.remove());
  const uid = 'text-edit-' + Math.random().toString(36).slice(2);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay text-edit-overlay open';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:480px;">
      <div class="modal-body">
        <h3 style="font-size:1.2rem; margin-bottom:1rem;">${escapeHtml(heading)}</h3>
        ${multiline
          ? `<textarea id="${uid}" rows="8"></textarea>`
          : `<input id="${uid}" type="text">`}
        <div style="display:flex; gap:0.8rem; margin-top:1.2rem;">
          <button class="btn btn--ghost text-edit-cancel" style="flex:1; justify-content:center;">Cancel</button>
          <button class="btn btn--solid text-edit-confirm" style="flex:1; justify-content:center;">Apply</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector(`#${uid}`);
  input.value = initialValue;
  input.focus();
  const cleanup = () => { overlay.remove(); releaseEditModalLock(); };
  overlay.onclick = (e) => { if (e.target === overlay) cleanup(); };
  overlay.querySelector('.text-edit-cancel').onclick = cleanup;
  overlay.querySelector('.text-edit-confirm').onclick = () => { onConfirm(input.value); cleanup(); };
}

/* ---- image editing (logo, team photos) ---- */
function promptImageEdit(path, suggestedRepoPath) {
  if (!SITE_DATA) return;
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const repoPath = suggestedRepoPath || `images/${path.replace(/\./g, '-')}-${Date.now()}.${ext}`;
      PENDING_IMAGES[repoPath] = dataUrl;
      persistPendingImages();
      setByPath(SITE_DATA, path, repoPath);
      rerenderFromMemory(dataUrl, repoPath);
      markUnsaved();
    };
    reader.readAsDataURL(file);
  };
  fileInput.click();
}

function rerenderFromMemory(previewDataUrl, previewPath) {
  const wasEditMode = window.__editMode;
  hydrateBrand();
  if (typeof renderPage === 'function') renderPage(SITE_DATA);
  injectTraces();
  if (wasEditMode) enterEditMode();
  if (previewDataUrl && previewPath) {
    document.querySelectorAll('img').forEach(img => {
      if (img.getAttribute('src') === previewPath || img.src.endsWith(previewPath)) {
        img.src = previewDataUrl;
      }
    });
  }
}

/* ---- add / remove array-of-object items ---- */
const ARRAY_TEMPLATES = {
  pillars:     { ref: 'Today', title: 'New pillar', desc: 'Description goes here.' },
  categories:  { title: 'New category', desc: 'Description goes here.' },
  reasons:     { title: 'New reason', desc: 'Description goes here.' },
  roadmap:     { tag: 'Next', title: 'New stage', desc: 'Description goes here.' },
  focusAreas:  { title: 'New focus area', desc: 'Description goes here.' },
  values:      { title: 'New value', desc: 'Description goes here.' },
  team:        { name: 'New team member', role: 'Role / Title', bio: '', imageUrl: '' },
};
// which top-level section each array lives under
const NESTED_ARRAY_PARENT = {
  pillars: 'home',
  categories: 'trading', reasons: 'trading',
  roadmap: 'research', focusAreas: 'research',
  values: 'about', team: 'about',
};
function getArrayContainer(section) {
  const parentKey = NESTED_ARRAY_PARENT[section];
  return parentKey ? (SITE_DATA[parentKey] ||= {}) : SITE_DATA;
}
function addArrayItem(section) {
  if (!SITE_DATA) return;
  const container = getArrayContainer(section);
  if (!container[section]) container[section] = [];
  container[section].push({ ...ARRAY_TEMPLATES[section] });
  rerenderFromMemory();
  markUnsaved();
}
function removeArrayItem(section, idx) {
  if (!SITE_DATA) return;
  const container = getArrayContainer(section);
  if (!container[section]) return;
  if (!confirm('Remove this item? This cannot be undone once saved.')) return;
  container[section].splice(idx, 1);
  rerenderFromMemory();
  markUnsaved();
}

function markUnsaved() {
  persistPendingPatch(SITE_DATA);
  const statusEl = document.getElementById('save-status');
  if (!statusEl) return;
  statusEl.textContent = 'Editing — changes are not yet saved.';
  statusEl.classList.remove('is-saved');
}

function discardChanges() {
  if (!confirm('Discard all unsaved changes and reload the live version?')) return;
  PENDING_IMAGES = {};
  sessionStorage.removeItem(PENDING_IMAGES_KEY);
  sessionStorage.removeItem(PENDING_PATCH_KEY);
  loadSiteData().then(() => {
    injectTraces();
    if (window.__editMode) enterEditMode();
  });
}

/* ---- save via Cloudflare Worker ---- */
async function saveAllChanges() {
  const token = getSessionToken();
  if (!token) {
    alert('Your admin session expired. Please log in again.');
    exitEditMode();
    openAdminLogin();
    return;
  }
  const saveBtn = document.getElementById('save-btn');
  const statusEl = document.getElementById('save-status');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
  if (statusEl) statusEl.textContent = 'Committing changes to the live site...';

  const images = Object.entries(PENDING_IMAGES).map(([path, base64]) => ({ path, base64 }));

  try {
    const resp = await fetch(`${ADMIN_API_BASE}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        dataJson: SITE_DATA,
        images,
        commitMessage: 'Admin: update site content via dashboard',
      }),
    });
    if (resp.status === 401) {
      alert('Your admin session expired. Please log in again.');
      exitEditMode();
      openAdminLogin();
      return;
    }
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.error || `Save failed (${resp.status})`);
    }
    alert('Changes successfully committed and pushed to GitHub! Give it a minute to update.');
    PENDING_IMAGES = {};
    sessionStorage.removeItem(PENDING_IMAGES_KEY);
    sessionStorage.removeItem(PENDING_PATCH_KEY);
    SERVER_DATA = SITE_DATA;
    if (statusEl) { statusEl.textContent = 'All changes saved permanently to GitHub.'; statusEl.classList.add('is-saved'); }
  } catch (err) {
    console.error('Save failed:', err);
    alert(`Failed to sync changes: ${err.message}`);
    markUnsaved();
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save changes (permanent)'; }
  }
}

/* ---------------- hero trace SVG (signature motif) ---------------- */
function traceSVG(opts = {}) {
  const w = opts.w || 640, h = opts.h || 60, seed = opts.seed || 1;
  let d1 = `M0 ${h*0.6}`;
  let d2 = `M0 ${h*0.7}`;
  const steps = 22;
  for (let i = 1; i <= steps; i++) {
    const x = (w / steps) * i;
    const n1 = Math.sin(i * 0.7 + seed) * 0.5 + Math.sin(i * 1.9 + seed * 2) * 0.3;
    const n2 = Math.cos(i * 0.5 + seed * 1.3) * 0.4 + Math.sin(i * 2.3) * 0.25;
    const y1 = h * 0.5 - n1 * (h * 0.4);
    const y2 = h * 0.55 - n2 * (h * 0.32);
    d1 += ` L${x.toFixed(1)} ${y1.toFixed(1)}`;
    d2 += ` L${x.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return `<svg class="trace" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path class="trace-mist" d="${d2}"/>
    <path d="${d1}"/>
  </svg>`;
}
function injectTraces() {
  document.querySelectorAll('[data-trace]').forEach((el, i) => {
    const w = el.clientWidth || 640;
    el.innerHTML = traceSVG({ w, h: parseInt(el.dataset.traceH || '60', 10), seed: i + 1 });
  });
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

document.addEventListener('DOMContentLoaded', () => {
  setupMobileMenu();
  setupAdminUI();
  loadSiteData().then(() => {
    injectTraces();
    if (window.__editMode) enterEditMode();
  });
  window.addEventListener('resize', () => injectTraces());
});
