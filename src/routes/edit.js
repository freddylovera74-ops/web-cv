const router = require('express').Router();
const { getDb } = require('../db');
const { requireOwner } = require('../middleware/auth');

router.get('/:userId', requireOwner, (req, res) => {
  const db = getDb();
  const userId = req.targetUser.id;

  const cvData = db.prepare('SELECT * FROM cv_data WHERE user_id = ?').get(userId);
  const jobs = cvData ? safeJson(cvData.jobs, []) : [];
  const profile = cvData ? safeJson(cvData.profile, {}) : {};
  const education = cvData ? safeJson(cvData.education, []) : [];
  const skills = cvData ? safeJson(cvData.skills, {}) : {};
  const habilidades = Array.isArray(skills.habilidades) ? skills.habilidades.join(', ') : '';
  const idiomas = Array.isArray(skills.idiomas) ? skills.idiomas.join(', ') : '';

  const jobsJson = escAttr(JSON.stringify(jobs));
  const educationJson = escAttr(JSON.stringify(education));

  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Editar CV</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #eef2f7; color: #1a2535; }
    .wrap { max-width: 720px; margin: 32px auto; padding: 0 16px 80px; }
    h1 { font-size: 22px; margin-bottom: 24px; color: #1e2d4d; }
    h2 { font-size: 15px; font-weight: 700; color: #1e2d4d; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #3a7ca5; }
    .field { margin-bottom: 12px; }
    label { display: block; font-size: 12px; font-weight: 600; color: #5a6a7a; margin-bottom: 4px; text-transform: uppercase; letter-spacing: .5px; }
    input, textarea { width: 100%; padding: 9px 12px; font-size: 14px; border: 1px solid #ccd6e0; border-radius: 6px; background: #fff; }
    textarea { resize: vertical; min-height: 70px; }
    .card { background: #fff; border: 1px solid #dde6f0; border-radius: 10px; padding: 16px; margin-bottom: 12px; position: relative; }
    .btn { padding: 9px 18px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; border-radius: 6px; }
    .btn-add  { background: #e8f5e9; color: #2e7d32; margin-bottom: 8px; }
    .btn-del  { position: absolute; top: 12px; right: 12px; background: #fdecea; color: #c62828; font-size: 12px; padding: 5px 10px; }
    .btn-save { background: #1e2d4d; color: #fff; margin-top: 24px; padding: 13px 32px; font-size: 15px; width: 100%; border-radius: 8px; }
    .btn-save:hover { opacity: .9; }
    .success { background: #e8f5e9; color: #2e7d32; padding: 12px 16px; border-radius: 6px; margin-top: 16px; display: none; font-weight: 600; }
    .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media(max-width:500px) { .row2 { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
<div class="wrap">
  <h1>Editar CV</h1>

  <h2>Datos personales</h2>
  <div class="row2">
    <div class="field"><label>Nombre</label><input id="p-nombre" value="${esc(profile.nombre || profile.name || '')}"></div>
    <div class="field"><label>Apellidos</label><input id="p-apellidos" value="${esc(profile.apellidos || '')}"></div>
  </div>
  <div class="row2">
    <div class="field"><label>Ciudad</label><input id="p-city" value="${esc(profile.city || '')}"></div>
    <div class="field"><label>Teléfono</label><input id="p-phone" value="${esc(profile.phone || '')}"></div>
  </div>
  <div class="field"><label>Email</label><input id="p-email" type="email" value="${esc(profile.email || '')}"></div>

  <h2>Experiencia laboral</h2>
  <div id="jobs"></div>
  <button class="btn btn-add" onclick="addJob()">+ Agregar empleo</button>

  <h2>Educación</h2>
  <div id="education"></div>
  <button class="btn btn-add" onclick="addEdu()">+ Agregar formación</button>

  <h2>Habilidades e idiomas</h2>
  <div class="field">
    <label>Habilidades (separadas por coma)</label>
    <textarea id="habilidades">${esc(habilidades)}</textarea>
  </div>
  <div class="field">
    <label>Idiomas (separados por coma)</label>
    <input id="idiomas" value="${esc(idiomas)}">
  </div>

  <button class="btn btn-save" onclick="save()">Guardar cambios</button>
  <div class="success" id="ok">Cambios guardados correctamente.</div>
</div>

<script>
  let jobs = ${jobsJson};
  let education = ${educationJson};

  function esc(s) { return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  function renderJobs() {
    document.getElementById('jobs').innerHTML = jobs.map((j, i) => \`
      <div class="card">
        <button class="btn btn-del" onclick="jobs.splice(\${i},1);renderJobs()">Eliminar</button>
        <div class="field"><label>Empresa</label><input placeholder="Nombre empresa" value="\${esc(j.name)}" oninput="jobs[\${i}].name=this.value"></div>
        <div class="row2">
          <div class="field"><label>Puesto</label><input placeholder="Ej: Camarero/a" value="\${esc(j.position)}" oninput="jobs[\${i}].position=this.value"></div>
          <div class="field"><label>Duración</label><input placeholder="Ej: 2 años" value="\${esc(j.duration)}" oninput="jobs[\${i}].duration=this.value"></div>
        </div>
        <div class="field"><label>Descripción (opcional)</label><textarea placeholder="Tareas realizadas..." oninput="jobs[\${i}].descripcion=this.value">\${esc(j.descripcion||'')}</textarea></div>
      </div>
    \`).join('');
  }

  function addJob() {
    jobs.push({ name:'', position:'', duration:'', descripcion:'', is_real:true });
    renderJobs();
  }

  function renderEdu() {
    document.getElementById('education').innerHTML = education.map((e, i) => \`
      <div class="card">
        <button class="btn btn-del" onclick="education.splice(\${i},1);renderEdu()">Eliminar</button>
        <div class="row2">
          <div class="field"><label>Título</label><input placeholder="Ej: Bachillerato" value="\${esc(e.titulo)}" oninput="education[\${i}].titulo=this.value"></div>
          <div class="field"><label>Año</label><input placeholder="Ej: 2020" value="\${esc(e.anio)}" oninput="education[\${i}].anio=this.value"></div>
        </div>
        <div class="field"><label>Institución</label><input placeholder="Ej: IES García Lorca" value="\${esc(e.institucion)}" oninput="education[\${i}].institucion=this.value"></div>
      </div>
    \`).join('');
  }

  function addEdu() {
    education.push({ titulo:'', anio:'', institucion:'' });
    renderEdu();
  }

  async function save() {
    const btn = document.querySelector('.btn-save');
    btn.textContent = 'Guardando...';
    btn.disabled = true;

    const profile = {
      nombre: document.getElementById('p-nombre').value.trim(),
      apellidos: document.getElementById('p-apellidos').value.trim(),
      city: document.getElementById('p-city').value.trim(),
      phone: document.getElementById('p-phone').value.trim(),
      email: document.getElementById('p-email').value.trim(),
    };

    const habilidades = document.getElementById('habilidades').value
      .split(',').map(s => s.trim()).filter(Boolean);
    const idiomas = document.getElementById('idiomas').value
      .split(',').map(s => s.trim()).filter(Boolean);

    const resp = await fetch('/editar/${userId}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs, education, profile, skills: { habilidades, idiomas } })
    });

    btn.textContent = 'Guardar cambios';
    btn.disabled = false;

    if (resp.ok) {
      document.getElementById('ok').style.display = 'block';
      setTimeout(() => { window.location.href = '/cv/${userId}?token=' + (await resp.json()).token; }, 1200);
    } else {
      alert('Error al guardar');
    }
  }

  renderJobs();
  renderEdu();
</script>
</body>
</html>`);
});

router.post('/:userId', requireOwner, (req, res) => {
  const db = getDb();
  const userId = req.targetUser.id;
  const { jobs, education, profile, skills } = req.body;

  if (!Array.isArray(jobs)) return res.status(400).json({ error: 'jobs debe ser un array' });

  const sanitizedJobs = jobs.map(j => ({
    name: String(j.name || '').slice(0, 200),
    position: String(j.position || '').slice(0, 100),
    duration: String(j.duration || '').slice(0, 100),
    descripcion: String(j.descripcion || '').slice(0, 500),
    is_real: true,
  }));

  const sanitizedEdu = Array.isArray(education) ? education.map(e => ({
    titulo: String(e.titulo || '').slice(0, 200),
    anio: String(e.anio || '').slice(0, 10),
    institucion: String(e.institucion || '').slice(0, 200),
  })) : [];

  const sanitizedProfile = {
    nombre: String(profile?.nombre || '').slice(0, 100),
    apellidos: String(profile?.apellidos || '').slice(0, 100),
    city: String(profile?.city || '').slice(0, 100),
    phone: String(profile?.phone || '').slice(0, 30),
    email: String(profile?.email || '').slice(0, 200),
  };

  const sanitizedSkills = {
    habilidades: Array.isArray(skills?.habilidades) ? skills.habilidades.map(s => String(s).slice(0, 50)).slice(0, 20) : [],
    idiomas: Array.isArray(skills?.idiomas) ? skills.idiomas.map(s => String(s).slice(0, 50)).slice(0, 10) : [],
  };

  const existing = db.prepare('SELECT id FROM cv_data WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare(`UPDATE cv_data SET jobs=?, ai_suggested_jobs='[]', profile=?, education=?, skills=?,
      version=version+1, updated_at=datetime('now') WHERE user_id=?`)
      .run(JSON.stringify(sanitizedJobs), JSON.stringify(sanitizedProfile),
           JSON.stringify(sanitizedEdu), JSON.stringify(sanitizedSkills), userId);
  } else {
    db.prepare(`INSERT INTO cv_data (user_id, jobs, profile, education, skills) VALUES (?,?,?,?,?)`)
      .run(userId, JSON.stringify(sanitizedJobs), JSON.stringify(sanitizedProfile),
           JSON.stringify(sanitizedEdu), JSON.stringify(sanitizedSkills));
  }

  const user = db.prepare('SELECT view_token FROM users WHERE id = ?').get(userId);
  res.json({ ok: true, token: user.view_token });
});

function safeJson(val, fallback) {
  if (val == null) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function escAttr(str) {
  return str.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = router;
