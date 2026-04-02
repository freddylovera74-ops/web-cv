function renderCvHtml(user, cvData, options = {}) {
  const profile = safeJson(cvData.profile, {});
  const jobs = cvData.jobs || [];
  const aiJobs = cvData.ai_suggested_jobs || [];
  const education = safeJson(cvData.education, []);
  const skillsData = safeJson(cvData.skills, {});

  const allJobs = [...jobs, ...aiJobs];
  const displayName = profile.name || user.email || 'Candidato';
  const contactParts = [profile.city, profile.email, profile.phone].filter(Boolean);

  const jobsHtml = allJobs.length ? allJobs.map(job => `
    <div class="cv-entry">
      <div class="cv-entry-header">
        <div>
          <span class="cv-entry-title">${escHtml(job.name || job.empresa || '')}</span>
          <span class="cv-entry-sub">${escHtml(job.position || job.cargo || '')}</span>
        </div>
        <span class="cv-entry-date">${escHtml(job.duration || job.fechas || '')}</span>
      </div>
      ${job.descripcion ? `<p class="cv-entry-desc">${escHtml(job.descripcion)}</p>` : ''}
    </div>
  `).join('') : '<p class="cv-empty">Sin experiencia registrada.</p>';

  const educationHtml = education.length ? education.map(e => `
    <div class="cv-entry">
      <div class="cv-entry-header">
        <div>
          <span class="cv-entry-title">${escHtml(e.titulo || '')}</span>
          <span class="cv-entry-sub">${escHtml(e.institucion || '')}</span>
        </div>
        <span class="cv-entry-date">${escHtml(e.anio || '')}</span>
      </div>
    </div>
  `).join('') : '';

  const skillsList = Array.isArray(skillsData.habilidades) ? skillsData.habilidades : [];
  const langList = Array.isArray(skillsData.idiomas) ? skillsData.idiomas : [];
  const skillsHtml = skillsList.length ? `
    <section class="cv-section">
      <h2 class="cv-section-title">Habilidades</h2>
      <div class="cv-tags">${skillsList.map(s => `<span class="cv-tag">${escHtml(s)}</span>`).join('')}</div>
    </section>
  ` : '';
  const langsHtml = langList.length ? `
    <section class="cv-section">
      <h2 class="cv-section-title">Idiomas</h2>
      <div class="cv-tags">${langList.map(l => `<span class="cv-tag cv-tag-lang">${escHtml(l)}</span>`).join('')}</div>
    </section>
  ` : '';

  const payButton = options.showPayButton ? `
    <div class="cv-pay-bar">
      <form action="/create-checkout-session" method="POST">
        <input type="hidden" name="userId" value="${user.id}">
        <button type="submit" class="btn-pay">Descargar PDF — 2 EUR</button>
      </form>
      <a href="/editar/${user.id}" class="cv-edit-link">Editar CV</a>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV — ${escHtml(displayName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f0f7fa; color: #2c3e50; }
    .cv-wrapper { max-width: 820px; margin: 32px auto; padding: 0 16px 60px; }
    .cv-card { background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(58,124,165,0.10); overflow: hidden; }
    .cv-header { background: linear-gradient(135deg, #3a7ca5 0%, #2c6490 100%); color: #fff; padding: 40px 48px 32px; }
    .cv-name { font-size: 32px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 6px; }
    .cv-contact { font-size: 14px; opacity: 0.85; display: flex; flex-wrap: wrap; gap: 16px; margin-top: 10px; }
    .cv-contact span::before { content: ''; }
    .cv-body { padding: 32px 48px; }
    .cv-section { margin-bottom: 28px; }
    .cv-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #3a7ca5; border-bottom: 2px solid #e8f4f8; padding-bottom: 6px; margin-bottom: 16px; }
    .cv-entry { margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid #f0f7fa; }
    .cv-entry:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .cv-entry-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .cv-entry-title { font-weight: 600; font-size: 15px; display: block; color: #2c3e50; }
    .cv-entry-sub { font-size: 13px; color: #5a6a7a; display: block; margin-top: 2px; }
    .cv-entry-date { font-size: 12px; color: #4caf50; font-weight: 600; white-space: nowrap; background: #e8f5e9; padding: 3px 10px; border-radius: 20px; flex-shrink: 0; }
    .cv-entry-desc { font-size: 13px; color: #5a6a7a; margin-top: 8px; line-height: 1.6; }
    .cv-empty { font-size: 13px; color: #aaa; font-style: italic; }
    .cv-tags { display: flex; flex-wrap: wrap; gap: 8px; }
    .cv-tag { background: #e8f4f8; color: #3a7ca5; font-size: 13px; font-weight: 500; padding: 4px 12px; border-radius: 20px; }
    .cv-tag-lang { background: #e8f5e9; color: #2e7d32; }
    .cv-pay-bar { background: #f0f7fa; border-top: 1px solid #dde; padding: 24px 48px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
    .btn-pay { background: #4caf50; color: #fff; border: none; padding: 13px 28px; font-size: 15px; font-weight: 600; border-radius: 8px; cursor: pointer; transition: background 0.2s; }
    .btn-pay:hover { background: #388e3c; }
    .cv-edit-link { font-size: 13px; color: #3a7ca5; text-decoration: none; }
    .cv-edit-link:hover { text-decoration: underline; }
    @media (max-width: 600px) {
      .cv-header, .cv-body { padding: 24px 20px; }
      .cv-pay-bar { padding: 20px; }
      .cv-name { font-size: 24px; }
      .cv-entry-header { flex-direction: column; }
    }
    @media print {
      body { background: #fff; }
      .cv-wrapper { margin: 0; padding: 0; }
      .cv-card { box-shadow: none; border-radius: 0; }
      .cv-pay-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="cv-wrapper">
    <div class="cv-card">
      <div class="cv-header">
        <div class="cv-name">${escHtml(displayName)}</div>
        ${contactParts.length ? `<div class="cv-contact">${contactParts.map(p => `<span>${escHtml(p)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="cv-body">
        <section class="cv-section">
          <h2 class="cv-section-title">Experiencia Laboral</h2>
          ${jobsHtml}
        </section>
        ${education.length ? `<section class="cv-section"><h2 class="cv-section-title">Educacion</h2>${educationHtml}</section>` : ''}
        ${skillsHtml}
        ${langsHtml}
      </div>
      ${payButton}
    </div>
  </div>
</body>
</html>`;
}

function safeJson(val, fallback) {
  if (val == null) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { renderCvHtml };
