function renderCvHtml(user, cvData, options = {}) {
  const allJobs = [
    ...(cvData.jobs || []),
    ...(cvData.ai_suggested_jobs || []),
  ];

  const jobsHtml = allJobs.map(job => `
    <div class="job">
      <div class="job-header">
        <span class="job-name">${escHtml(job.name)}</span>
        <span class="job-position">${escHtml(job.position)}</span>
      </div>
      <div class="job-duration">${escHtml(job.duration)}</div>
    </div>
  `).join('');

  const payButton = options.showPayButton ? `
    <div class="pay-section">
      <form action="/create-checkout-session" method="POST">
        <input type="hidden" name="userId" value="${user.id}">
        <button type="submit" class="pay-btn">Descargar PDF por 2 EUR (pago unico)</button>
      </form>
      <a href="/editar/${user.id}" class="edit-link">Editar CV</a>
    </div>
  ` : '';

  // OWASP-FIX: A01 — Do not expose phone number on the public CV page (PII exposure).
  // Use email if available (Google users), otherwise show a generic identifier.
  const identifier = user.email || 'Candidato';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CV</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', serif; background: #f5f5f5; color: #222; }
    .page { max-width: 800px; margin: 40px auto; background: #fff; padding: 60px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    h1 { font-size: 28px; letter-spacing: 2px; border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 8px; }
    .contact { color: #555; font-size: 14px; margin-bottom: 32px; }
    h2 { font-size: 16px; text-transform: uppercase; letter-spacing: 1px; color: #444; margin: 24px 0 12px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .job { margin-bottom: 20px; }
    .job-header { display: flex; justify-content: space-between; align-items: baseline; }
    .job-name { font-weight: bold; font-size: 15px; }
    .job-position { font-style: italic; color: #555; font-size: 14px; }
    .job-duration { font-size: 13px; color: #888; margin-top: 2px; }
    .pay-section { margin-top: 40px; text-align: center; border-top: 1px solid #eee; padding-top: 24px; }
    .pay-btn { background: #635bff; color: #fff; border: none; padding: 14px 32px; font-size: 16px; border-radius: 6px; cursor: pointer; }
    .pay-btn:hover { background: #4b44cc; }
    .edit-link { display: inline-block; margin-top: 12px; font-size: 13px; color: #635bff; text-decoration: none; }
    .edit-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="page">
    <h1>${escHtml(identifier)}</h1>
    <div class="contact"></div>
    <h2>Experiencia Laboral</h2>
    ${jobsHtml || '<p>Sin empleos registrados.</p>'}
    ${payButton}
  </div>
</body>
</html>`;
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
