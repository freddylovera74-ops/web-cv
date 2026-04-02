const router = require('express').Router();
const { getDb } = require('../db');
const { requireOwner } = require('../middleware/auth');

router.get('/:userId', requireOwner, (req, res) => {
  const db = getDb();
  const userId = req.targetUser.id;

  const cvData = db.prepare('SELECT * FROM cv_data WHERE user_id = ?').get(userId);
  const jobs = cvData ? JSON.parse(cvData.jobs || '[]') : [];

  const jobsJson = escAttr(JSON.stringify(jobs));

  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Editar CV</title>
  <style>
    body { font-family: sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; }
    h1 { margin-bottom: 24px; }
    .job-entry { border: 1px solid #ddd; padding: 16px; margin-bottom: 12px; border-radius: 6px; }
    .job-entry input { display: block; width: 100%; margin-bottom: 8px; padding: 8px; font-size: 14px; }
    .btn { padding: 10px 20px; font-size: 14px; cursor: pointer; }
    .btn-add { background: #28a745; color: #fff; border: none; border-radius: 4px; margin-bottom: 16px; }
    .btn-remove { background: #dc3545; color: #fff; border: none; border-radius: 4px; float: right; }
    .btn-save { background: #007bff; color: #fff; border: none; border-radius: 4px; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>Editar experiencia laboral</h1>
  <div id="jobs"></div>
  <button class="btn btn-add" onclick="addJob()">+ Agregar empleo</button>
  <br>
  <button class="btn btn-save" onclick="saveJobs()">Guardar cambios</button>

  <script>
    let jobs = ${jobsJson};

    function render() {
      const container = document.getElementById('jobs');
      container.innerHTML = jobs.map((job, i) => \`
        <div class="job-entry" id="job-\${i}">
          <button class="btn btn-remove" onclick="removeJob(\${i})">Eliminar</button>
          <input placeholder="Nombre del empleo" value="\${esc(job.name)}" oninput="jobs[\${i}].name = this.value">
          <input placeholder="Puesto" value="\${esc(job.position)}" oninput="jobs[\${i}].position = this.value">
          <input placeholder="Tiempo trabajado" value="\${esc(job.duration)}" oninput="jobs[\${i}].duration = this.value">
        </div>
      \`).join('');
    }

    function esc(s) {
      return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    function addJob() {
      jobs.push({ name: '', position: '', duration: '', is_real: true });
      render();
    }

    function removeJob(i) {
      jobs.splice(i, 1);
      render();
    }

    async function saveJobs() {
      const resp = await fetch('/editar/${userId}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs })
      });
      if (resp.ok) {
        window.location.href = '/cv/${userId}';
      } else {
        alert('Error al guardar');
      }
    }

    render();
  </script>
</body>
</html>`);
});

router.post('/:userId', requireOwner, (req, res) => {
  const db = getDb();
  const userId = req.targetUser.id;
  const jobs = req.body.jobs;

  if (!Array.isArray(jobs)) return res.status(400).json({ error: 'jobs debe ser un array' });

  const sanitized = jobs.map(j => ({
    name: String(j.name || '').slice(0, 200),
    position: String(j.position || '').slice(0, 100),
    duration: String(j.duration || '').slice(0, 100),
    is_real: true,
  }));

  const existing = db.prepare('SELECT id FROM cv_data WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare('UPDATE cv_data SET jobs = ?, ai_suggested_jobs = ?, version = version + 1, updated_at = datetime("now") WHERE user_id = ?')
      .run(JSON.stringify(sanitized), '[]', userId);
  } else {
    db.prepare('INSERT INTO cv_data (user_id, jobs) VALUES (?, ?)').run(userId, JSON.stringify(sanitized));
  }

  res.json({ ok: true });
});

function escAttr(str) {
  return str.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

module.exports = router;
