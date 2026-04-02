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
  const photo = profile.photo || null;

  const contactItems = [
    profile.phone ? { icon: '📞', text: profile.phone } : null,
    profile.city  ? { icon: '📍', text: profile.city } : null,
    profile.email ? { icon: '✉',  text: profile.email } : null,
  ].filter(Boolean);

  const contactHtml = contactItems.map(c => `
    <div class="sidebar-contact-item">
      <span class="sidebar-icon">${c.icon}</span>
      <span>${escHtml(c.text)}</span>
    </div>
  `).join('');

  const jobsHtml = allJobs.length ? allJobs.map(job => `
    <div class="cv-entry">
      <div class="cv-entry-top">
        <strong class="cv-entry-title">${escHtml(job.name || job.empresa || '')}</strong>
        <span class="cv-entry-date">${escHtml(job.duration || job.fechas || '')}</span>
      </div>
      <span class="cv-entry-sub">${escHtml(job.position || job.cargo || '')}</span>
      ${job.descripcion ? `<ul class="cv-entry-desc">${job.descripcion.split(/[,;·\n]/).filter(s=>s.trim()).map(s=>`<li>${escHtml(s.trim())}</li>`).join('')}</ul>` : ''}
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

  const showWatermark = options.watermark === true;
  const watermarkHtml = showWatermark ? `
    <div class="cv-watermark" aria-hidden="true">
      <div class="cv-watermark-inner">WEBCV · WEBCV · WEBCV · WEBCV · WEBCV · WEBCV · WEBCV · WEBCV</div>
    </div>` : '';

  const payButton = options.showPayButton ? `
    <div class="cv-pay-bar">
      <p class="cv-pay-note">Descarga el PDF sin marca de agua por un pago unico de <strong>5 EUR</strong>.</p>
      <div class="cv-pay-actions">
        <form action="/create-checkout-session" method="POST">
          <input type="hidden" name="userId" value="${user.id}">
          <button type="submit" class="btn-pay">Descargar PDF — 5 EUR</button>
        </form>
        <a href="/editar/${user.id}" class="cv-edit-link">Editar CV</a>
      </div>
    </div>` : '';

  const photoHtml = photo
    ? `<div class="sidebar-photo"><img src="${escHtml(photo)}" alt="Foto de perfil"></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV — ${escHtml(displayName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700;800&family=Source+Sans+3:wght@400;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Source Sans 3', sans-serif; background: #eef2f7; color: #1a2535; }

    .cv-page-wrap { max-width: 920px; margin: 36px auto; padding: 0 16px 80px; position: relative; }

    /* Watermark */
    .cv-watermark { position: absolute; inset: 0 16px 80px; pointer-events: none; overflow: hidden; z-index: 10; border-radius: 14px; }
    .cv-watermark-inner { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-size: 28px; font-weight: 900; color: rgba(58,124,165,0.10); white-space: nowrap; letter-spacing: 8px; font-family: 'Raleway', sans-serif; width: 220%; text-align: center; line-height: 3.2; }

    /* Layout */
    .cv-card { display: grid; grid-template-columns: 220px 1fr; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 40px rgba(26,37,53,0.15); background: #fff; }

    /* Sidebar */
    .cv-sidebar { background: #1e2d4d; color: #fff; padding: 36px 22px; display: flex; flex-direction: column; gap: 24px; }

    .sidebar-photo { width: 100px; height: 100px; border-radius: 50%; overflow: hidden; border: 3px solid rgba(255,255,255,0.25); margin: 0 auto 4px; flex-shrink: 0; }
    .sidebar-photo img { width: 100%; height: 100%; object-fit: cover; }

    .cv-sidebar-name { font-family: 'Raleway', sans-serif; text-align: ${photo ? 'center' : 'left'}; }
    .cv-sidebar-name .first { font-size: 20px; font-weight: 800; line-height: 1.15; display: block; }
    .cv-sidebar-name .last  { font-size: 20px; font-weight: 400; line-height: 1.15; display: block; color: #a8c5e8; }

    .sidebar-divider { height: 1px; background: rgba(255,255,255,0.12); margin: 0; }
    .sidebar-section-title { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 2.5px; color: #7aa8d0; margin-bottom: 10px; }

    .sidebar-contact-item { display: flex; align-items: flex-start; gap: 9px; font-size: 12px; color: rgba(255,255,255,0.82); line-height: 1.5; margin-bottom: 7px; word-break: break-word; }
    .sidebar-icon { flex-shrink: 0; font-size: 13px; margin-top: 1px; }

    .sidebar-tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .sidebar-tag { display: inline-block; background: rgba(255,255,255,0.10); color: rgba(255,255,255,0.88); font-size: 11px; padding: 3px 9px; border-radius: 12px; }
    .sidebar-tag-lang { background: rgba(76,175,80,0.22); color: #a5d6a7; }

    /* Main */
    .cv-main { padding: 40px 44px 40px 40px; }

    .cv-main-header { padding-bottom: 20px; margin-bottom: 28px; border-bottom: 3px solid #e8f0f7; }
    .cv-main-fullname { font-family: 'Raleway', sans-serif; font-size: 36px; font-weight: 800; color: #1e2d4d; line-height: 1.1; letter-spacing: -0.5px; }
    .cv-main-role { font-size: 13px; font-weight: 700; color: #3a7ca5; margin-top: 6px; text-transform: uppercase; letter-spacing: 1.5px; }

    .cv-section { margin-bottom: 28px; }
    .cv-section-title { font-family: 'Raleway', sans-serif; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #1e2d4d; margin-bottom: 16px; padding-bottom: 6px; border-bottom: 2px solid #3a7ca5; }

    .cv-entry { margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid #f0f4f8; }
    .cv-entry:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .cv-entry-top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 3px; }
    .cv-entry-title { font-size: 14px; font-weight: 700; color: #1a2535; }
    .cv-entry-date { font-size: 11px; color: #3a7ca5; font-weight: 700; background: #e8f0f7; padding: 2px 10px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; }
    .cv-entry-sub { font-size: 12px; color: #3a7ca5; font-weight: 600; display: block; margin-bottom: 5px; }
    .cv-entry-desc { font-size: 12px; color: #4a5a6a; margin-top: 5px; line-height: 1.7; padding-left: 14px; }
    .cv-entry-desc li { margin-bottom: 2px; }
    .cv-empty { font-size: 12px; color: #aaa; font-style: italic; }

    /* Pay bar */
    .cv-pay-bar { background: #f4f8fc; border-top: 2px solid #e0eaf4; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; }
    .cv-pay-note { font-size: 13px; color: #5a6a7a; }
    .cv-pay-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .btn-pay { background: linear-gradient(135deg, #4caf50, #388e3c); color: #fff; border: none; padding: 12px 28px; font-size: 14px; font-weight: 700; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 8px rgba(76,175,80,0.3); transition: opacity 0.2s; }
    .btn-pay:hover { opacity: 0.9; }
    .cv-edit-link { font-size: 13px; color: #3a7ca5; text-decoration: none; font-weight: 600; }
    .cv-edit-link:hover { text-decoration: underline; }

    @media (max-width: 680px) {
      .cv-card { grid-template-columns: 1fr; }
      .cv-sidebar { padding: 28px 20px; }
      .cv-main { padding: 28px 22px; }
      .cv-pay-bar { padding: 16px 22px; }
      .cv-main-fullname { font-size: 26px; }
    }
    @media print {
      body { background: #fff; }
      .cv-page-wrap { margin: 0; padding: 0; }
      .cv-card { box-shadow: none; border-radius: 0; }
      .cv-pay-bar, .cv-watermark { display: none; }
    }
  </style>
</head>
<body>
  <div class="cv-page-wrap">
    ${watermarkHtml}
    <div class="cv-card">
      <aside class="cv-sidebar">
        ${photoHtml}
        <div class="cv-sidebar-name">
          <span class="first">${escHtml(firstName || displayName)}</span>
          ${lastName ? `<span class="last">${escHtml(lastName)}</span>` : ''}
        </div>

        ${contactItems.length ? `
          <div class="sidebar-divider"></div>
          <div>
            <div class="sidebar-section-title">Contacto</div>
            ${contactHtml}
          </div>
        ` : ''}

        ${skillsList.length ? `
          <div class="sidebar-divider"></div>
          <div>
            <div class="sidebar-section-title">Habilidades</div>
            <div class="sidebar-tags">${skillsList.map(s => `<span class="sidebar-tag">${escHtml(s)}</span>`).join('')}</div>
          </div>
        ` : ''}

        ${langList.length ? `
          <div class="sidebar-divider"></div>
          <div>
            <div class="sidebar-section-title">Idiomas</div>
            <div class="sidebar-tags">${langList.map(l => `<span class="sidebar-tag sidebar-tag-lang">${escHtml(l)}</span>`).join('')}</div>
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
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { renderCvHtml };
