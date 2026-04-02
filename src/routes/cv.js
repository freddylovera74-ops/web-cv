const router = require('express').Router();
const { getDb } = require('../db');
const { renderCvHtml } = require('../views/cv.html.js');
const { renderLanding } = require('../views/landing.js');

router.get('/', (req, res) => {
  res.send(renderLanding(req.user || null));
});

router.get('/cv/:userId', (req, res) => {
  const db = getDb();
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) return res.status(400).send('ID invalido');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).send('Usuario no encontrado');

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

  const html = renderCvHtml(user, cvData, { showPayButton: true });
  res.send(html);
});

module.exports = router;
