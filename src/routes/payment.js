const router = require('express').Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getDb, getUserById, getCvData } = require('../db');
const { generatePdf } = require('../services/pdf');
const { renderCvHtml } = require('../views/cv.html.js');

router.post('/create-checkout-session', async (req, res) => {
  const db = getDb();
  const userId = parseInt(req.body.userId);
  if (isNaN(userId)) return res.status(400).send('userId invalido');

  // OWASP-FIX: A01 — If the requester is authenticated via Google OAuth, enforce ownership.
  // WhatsApp-only users (not Google-authenticated) can still pay for their own CV via the bot link.
  if (req.isAuthenticated() && req.user.id !== userId) {
    console.error(`[SECURITY] User ${req.user.id} attempted checkout for user ${userId}`);
    return res.status(403).send('Forbidden');
  }

  const user = getUserById(userId);
  if (!user) return res.status(404).send('Usuario no encontrado');

  const cvData = getCvData(userId);
  if (!cvData) return res.status(400).send('CV no encontrado');

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: 'Descarga de CV en PDF' },
          unit_amount: 200,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.BASE_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/cv/${userId}`,
      metadata: { userId: String(userId), cvVersion: String(cvData.version) },
    });

    db.prepare('INSERT INTO payments (user_id, cv_version, stripe_session_id, amount, status) VALUES (?, ?, ?, ?, ?)')
      .run(userId, cvData.version, session.id, 200, 'pending');

    res.redirect(303, session.url);
  } catch (e) {
    console.error('Stripe error:', e.message);
    res.status(500).send('Error al crear sesion de pago');
  }
});

router.get('/payment-success', async (req, res) => {
  const db = getDb();
  const sessionId = req.query.session_id;
  if (!sessionId) return res.status(400).send('session_id requerido');

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (e) {
    return res.status(400).send('Sesion invalida');
  }

  if (session.payment_status !== 'paid') {
    return res.status(402).send('Pago no completado');
  }

  const payment = db.prepare('SELECT * FROM payments WHERE stripe_session_id = ?').get(sessionId);
  if (!payment) return res.status(404).send('Pago no encontrado');

  db.prepare('UPDATE payments SET status = ? WHERE stripe_session_id = ?').run('paid', sessionId);

  const userId = parseInt(session.metadata.userId);
  const user = getUserById(userId);
  const cvData = getCvData(userId);

  cvData.jobs = JSON.parse(cvData.jobs || '[]');
  cvData.ai_suggested_jobs = JSON.parse(cvData.ai_suggested_jobs || '[]');

  const html = renderCvHtml(user, cvData, { showPayButton: false });

  try {
    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cv-${userId}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error('PDF generation error:', e.message);
    res.status(500).send('Error al generar el PDF');
  }
});

router.post('/stripe-webhook', (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Webhook error: ${e.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      const db = getDb();
      db.prepare('UPDATE payments SET status = ? WHERE stripe_session_id = ?')
        .run('paid', session.id);
    }
  }

  res.json({ received: true });
});

module.exports = router;
