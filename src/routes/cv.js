const router = require('express').Router();
const { getDb } = require('../db');
const { renderCvHtml } = require('../views/cv.html.js');

router.get('/', (req, res) => {
  res.send(`
    <h2>Generador de CV</h2>
    <p>Envia un mensaje a nuestro bot de WhatsApp para comenzar:</p>
    <a href="https://wa.me/${process.env.WHATSAPP_NUMBER}">Abrir WhatsApp</a>
  `);
});

router.get('/cv/:userId', (req, res) => {
  const db = getDb();
  const userId = parseInt(req.params.userId);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).send('Usuario no encontrado');

  const cvData = db.prepare('SELECT * FROM cv_data WHERE user_id = ?').get(userId);
  if (!cvData) return res.send('<p>CV no generado aun. Usa el bot de WhatsApp para comenzar.</p>');

  cvData.jobs = JSON.parse(cvData.jobs || '[]');
  cvData.ai_suggested_jobs = JSON.parse(cvData.ai_suggested_jobs || '[]');

  const html = renderCvHtml(user, cvData, { showPayButton: true });
  res.send(html);
});

module.exports = router;
