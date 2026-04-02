const router = require('express').Router();
const { getDb } = require('../db');
const { renderCvHtml } = require('../views/cv.html.js');
const { renderLanding } = require('../views/landing.js');

router.get('/', (req, res) => {
  const db = getDb();
  // Count CVs updated in the last 7 days for social proof
  const row = db.prepare(`SELECT COUNT(*) as cnt FROM cv_data WHERE updated_at >= datetime('now', '-7 days')`).get();
  const cvCount = row ? row.cnt : 0;
  res.send(renderLanding(req.user || null, { cvCount }));
});

router.get('/cv/:userId', (req, res) => {
  const db = getDb();
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) return res.status(400).send('ID invalido');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).send('Usuario no encontrado');

  // Access control: must be the owner (Google session) or have the view token
  const isOwner = req.isAuthenticated() && req.user.id === userId;
  const tokenOk = req.query.token && req.query.token === user.view_token;

  if (!isOwner && !tokenOk) {
    return res.status(403).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#f0f7fa">
        <h2 style="color:#1e2d4d">Acceso restringido</h2>
        <p style="color:#5a6a7a;margin:16px 0">Necesitas el enlace con token para ver este CV.</p>
        <a href="/" style="color:#3a7ca5">Volver al inicio</a>
      </body></html>
    `);
  }

  const cvData = db.prepare('SELECT * FROM cv_data WHERE user_id = ?').get(userId);
  if (!cvData) {
    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#f0f7fa">
        <h2 style="color:#3a7ca5">CV no generado aun</h2>
        <p style="color:#5a6a7a;margin:16px 0">Usa el formulario web o el bot de WhatsApp para comenzar.</p>
        <a href="/" style="color:#3a7ca5">Volver al inicio</a>
      </body></html>
    `);
  }

  cvData.jobs = JSON.parse(cvData.jobs || '[]');
  cvData.ai_suggested_jobs = JSON.parse(cvData.ai_suggested_jobs || '[]');

  // Pass the shareable token link so the pay bar can show it
  const shareToken = user.view_token;
  const html = renderCvHtml(user, cvData, { showPayButton: true, watermark: true, shareToken });
  res.send(html);
});

// Shareable public link: /ver/:token — no login required
router.get('/ver/:token', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE view_token = ?').get(req.params.token);
  if (!user) return res.status(404).send('Enlace no valido');

  const cvData = db.prepare('SELECT * FROM cv_data WHERE user_id = ?').get(user.id);
  if (!cvData) return res.status(404).send('CV no encontrado');

  cvData.jobs = JSON.parse(cvData.jobs || '[]');
  cvData.ai_suggested_jobs = JSON.parse(cvData.ai_suggested_jobs || '[]');

  const html = renderCvHtml(user, cvData, { showPayButton: true, watermark: true, shareToken: req.params.token });
  res.send(html);
});

module.exports = router;
