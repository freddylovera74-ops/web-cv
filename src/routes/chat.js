const router = require('express').Router();
const { getDb } = require('../db');
const { renderCvHtml } = require('../views/cv.html.js');
const { suggestJobFunctions, suggestSkillsForJobs } = require('../services/chatAi');

// ── Rate limiter: 10 messages/min per session ─────────────────────────────
const rateMap = new Map();
function isRateLimited(sid) {
  const now = Date.now();
  const e = rateMap.get(sid);
  if (!e || now - e.t > 60000) { rateMap.set(sid, { c: 1, t: now }); return false; }
  e.c++;
  return e.c > 10;
}

// ── Simple in-memory metrics ──────────────────────────────────────────────
const metrics = { started: 0, completed: 0, paid: 0, aiCalls: 0, aiErrors: 0 };

// ── Helpers ───────────────────────────────────────────────────────────────
function sanitize(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/[<>"'`]/g, '').trim().slice(0, 300);
}
function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function reply(text, buttons = [], newState, extra = {}) {
  return { text, buttons, newState, ...extra };
}
function initState() {
  return { step: 'start', profile: {}, jobs: [], pendingJob: {}, educacion: [],
           pendingEdu: {}, habilidades: [], suggestedFunciones: [], suggestedHabilidades: [],
           totalJobs: 0, currentJobIdx: 0, currentEduIdx: 0, startedAt: Date.now() };
}

// ── CV data builder ───────────────────────────────────────────────────────
function buildCvDataFromChat(chat) {
  const jobs = (chat.jobs || []).map(j => ({
    name: j.empresa || '',
    position: j.cargo || '',
    duration: j.duracion || '',
    descripcion: Array.isArray(j.funciones) ? j.funciones.join(', ') : (j.funciones || ''),
    is_real: true,
  }));
  return {
    jobs,
    ai_suggested_jobs: [],
    profile: {
      nombre: chat.profile.nombre || '',
      apellidos: '',
      city: chat.profile.ciudad || '',
      phone: chat.profile.telefono || '',
      email: chat.profile.email || '',
      photo: '',
    },
    education: (chat.educacion || []).map(e => ({
      titulo: e.titulo || '',
      institucion: e.institucion || '',
      anio: '',
    })),
    skills: {
      habilidades: Array.isArray(chat.habilidades) ? chat.habilidades : [],
      idiomas: [],
    },
  };
}

// ── State machine ─────────────────────────────────────────────────────────
async function processStep(state, input) {
  const step = state.step || 'start';
  const s = sanitize(input);
  const sl = s.toLowerCase();

  // ── START ──────────────────────────────────────────────────────────────
  if (step === 'start') {
    metrics.started++;
    return reply(
      '¡Hola! 👋 Soy tu asistente de CV.\n\nVoy a hacerte unas preguntas para crear tu curriculum profesional en minutos. ¡Empecemos!\n\n¿Cómo te llamas?',
      [], { ...state, step: 'awaiting_nombre' }
    );
  }

  // ── NOMBRE ────────────────────────────────────────────────────────────
  if (step === 'awaiting_nombre') {
    if (!s) return reply('Por favor, escribe tu nombre completo.', [], state);
    const nombre = s.slice(0, 100);
    const first = nombre.split(' ')[0];
    return reply(
      `¡Encantado, ${first}! 😊\n\n¿En qué ciudad vives?`,
      [], { ...state, step: 'awaiting_ciudad', profile: { ...state.profile, nombre } }
    );
  }

  // ── CIUDAD ────────────────────────────────────────────────────────────
  if (step === 'awaiting_ciudad') {
    if (!s) return reply('¿En qué ciudad vives?', [], state);
    return reply(
      '¿Cuál es tu teléfono de contacto?',
      [{ label: 'Saltar', value: '__skip__' }],
      { ...state, step: 'awaiting_telefono', profile: { ...state.profile, ciudad: s.slice(0, 100) } }
    );
  }

  // ── TELEFONO ──────────────────────────────────────────────────────────
  if (step === 'awaiting_telefono') {
    const telefono = s === '__skip__' ? '' : s.slice(0, 30);
    return reply(
      '¿Cuál es tu email?',
      [{ label: 'Saltar', value: '__skip__' }],
      { ...state, step: 'awaiting_email', profile: { ...state.profile, telefono } }
    );
  }

  // ── EMAIL ─────────────────────────────────────────────────────────────
  if (step === 'awaiting_email') {
    const email = s === '__skip__' ? '' : s.slice(0, 150);
    return reply(
      '¿Cuántos empleos anteriores quieres incluir en tu CV?',
      [
        { label: '1', value: '1' },
        { label: '2', value: '2' },
        { label: '3', value: '3' },
        { label: 'Más de 3', value: '__ask__' },
      ],
      { ...state, step: 'awaiting_num_jobs', profile: { ...state.profile, email } }
    );
  }

  // ── NUM JOBS ──────────────────────────────────────────────────────────
  if (step === 'awaiting_num_jobs') {
    if (s === '__ask__') {
      return reply(
        '¿Cuántos empleos exactamente? (máximo 10)',
        [], { ...state, step: 'awaiting_num_jobs_custom' }
      );
    }
    const n = parseInt(s);
    if (isNaN(n) || n < 1 || n > 10) {
      return reply('Por favor elige entre 1 y 10 empleos.',
        [{ label: '1', value: '1' }, { label: '2', value: '2' }, { label: '3', value: '3' }],
        state
      );
    }
    return reply(
      `Perfecto, ${n} empleo${n > 1 ? 's' : ''}.\n\nEmpezamos por el más reciente. ¿En qué empresa trabajaste?`,
      [], { ...state, step: 'awaiting_empresa', totalJobs: n, currentJobIdx: 0, pendingJob: {} }
    );
  }

  if (step === 'awaiting_num_jobs_custom') {
    const n = parseInt(s);
    if (isNaN(n) || n < 1 || n > 10) return reply('Por favor escribe un número entre 1 y 10.', [], state);
    return reply(
      `${n} empleos. Empezamos por el más reciente. ¿En qué empresa trabajaste?`,
      [], { ...state, step: 'awaiting_empresa', totalJobs: n, currentJobIdx: 0, pendingJob: {} }
    );
  }

  // ── EMPRESA ───────────────────────────────────────────────────────────
  if (step === 'awaiting_empresa') {
    if (!s) return reply('¿En qué empresa trabajaste?', [], state);
    const jobNum = (state.currentJobIdx || 0) + 1;
    const total = state.totalJobs || 1;
    const prefix = total > 1 ? `*Empleo ${jobNum} de ${total}*\n\n` : '';
    return reply(
      `${prefix}¿Cuál era tu cargo en *${s}*?`,
      [], { ...state, step: 'awaiting_cargo', pendingJob: { empresa: s.slice(0, 150) } }
    );
  }

  // ── CARGO (calls AI) ──────────────────────────────────────────────────
  if (step === 'awaiting_cargo') {
    if (!s) return reply('¿Cuál era tu cargo o puesto?', [], state);
    const cargo = s.slice(0, 100);
    const empresa = state.pendingJob.empresa;

    metrics.aiCalls++;
    const funciones = await suggestJobFunctions(cargo);

    const lista = funciones.map(f => `• ${f}`).join('\n');
    return reply(
      `✨ Para *${cargo}* en ${empresa}, las funciones típicas son:\n\n${lista}\n\n¿Las añado tal cual o prefieres escribir las tuyas?`,
      [
        { label: '✅ Añadir estas', value: '__accept__' },
        { label: '✏️ Escribir las mías', value: '__custom__' },
      ],
      { ...state, step: 'awaiting_funciones_confirm', pendingJob: { ...state.pendingJob, cargo }, suggestedFunciones: funciones }
    );
  }

  // ── FUNCIONES CONFIRM ─────────────────────────────────────────────────
  if (step === 'awaiting_funciones_confirm') {
    if (s === '__accept__') {
      return reply(
        '¿Cuánto tiempo trabajaste ahí?',
        [
          { label: 'Menos de 1 año', value: 'menos de 1 año' },
          { label: '1 - 2 años', value: '1-2 años' },
          { label: 'Más de 2 años', value: 'más de 2 años' },
        ],
        { ...state, step: 'awaiting_duracion', pendingJob: { ...state.pendingJob, funciones: state.suggestedFunciones } }
      );
    }
    if (s === '__custom__') {
      return reply(
        'Escribe las funciones que realizabas. Puedes separarlas con comas.',
        [], { ...state, step: 'awaiting_funciones_custom' }
      );
    }
    return reply(
      '¿Añado las funciones sugeridas o prefieres escribir las tuyas?',
      [
        { label: '✅ Añadir estas', value: '__accept__' },
        { label: '✏️ Escribir las mías', value: '__custom__' },
      ],
      state
    );
  }

  // ── FUNCIONES CUSTOM ──────────────────────────────────────────────────
  if (step === 'awaiting_funciones_custom') {
    if (!s) return reply('Por favor escribe las funciones que realizabas.', [], state);
    const funciones = s.split(/[,\n]+/).map(f => f.trim()).filter(Boolean).slice(0, 8);
    return reply(
      '¿Cuánto tiempo trabajaste ahí?',
      [
        { label: 'Menos de 1 año', value: 'menos de 1 año' },
        { label: '1 - 2 años', value: '1-2 años' },
        { label: 'Más de 2 años', value: 'más de 2 años' },
      ],
      { ...state, step: 'awaiting_duracion', pendingJob: { ...state.pendingJob, funciones } }
    );
  }

  // ── DURACION ──────────────────────────────────────────────────────────
  if (step === 'awaiting_duracion') {
    const duracion = s || '1-2 años';
    const job = { ...state.pendingJob, duracion };
    const jobs = [...(state.jobs || []), job];
    const nextIdx = (state.currentJobIdx || 0) + 1;

    if (nextIdx < state.totalJobs) {
      return reply(
        `Empleo ${nextIdx + 1} de ${state.totalJobs}. ¿En qué empresa trabajaste?`,
        [], { ...state, step: 'awaiting_empresa', jobs, currentJobIdx: nextIdx, pendingJob: {} }
      );
    }

    return reply(
      '¡Muy bien! ¿Quieres añadir tu formación académica?',
      [{ label: '✅ Sí', value: 'si' }, { label: '❌ No', value: 'no' }],
      { ...state, step: 'awaiting_edu_choice', jobs, currentJobIdx: nextIdx }
    );
  }

  // ── EDUCACION CHOICE ──────────────────────────────────────────────────
  if (step === 'awaiting_edu_choice') {
    if (sl === 'si') {
      return reply(
        '¿Qué título o nivel de estudios tienes? (ej: Bachillerato, FP Medio, Licenciatura...)',
        [], { ...state, step: 'awaiting_edu_titulo', educacion: [], currentEduIdx: 0 }
      );
    }
    return await goToHabilidades(state);
  }

  // ── EDUCACION TITULO ──────────────────────────────────────────────────
  if (step === 'awaiting_edu_titulo') {
    if (!s) return reply('¿Qué título tienes?', [], state);
    return reply(
      `¿En qué centro o institución obtuviste ${s}?`,
      [], { ...state, step: 'awaiting_edu_institucion', pendingEdu: { titulo: s.slice(0, 150) } }
    );
  }

  // ── EDUCACION INSTITUCION ─────────────────────────────────────────────
  if (step === 'awaiting_edu_institucion') {
    const edu = { ...state.pendingEdu, institucion: (s || 'No especificado').slice(0, 150) };
    const educacion = [...(state.educacion || []), edu];
    return reply(
      '¿Quieres añadir otra formación?',
      [{ label: '✅ Sí', value: 'si' }, { label: '❌ No', value: 'no' }],
      { ...state, step: 'awaiting_edu_more', educacion }
    );
  }

  // ── EDUCACION MORE ────────────────────────────────────────────────────
  if (step === 'awaiting_edu_more') {
    if (sl === 'si' && (state.educacion || []).length < 4) {
      return reply(
        '¿Qué título o nivel de estudios?',
        [], { ...state, step: 'awaiting_edu_titulo' }
      );
    }
    return await goToHabilidades(state);
  }

  // ── HABILIDADES CONFIRM ───────────────────────────────────────────────
  if (step === 'awaiting_habilidades_confirm') {
    if (s === '__accept__') {
      return await goToPreview({ ...state, habilidades: state.suggestedHabilidades });
    }
    if (s === '__custom__') {
      return reply(
        'Escribe tus habilidades separadas por comas.\n(ej: Atención al cliente, Inglés básico, Carnet B)',
        [], { ...state, step: 'awaiting_habilidades_custom' }
      );
    }
    return reply(
      '¿Añado las habilidades sugeridas o prefieres escribir las tuyas?',
      [
        { label: '✅ Añadir estas', value: '__accept__' },
        { label: '✏️ Escribir las mías', value: '__custom__' },
      ],
      state
    );
  }

  // ── HABILIDADES CUSTOM ────────────────────────────────────────────────
  if (step === 'awaiting_habilidades_custom') {
    if (!s) return reply('Escribe al menos una habilidad.', [], state);
    const habilidades = s.split(',').map(x => x.trim()).filter(Boolean).slice(0, 15);
    return await goToPreview({ ...state, habilidades });
  }

  // ── PREVIEW: user asks for restart ────────────────────────────────────
  if (step === 'preview') {
    return reply(
      'Tu CV ya está listo para descargar. Usa el botón de abajo para pagar y descargar el PDF sin marca de agua.',
      [{ label: '💳 Pagar 5€ y descargar', value: '__pay__' }],
      state
    );
  }

  return reply('No entendí tu respuesta. ¿Puedes repetirlo?', [], state);
}

// ── Transition helpers ────────────────────────────────────────────────────
async function goToHabilidades(state) {
  metrics.aiCalls++;
  const suggested = await suggestSkillsForJobs(state.jobs || []);
  const lista = suggested.map(s => `• ${s}`).join('\n');
  return reply(
    `Casi listo. Para tus empleos te sugiero estas habilidades:\n\n${lista}\n\n¿Las añado o prefieres escribir las tuyas?`,
    [
      { label: '✅ Añadir estas', value: '__accept__' },
      { label: '✏️ Escribir las mías', value: '__custom__' },
    ],
    { ...state, step: 'awaiting_habilidades_confirm', suggestedHabilidades: suggested }
  );
}

async function goToPreview(state) {
  const cvData = buildCvDataFromChat(state);
  const mockUser = { id: 0, email: state.profile.email || '' };
  const previewHtml = renderCvHtml(mockUser, cvData, { showPayButton: false, watermark: true });
  const previewEncoded = Buffer.from(previewHtml).toString('base64');
  metrics.completed++;
  return reply(
    '🎉 ¡Tu CV está listo! Aquí tienes una vista previa con marca de agua.\n\nDescarga el PDF sin marca de agua por *5€*.',
    [],
    { ...state, step: 'preview' },
    { previewEncoded }
  );
}

// ── Routes ────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const chatState = req.session.chat ? req.session.chat.step : 'start';
  const fromAuth = req.query.fromAuth === '1';
  res.send(renderChatPage(req.user || null, chatState, fromAuth));
});

