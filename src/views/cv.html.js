function renderCvHtml(user, cvData, options = {}) {
  const profile = safeJson(cvData.profile, {});
  const jobs = cvData.jobs || [];
  const aiJobs = cvData.ai_suggested_jobs || [];
  const education = safeJson(cvData.education, []);
  const skillsData = safeJson(cvData.skills, {});

  const allJobs = [...jobs, ...aiJobs];
  const firstName = profile.nombre || profile.name || '';
  const lastName = profile.apellidos || '';
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || user.email || 'Candidato';
  const skillsList = Array.isArray(skillsData.habilidades) ? skillsData.habilidades : [];
  const langList = Array.isArray(skillsData.idiomas) ? skillsData.idiomas : [];

  // Sidebar contact items
  const contactItems = [
    profile.phone ? { icon: '📞', text: profile.phone } : null,
    profile.city  ? { icon: '📍', text: profile.city } : null,
    profile.email ? { icon: '✉', text: profile.email } : null,
  ].filter(Boolean);

  const contactHtml = contactItems.map(c => `
    <div class="sidebar-contact-item">
      <span class="sidebar-icon">${c.icon}</span>
      <span>${escHtml(c.text)}</span>
    </div>
  `).join('');

  const skillsTagsHtml = skillsList.map(s => `<span class="sidebar-tag">${escHtml(s)}</span>`).join('');
  const langsTagsHtml = langList.map(l => `<span class="sidebar-tag lang-tag">${escHtml(l)}</span>`).join('');

  const jobsHtml = allJobs.length ? allJobs.map(job => `
    <div class="cv-entry">
      <div class="cv-entry-top">
        <strong class="cv-entry-title">${escHtml(job.name || job.empresa || '')}</strong>
        <span class="cv-entry-date">${escHtml(job.duration || job.fechas || '')}</span>
      </div>
      <span class="cv-entry-sub">${escHtml(job.position || job.cargo || '')}</span>
      ${job.descripcion ? `<p class="cv-entry-desc">${escHtml(job.descripcion)}</p>` : ''}
    </div>
  `).join('') : '<p class="cv-empty">Sin experiencia registrada.</p>';

  const educationHtml = education.length ? education.map(e => `
    <div class="cv-entry">
      <div class="cv-entry-top">
        <strong class="cv-entry-title">${escHtml(e.titulo || '')}</strong>
        <span class="cv-entry-date">${escHtml(e.anio || '')}</span>
      </div>
      <span class="cv-entry-sub">${escHtml(e.institucion || '')}</span>
    </div>
  `).join('') : '';

  // Watermark shown in preview, hidden when printing (PDF generation has showPayButton: false and watermark: false)
  const showWatermark = options.watermark === true;
  const watermarkHtml = showWatermark ? `
    <div class="cv-watermark">
      <div class="cv-watermark-inner">WEBCV · WEBCV · WEBCV · WEBCV · WEBCV · WEBCV · WEBCV</div>
    </div>
  ` : '';

  const payButton = options.showPayButton ? `
    <div class="cv-pay-bar">
      <div>
        <p class="cv-pay-note">Descarga el PDF sin marca de agua por un pago unico de 2 EUR.</p>
      </div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <form action="/create-checkout-session" method="POST">
          <input type="hidden" name="userId" value="${user.id}">
          <button type="submit" class="btn-pay">Descargar PDF — 2 EUR</button>
        </form>
        <a href="/editar/${user.id}" class="cv-edit-link">Editar CV</a>
      </div>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV — ${escHtml(displayName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700;800&family=Open+Sans:wght@400;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Open Sans', sans-serif; background: #eef2f7; color: #2c3e50; }

    .cv-page-wrap { max-width: 900px; margin: 32px auto; padding: 0 16px 80px; position: relative; }

    /* Watermark */
    .cv-watermark { position: absolute; top: 0; left: 16px; right: 16px; bottom: 80px; pointer-events: none; overflow: hidden; z-index: 10; border-radius: 14px; }
    .cv-watermark-inner { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-size: 22px; font-weight: 800; color: rgba(58,124,165,0.13); white-space: nowrap; letter-spacing: 6px; font-family: 'Raleway', sans-serif; width: 200%; text-align: center; line-height: 3; }

    /* Card */
    .cv-card { display: grid; grid-template-columns: 240px 1fr; border-radius: 14px; overflow: hidden; box-shadow: 0 6px 32px rgba(44,62,80,0.13); background: #fff; }

    /* Sidebar */
    .cv-sidebar { background: #2c3e6e; color: #fff; padding: 40px 24px; display: flex; flex-direction: column; gap: 28px; }
    .cv-sidebar-name { font-family: 'Raleway', sans-serif; }
    .cv-sidebar-name .first { font-size: 26px; font-weight: 800; line-height: 1.1; display: block; }
    .cv-sidebar-name .last { font-size: 26px; font-weight: 400; line-height: 1.1; display: block; }
    .cv-sidebar-role { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #a8c5e8; margin-top: 8px; }

    .sidebar-section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #a8c5e8; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.15); }
    .sidebar-contact-item { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: rgba(255,255,255,0.85); line-height: 1.4; margin-bottom: 8px; }
    .sidebar-icon { flex-shrink: 0; font-size: 13px; margin-top: 1px; }
    .sidebar-tag { display: inline-block; background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.9); font-size: 11px; padding: 3px 10px; border-radius: 12px; margin: 3px 3px 3px 0; }
    .lang-tag { background: rgba(76,175,80,0.25); color: #a5d6a7; }

    /* Main content */
    .cv-main { padding: 40px 40px 40px 36px; }
    .cv-main-header { margin-bottom: 28px; padding-bottom: 20px; border-bottom: 3px solid #e8f4f8; }
    .cv-main-fullname { font-family: 'Raleway', sans-serif; font-size: 34px; font-weight: 800; color: #2c3e6e; line-height: 1.1; }
    .cv-main-role { font-size: 14px; font-weight: 600; color: #3a7ca5; margin-top: 6px; text-transform: uppercase; letter-spacing: 1px; }

    .cv-section { margin-bottom: 26px; }
    .cv-section-title { font-family: 'Raleway', sans-serif; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #2c3e6e; margin-bottom: 14px; padding-bottom: 5px; border-bottom: 2px solid #e8f4f8; }
    .cv-entry { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #f4f7fb; }
    .cv-entry:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .cv-entry-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .cv-entry-title { font-size: 14px; font-weight: 700; color: #2c3e50; }
    .cv-entry-date { font-size: 11px; color: #3a7ca5; font-weight: 700; background: #e8f4f8; padding: 2px 10px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; }
    .cv-entry-sub { font-size: 12px; color: #3a7ca5; font-weight: 600; display: block; margin-top: 3px; }
    .cv-entry-desc { font-size: 12px; color: #5a6a7a; margin-top: 6px; line-height: 1.65; }
    .cv-empty { font-size: 12px; color: #aaa; font-style: italic; }

    /* Pay bar */
    .cv-pay-bar { background: #f4f7fb; border-top: 2px solid #e8f4f8; padding: 20px 36px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .cv-pay-note { font-size: 13px; color: #5a6a7a; }
    .btn-pay { background: #4caf50; color: #fff; border: none; padding: 12px 28px; font-size: 14px; font-weight: 700; border-radius: 8px; cursor: pointer; }
    .btn-pay:hover { background: #388e3c; }
    .cv-edit-link { font-size: 13px; color: #3a7ca5; text-decoration: none; }
    .cv-edit-link:hover { text-decoration: underline; }

    @media (max-width: 680px) {
      .cv-card { grid-template-columns: 1fr; }
      .cv-sidebar { padding: 28px 20px; }
      .cv-main { padding: 24px 20px; }
      .cv-pay-bar { padding: 16px 20px; flex-direction: column; align-items: flex-start; }
    }
    @media print {
      body { background: #fff; }
      .cv-page-wrap { margin: 0; padding: 0; }
      .cv-card { box-shadow: none; border-radius: 0; }
      .cv-pay-bar { display: none; }
      .cv-watermark { display: none; }
    }
  </style>
</head>
<body>
  <div class="cv-page-wrap">
    ${watermarkHtml}
    <div class="cv-card">
      <aside class="cv-sidebar">
        <div>
          <div class="cv-sidebar-name">
            <span class="first">${escHtml(firstName || displayName)}</span>
            ${lastName ? `<span class="last">${escHtml(lastName)}</span>` : ''}
          </div>
        </div>

        ${contactItems.length ? `
          <div>
            <div class="sidebar-section-title">Contacto</div>
            ${contactHtml}
          </div>
        ` : ''}

        ${skillsList.length ? `
          <div>
            <div class="sidebar-section-title">Habilidades</div>
            <div>${skillsTagsHtml}</div>
          </div>
        ` : ''}

        ${langList.length ? `
          <div>
            <div class="sidebar-section-title">Idiomas</div>
            <div>${langsTagsHtml}</div>
          </div>
        ` : ''}
      </aside>

      <main class="cv-main">
        <div class="cv-main-header">
          <div class="cv-main-fullname">${escHtml(displayName)}</div>
          ${allJobs.length ? `<div class="cv-main-role">${escHtml(allJobs[0].position || allJobs[0].cargo || '')}</div>` : ''}
        </div>

        <section class="cv-section">
          <h2 class="cv-section-title">Experiencia Profesional</h2>
          ${jobsHtml}
        </section>

        ${education.length ? `
          <section class="cv-section">
            <h2 class="cv-section-title">Formacion Academica</h2>
            ${educationHtml}
          </section>
        ` : ''}
      </main>
    </div>
    ${payButton}
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
