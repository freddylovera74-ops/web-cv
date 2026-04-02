const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { getDb, getCvData, upsertCvData } = require('../db');
const { renderCvHtml } = require('../views/cv.html.js');

const TOTAL_STEPS = 5;

const STEP_TITLES = {
  1: 'Datos personales',
  2: 'Experiencia laboral',
  3: 'Educacion',
  4: 'Habilidades e idiomas',
  5: 'Vista previa',
};

function progressBar(current) {
  const pct = Math.round((current / TOTAL_STEPS) * 100);
  return `
    <div class="wz-progress">
      <div class="wz-progress-labels">
        ${Object.entries(STEP_TITLES).map(([n, t]) => `
          <span class="wz-step-label ${parseInt(n) === current ? 'active' : ''} ${parseInt(n) < current ? 'done' : ''}">${n}</span>
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

    /* Progress */
    .wz-progress { margin-bottom: 32px; }
    .wz-progress-labels { display: flex; gap: 8px; margin-bottom: 10px; }
    .wz-step-label { width: 32px; height: 32px; border-radius: 50%; background: #e8f4f8; color: #5a6a7a; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .wz-step-label.active { background: #3a7ca5; color: #fff; }
    .wz-step-label.done { background: #4caf50; color: #fff; }
    .wz-bar-bg { height: 6px; background: #e8f4f8; border-radius: 3px; overflow: hidden; }
    .wz-bar-fill { height: 100%; background: linear-gradient(90deg, #3a7ca5, #4caf50); border-radius: 3px; transition: width 0.4s; }
    .wz-step-name { font-size: 13px; color: #5a6a7a; margin-top: 8px; }

    /* Form */
    .field { margin-bottom: 20px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #5a6a7a; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    input, textarea { width: 100%; padding: 11px 14px; border: 2px solid #e8f4f8; border-radius: 8px; font-size: 15px; font-family: inherit; color: #2c3e50; transition: border-color 0.2s; background: #fafcfd; }
    input:focus, textarea:focus { outline: none; border-color: #3a7ca5; background: #fff; }
    textarea { resize: vertical; min-height: 80px; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

    /* Entry blocks */
    .entry-block { border: 2px solid #e8f4f8; border-radius: 10px; padding: 20px; margin-bottom: 16px; position: relative; background: #fafcfd; }
    .entry-block-title { font-size: 13px; font-weight: 700; color: #3a7ca5; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
    .btn-remove-entry { position: absolute; top: 16px; right: 16px; background: #fee; border: none; color: #c0392b; font-size: 18px; line-height: 1; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .btn-add-entry { background: transparent; border: 2px dashed #3a7ca5; color: #3a7ca5; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; width: 100%; margin-top: 4px; transition: background 0.2s; }
    .btn-add-entry:hover { background: #e8f4f8; }

    /* Tags input */
    .tags-container { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px; border: 2px solid #e8f4f8; border-radius: 8px; background: #fafcfd; min-height: 50px; cursor: text; }
    .tag-item { background: #e8f4f8; color: #3a7ca5; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px; }
    .tag-item button { background: none; border: none; color: #3a7ca5; cursor: pointer; font-size: 15px; line-height: 1; padding: 0; }
    .tag-lang .tag-item { background: #e8f5e9; color: #2e7d32; }
    .tag-lang .tag-item button { color: #2e7d32; }
    .tag-input { border: none; outline: none; font-size: 14px; font-family: inherit; background: transparent; min-width: 120px; color: #2c3e50; }

    /* Buttons */
    .btn-row { display: flex; justify-content: space-between; align-items: center; margin-top: 32px; gap: 12px; }
    .btn-back { background: transparent; border: 2px solid #dde; color: #5a6a7a; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none; }
    .btn-back:hover { border-color: #3a7ca5; color: #3a7ca5; }
    .btn-next { background: #3a7ca5; color: #fff; border: none; padding: 13px 32px; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
    .btn-next:hover { background: #2c6490; }
    .btn-pay { background: #4caf50; color: #fff; border: none; padding: 13px 32px; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; }
    .btn-pay:hover { background: #388e3c; }
    .required-note { font-size: 12px; color: #e74c3c; display: none; margin-top: 4px; }
    input:invalid:not(:placeholder-shown) + .required-note { display: block; }

    /* CV preview embed */
    .cv-preview-wrap { border: 2px solid #e8f4f8; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
    .cv-preview-wrap iframe { width: 100%; height: 480px; border: none; display: block; }

    @media (max-width: 600px) {
      .wz-card { padding: 24px 18px; }
      .field-row { grid-template-columns: 1fr; }
      nav { padding: 14px 20px; }
    }
  </style>
</head>
<body>
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

// GET /crear — redirect to step 1
router.get('/', requireAuth, (req, res) => {
  res.redirect('/crear/paso/1');
});

// GET /crear/paso/:step
router.get('/paso/:step', requireAuth, (req, res) => {
  const step = parseInt(req.params.step);
  if (isNaN(step) || step < 1 || step > TOTAL_STEPS) return res.redirect('/crear/paso/1');

  const wz = req.session.wizard || {};

  if (step === 1) {
    const d = wz.step1 || {};
    return res.send(layout('Datos personales', `
      <form method="POST" action="/crear/paso/1">
        <div class="field-row">
          <div class="field">
            <label>Nombre completo *</label>
            <input name="nombre" type="text" value="${escHtml(d.nombre || '')}" placeholder="Ana Garcia" required>
          </div>
          <div class="field">
            <label>Ciudad</label>
            <input name="ciudad" type="text" value="${escHtml(d.ciudad || '')}" placeholder="Madrid">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Email</label>
            <input name="email" type="email" value="${escHtml(d.email || req.user.email || '')}" placeholder="ana@email.com">
          </div>
          <div class="field">
            <label>Telefono</label>
            <input name="telefono" type="tel" value="${escHtml(d.telefono || '')}" placeholder="+34 600 000 000">
          </div>
        </div>
        <div class="btn-row">
          <a href="/" class="btn-back">Cancelar</a>
          <button type="submit" class="btn-next">Siguiente →</button>
        </div>
      </form>
    `, step));
  }

  if (step === 2) {
    const jobs = (wz.step2 || {}).empleos || [{}];
    const jobsHtml = jobs.map((j, i) => `
      <div class="entry-block" id="job-${i}">
        <div class="entry-block-title">Empleo ${i + 1}</div>
        ${jobs.length > 1 ? `<button type="button" class="btn-remove-entry" onclick="removeEntry('job-${i}')">×</button>` : ''}
        <div class="field-row">
          <div class="field">
            <label>Empresa *</label>
            <input name="empresa_${i}" value="${escHtml(j.empresa || '')}" placeholder="Acme Corp" required>
          </div>
          <div class="field">
            <label>Cargo *</label>
            <input name="cargo_${i}" value="${escHtml(j.cargo || '')}" placeholder="Desarrollador Full Stack" required>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Fecha inicio</label>
            <input name="fecha_inicio_${i}" value="${escHtml(j.fecha_inicio || '')}" placeholder="Ene 2021">
          </div>
          <div class="field">
            <label>Fecha fin</label>
            <input name="fecha_fin_${i}" value="${escHtml(j.fecha_fin || '')}" placeholder="Actualidad">
          </div>
        </div>
        <div class="field">
          <label>Descripcion</label>
          <textarea name="descripcion_${i}" placeholder="Describe tus responsabilidades y logros...">${escHtml(j.descripcion || '')}</textarea>
        </div>
      </div>
    `).join('');

    return res.send(layout('Experiencia laboral', `
      <form method="POST" action="/crear/paso/2" id="jobs-form">
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
              <div class="field"><label>Empresa *</label><input name="empresa_\${i}" placeholder="Acme Corp" required></div>
              <div class="field"><label>Cargo *</label><input name="cargo_\${i}" placeholder="Desarrollador Full Stack" required></div>
            </div>
            <div class="field-row">
              <div class="field"><label>Fecha inicio</label><input name="fecha_inicio_\${i}" placeholder="Ene 2021"></div>
              <div class="field"><label>Fecha fin</label><input name="fecha_fin_\${i}" placeholder="Actualidad"></div>
            </div>
            <div class="field"><label>Descripcion</label><textarea name="descripcion_\${i}" placeholder="Describe tus responsabilidades..."></textarea></div>
          \`;
          c.appendChild(div);
          count++;
          document.getElementById('jobs-count').value = count;
        }
        function removeEntry(id) {
          document.getElementById(id).remove();
        }
      </script>
    `, step));
  }

  if (step === 3) {
    const edu = (wz.step3 || {}).educacion || [{}];
    const eduHtml = edu.map((e, i) => `
      <div class="entry-block" id="edu-${i}">
        <div class="entry-block-title">Educacion ${i + 1}</div>
        ${edu.length > 1 ? `<button type="button" class="btn-remove-entry" onclick="removeEntry('edu-${i}')">×</button>` : ''}
        <div class="field">
          <label>Institucion</label>
          <input name="institucion_${i}" value="${escHtml(e.institucion || '')}" placeholder="Universidad Complutense de Madrid">
        </div>
        <div class="field-row">
          <div class="field">
            <label>Titulo / Grado</label>
            <input name="titulo_${i}" value="${escHtml(e.titulo || '')}" placeholder="Grado en Informatica">
          </div>
          <div class="field">
            <label>Ano de fin</label>
            <input name="anio_${i}" value="${escHtml(e.anio || '')}" placeholder="2020">
          </div>
        </div>
      </div>
    `).join('');

    return res.send(layout('Educacion', `
      <form method="POST" action="/crear/paso/3" id="edu-form">
        <input type="hidden" name="count" id="edu-count" value="${edu.length}">
        <div id="edu-container">${eduHtml}</div>
        ${edu.length < 3 ? `<button type="button" class="btn-add-entry" onclick="addEdu()">+ Agregar otra entrada</button>` : ''}
        <div class="btn-row">
          <a href="/crear/paso/2" class="btn-back">← Anterior</a>
          <button type="submit" class="btn-next">Siguiente →</button>
        </div>
      </form>
      <script>
        let count = ${edu.length};
        function addEdu() {
          if (count >= 3) return;
          const c = document.getElementById('edu-container');
          const i = count;
          const div = document.createElement('div');
          div.className = 'entry-block';
          div.id = 'edu-' + i;
          div.innerHTML = \`
            <div class="entry-block-title">Educacion \${i+1}</div>
            <button type="button" class="btn-remove-entry" onclick="removeEntry('edu-\${i}')">×</button>
            <div class="field"><label>Institucion</label><input name="institucion_\${i}" placeholder="Universidad..."></div>
            <div class="field-row">
              <div class="field"><label>Titulo</label><input name="titulo_\${i}" placeholder="Grado en..."></div>
              <div class="field"><label>Ano</label><input name="anio_\${i}" placeholder="2020"></div>
            </div>
          \`;
          c.appendChild(div);
          count++;
          document.getElementById('edu-count').value = count;
        }
        function removeEntry(id) {
          document.getElementById(id).remove();
        }
      </script>
    `, step));
  }

  if (step === 4) {
    const d = wz.step4 || {};
    const habilidades = (d.habilidades || []).join(', ');
    const idiomas = (d.idiomas || []).join(', ');

    return res.send(layout('Habilidades e idiomas', `
      <form method="POST" action="/crear/paso/4">
        <div class="field">
          <label>Habilidades tecnicas y blandas</label>
          <input name="habilidades" value="${escHtml(habilidades)}" placeholder="JavaScript, Trabajo en equipo, Gestion de proyectos...">
          <p style="font-size:12px;color:#8a9aaa;margin-top:5px;">Separalas con comas.</p>
        </div>
        <div class="field">
          <label>Idiomas</label>
          <input name="idiomas" value="${escHtml(idiomas)}" placeholder="Espanol (nativo), Ingles (B2), Frances (A2)...">
          <p style="font-size:12px;color:#8a9aaa;margin-top:5px;">Separalos con comas.</p>
        </div>
        <div class="btn-row">
          <a href="/crear/paso/3" class="btn-back">← Anterior</a>
          <button type="submit" class="btn-next">Ver vista previa →</button>
        </div>
      </form>
    `, step));
  }

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
      profile: { name: profile.nombre, email: profile.email, phone: profile.telefono, city: profile.ciudad },
      education: educacion,
      skills: skills,
    };

    const previewHtml = renderCvHtml({ id: req.user.id, email: req.user.email }, cvDataPreview, { showPayButton: false });
    const previewEncoded = Buffer.from(previewHtml).toString('base64');

    return res.send(layout('Vista previa y pago', `
      <p style="font-size:14px;color:#5a6a7a;margin-bottom:16px;">Asi quedara tu CV. Puedes volver atras para editar cualquier dato.</p>
      <div class="cv-preview-wrap">
        <iframe id="cv-preview" srcdoc="" title="Vista previa CV"></iframe>
      </div>
      <form method="POST" action="/crear/guardar">
        <div class="btn-row">
          <a href="/crear/paso/4" class="btn-back">← Anterior</a>
          <button type="submit" class="btn-next">Guardar CV</button>
        </div>
      </form>
      <script>
        const html = atob('${previewEncoded}');
        document.getElementById('cv-preview').srcdoc = html;
      </script>
    `, step));
  }
});

// POST /crear/paso/1
router.post('/paso/1', requireAuth, (req, res) => {
  const { nombre, ciudad, email, telefono } = req.body;
  if (!nombre || !nombre.trim()) return res.redirect('/crear/paso/1');
  req.session.wizard = req.session.wizard || {};
  req.session.wizard.step1 = {
    nombre: nombre.trim().slice(0, 100),
    ciudad: (ciudad || '').trim().slice(0, 100),
    email: (email || '').trim().slice(0, 150),
    telefono: (telefono || '').trim().slice(0, 30),
  };
  res.redirect('/crear/paso/2');
});

// POST /crear/paso/2
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

// POST /crear/paso/3
router.post('/paso/3', requireAuth, (req, res) => {
  const count = parseInt(req.body.count) || 1;
  const educacion = [];
  for (let i = 0; i < count && i < 3; i++) {
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

// POST /crear/paso/4
router.post('/paso/4', requireAuth, (req, res) => {
  const habilidades = (req.body.habilidades || '').split(',').map(s => s.trim().slice(0, 60)).filter(Boolean).slice(0, 20);
  const idiomas = (req.body.idiomas || '').split(',').map(s => s.trim().slice(0, 60)).filter(Boolean).slice(0, 10);
  req.session.wizard = req.session.wizard || {};
  req.session.wizard.step4 = { habilidades, idiomas };
  res.redirect('/crear/paso/5');
});

// POST /crear/guardar — persist to DB
router.post('/guardar', requireAuth, (req, res) => {
  const wz = req.session.wizard || {};
  const userId = req.user.id;
  const profile = wz.step1 || {};
  const empleos = (wz.step2 || {}).empleos || [];
  const educacion = (wz.step3 || {}).educacion || [];
  const skills = wz.step4 || {};

  const jobs = empleos.map(j => ({
    name: j.empresa,
    position: j.cargo,
    duration: [j.fecha_inicio, j.fecha_fin].filter(Boolean).join(' — '),
    descripcion: j.descripcion,
    is_real: true,
  }));

  const db = getDb();
  const existing = db.prepare('SELECT id FROM cv_data WHERE user_id = ?').get(userId);
  const profileJson = JSON.stringify({ name: profile.nombre, email: profile.email, phone: profile.telefono, city: profile.ciudad });
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
  res.redirect(`/cv/${userId}`);
});

function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = router;
