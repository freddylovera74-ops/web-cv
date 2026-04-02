const router = require('express').Router();
const twilio = require('twilio');
const { getUserByPhone, createUserByPhone, updateWhatsappStep, upsertCvData, getUserById } = require('../db');
const { suggestJobs } = require('../services/openai');

const MessagingResponse = twilio.twiml.MessagingResponse;

// OWASP-FIX: A04 — Per-phone rate limiting (in-memory)
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
  return entry.count > PHONE_RATE_LIMIT;
}

// OWASP-FIX: A03 — Sanitize and truncate free-text inputs
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
  try { return JSON.parse(user.whatsapp_data || '{}'); } catch { return {}; }
}

function saveStep(userId, step, data) {
  updateWhatsappStep(userId, step, data);
}

async function finalizeCv(user, data) {
  const jobs = data.jobs || [];
  let aiJobs = [];
  if (data.wantAi) {
    try { aiJobs = await suggestJobs(jobs, data.aiCount); } catch (e) {
      console.error('OpenAI error:', e.message);
    }
  }

  // Build profile from collected WhatsApp data
  const profile = {
    nombre: data.nombre || '',
    apellidos: '',
    phone: data.telefono || user.phone_number || '',
    city: data.ciudad || '',
    email: '',
    photo: '',
  };

  const { getDb } = require('../db');
  const db = getDb();
  const existing = db.prepare('SELECT id FROM cv_data WHERE user_id = ?').get(user.id);
  if (existing) {
    db.prepare(`UPDATE cv_data SET jobs=?, ai_suggested_jobs=?, profile=?,
      version=version+1, updated_at=datetime('now') WHERE user_id=?`)
      .run(JSON.stringify(jobs), JSON.stringify(aiJobs), JSON.stringify(profile), user.id);
  } else {
    db.prepare('INSERT INTO cv_data (user_id, jobs, ai_suggested_jobs, profile) VALUES (?,?,?,?)')
      .run(user.id, JSON.stringify(jobs), JSON.stringify(aiJobs), JSON.stringify(profile));
  }

  saveStep(user.id, 'done', {});
  const freshUser = getUserById(user.id);
  return `CV generado. Accede a tu enlace:\n${process.env.BASE_URL}/ver/${freshUser.view_token}`;
}

router.post('/whatsapp', async (req, res) => {
  // OWASP-FIX: A08 — Verify Twilio request signature
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

  if (isPhoneRateLimited(phone)) {
    return twimlReply(res, 'Demasiados mensajes. Espera un minuto e intenta de nuevo.');
  }

  const bodyRaw = (req.body.Body || '').trim();
  const body = bodyRaw.toLowerCase();

  const user = getOrCreateUser(phone);
  const step = user.whatsapp_step || 'start';
  const data = parseData(user);

  // ── START / DONE ─────────────────────────────────────────────────────────
  if (step === 'start' || step === 'done') {
    saveStep(user.id, 'awaiting_terms', {});
    return twimlReply(res, 'Bienvenido a CreaCV. Acepta los terminos y condiciones para continuar? (si/no)');
  }

  // ── TERMS ─────────────────────────────────────────────────────────────────
  if (step === 'awaiting_terms') {
    if (body !== 'si') return twimlReply(res, 'Debes responder "si" para aceptar los terminos y continuar.');
    saveStep(user.id, 'awaiting_nombre', data);
    return twimlReply(res, 'Perfecto. Empecemos con tus datos.\nCual es tu nombre? (ej: Ana Garcia)');
  }

  // ── NOMBRE ────────────────────────────────────────────────────────────────
  if (step === 'awaiting_nombre') {
    saveStep(user.id, 'awaiting_ciudad', { ...data, nombre: sanitizeInput(bodyRaw) });
    return twimlReply(res, 'En que ciudad vives? (ej: Madrid)');
  }

  // ── CIUDAD ────────────────────────────────────────────────────────────────
  if (step === 'awaiting_ciudad') {
    saveStep(user.id, 'awaiting_telefono', { ...data, ciudad: sanitizeInput(bodyRaw) });
    return twimlReply(res, 'Cual es tu telefono de contacto? (ej: 600 123 456)\nEscribe "saltar" si no quieres incluirlo.');
  }

  // ── TELEFONO ──────────────────────────────────────────────────────────────
  if (step === 'awaiting_telefono') {
    const telefono = body === 'saltar' ? '' : sanitizeInput(bodyRaw);
    saveStep(user.id, 'awaiting_ai_choice', { ...data, telefono });
    return twimlReply(res, 'Quieres que la IA sugiera 2 o 3 empleos segun tu experiencia?\nResponde "2", "3" o "0" si no quieres.');
  }

  // ── AI CHOICE ─────────────────────────────────────────────────────────────
  if (step === 'awaiting_ai_choice') {
    if (!['0', '2', '3'].includes(body)) return twimlReply(res, 'Responde "0", "2" o "3".');
    const aiCount = parseInt(body);
    saveStep(user.id, 'awaiting_job_count', { ...data, wantAi: aiCount > 0, aiCount, jobs: [], currentJob: 0, totalJobs: 0 });
    return twimlReply(res, 'Cuantos empleos anteriores quieres incluir? (minimo 1, maximo 10)');
  }

  // ── JOB COUNT ─────────────────────────────────────────────────────────────
  if (step === 'awaiting_job_count') {
    const count = parseInt(body);
    // OWASP-FIX: A03 — Limit job count
    if (isNaN(count) || count < 1 || count > 10) return twimlReply(res, 'Por favor ingresa un numero entre 1 y 10.');
    saveStep(user.id, 'awaiting_job_name', { ...data, totalJobs: count, jobs: [], currentJob: 0 });
    return twimlReply(res, `Empleo 1 de ${count}.\nNombre de la empresa (ej: Restaurante El Rincon):`);
  }

  // ── JOB NAME ──────────────────────────────────────────────────────────────
  if (step === 'awaiting_job_name') {
    saveStep(user.id, 'awaiting_job_position', { ...data, pendingJob: { name: sanitizeInput(bodyRaw) } });
    return twimlReply(res, 'Cual era tu cargo? (ej: Camarero/a)');
  }

  // ── JOB POSITION ──────────────────────────────────────────────────────────
  if (step === 'awaiting_job_position') {
    saveStep(user.id, 'awaiting_job_duration', { ...data, pendingJob: { ...data.pendingJob, position: sanitizeInput(bodyRaw) } });
    return twimlReply(res, 'Cuanto tiempo trabajaste ahi? (ej: 1 ano y 6 meses)');
  }

  // ── JOB DURATION ──────────────────────────────────────────────────────────
  if (step === 'awaiting_job_duration') {
    const job = { ...data.pendingJob, duration: sanitizeInput(bodyRaw), is_real: true };
    const jobs = [...(data.jobs || []), job];
    const currentJob = (data.currentJob || 0) + 1;

    if (currentJob < data.totalJobs) {
      saveStep(user.id, 'awaiting_job_name', { ...data, jobs, currentJob, pendingJob: {} });
      return twimlReply(res, `Empleo ${currentJob + 1} de ${data.totalJobs}.\nNombre de la empresa:`);
    }

    try {
      const reply = await finalizeCv(user, { ...data, jobs, currentJob });
      return twimlReply(res, reply);
    } catch (e) {
      console.error('finalizeCv error:', e.message);
      return twimlReply(res, 'Ocurrio un error al generar tu CV. Por favor intenta de nuevo.');
    }
  }

  return twimlReply(res, 'Envia cualquier mensaje para comenzar.');
});

module.exports = router;