router.post('/mensaje', async (req, res) => {
  if (isRateLimited(req.sessionID)) {
    return res.json({ text: 'Vas muy rápido. Espera un momento.', buttons: [] });
  }

  const rawInput = req.body.buttonValue || req.body.mensaje || '';

  if (!req.session.chat || rawInput === '__restart__') {
    req.session.chat = initState();
  }

  try {
    const result = await processStep(req.session.chat, rawInput);
    req.session.chat = result.newState;

    return res.json({
      text: result.text,
      buttons: result.buttons || [],
      step: result.newState.step,
      previewEncoded: result.previewEncoded || null,
    });
  } catch (err) {
    console.error('[CHAT] processStep error:', err.message);
    return res.json({
      text: 'Algo salió mal. Intenta de nuevo.',
      buttons: [{ label: 'Reintentar', value: '__retry__' }],
      step: req.session.chat?.step || 'start',
    });
  }
});

router.post('/guardar', (req, res) => {
  const chat = req.session.chat;
  if (!chat || !chat.profile?.nombre || !(chat.jobs?.length)) {
    return res.status(400).json({ error: 'incomplete' });
  }

  // If not authenticated, redirect through OAuth then return here
  if (!req.isAuthenticated()) {
    req.session.returnTo = '/chat?fromAuth=1';
    return res.json({ redirect: '/auth/google' });
  }

  const userId = req.user.id;
  const db = getDb();
  const cvData = buildCvDataFromChat(chat);

  const upsert = db.transaction(() => {
    const existing = db.prepare('SELECT id FROM cv_data WHERE user_id = ?').get(userId);
    if (existing) {
      db.prepare(`UPDATE cv_data SET jobs=?, ai_suggested_jobs='[]', profile=?, education=?, skills=?,
        version=version+1, updated_at=datetime('now') WHERE user_id=?`)
        .run(
          JSON.stringify(cvData.jobs), JSON.stringify(cvData.profile),
          JSON.stringify(cvData.education), JSON.stringify(cvData.skills),
          userId
        );
    } else {
      db.prepare('INSERT INTO cv_data (user_id, jobs, ai_suggested_jobs, profile, education, skills) VALUES (?,?,?,?,?,?)')
        .run(userId, JSON.stringify(cvData.jobs), '[]',
          JSON.stringify(cvData.profile), JSON.stringify(cvData.education), JSON.stringify(cvData.skills));
    }
  });
  upsert();

  metrics.paid++;
  const user = db.prepare('SELECT id, view_token FROM users WHERE id = ?').get(userId);
  res.json({ ok: true, userId: user.id, viewToken: user.view_token });
});

