const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { generatePdf } = require('../services/pdf');
const { renderCvHtml } = require('../views/cv.html.js');

// ─── Multer setup ────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../../public/uploads/avatars');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = ['.jpg', '.jpeg', '.png'].includes(path.extname(file.originalname).toLowerCase())
      ? path.extname(file.originalname).toLowerCase()
      : '.jpg';
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes JPEG o PNG'));
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function safeJson(val, fallback) {
  if (val == null) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}
function getInitials(user) {
  const name = user.name || user.email || '';
  return name.split(/[\s@]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}
function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── GET /perfil ─────────────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const cvData = db.prepare('SELECT * FROM cv_data WHERE user_id = ?').get(req.user.id);
  const payments = db.prepare(
    `SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC`
  ).all(req.user.id);
  const hasPaid = payments.some(p => p.status === 'paid');
  res.send(renderPerfilHtml(user, cvData, payments, hasPaid));
});

// ─── POST /perfil/datos ───────────────────────────────────────────────────────
router.post('/datos', requireAuth, (req, res) => {
  const db = getDb();
  const name  = String(req.body.name  || '').trim().slice(0, 100);
  const phone = String(req.body.phone || '').trim().slice(0, 30);
  const city  = String(req.body.city  || '').trim().slice(0, 100);
  db.prepare(`UPDATE users SET name=?, phone=?, city=?, updated_at=datetime('now') WHERE id=?`)
    .run(name, phone, city, req.user.id);
  console.log(`[AUDIT] Profile datos updated: user ${req.user.id}`);
  res.json({ ok: true });
});

// ─── POST /perfil/foto ────────────────────────────────────────────────────────
router.post('/foto', requireAuth, (req, res) => {
  upload.single('foto')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

    const db = getDb();
    const photoUrl = `/uploads/avatars/${req.file.filename}`;

    db.prepare(`UPDATE users SET photo_url=?, updated_at=datetime('now') WHERE id=?`)
      .run(photoUrl, req.user.id);

    // Sync photo into cv_data.profile so CV uses the same photo
    const cvData = db.prepare('SELECT profile FROM cv_data WHERE user_id = ?').get(req.user.id);
    if (cvData) {
      const profile = safeJson(cvData.profile, {});
      profile.photo = photoUrl;
      db.prepare(`UPDATE cv_data SET profile=? WHERE user_id=?`)
        .run(JSON.stringify(profile), req.user.id);
    }

    console.log(`[AUDIT] Profile photo updated: user ${req.user.id}`);
    res.json({ ok: true, photoUrl });
  });
});

