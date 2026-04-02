const router = require('express').Router();
const twilio = require('twilio');
const { getUserByPhone, createUserByPhone, updateWhatsappStep, upsertCvData } = require('../db');
const { suggestJobs } = require('../services/openai');

const MessagingResponse = twilio.twiml.MessagingResponse;

// OWASP-FIX: A04 — Per-phone rate limiting (in-memory). Twilio sends from its own IPs
// so IP-based rate limiting would block all messages. We limit per phone number instead.
const phoneRateMap = new Map();
const PHONE_RATE_LIMIT = 30;
const PHONE_RATE_WINDOW_MS = 60 * 1000;

function isPhoneRateLimited(phone) {
  const now = Date.now();
  const entry = phoneRateMap.get(phone);
  if (!entry || now - entry.windowStart > PHONE_RATE_WINDOW_MS) {
    phoneRateMap.set(phone, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  if (entry.count > PHONE_RATE_LIMIT) return true;
  return false;
}

// OWASP-FIX: A03 — Sanitize and truncate all free-text inputs from WhatsApp
const MAX_FIELD_LEN = 150;
function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&]/g, '').trim().slice(0, MAX_FIELD_LEN);
}

function twimlReply(res, message) {
  const twiml = new MessagingResponse();
  twiml.message(message);
  res.type('text/xml').send(twiml.toString());
}

function getOrCreateUser(phone) {
  return getUserByPhone(phone) || createUserByPhone(phone);
}

function parseData(user) {
  try {
    return JSON.parse(user.whatsapp_data || '{}');
  } catch {
    return {};
  }
}

function saveStep(userId, step, data) {
  updateWhatsappStep(userId, step, data);
}

async function finalizeCv(user, data) {
  const jobs = data.jobs || [];

  let aiJobs = [];
  if (data.wantAi) {
    try {
      aiJobs = await suggestJobs(jobs, data.aiCount);
    } catch (e) {
      console.error('OpenAI error:', e.message);
    }
  }

  upsertCvData(user.id, jobs, aiJobs);
  saveStep(user.id, 'done', {});
  return `CV generado. Accede a tu enlace: ${process.env.BASE_URL}/cv/${user.id}`;
}

router.post('/whatsapp', async (req, res) => {
  // OWASP-FIX: A08 — Verify Twilio request signature before processing any payload
  // This prevents anyone from forging WhatsApp messages to the webhook
  const twilioSignature = req.headers['x-twilio-signature'];
  const webhookUrl = `${process.env.BASE_URL}/webhook/whatsapp`;
  const isValidSignature = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    twilioSignature,
    webhookUrl,
    req.body
  );
  if (!isValidSignature) {
    console.error(`[SECURITY] Invalid Twilio signature from ${req.ip}`);
    return res.status(403).send('Forbidden');
  }

  const phone = req.body.From;
  if (!phone) return res.status(400).send('Missing From');

  // OWASP-FIX: A04 — Rate limit per phone number (30 messages/minute)
  if (isPhoneRateLimited(phone)) {
    return twimlReply(res, 'Demasiados mensajes. Espera un minuto e intenta de nuevo.');
  }

  const bodyRaw = (req.body.Body || '').trim();
  const body = bodyRaw.toLowerCase();

  const user = getOrCreateUser(phone);
  const step = user.whatsapp_step || 'start';
  const data = parseData(user);

  if (step === 'start' || step === 'done') {
    saveStep(user.id, 'awaiting_terms', {});
    return twimlReply(res, 'Bienvenido. Acepta los terminos y condiciones? (si/no)');
  }

  if (step === 'awaiting_terms') {
    if (body === 'si') {
      saveStep(user.id, 'awaiting_ai_choice', data);
      return twimlReply(res, 'Quieres que la IA genere 2 o 3 empleos sugeridos segun tus trabajos anteriores? Responde "2" o "3". Si no quieres, responde "0".');
    }
    return twimlReply(res, 'Debes aceptar los terminos para continuar. Responde "si" para aceptar.');
  }

  if (step === 'awaiting_ai_choice') {
    if (!['0', '2', '3'].includes(body)) {
      return twimlReply(res, 'Responde "0", "2" o "3".');
    }
    const aiCount = parseInt(body);
    const newData = { ...data, wantAi: aiCount > 0, aiCount, jobs: [], currentJob: 0, totalJobs: 0 };
    saveStep(user.id, 'awaiting_job_count', newData);
    return twimlReply(res, 'Cuantos empleos anteriores quieres incluir? (minimo 1, maximo 10)');
  }

  if (step === 'awaiting_job_count') {
    const count = parseInt(body);
    // OWASP-FIX: A03 — Limit job count to prevent oversized payloads
    if (isNaN(count) || count < 1 || count > 10) {
      return twimlReply(res, 'Por favor ingresa un numero entre 1 y 10.');
    }
    const newData = { ...data, totalJobs: count, jobs: [], currentJob: 0 };
    saveStep(user.id, 'awaiting_job_name', newData);
    return twimlReply(res, `Empleo 1 de ${count}. Nombre del empleo (ej: Desarrollador Full Stack):`);
  }

  if (step === 'awaiting_job_name') {
    // OWASP-FIX: A03 — Sanitize free-text input before storing in DB
    const newData = { ...data, pendingJob: { name: sanitizeInput(bodyRaw) } };
    saveStep(user.id, 'awaiting_job_position', newData);
    return twimlReply(res, 'Puesto (ej: Senior):');
  }

  if (step === 'awaiting_job_position') {
    const newData = { ...data, pendingJob: { ...data.pendingJob, position: sanitizeInput(bodyRaw) } };
    saveStep(user.id, 'awaiting_job_duration', newData);
    return twimlReply(res, 'Tiempo trabajado (ej: 2 anos):');
  }

  if (step === 'awaiting_job_duration') {
    const job = { ...data.pendingJob, duration: sanitizeInput(bodyRaw), is_real: true };
    const jobs = [...(data.jobs || []), job];
    const currentJob = (data.currentJob || 0) + 1;

    if (currentJob < data.totalJobs) {
      const newData = { ...data, jobs, currentJob, pendingJob: {} };
      saveStep(user.id, 'awaiting_job_name', newData);
      return twimlReply(res, `Empleo ${currentJob + 1} de ${data.totalJobs}. Nombre del empleo:`);
    }

    const newData = { ...data, jobs, currentJob };
    try {
      const reply = await finalizeCv(user, newData);
      return twimlReply(res, reply);
    } catch (e) {
      console.error('finalizeCv error:', e.message);
      return twimlReply(res, 'Ocurrio un error al generar tu CV. Por favor intenta de nuevo.');
    }
  }

  return twimlReply(res, 'Envia cualquier mensaje para comenzar.');
});

module.exports = router;