// Internal metrics endpoint
router.get('/metrics', (req, res) => {
  res.json(metrics);
});

// ── HTML template ─────────────────────────────────────────────────────────
function renderChatPage(user, chatState, fromAuth) {
  const isAuthenticated = !!user;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CreaCV — Asistente de CV</title>
  <meta name="description" content="Crea tu curriculum vitae con ayuda de nuestro asistente inteligente. Solo responde las preguntas.">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; }
    body { font-family: 'Inter', sans-serif; background: #0b141a; color: #e9edef; }

    /* ── Layout ── */
    .app { display: flex; flex-direction: column; height: 100vh; max-width: 680px; margin: 0 auto; background: #0b141a; }

    /* ── Header ── */
    .chat-header { background: #1f2c34; padding: 10px 16px; display: flex; align-items: center; gap: 12px; flex-shrink: 0; border-bottom: 1px solid #2a3942; }
    .header-avatar { width: 40px; height: 40px; background: linear-gradient(135deg, #3a7ca5, #4caf50); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
    .header-info { flex: 1; }
    .header-name { font-size: 15px; font-weight: 600; color: #e9edef; }
    .header-status { font-size: 12px; color: #8696a0; display: flex; align-items: center; gap: 4px; }
    .online-dot { width: 7px; height: 7px; background: #00a884; border-radius: 50%; }
    .header-back { color: #8696a0; text-decoration: none; font-size: 13px; padding: 6px 12px; border-radius: 6px; border: 1px solid #2a3942; }
    .header-back:hover { background: #2a3942; color: #e9edef; }

    /* ── Messages area ── */
    .chat-messages { flex: 1; overflow-y: auto; padding: 16px 16px 8px; display: flex; flex-direction: column; gap: 4px;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%230b141a'/%3E%3C/svg%3E"); }
    .chat-messages::-webkit-scrollbar { width: 5px; }
    .chat-messages::-webkit-scrollbar-thumb { background: #2a3942; border-radius: 10px; }

    /* ── Bubbles ── */
    .msg { display: flex; margin-bottom: 4px; max-width: 100%; }
    .msg-bot { justify-content: flex-start; gap: 8px; align-items: flex-end; }
    .msg-user { justify-content: flex-end; }

    .avatar { width: 28px; height: 28px; background: linear-gradient(135deg, #3a7ca5, #4caf50); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; font-weight: 700; color: #fff; }

    .bubble { max-width: min(75%, 460px); padding: 8px 12px 6px; border-radius: 10px; font-size: 14px; line-height: 1.5; position: relative; }
    .msg-bot .bubble { background: #202c33; border-radius: 0 10px 10px 10px; color: #e9edef; }
    .msg-user .bubble { background: #005c4b; border-radius: 10px 10px 0 10px; color: #e9edef; }

    .bubble-time { font-size: 11px; color: #8696a0; text-align: right; margin-top: 3px; display: flex; justify-content: flex-end; align-items: center; gap: 3px; }
    .tick { color: #53bdeb; }

    /* ── Quick reply buttons ── */
    .qr-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; margin-left: 36px; margin-bottom: 8px; }
    .qr-btn { background: #202c33; border: 1.5px solid #3a7ca5; color: #53bdeb; padding: 7px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; font-family: inherit; }
    .qr-btn:hover { background: #3a7ca5; color: #fff; }
    .qr-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Typing indicator ── */
    .typing-bubble { background: #202c33; border-radius: 0 10px 10px 10px; padding: 12px 16px; display: flex; gap: 4px; align-items: center; }
    .dot { width: 7px; height: 7px; background: #8696a0; border-radius: 50%; animation: dot-bounce 1.4s infinite; }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes dot-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.6; } 30% { transform: translateY(-6px); opacity: 1; } }

    /* ── Preview bubble ── */
    .preview-bubble { background: #202c33; border-radius: 0 10px 10px 10px; overflow: hidden; max-width: min(85%, 520px); }
    .preview-label { padding: 10px 14px 6px; font-size: 12px; color: #8696a0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .preview-frame { border-radius: 0 0 6px 6px; overflow: hidden; }
    .preview-frame iframe { width: 100%; height: 440px; border: none; display: block; background: #fff; }

    /* ── Payment card ── */
    .pay-card { background: linear-gradient(135deg, #1e3a2f, #1a3347); border: 1.5px solid #00a884; border-radius: 0 12px 12px 12px; padding: 18px 20px; max-width: min(80%, 360px); }
    .pay-card-title { font-size: 13px; color: #8696a0; margin-bottom: 8px; }
    .pay-card-amount { font-size: 32px; font-weight: 800; color: #e9edef; margin-bottom: 4px; }
    .pay-card-amount span { font-size: 16px; vertical-align: top; margin-top: 6px; display: inline-block; }
    .pay-card-desc { font-size: 13px; color: #8696a0; margin-bottom: 14px; }
    .pay-card-features { list-style: none; margin-bottom: 16px; }
    .pay-card-features li { font-size: 13px; color: #00a884; padding: 3px 0; display: flex; gap: 6px; align-items: center; }
    .pay-card-features li::before { content: "✓"; font-weight: 700; }
    .btn-pay { width: 100%; background: #00a884; color: #fff; border: none; padding: 13px; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background 0.2s; }
    .btn-pay:hover { background: #008f70; }
    .btn-login-pay { width: 100%; background: #fff; color: #1a1a1a; border: none; padding: 13px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-login-pay:hover { background: #f0f0f0; }

    /* ── Input bar ── */
    .chat-input-bar { background: #1f2c34; padding: 8px 12px; display: flex; gap: 10px; align-items: flex-end; flex-shrink: 0; border-top: 1px solid #2a3942; }
    .chat-input { flex: 1; background: #2a3942; border: none; border-radius: 20px; padding: 10px 16px; font-size: 15px; color: #e9edef; resize: none; max-height: 100px; font-family: inherit; outline: none; line-height: 1.4; }
    .chat-input::placeholder { color: #8696a0; }
    .chat-input:focus { background: #2e4451; }
    .btn-send { width: 44px; height: 44px; background: #00a884; border: none; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.2s; }
    .btn-send:hover { background: #008f70; }
    .btn-send:disabled { background: #2a3942; cursor: not-allowed; }
    .btn-send svg { width: 20px; height: 20px; fill: #fff; }

    /* ── Date separator ── */
    .date-sep { text-align: center; margin: 12px 0; }
    .date-sep span { background: #182229; color: #8696a0; font-size: 11px; padding: 4px 12px; border-radius: 6px; }

    /* ── Restart banner ── */
    .restart-bar { text-align: center; padding: 8px; }
    .btn-restart { background: none; border: 1px solid #2a3942; color: #8696a0; font-size: 12px; padding: 4px 12px; border-radius: 12px; cursor: pointer; font-family: inherit; }
    .btn-restart:hover { color: #e9edef; border-color: #8696a0; }

    @media (max-width: 480px) {
      .bubble { max-width: 88%; }
      .preview-frame iframe { height: 340px; }
    }
  </style>
</head>
<body>
<div class="app">
  <!-- Header -->
  <div class="chat-header">
    <a href="/" class="header-back">←</a>
    <div class="header-avatar">CV</div>
    <div class="header-info">
      <div class="header-name">CreaCV Asistente</div>
      <div class="header-status"><span class="online-dot"></span> En línea</div>
    </div>
  </div>

  <!-- Messages -->
  <div class="chat-messages" id="chat-messages">
    <div class="date-sep"><span>HOY</span></div>
  </div>

  <!-- Restart bar (shown after preview) -->
  <div class="restart-bar" id="restart-bar" style="display:none">
    <button class="btn-restart" id="btn-restart">↺ Empezar de nuevo</button>
  </div>

  <!-- Input -->
  <div class="chat-input-bar">
    <textarea class="chat-input" id="chat-input" placeholder="Escribe un mensaje..." rows="1"></textarea>
    <button class="btn-send" id="btn-send" aria-label="Enviar">
      <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
    </button>
  </div>
</div>

<script>
  const IS_AUTHENTICATED = ${isAuthenticated};
  const INITIAL_STATE = '${escHtml(chatState)}';
  const FROM_AUTH = ${fromAuth};

  const messagesEl = document.getElementById('chat-messages');
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('btn-send');
  const restartBar = document.getElementById('restart-bar');
  let isWaiting = false;
  let savedUserId = null;
  let savedViewToken = null;

  // ── Format bot text ──────────────────────────────────────────────────
  function fmt(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\\*(.*?)\\*/g, '<strong>$1</strong>')
      .replace(/\\n/g, '<br>');
  }
  function esc(s) { return (s||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function now() { return new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Render helpers ────────────────────────────────────────────────────
  function addBotBubble(text, buttons) {
    const wrap = document.createElement('div');
    wrap.className = 'msg msg-bot';
    wrap.innerHTML =
      '<div class="avatar">CV</div>' +
      '<div class="bubble">' +
        '<div class="bubble-text">' + fmt(text) + '</div>' +
        '<div class="bubble-time">' + now() + '</div>' +
      '</div>';
    messagesEl.appendChild(wrap);
    if (buttons && buttons.length) addButtons(buttons);
    scrollDown();
  }

  function addUserBubble(text) {
    const wrap = document.createElement('div');
    wrap.className = 'msg msg-user';
    wrap.innerHTML =
      '<div class="bubble">' +
        '<div class="bubble-text">' + fmt(text) + '</div>' +
        '<div class="bubble-time">' + now() + ' <span class="tick">✓✓</span></div>' +
      '</div>';
    messagesEl.appendChild(wrap);
    scrollDown();
  }

  function addButtons(buttons) {
    const row = document.createElement('div');
    row.className = 'qr-row';
    row.id = 'qr-' + Date.now();
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'qr-btn';
      btn.textContent = b.label;
      btn.addEventListener('click', function() {
        document.querySelectorAll('.qr-btn').forEach(x => { x.disabled = true; });
        row.remove();
        send(b.label, b.value);
      });
      row.appendChild(btn);
    });
    messagesEl.appendChild(row);
    scrollDown();
  }

  function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'msg msg-bot';
    wrap.id = 'typing';
    wrap.innerHTML = '<div class="avatar">CV</div><div class="typing-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
    messagesEl.appendChild(wrap);
    scrollDown();
  }
  function hideTyping() { const el = document.getElementById('typing'); if (el) el.remove(); }

  function addPreviewBubble(encoded) {
    // Preview frame
    const wrap = document.createElement('div');
    wrap.className = 'msg msg-bot';
    const frame = document.createElement('div');
    frame.className = 'preview-bubble';
    frame.innerHTML = '<div class="preview-label">Vista previa — con marca de agua</div><div class="preview-frame"><iframe id="cv-preview" title="Vista previa CV"></iframe></div>';
    wrap.appendChild(document.createElement('div')).className = 'avatar';
    wrap.querySelector('.avatar').textContent = 'CV';
    wrap.appendChild(frame);
    messagesEl.appendChild(wrap);

    // Decode and set srcdoc
    try {
      const html = decodeURIComponent(escape(atob(encoded)));
      document.getElementById('cv-preview').srcdoc = html;
    } catch(e) {}

    scrollDown();
    restartBar.style.display = 'block';
  }

  function addPayCard() {
    const wrap = document.createElement('div');
    wrap.className = 'msg msg-bot';
    wrap.innerHTML =
      '<div class="avatar">CV</div>' +
      '<div class="pay-card">' +
        '<div class="pay-card-title">Descarga tu CV profesional</div>' +
        '<div class="pay-card-amount"><span>€</span>5</div>' +
        '<div class="pay-card-desc">Pago único · Sin suscripción</div>' +
        '<ul class="pay-card-features">' +
          '<li>PDF de alta calidad listo para imprimir</li>' +
          '<li>Sin marca de agua</li>' +
          '<li>Diseño profesional y moderno</li>' +
        '</ul>' +
        '<button class="btn-pay" id="btn-pay-final">💳 Pagar y descargar</button>' +
        (IS_AUTHENTICATED ? '' : '<button class="btn-login-pay" id="btn-login-pay"><img src="https://www.google.com/favicon.ico" width="16" height="16"> Acceder con Google y pagar</button>') +
      '</div>';
    messagesEl.appendChild(wrap);
    scrollDown();

    document.getElementById('btn-pay-final').addEventListener('click', handlePay);
    if (!IS_AUTHENTICATED) {
      document.getElementById('btn-login-pay').addEventListener('click', handleLoginPay);
    }
  }

  // ── Payment handlers ──────────────────────────────────────────────────
  async function handlePay() {
    if (!savedUserId) {
      const result = await doGuardar();
      if (!result) return;
    }
    submitStripeForm(savedUserId);
  }

  async function handleLoginPay() {
    await doGuardar(); // may return redirect
  }

  async function doGuardar() {
    try {
      const resp = await fetch('/chat/guardar', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await resp.json();
      if (data.redirect) {
        window.location.href = data.redirect;
        return null;
      }
      if (data.ok) {
        savedUserId = data.userId;
        savedViewToken = data.viewToken;
        return data;
      }
    } catch(e) {
      addBotBubble('Error al guardar. Por favor intenta de nuevo.', []);
    }
    return null;
  }

  function submitStripeForm(userId) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/create-checkout-session';
    const inp = document.createElement('input');
    inp.type = 'hidden'; inp.name = 'userId'; inp.value = userId;
    form.appendChild(inp);
    document.body.appendChild(form);
    form.submit();
  }

  // ── Core send ─────────────────────────────────────────────────────────
  async function send(displayText, value) {
    if (isWaiting) return;
    isWaiting = true;
    setInputEnabled(false);

    if (displayText && displayText !== '__init__') addUserBubble(displayText);

    showTyping();
    let minDelay = sleep(400 + Math.random() * 300);

    try {
      const resp = await fetch('/chat/mensaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: displayText === '__init__' ? '' : displayText, buttonValue: value }),
      });
      const data = await resp.json();
      await minDelay;
      hideTyping();

      if (data.previewEncoded) {
        addBotBubble(data.text, []);
        await sleep(400);
        addPreviewBubble(data.previewEncoded);
        await sleep(600);
        addPayCard();
      } else {
        addBotBubble(data.text, data.buttons || []);
      }

      if (data.step === 'preview') {
        setInputEnabled(false);
      } else {
        setInputEnabled(true);
        inputEl.focus();
      }
    } catch(e) {
      await minDelay;
      hideTyping();
      addBotBubble('Error de conexión. Intenta de nuevo.', [{ label: 'Reintentar', value: '__retry__' }]);
      setInputEnabled(true);
    }

    isWaiting = false;
  }

  function setInputEnabled(on) {
    inputEl.disabled = !on;
    sendBtn.disabled = !on;
  }

  function scrollDown() {
    requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
  }

  // ── Event listeners ───────────────────────────────────────────────────
  sendBtn.addEventListener('click', () => {
    const t = inputEl.value.trim();
    if (t && !isWaiting) { inputEl.value = ''; send(t, null); }
  });

  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const t = inputEl.value.trim();
      if (t && !isWaiting) { inputEl.value = ''; send(t, null); }
    }
  });

  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
  });

  document.getElementById('btn-restart').addEventListener('click', () => {
    if (confirm('¿Empezar de nuevo? Perderás el progreso actual.')) {
      send('Reiniciar', '__restart__');
      restartBar.style.display = 'none';
      setInputEnabled(true);
    }
  });

  // ── Init ──────────────────────────────────────────────────────────────
  window.addEventListener('load', async () => {
    if (FROM_AUTH && INITIAL_STATE === 'preview') {
      // Came back from OAuth with a pending CV — go straight to payment
      addBotBubble('¡Bienvenido/a de vuelta! Tu CV está listo. 🎉', []);
      await sleep(500);
      const data = await doGuardar();
      if (data) {
        await sleep(300);
        addPayCard();
      }
    } else {
      // Start or resume conversation
      send('__init__', '__init__');
    }
    setInputEnabled(true);
    inputEl.focus();
  });
</script>
</body>
</html>`;
}

module.exports = router;