// ─── POST /perfil/cv/descargar ────────────────────────────────────────────────
router.post('/cv/descargar', requireAuth, async (req, res) => {
  const db = getDb();
  const payment = db.prepare(
    `SELECT id FROM payments WHERE user_id = ? AND status = 'paid' LIMIT 1`
  ).get(req.user.id);
  if (!payment) return res.status(403).send('Acceso denegado: sin pago verificado');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const cvData = db.prepare('SELECT * FROM cv_data WHERE user_id = ?').get(req.user.id);
  if (!cvData) return res.status(404).send('CV no encontrado');

  cvData.jobs = safeJson(cvData.jobs, []);
  cvData.ai_suggested_jobs = safeJson(cvData.ai_suggested_jobs, []);

  const html = renderCvHtml(user, cvData, { showPayButton: false, watermark: false });
  try {
    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cv-${req.user.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error('[Perfil] PDF error:', e.message);
    res.status(500).send('Error al generar el PDF');
  }
});

// ─── POST /perfil/eliminar-cuenta ─────────────────────────────────────────────
router.post('/eliminar-cuenta', requireAuth, (req, res, next) => {
  if (req.body.confirm !== 'ELIMINAR') {
    return res.status(400).json({ error: 'Confirmación incorrecta' });
  }
  const db = getDb();
  const userId = req.user.id;
  const deleteAll = db.transaction(() => {
    db.prepare('DELETE FROM payments WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM cv_data WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });
  deleteAll();
  console.log(`[AUDIT] Account deleted: user ${userId}`);
  req.logout(err => {
    if (err) return next(err);
    res.json({ ok: true });
  });
});

// ─── HTML render ──────────────────────────────────────────────────────────────
function renderPerfilHtml(user, cvData, payments, hasPaid) {
  const profile = safeJson(cvData && cvData.profile, {});
  const displayName = user.name || profile.nombre || user.email.split('@')[0];
  const avatarText = getInitials(user);
  const photoHtml = user.photo_url
    ? `<img src="${esc(user.photo_url)}" alt="Foto de perfil" class="avatar-img">`
    : `<span class="avatar-initials">${esc(avatarText)}</span>`;

  // CV card
  const cvProfile = safeJson(cvData && cvData.profile, {});
  const cvJobs = safeJson(cvData && cvData.jobs, []);
  const cvTitle = cvJobs.length
    ? `CV — ${esc(cvJobs[0].position || cvJobs[0].cargo || 'Sin cargo')} — ${fmtDate(cvData.updated_at)}`
    : `CV — ${fmtDate(cvData && cvData.updated_at)}`;

  const cvCardHtml = cvData
    ? `<div class="cv-card">
        <div class="cv-card-info">
          <div class="cv-card-title">${cvTitle}</div>
          <div class="cv-card-meta">
            Actualizado: ${fmtDate(cvData.updated_at)}
            ${hasPaid ? '<span class="badge-paid">Pagado ✓</span>' : '<span class="badge-unpaid">Sin pagar</span>'}
          </div>
        </div>
        <div class="cv-card-actions">
          <a href="/ver/${esc(user.view_token)}" target="_blank" class="btn-cv-action btn-preview">Previsualizar</a>
          <a href="/editar/${esc(String(user.id))}" class="btn-cv-action btn-edit">Editar</a>
          ${hasPaid
            ? `<form method="POST" action="/perfil/cv/descargar" style="display:inline">
                 <button type="submit" class="btn-cv-action btn-download">Descargar PDF</button>
               </form>`
            : `<form method="POST" action="/create-checkout-session" style="display:inline">
                 <input type="hidden" name="userId" value="${esc(String(user.id))}">
                 <button type="submit" class="btn-cv-action btn-pay">Descargar — 5€</button>
               </form>`
          }
        </div>
      </div>`
    : `<div class="empty-state">
        <p>Aún no has generado ningún CV.</p>
        <a href="/chat" class="btn-create">Crear CV con IA</a>
        <a href="/crear" class="btn-create-secondary">Formulario clásico</a>
      </div>`;

  // Payments table
  const paymentsHtml = payments.length
    ? `<table class="payments-table">
        <thead><tr><th>Fecha</th><th>Importe</th><th>Estado</th><th>Referencia</th></tr></thead>
        <tbody>
          ${payments.map(p => `
            <tr>
              <td>${fmtDate(p.created_at)}</td>
              <td>${((p.amount || 0) / 100).toFixed(2)} €</td>
              <td><span class="status-${esc(p.status)}">${p.status === 'paid' ? 'Pagado' : p.status === 'pending' ? 'Pendiente' : esc(p.status)}</span></td>
              <td class="session-id">${esc((p.stripe_session_id || '').slice(0, 24))}…</td>
            </tr>`).join('')}
        </tbody>
      </table>`
    : `<div class="empty-state"><p>No hay compras registradas.</p></div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mi Perfil — CreaCV</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f0f4f8; color: #1a2535; min-height: 100vh; }

    /* NAV */
    nav { display: flex; justify-content: space-between; align-items: center; padding: 16px 48px; background: #fff; border-bottom: 1px solid #e8f0f7; position: sticky; top: 0; z-index: 100; }
    .nav-logo { font-family: 'Raleway', sans-serif; font-size: 22px; font-weight: 800; color: #1e2d4d; text-decoration: none; }
    .nav-logo span { color: #4caf50; }
    .nav-links { display: flex; gap: 10px; align-items: center; }
    .btn-nav { padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; border: 2px solid transparent; transition: all 0.2s; cursor: pointer; background: none; }
    .btn-nav-outline { color: #3a7ca5; border-color: #3a7ca5; }
    .btn-nav-outline:hover { background: #e8f0f7; }
    .btn-nav-solid { background: #1e2d4d; color: #fff; }
    .btn-nav-solid:hover { background: #2c4270; }

    /* LAYOUT */
    .page { max-width: 860px; margin: 36px auto; padding: 0 20px 80px; }

    /* PROFILE HEADER */
    .profile-header { background: #fff; border-radius: 16px; padding: 32px 36px; display: flex; align-items: center; gap: 28px; margin-bottom: 28px; box-shadow: 0 2px 12px rgba(30,45,77,0.06); }
    .avatar-wrap { position: relative; flex-shrink: 0; }
    .avatar-img { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #e8f0f7; }
    .avatar-initials { width: 80px; height: 80px; border-radius: 50%; background: #1e2d4d; color: #fff; font-size: 28px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .avatar-upload-btn { position: absolute; bottom: 0; right: 0; background: #3a7ca5; color: #fff; border: none; border-radius: 50%; width: 26px; height: 26px; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .avatar-upload-btn:hover { background: #2a6a95; }
    #foto-input { display: none; }
    .profile-details { flex: 1; }
    .profile-details h1 { font-size: 22px; font-weight: 700; color: #1e2d4d; margin-bottom: 4px; }
    .profile-details p { font-size: 14px; color: #5a6a7a; }

    /* TABS */
    .tabs { display: flex; gap: 4px; background: #fff; border-radius: 12px; padding: 6px; margin-bottom: 20px; box-shadow: 0 2px 12px rgba(30,45,77,0.06); }
    .tab-btn { flex: 1; padding: 10px 16px; border: none; background: none; border-radius: 8px; font-size: 14px; font-weight: 600; color: #5a6a7a; cursor: pointer; transition: all 0.2s; }
    .tab-btn.active { background: #1e2d4d; color: #fff; }
    .tab-btn:hover:not(.active) { background: #f0f4f8; color: #1e2d4d; }

    /* PANELS */
    .tab-panel { background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 2px 12px rgba(30,45,77,0.06); }
    .tab-panel.hidden { display: none; }

    /* FORM */
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 8px; }
    @media (max-width: 560px) { .form-grid { grid-template-columns: 1fr; } }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #5a6a7a; }
    .field input { padding: 10px 13px; border: 1.5px solid #dde6f0; border-radius: 8px; font-size: 14px; background: #fafbfd; transition: border-color 0.2s; }
    .field input:focus { outline: none; border-color: #3a7ca5; }
    .field input[readonly] { background: #f4f7fb; color: #8a9aaa; cursor: not-allowed; }
    .btn-save { margin-top: 20px; padding: 12px 28px; background: #1e2d4d; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
    .btn-save:hover { background: #2c4270; }
    .btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

    /* CV CARD */
    .cv-card { border: 1.5px solid #dde6f0; border-radius: 12px; padding: 20px 24px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
    .cv-card-info { flex: 1; min-width: 180px; }
    .cv-card-title { font-size: 15px; font-weight: 700; color: #1e2d4d; margin-bottom: 6px; }
    .cv-card-meta { font-size: 13px; color: #5a6a7a; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .badge-paid { background: #e8f5e9; color: #2e7d32; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }
    .badge-unpaid { background: #fff3e0; color: #e65100; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }
    .cv-card-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn-cv-action { padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; transition: all 0.2s; display: inline-block; }
    .btn-preview  { background: #e8f0f7; color: #1e2d4d; }
    .btn-preview:hover { background: #d0e4f0; }
    .btn-edit     { background: #e8f5e9; color: #2e7d32; }
    .btn-edit:hover { background: #c8e6c9; }
    .btn-download { background: #1e2d4d; color: #fff; }
    .btn-download:hover { background: #2c4270; }
    .btn-pay      { background: #4caf50; color: #fff; }
    .btn-pay:hover { background: #388e3c; }

    /* EMPTY STATE */
    .empty-state { text-align: center; padding: 40px 20px; color: #5a6a7a; }
    .empty-state p { margin-bottom: 16px; font-size: 15px; }
    .btn-create { display: inline-block; background: #1e2d4d; color: #fff; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 700; text-decoration: none; margin: 4px; }
    .btn-create:hover { background: #2c4270; }
    .btn-create-secondary { display: inline-block; background: transparent; color: #3a7ca5; border: 2px solid #3a7ca5; padding: 8px 22px; border-radius: 8px; font-size: 14px; font-weight: 700; text-decoration: none; margin: 4px; }
    .btn-create-secondary:hover { background: #e8f0f7; }

    /* PAYMENTS TABLE */
    .payments-table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .payments-table th { text-align: left; padding: 10px 14px; border-bottom: 2px solid #e8f0f7; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #5a6a7a; }
    .payments-table td { padding: 12px 14px; border-bottom: 1px solid #f0f4f8; }
    .payments-table tr:last-child td { border-bottom: none; }
    .status-paid { color: #2e7d32; font-weight: 700; }
    .status-pending { color: #e65100; }
    .session-id { font-family: monospace; font-size: 12px; color: #8a9aaa; }

    /* DANGER ZONE */
    .danger-zone { margin-top: 28px; background: #fff; border-radius: 16px; padding: 28px 32px; box-shadow: 0 2px 12px rgba(30,45,77,0.06); border-left: 4px solid #e53935; }
    .danger-zone h2 { font-size: 16px; font-weight: 700; color: #c62828; margin-bottom: 8px; }
    .danger-zone p { font-size: 14px; color: #5a6a7a; margin-bottom: 16px; }
    .btn-danger { padding: 10px 22px; background: #fdecea; color: #c62828; border: 1.5px solid #e57373; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
    .btn-danger:hover { background: #e53935; color: #fff; border-color: #e53935; }

    /* MODAL */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 500; }
    .modal-overlay.hidden { display: none; }
    .modal-box { background: #fff; border-radius: 16px; padding: 36px; max-width: 420px; width: 90%; }
    .modal-box h2 { font-size: 18px; color: #c62828; margin-bottom: 10px; }
    .modal-box p { font-size: 14px; color: #5a6a7a; margin-bottom: 14px; }
    .modal-box input { width: 100%; padding: 10px 13px; border: 1.5px solid #dde6f0; border-radius: 8px; font-size: 14px; margin-bottom: 20px; }
    .modal-box input:focus { outline: none; border-color: #e53935; }
    .modal-buttons { display: flex; gap: 10px; justify-content: flex-end; }
    .btn-cancel { padding: 10px 20px; background: #f0f4f8; color: #5a6a7a; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-cancel:hover { background: #e0e8f0; }

    /* TOAST */
    .toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); background: #1e2d4d; color: #fff; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 600; }
    .toast.show { opacity: 1; }
    .toast.error { background: #c62828; }

    @media (max-width: 600px) {
      nav { padding: 14px 20px; }
      .page { margin: 20px auto; }
      .profile-header { flex-direction: column; text-align: center; padding: 24px 20px; }
      .tab-btn { font-size: 12px; padding: 8px 8px; }
      .tab-panel { padding: 20px; }
      .cv-card { flex-direction: column; }
    }
  </style>
</head>
<body>

<nav>
  <a href="/" class="nav-logo">Crea<span>CV</span></a>
  <div class="nav-links">
    ${user.view_token ? `<a href="/ver/${esc(user.view_token)}" target="_blank" class="btn-nav btn-nav-outline">Mi CV</a>` : ''}
    <form method="GET" action="/auth/logout" style="margin:0">
      <button type="submit" class="btn-nav btn-nav-solid">Cerrar sesión</button>
    </form>
  </div>
</nav>

<div class="page">

  <!-- Profile header -->
  <div class="profile-header">
    <div class="avatar-wrap">
      ${photoHtml}
      <button class="avatar-upload-btn" onclick="document.getElementById('foto-input').click()" title="Cambiar foto">✎</button>
      <input type="file" id="foto-input" accept="image/jpeg,image/png" onchange="uploadFoto(this)">
    </div>
    <div class="profile-details">
      <h1>${esc(displayName)}</h1>
      <p>${esc(user.email || '')}</p>
      ${user.city ? `<p style="margin-top:4px">📍 ${esc(user.city)}</p>` : ''}
    </div>
  </div>

  <!-- Tabs -->
  <div class="tabs">
    <button class="tab-btn active" data-tab="datos" onclick="switchTab('datos')">👤 Datos personales</button>
    <button class="tab-btn" data-tab="cvs" onclick="switchTab('cvs')">📄 Mis CVs</button>
    <button class="tab-btn" data-tab="pagos" onclick="switchTab('pagos')">💳 Historial de pagos</button>
  </div>

  <!-- Tab: Datos personales -->
  <div class="tab-panel" id="tab-datos">
    <div class="form-grid">
      <div class="field">
        <label>Nombre completo</label>
        <input id="f-name" value="${esc(user.name || '')}" placeholder="Tu nombre completo">
      </div>
      <div class="field">
        <label>Email</label>
        <input value="${esc(user.email || '')}" readonly>
      </div>
      <div class="field">
        <label>Teléfono</label>
        <input id="f-phone" value="${esc(user.phone || '')}" placeholder="+34 600 000 000" type="tel">
      </div>
      <div class="field">
        <label>Ciudad</label>
        <input id="f-city" value="${esc(user.city || '')}" placeholder="Madrid, Barcelona…">
      </div>
    </div>
    <button class="btn-save" onclick="saveDatos(this)">Guardar cambios</button>
  </div>

  <!-- Tab: Mis CVs -->
  <div class="tab-panel hidden" id="tab-cvs">
    ${cvCardHtml}
  </div>

  <!-- Tab: Historial de pagos -->
  <div class="tab-panel hidden" id="tab-pagos">
    ${paymentsHtml}
  </div>

  <!-- Danger zone -->
  <div class="danger-zone">
    <h2>Zona de peligro</h2>
    <p>Eliminar tu cuenta borrará permanentemente todos tus datos, CVs y registros de pago. Esta acción no se puede deshacer.</p>
    <button class="btn-danger" onclick="showDeleteModal()">Eliminar mi cuenta</button>
  </div>

</div>

<!-- Delete modal -->
<div class="modal-overlay hidden" id="delete-modal">
  <div class="modal-box">
    <h2>Eliminar cuenta</h2>
    <p>Esta acción es <strong>irreversible</strong>. Se borrarán todos tus datos, CVs e historial de pagos.</p>
    <p>Escribe <strong>ELIMINAR</strong> para confirmar:</p>
    <input type="text" id="delete-confirm-input" placeholder="ELIMINAR" autocomplete="off">
    <div class="modal-buttons">
      <button class="btn-cancel" onclick="closeDeleteModal()">Cancelar</button>
      <button class="btn-danger" onclick="confirmDelete()">Eliminar mi cuenta</button>
    </div>
  </div>
</div>

<!-- Toast -->
<div class="toast" id="toast"></div>

<script>
  function switchTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.remove('hidden');
    document.querySelector('[data-tab="' + tabId + '"]').classList.add('active');
    history.replaceState(null, '', '#' + tabId);
  }

  // Restore tab from URL hash
  (function() {
    const hash = location.hash.replace('#', '');
    if (['datos', 'cvs', 'pagos'].includes(hash)) switchTab(hash);
  })();

  function showToast(msg, isError) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isError ? ' error' : '');
    setTimeout(() => t.className = 'toast', 3000);
  }

  async function saveDatos(btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    const body = {
      name:  document.getElementById('f-name').value.trim(),
      phone: document.getElementById('f-phone').value.trim(),
      city:  document.getElementById('f-city').value.trim(),
    };
    try {
      const r = await fetch('/perfil/datos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        showToast('Cambios guardados correctamente');
        // Update displayed name/city live
        const nameEl = document.querySelector('.profile-details h1');
        if (body.name && nameEl) nameEl.textContent = body.name;
      } else {
        showToast('Error al guardar', true);
      }
    } catch {
      showToast('Error de conexión', true);
    }
    btn.disabled = false;
    btn.textContent = 'Guardar cambios';
  }

  async function uploadFoto(input) {
    if (!input.files[0]) return;
    const fd = new FormData();
    fd.append('foto', input.files[0]);
    showToast('Subiendo foto…');
    try {
      const r = await fetch('/perfil/foto', { method: 'POST', body: fd });
      const data = await r.json();
      if (r.ok && data.photoUrl) {
        // Replace avatar display
        const wrap = document.querySelector('.avatar-wrap');
        const old = wrap.querySelector('.avatar-initials, .avatar-img');
        if (old) {
          const img = document.createElement('img');
          img.src = data.photoUrl;
          img.alt = 'Foto de perfil';
          img.className = 'avatar-img';
          wrap.replaceChild(img, old);
        }
        showToast('Foto actualizada');
      } else {
        showToast(data.error || 'Error al subir la foto', true);
      }
    } catch {
      showToast('Error de conexión', true);
    }
    input.value = '';
  }

  function showDeleteModal() {
    document.getElementById('delete-confirm-input').value = '';
    document.getElementById('delete-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('delete-confirm-input').focus(), 50);
  }

  function closeDeleteModal() {
    document.getElementById('delete-modal').classList.add('hidden');
  }

  async function confirmDelete() {
    const confirm = document.getElementById('delete-confirm-input').value.trim();
    if (confirm !== 'ELIMINAR') {
      showToast('Escribe exactamente "ELIMINAR" para confirmar', true);
      return;
    }
    try {
      const r = await fetch('/perfil/eliminar-cuenta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm }),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        window.location.href = '/';
      } else {
        showToast(data.error || 'Error al eliminar', true);
      }
    } catch {
      showToast('Error de conexión', true);
    }
  }

  // Close modal on overlay click
  document.getElementById('delete-modal').addEventListener('click', function(e) {
    if (e.target === this) closeDeleteModal();
  });
</script>
</body>
</html>`;
}

module.exports = router;
