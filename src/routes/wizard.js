const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../db');
const { renderCvHtml } = require('../views/cv.html.js');

const TOTAL_STEPS = 5;

const STEP_TITLES = {
  1: 'Datos personales',
  2: 'Experiencia laboral',
  3: 'Formacion academica',
  4: 'Habilidades e idiomas',
  5: 'Vista previa',
};

function progressBar(current) {
  const pct = Math.round((current / TOTAL_STEPS) * 100);
  return `
    <div class="wz-progress">
      <div class="wz-progress-labels">
        ${Object.entries(STEP_TITLES).map(([n, t]) => `
          <span class="wz-step-label ${parseInt(n) === current ? 'active' : ''} ${parseInt(n) < current ? 'done' : ''}" title="${t}">${n}</span>
        `).join('')}
      </div>
      <div class="wz-bar-bg"><div class="wz-bar-fill" style="width:${pct}%"></div></div>
      <p class="wz-step-name">Paso ${current} de ${TOTAL_STEPS}: <strong>${STEP_TITLES[current]}</strong></p>
    </div>`;
}

function layout(title, content, step) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)} — CreaCV</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; color: #2c3e50; background: #f0f7fa; min-height: 100vh; }
    nav { display: flex; justify-content: space-between; align-items: center; padding: 16px 40px; background: #fff; border-bottom: 1px solid #e8f4f8; }
    .nav-logo { font-size: 18px; font-weight: 800; color: #3a7ca5; text-decoration: none; }
    .nav-logo span { color: #4caf50; }
    .container { max-width: 680px; margin: 40px auto; padding: 0 20px 60px; }
    .wz-card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(58,124,165,0.10); padding: 40px; }
    h1 { font-size: 22px; font-weight: 800; color: #2c3e50; margin-bottom: 28px; }

    .wz-progress { margin-bottom: 32px; }
    .wz-progress-labels { display: flex; gap: 8px; margin-bottom: 10px; }
    .wz-step-label { width: 32px; height: 32px; border-radius: 50%; background: #e8f4f8; color: #5a6a7a; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; cursor: default; }
    .wz-step-label.active { background: #3a7ca5; color: #fff; }
    .wz-step-label.done { background: #4caf50; color: #fff; }
    .wz-bar-bg { height: 6px; background: #e8f4f8; border-radius: 3px; overflow: hidden; }
    .wz-bar-fill { height: 100%; background: linear-gradient(90deg, #3a7ca5, #4caf50); border-radius: 3px; transition: width 0.4s; }
    .wz-step-name { font-size: 13px; color: #5a6a7a; margin-top: 8px; }

    .field { margin-bottom: 20px; }
    label { display: block; font-size: 12px; font-weight: 700; color: #5a6a7a; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.6px; }
    input, textarea, select { width: 100%; padding: 11px 14px; border: 2px solid #e8f4f8; border-radius: 8px; font-size: 15px; font-family: inherit; color: #2c3e50; transition: border-color 0.2s; background: #fafcfd; }
    input:focus, textarea:focus { outline: none; border-color: #3a7ca5; background: #fff; }
    textarea { resize: vertical; min-height: 80px; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field-hint { font-size: 12px; color: #8a9aaa; margin-top: 5px; }

    .entry-block { border: 2px solid #e8f4f8; border-radius: 10px; padding: 20px; margin-bottom: 16px; position: relative; background: #fafcfd; }
    .entry-block-title { font-size: 12px; font-weight: 700; color: #3a7ca5; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
    .btn-remove-entry { position: absolute; top: 14px; right: 14px; background: #fee2e2; border: none; color: #c0392b; font-size: 18px; line-height: 1; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .btn-add-entry { background: transparent; border: 2px dashed #3a7ca5; color: #3a7ca5; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%; margin-top: 4px; transition: background 0.2s; }
    .btn-add-entry:hover { background: #e8f4f8; }

    .btn-row { display: flex; justify-content: space-between; align-items: center; margin-top: 32px; gap: 12px; }
    .btn-back { background: transparent; border: 2px solid #dde; color: #5a6a7a; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-block; }
    .btn-back:hover { border-color: #3a7ca5; color: #3a7ca5; }
    .btn-next { background: #3a7ca5; color: #fff; border: none; padding: 13px 32px; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
    .btn-next:hover { background: #2c6490; }
    .btn-save { background: #4caf50; color: #fff; border: none; padding: 13px 32px; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; }
    .btn-save:hover { background: #388e3c; }

    .cv-preview-wrap { border: 2px solid #e8f4f8; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
    .cv-preview-wrap iframe { width: 100%; height: 520px; border: none; display: block; }
    .preview-note { font-size: 13px; color: #5a6a7a; margin-bottom: 16px; background: #fff9e6; border: 1px solid #ffe082; border-radius: 8px; padding: 10px 14px; }

    @media (max-width: 600px) {
      .wz-card { padding: 24px 18px; }
      .field-row { grid-template-columns: 1fr; }
      nav { padding: 14px 20px; }
    }
  </style>
</head>
<body>
<script>
  // Warn user before closing/refreshing mid-form (steps 1-4)
  if (${step} < 5) {
    let formDirty = false;
    document.addEventListener('input', () => { formDirty = true; });
    document.addEventListener('submit', () => { formDirty = false; });
    window.addEventListener('beforeunload', (e) => {
      if (formDirty) { e.preventDefault(); e.returnValue = ''; }
    });
  }
</script>
<nav>
  <a class="nav-logo" href="/">Crea<span>CV</span></a>
  <a href="/" style="font-size:13px;color:#5a6a7a;text-decoration:none;">Cancelar</a>
</nav>
<div class="container">
  <div class="wz-card">
    ${progressBar(step)}
    <h1>${escHtml(STEP_TITLES[step])}</h1>
    ${content}
  </div>
</div>
</body>
</html>`;
}

router.get('/', requireAuth, (req, res) => res.redirect('/crear/paso/1'));

router.get('/paso/:step', requireAuth, (req, res) => {
  const step = parseInt(req.params.step);
  if (isNaN(step) || step < 1 || step > TOTAL_STEPS) return res.redirect('/crear/paso/1');

  const wz = req.session.wizard || {};

  // ── PASO 1: Datos personales ──────────────────────────────────────────────
  if (step === 1) {
    const d = wz.step1 || {};
    return res.send(layout('Datos personales', `
      <form method="POST" action="/crear/paso/1" id="form-step1">
        <div class="field-row">
          <div class="field">
            <label>Nombre *</label>
            <input name="nombre" type="text" value="${escHtml(d.nombre || '')}" placeholder="Ana" required>
          </div>
          <div class="field">
            <label>Apellidos *</label>
            <input name="apellidos" type="text" value="${escHtml(d.apellidos || '')}" placeholder="Garcia Lopez" required>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Ciudad</label>
            <input name="ciudad" type="text" value="${escHtml(d.ciudad || '')}" placeholder="Madrid">
          </div>
          <div class="field">
            <label>Telefono</label>
            <input name="telefono" type="tel" value="${escHtml(d.telefono || '')}" placeholder="600 000 000">
          </div>
        </div>
        <div class="field">
          <label>Email</label>
          <input name="email" type="email" value="${escHtml(d.email || req.user.email || '')}" placeholder="ana@email.com">
        </div>

        <div class="field photo-field">
          <label>Foto de perfil <span class="label-optional">(opcional)</span></label>
          <div class="photo-upload-wrap" onclick="document.getElementById('photo-input').click()">
            <div id="photo-preview" class="photo-preview">
              ${d.photo ? `<img src="${escHtml(d.photo)}" alt="foto">` : `<div class="photo-placeholder"><span class="photo-icon">📷</span><span>Subir foto</span></div>`}
            </div>
            <input type="file" id="photo-input" accept="image/*" style="display:none">
          </div>
          <p class="field-hint">No es obligatoria para optar a empleos — añadela solo si lo deseas.</p>
          <input type="hidden" name="photo" id="photo-b64" value="${escHtml(d.photo || '')}">
        </div>

        <div class="btn-row">
          <a href="/" class="btn-back">Cancelar</a>
          <button type="submit" class="btn-next">Siguiente →</button>
        </div>
      </form>
      <style>
        .label-optional { font-weight: 400; font-size: 11px; color: #8a9aaa; text-transform: none; letter-spacing: 0; }
        .photo-upload-wrap { cursor: pointer; display: inline-block; }
        .photo-preview { width: 96px; height: 96px; border-radius: 50%; overflow: hidden; border: 2px dashed #3a7ca5; display: flex; align-items: center; justify-content: center; background: #f0f7fa; transition: border-color 0.2s; }
        .photo-preview:hover { border-color: #2c6490; }
        .photo-preview img { width: 100%; height: 100%; object-fit: cover; }
        .photo-placeholder { display: flex; flex-direction: column; align-items: center; gap: 4px; color: #3a7ca5; font-size: 11px; font-weight: 600; }
        .photo-icon { font-size: 22px; }
      </style>
      <script>
        document.getElementById('photo-input').addEventListener('change', function(e) {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function(ev) {
            const img = new Image();
            img.onload = function() {
              const canvas = document.createElement('canvas');
              const MAX = 240;
              const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
              canvas.width = img.width * ratio;
              canvas.height = img.height * ratio;
              canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
              const b64 = canvas.toDataURL('image/jpeg', 0.82);
              document.getElementById('photo-b64').value = b64;
              const preview = document.getElementById('photo-preview');
              preview.innerHTML = '<img src="' + b64 + '" alt="foto">';
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        });
      </script>
    `, step));
  }

  // ── PASO 2: Experiencia laboral ──────────────────────────────────────────
  if (step === 2) {
    const jobs = (wz.step2 || {}).empleos || [{}];
    const jobsHtml = jobs.map((j, i) => jobBlock(j, i, jobs.length > 1)).join('');
    return res.send(layout('Experiencia laboral', `
      <form method="POST" action="/crear/paso/2">
        <input type="hidden" name="count" id="jobs-count" value="${jobs.length}">
        <div id="jobs-container">${jobsHtml}</div>
        ${jobs.length < 5 ? `<button type="button" class="btn-add-entry" onclick="addJob()">+ Agregar otro empleo</button>` : ''}
        <div class="btn-row">
          <a href="/crear/paso/1" class="btn-back">← Anterior</a>
          <button type="submit" class="btn-next">Siguiente →</button>
        </div>
      </form>
      <script>
        let count = ${jobs.length};
        function addJob() {
          if (count >= 5) return;
          const c = document.getElementById('jobs-container');
          const i = count;
          const div = document.createElement('div');
          div.className = 'entry-block';
          div.id = 'job-' + i;
          div.innerHTML = \`
            <div class="entry-block-title">Empleo \${i+1}</div>
            <button type="button" class="btn-remove-entry" onclick="removeEntry('job-\${i}')">×</button>
            <div class="field-row">
              <div class="field"><label>Empresa *</label><input name="empresa_\${i}" placeholder="Restaurante El Rincon" required></div>
              <div class="field"><label>Cargo *</label><input name="cargo_\${i}" placeholder="Camarero/a" required></div>
            </div>
            <div class="field-row">
              <div class="field"><label>Fecha inicio</label><input name="fecha_inicio_\${i}" placeholder="Mar 2022"></div>
              <div class="field"><label>Fecha fin</label><input name="fecha_fin_\${i}" placeholder="Actualidad"></div>
            </div>
            <div class="field"><label>Descripcion (opcional)</label><textarea name="descripcion_\${i}" placeholder="Atencion al cliente, gestion de mesas, cobro en caja..."></textarea></div>
          \`;
          c.appendChild(div);
          count++;
          document.getElementById('jobs-count').value = count;
        }
        function removeEntry(id) { document.getElementById(id).remove(); }
      </script>
    `, step));
  }

  // ── PASO 3: Educacion ────────────────────────────────────────────────────
  if (step === 3) {
    const edu = (wz.step3 || {}).educacion || [{}];
    const eduHtml = edu.map((e, i) => eduBlock(e, i, edu.length > 1)).join('');
    return res.send(layout('Formacion academica', `
      <form method="POST" action="/crear/paso/3">
        <input type="hidden" name="count" id="edu-count" value="${edu.length}">
        <div id="edu-container">${eduHtml}</div>
        ${edu.length < 4 ? `<button type="button" class="btn-add-entry" onclick="addEdu()">+ Agregar otra entrada</button>` : ''}
        <div class="btn-row">
          <a href="/crear/paso/2" class="btn-back">← Anterior</a>
          <button type="submit" class="btn-next">Siguiente →</button>
        </div>
      </form>
      <script>
        let count = ${edu.length};
        function addEdu() {
          if (count >= 4) return;
          const c = document.getElementById('edu-container');
          const i = count;
          const div = document.createElement('div');
          div.className = 'entry-block';
          div.id = 'edu-' + i;
          div.innerHTML = \`
            <div class="entry-block-title">Formacion \${i+1}</div>
            <button type="button" class="btn-remove-entry" onclick="removeEntry('edu-\${i}')">×</button>
            <div class="field"><label>Centro / Institucion</label><input name="institucion_\${i}" placeholder="IES Ramon y Cajal"></div>
            <div class="field-row">
              <div class="field"><label>Titulo o nivel</label><input name="titulo_\${i}" placeholder="Bachillerato de Ciencias"></div>
              <div class="field"><label>Ano de fin</label><input name="anio_\${i}" placeholder="2019"></div>
            </div>
          \`;
          c.appendChild(div);
          count++;
          document.getElementById('edu-count').value = count;
        }
        function removeEntry(id) { document.getElementById(id).remove(); }
      </script>
    `, step));
  }

  // ── PASO 4: Habilidades e idiomas ─────────────────────────────────────────
  if (step === 4) {
    const d = wz.step4 || {};
    const habilidades = (d.habilidades || []).join(', ');
    const idiomas = (d.idiomas || []).join(', ');
    return res.send(layout('Habilidades e idiomas', `
      <form method="POST" action="/crear/paso/4">
        <div class="field">
          <label>Habilidades</label>
          <input name="habilidades" value="${escHtml(habilidades)}" placeholder="Atencion al cliente, Trabajo en equipo, Puntualidad, Resolucion de problemas...">
          <p class="field-hint">Separalas con comas. Puedes incluir habilidades personales, tecnicas o de oficio.</p>
        </div>
        <div class="field">
          <label>Idiomas</label>
          <input name="idiomas" value="${escHtml(idiomas)}" placeholder="Espanol (nativo), Ingles (basico), Catalan (nativo)...">
          <p class="field-hint">Indica el nivel entre parentesis si lo sabes.</p>
        </div>
        <div class="btn-row">
          <a href="/crear/paso/3" class="btn-back">← Anterior</a>
          <button type="submit" class="btn-next">Ver vista previa →</button>
        </div>
      </form>
    `, step));
  }

  // ── PASO 5: Vista previa ──────────────────────────────────────────────────
  if (step === 5) {
    const wz = req.session.wizard || {};
    const profile = wz.step1 || {};
    const empleos = (wz.step2 || {}).empleos || [];
    const educacion = (wz.step3 || {}).educacion || [];
    const skills = wz.step4 || {};

    const cvDataPreview = {
      jobs: empleos.map(j => ({
        name: j.empresa,
        position: j.cargo,
        duration: [j.fecha_inicio, j.fecha_fin].filter(Boolean).join(' — '),
        descripcion: j.descripcion,
        is_real: true,
      })),
      ai_suggested_jobs: [],
      profile: { nombre: profile.nombre, apellidos: profile.apellidos, email: profile.email, phone: profile.telefono, city: profile.ciudad, photo: profile.photo || '' },
      education: educacion,
      skills,
    };

    const previewHtml = renderCvHtml(
      { id: req.user.id, email: req.user.email },
      cvDataPreview,
      { showPayButton: false, watermark: true }
    );
    const previewEncoded = Buffer.from(previewHtml).toString('base64');

    return res.send(layout('Vista previa y pago', `
      <p class="preview-note">Vista previa con marca de agua. Guarda tu CV y descarga el PDF sin marca por <strong>5 EUR</strong>.</p>
      <div class="cv-preview-wrap">
        <iframe id="cv-preview" srcdoc="" title="Vista previa CV"></iframe>
      </div>
      <form method="POST" action="/crear/guardar">
        <div class="btn-row">
          <a href="/crear/paso/4" class="btn-back">← Anterior</a>
          <button type="submit" class="btn-save">Guardar y ver CV completo</button>
        </div>
      </form>
      <script>
        const encoded = '${previewEncoded}';
        const html = decodeURIComponent(escape(atob(encoded)));
        document.getElementById('cv-preview').srcdoc = html;
      </script>
    `, step));
  }
});

// ── POST handlers ─────────────────────────────────────────────────────────

router.post('/paso/1', requireAuth, (req, res) => {
  const { nombre, apellidos, ciudad, email, telefono, photo } = req.body;
  if (!nombre || !nombre.trim() || !apellidos || !apellidos.trim()) return res.redirect('/crear/paso/1');
  // Only accept valid base64 data URIs for photo; discard anything else
  const safePhoto = (photo && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo))
    ? photo : '';
  req.session.wizard = req.session.wizard || {};
  req.session.wizard.step1 = {
    nombre: nombre.trim().slice(0, 80),
    apellidos: apellidos.trim().slice(0, 100),
    ciudad: (ciudad || '').trim().slice(0, 100),
    email: (email || '').trim().slice(0, 150),
    telefono: (telefono || '').trim().slice(0, 30),
    photo: safePhoto,
  };
  res.redirect('/crear/paso/2');
});

router.post('/paso/2', requireAuth, (req, res) => {
  const count = parseInt(req.body.count) || 1;
  const empleos = [];
  for (let i = 0; i < count && i < 5; i++) {
    const empresa = (req.body[`empresa_${i}`] || '').trim().slice(0, 150);
    const cargo = (req.body[`cargo_${i}`] || '').trim().slice(0, 150);
    if (!empresa && !cargo) continue;
    empleos.push({
      empresa,
      cargo,
      fecha_inicio: (req.body[`fecha_inicio_${i}`] || '').trim().slice(0, 50),
      fecha_fin: (req.body[`fecha_fin_${i}`] || '').trim().slice(0, 50),
      descripcion: (req.body[`descripcion_${i}`] || '').trim().slice(0, 500),
    });
  }
  req.session.wizard = req.session.wizard || {};
  req.session.wizard.step2 = { empleos: empleos.length ? empleos : [{}] };
  res.redirect('/crear/paso/3');
});

router.post('/paso/3', requireAuth, (req, res) => {
  const count = parseInt(req.body.count) || 1;
  const educacion = [];
  for (let i = 0; i < count && i < 4; i++) {
    const institucion = (req.body[`institucion_${i}`] || '').trim().slice(0, 150);
    const titulo = (req.body[`titulo_${i}`] || '').trim().slice(0, 150);
    const anio = (req.body[`anio_${i}`] || '').trim().slice(0, 10);
    if (!institucion && !titulo) continue;
    educacion.push({ institucion, titulo, anio });
  }
  req.session.wizard = req.session.wizard || {};
  req.session.wizard.step3 = { educacion };
  res.redirect('/crear/paso/4');
});

router.post('/paso/4', requireAuth, (req, res) => {
  const habilidades = (req.body.habilidades || '').split(',').map(s => s.trim().slice(0, 60)).filter(Boolean).slice(0, 20);
  const idiomas = (req.body.idiomas || '').split(',').map(s => s.trim().slice(0, 60)).filter(Boolean).slice(0, 10);
  req.session.wizard = req.session.wizard || {};
  req.session.wizard.step4 = { habilidades, idiomas };
  res.redirect('/crear/paso/5');
});

router.post('/guardar', requireAuth, (req, res) => {
  const wz = req.session.wizard || {};
  const userId = req.user.id;
  const profile = wz.step1 || {};
  const empleos = (wz.step2 || {}).empleos || [];
  const educacion = (wz.step3 || {}).educacion || [];
  const skills = wz.step4 || {};

  const jobs = empleos.filter(j => j.empresa || j.cargo).map(j => ({
    name: j.empresa,
    position: j.cargo,
    duration: [j.fecha_inicio, j.fecha_fin].filter(Boolean).join(' — '),
    descripcion: j.descripcion,
    is_real: true,
  }));

  const db = getDb();
  const existing = db.prepare('SELECT id FROM cv_data WHERE user_id = ?').get(userId);
  const profileJson = JSON.stringify({ nombre: profile.nombre, apellidos: profile.apellidos, email: profile.email, phone: profile.telefono, city: profile.ciudad, photo: profile.photo || '' });
  const educationJson = JSON.stringify(educacion);
  const skillsJson = JSON.stringify(skills);

  if (existing) {
    db.prepare(`UPDATE cv_data SET jobs = ?, ai_suggested_jobs = ?, profile = ?, education = ?, skills = ?,
      version = version + 1, updated_at = datetime('now') WHERE user_id = ?`)
      .run(JSON.stringify(jobs), '[]', profileJson, educationJson, skillsJson, userId);
  } else {
    db.prepare('INSERT INTO cv_data (user_id, jobs, ai_suggested_jobs, profile, education, skills) VALUES (?,?,?,?,?,?)')
      .run(userId, JSON.stringify(jobs), '[]', profileJson, educationJson, skillsJson);
  }

  req.session.wizard = null;
  // If logged in via Google, they are the owner and don't need the token.
  // The token would only be null for users created before the view_token migration.
  const savedUser = db.prepare('SELECT view_token FROM users WHERE id = ?').get(userId);
  const token = savedUser && savedUser.view_token ? `?token=${savedUser.view_token}` : '';
  res.redirect(`/cv/${userId}${token}`);
});

// ── Helper renderers ──────────────────────────────────────────────────────

function jobBlock(j, i, showRemove) {
  return `
    <div class="entry-block" id="job-${i}">
      <div class="entry-block-title">Empleo ${i + 1}</div>
      ${showRemove ? `<button type="button" class="btn-remove-entry" onclick="removeEntry('job-${i}')">×</button>` : ''}
      <div class="field-row">
        <div class="field">
          <label>Empresa *</label>
          <input name="empresa_${i}" value="${escHtml(j.empresa || '')}" placeholder="Restaurante El Rincon" required>
        </div>
        <div class="field">
          <label>Cargo *</label>
          <input name="cargo_${i}" value="${escHtml(j.cargo || '')}" placeholder="Camarero/a" required>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Fecha inicio</label>
          <input name="fecha_inicio_${i}" value="${escHtml(j.fecha_inicio || '')}" placeholder="Mar 2022">
        </div>
        <div class="field">
          <label>Fecha fin</label>
          <input name="fecha_fin_${i}" value="${escHtml(j.fecha_fin || '')}" placeholder="Actualidad">
        </div>
      </div>
      <div class="field">
        <label>Descripcion (opcional)</label>
        <textarea name="descripcion_${i}" placeholder="Atencion al cliente, gestion de mesas, cobro en caja...">${escHtml(j.descripcion || '')}</textarea>
      </div>
    </div>`;
}

function eduBlock(e, i, showRemove) {
  return `
    <div class="entry-block" id="edu-${i}">
      <div class="entry-block-title">Formacion ${i + 1}</div>
      ${showRemove ? `<button type="button" class="btn-remove-entry" onclick="removeEntry('edu-${i}')">×</button>` : ''}
      <div class="field">
        <label>Centro / Institucion</label>
        <input name="institucion_${i}" value="${escHtml(e.institucion || '')}" placeholder="IES Ramon y Cajal">
      </div>
      <div class="field-row">
        <div class="field">
          <label>Titulo o nivel</label>
          <input name="titulo_${i}" value="${escHtml(e.titulo || '')}" placeholder="Bachillerato de Ciencias">
        </div>
        <div class="field">
          <label>Ano de fin</label>
          <input name="anio_${i}" value="${escHtml(e.anio || '')}" placeholder="2019">
        </div>
      </div>
    </div>`;
}

function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = router;
