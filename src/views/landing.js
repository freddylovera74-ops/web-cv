const JOBS = [
  { title: 'Repartidor/a de paqueteria', company: 'GLS Spain', location: 'Madrid', type: 'Jornada completa' },
  { title: 'Operario/a de almacen', company: 'Amazon Logistics', location: 'Getafe, Madrid', type: 'Turno rotativo' },
  { title: 'Auxiliar de farmacia', company: 'Farmacia Central', location: 'Barcelona', type: 'Media jornada' },
  { title: 'Mozo/a de almacen', company: 'Decathlon', location: 'Valencia', type: 'Jornada completa' },
  { title: 'Conductor/a de reparto', company: 'Correos Express', location: 'Sevilla', type: 'Jornada completa' },
  { title: 'Tecnico/a de farmacia', company: 'Grupo Cofares', location: 'Zaragoza', type: 'Contrato indefinido' },
];

const NEWS = [
  {
    company: 'Amazon',
    headline: 'Amazon abre nuevo centro logistico en Zaragoza y crea 1.200 empleos',
    body: 'La compania busca operarios de almacen, conductores y tecnicos de mantenimiento. Las solicitudes se pueden presentar directamente en su portal de empleo.',
    tag: 'Logistica',
  },
  {
    company: 'GLS Spain',
    headline: 'GLS Spain refuerza su flota y contrata 400 repartidores para la campana de verano',
    body: 'La empresa de paqueteria busca conductores con permiso B en mas de 20 provincias. Ofrece contrato de 6 meses con posibilidad de renovacion.',
    tag: 'Reparto',
  },
  {
    company: 'Novartis',
    headline: 'Novartis lanza programa de contratacion de auxiliares de farmacia en toda Espana',
    body: 'La farmaceutica suiza busca perfiles con FP en Farmacia o experiencia en atencion al publico. No se requiere titulacion universitaria.',
    tag: 'Farmacia',
  },
  {
    company: 'Pfizer',
    headline: 'Pfizer busca operarios de produccion para su planta de Guadalajara',
    body: 'La compania ofrece formacion a cargo de la empresa, salario base de 1.800 EUR y beneficios sociales. Solo se requiere ESO o Bachillerato.',
    tag: 'Industria',
  },
  {
    company: 'Decathlon',
    headline: 'Decathlon necesita 500 personas para sus almacenes antes del Black Friday',
    body: 'La cadena deportiva refuerza su logistica interna. Busca mozos de almacen, carretilleros y auxiliares administrativos en toda la peninsula.',
    tag: 'Almacen',
  },
  {
    company: 'Correos Express',
    headline: 'Correos Express incorpora conductores autonomos con contrato mercantil',
    body: 'La empresa de mensajeria ofrece rutas fijas, camioneta de empresa y remuneracion variable segun volumetria. Minimo 1 ano de carnet B.',
    tag: 'Reparto',
  },
];

function renderLanding(user) {
  const loginOrDashboard = user
    ? `<a href="/cv/${user.id}" class="btn-primary">Ver mi CV</a>`
    : `<a href="/auth/google" class="btn-primary">Empezar gratis con Google</a>`;

  const waNumber = process.env.WHATSAPP_NUMBER || '';

  const jobsHtml = JOBS.map(j => `
    <div class="job-card">
      <div class="job-card-body">
        <span class="job-tag">${escHtml(j.type)}</span>
        <h3 class="job-title">${escHtml(j.title)}</h3>
        <p class="job-company">${escHtml(j.company)}</p>
        <p class="job-location">📍 ${escHtml(j.location)}</p>
      </div>
      <div class="job-card-footer">
        <button class="btn-interest" onclick="showInterest(this)">Me interesa</button>
      </div>
    </div>
  `).join('');

  const newsHtml = NEWS.map(n => `
    <div class="news-card">
      <div class="news-header">
        <span class="news-company">${escHtml(n.company)}</span>
        <span class="news-tag">${escHtml(n.tag)}</span>
      </div>
      <h3 class="news-title">${escHtml(n.headline)}</h3>
      <p class="news-body">${escHtml(n.body)}</p>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CreaCV — Tu CV profesional en minutos</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Raleway:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { font-family: 'Inter', sans-serif; color: #1a2535; background: #fff; line-height: 1.6; }

    /* NAV */
    nav { display: flex; justify-content: space-between; align-items: center; padding: 18px 56px; border-bottom: 1px solid #e8f0f7; background: #fff; position: sticky; top: 0; z-index: 100; }
    .nav-logo { font-family: 'Raleway', sans-serif; font-size: 22px; font-weight: 800; color: #1e2d4d; text-decoration: none; }
    .nav-logo span { color: #4caf50; }
    .nav-links { display: flex; gap: 12px; align-items: center; }
    .btn-nav { padding: 9px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; border: 2px solid transparent; transition: all 0.2s; }
    .btn-nav-outline { color: #3a7ca5; border-color: #3a7ca5; }
    .btn-nav-outline:hover { background: #e8f0f7; }
    .btn-nav-solid { background: #4caf50; color: #fff; }
    .btn-nav-solid:hover { background: #388e3c; }

    /* HERO */
    .hero { background: linear-gradient(155deg, #e8f0f7 0%, #e8f5e9 100%); padding: 88px 56px 80px; text-align: center; }
    .hero-badge { display: inline-block; background: #e8f5e9; color: #2e7d32; font-size: 13px; font-weight: 700; padding: 5px 16px; border-radius: 20px; margin-bottom: 22px; letter-spacing: 0.3px; }
    .hero h1 { font-family: 'Raleway', sans-serif; font-size: clamp(34px, 5vw, 58px); font-weight: 800; color: #1e2d4d; line-height: 1.12; margin-bottom: 20px; }
    .hero h1 em { color: #3a7ca5; font-style: normal; }
    .hero p { font-size: 18px; color: #4a5a6a; max-width: 540px; margin: 0 auto 38px; }
    .hero-ctas { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-bottom: 16px; }
    .btn-primary { background: #1e2d4d; color: #fff; padding: 15px 34px; border-radius: 10px; font-size: 16px; font-weight: 700; text-decoration: none; display: inline-block; transition: background 0.2s, transform 0.15s; border: none; cursor: pointer; }
    .btn-primary:hover { background: #2c4270; transform: translateY(-2px); }
    .btn-whatsapp { background: #25d366; color: #fff; padding: 15px 34px; border-radius: 10px; font-size: 16px; font-weight: 700; text-decoration: none; display: inline-block; transition: background 0.2s; }
    .btn-whatsapp:hover { background: #1da851; }
    .hero-note { font-size: 13px; color: #8a9aaa; }

    /* SHARED SECTION STYLES */
    section { padding: 72px 56px; }
    .section-eyebrow { text-align: center; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #3a7ca5; margin-bottom: 10px; }
    .section-title { text-align: center; font-family: 'Raleway', sans-serif; font-size: clamp(26px, 3vw, 38px); font-weight: 800; color: #1e2d4d; margin-bottom: 48px; }

    /* PATHS */
    .paths { background: #fff; }
    .paths-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 860px; margin: 0 auto; }
    .path-card { border-radius: 16px; padding: 36px 32px; border: 2px solid transparent; transition: box-shadow 0.2s; }
    .path-card:hover { box-shadow: 0 8px 32px rgba(30,45,77,0.1); }
    .path-web { background: #e8f0f7; border-color: #3a7ca5; }
    .path-wa  { background: #e8f5e9; border-color: #4caf50; }
    .path-icon { font-size: 36px; margin-bottom: 14px; }
    .path-card h3 { font-size: 20px; font-weight: 700; margin-bottom: 10px; color: #1a2535; }
    .path-card p  { font-size: 14px; color: #4a5a6a; margin-bottom: 20px; line-height: 1.65; }
    .btn-path { display: inline-block; padding: 11px 24px; border-radius: 8px; font-size: 14px; font-weight: 700; text-decoration: none; }
    .path-web .btn-path { background: #1e2d4d; color: #fff; }
    .path-wa  .btn-path { background: #25d366; color: #fff; }

    /* STEPS */
    .steps { background: linear-gradient(155deg, #e8f0f7, #e8f5e9); }
    .steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; max-width: 860px; margin: 0 auto; }
    .step { text-align: center; }
    .step-num { width: 52px; height: 52px; border-radius: 50%; background: #1e2d4d; color: #fff; font-family: 'Raleway', sans-serif; font-size: 22px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
    .step h3 { font-size: 17px; font-weight: 700; margin-bottom: 8px; color: #1a2535; }
    .step p  { font-size: 14px; color: #4a5a6a; }

    /* JOBS */
    .jobs-section { background: #fff; }
    .jobs-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 1060px; margin: 0 auto; }
    .job-card { border: 2px solid #e8f0f7; border-radius: 12px; overflow: hidden; transition: box-shadow 0.2s, border-color 0.2s; display: flex; flex-direction: column; }
    .job-card:hover { border-color: #3a7ca5; box-shadow: 0 6px 24px rgba(58,124,165,0.10); }
    .job-card-body { padding: 20px 20px 14px; flex: 1; }
    .job-tag { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #3a7ca5; background: #e8f0f7; padding: 3px 10px; border-radius: 12px; display: inline-block; margin-bottom: 10px; }
    .job-title { font-size: 15px; font-weight: 700; color: #1a2535; margin-bottom: 5px; line-height: 1.3; }
    .job-company { font-size: 13px; color: #3a7ca5; font-weight: 600; margin-bottom: 4px; }
    .job-location { font-size: 12px; color: #7a8a9a; }
    .job-card-footer { padding: 12px 20px 16px; border-top: 1px solid #f0f4f8; }
    .btn-interest { width: 100%; padding: 9px; background: #1e2d4d; color: #fff; border: none; border-radius: 7px; font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
    .btn-interest:hover { background: #2c4270; }
    .btn-interest.clicked { background: #4caf50; cursor: default; }

    /* NEWS */
    .news-section { background: #f4f8fc; }
    .news-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; max-width: 1060px; margin: 0 auto; }
    .news-card { background: #fff; border-radius: 12px; padding: 24px; border: 1px solid #e8f0f7; transition: box-shadow 0.2s; }
    .news-card:hover { box-shadow: 0 4px 20px rgba(30,45,77,0.08); }
    .news-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .news-company { font-size: 12px; font-weight: 700; color: #1e2d4d; text-transform: uppercase; letter-spacing: 0.8px; }
    .news-tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #4caf50; background: #e8f5e9; padding: 2px 9px; border-radius: 12px; }
    .news-title { font-size: 14px; font-weight: 700; color: #1a2535; line-height: 1.4; margin-bottom: 8px; }
    .news-body { font-size: 13px; color: #5a6a7a; line-height: 1.65; }

    /* PRICE */
    .price { background: #fff; text-align: center; }
    .price-card { display: inline-block; background: linear-gradient(135deg, #1e2d4d 0%, #2c4270 100%); color: #fff; border-radius: 20px; padding: 52px 60px; max-width: 460px; width: 100%; box-shadow: 0 12px 48px rgba(30,45,77,0.18); }
    .price-amount { font-family: 'Raleway', sans-serif; font-size: 72px; font-weight: 800; line-height: 1; }
    .price-amount sup { font-size: 28px; vertical-align: top; margin-top: 14px; display: inline-block; }
    .price-desc { font-size: 16px; opacity: 0.8; margin: 12px 0 28px; }
    .price-features { list-style: none; text-align: left; margin-bottom: 32px; display: inline-block; }
    .price-features li { font-size: 14px; padding: 5px 0; opacity: 0.9; }
    .price-features li::before { content: '✓  '; font-weight: 800; color: #81c784; }

    /* CTA */
    .cta { background: #1e2d4d; color: #fff; text-align: center; }
    .cta h2 { font-family: 'Raleway', sans-serif; font-size: clamp(24px, 3vw, 38px); font-weight: 800; margin-bottom: 14px; }
    .cta p  { font-size: 16px; opacity: 0.7; margin-bottom: 32px; }
    .btn-cta { background: #4caf50; color: #fff; padding: 16px 40px; border-radius: 10px; font-size: 17px; font-weight: 700; text-decoration: none; display: inline-block; transition: background 0.2s; }
    .btn-cta:hover { background: #388e3c; }

    footer { background: #131d2e; color: #6a7a8a; text-align: center; padding: 28px; font-size: 13px; }

    @media (max-width: 900px) {
      .jobs-grid, .news-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 640px) {
      nav, section { padding-left: 20px; padding-right: 20px; }
      .hero { padding: 56px 20px; }
      .paths-grid, .steps-grid, .jobs-grid, .news-grid { grid-template-columns: 1fr; }
      .price-card { padding: 40px 28px; }
    }
  </style>
</head>
<body>

<nav>
  <a class="nav-logo" href="/">Crea<span>CV</span></a>
  <div class="nav-links">
    <a href="#empleos" class="btn-nav btn-nav-outline">Ver empleos</a>
    ${user
      ? `<a href="/cv/${user.id}" class="btn-nav btn-nav-solid">Mi CV</a>`
      : `<a href="/auth/google" class="btn-nav btn-nav-solid">Entrar con Google</a>`
    }
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="hero-badge">Solo 5 EUR · Pago unico · Sin suscripcion</div>
  <h1>Tu CV profesional,<br><em>listo en minutos</em></h1>
  <p>Rellena un formulario sencillo, anade tu foto si quieres, y descarga un PDF impecable listo para enviar.</p>
  <div class="hero-ctas">
    ${user
      ? `<a href="/crear" class="btn-primary">Crear mi CV ahora</a>`
      : `<a href="/auth/google" class="btn-primary">Empezar con Google — es gratis</a>`
    }
    <a href="https://wa.me/${waNumber}" class="btn-whatsapp">💬 Crear por WhatsApp</a>
  </div>
  <p class="hero-note">Crea gratis, descarga el PDF sin marca de agua por 5 EUR. Sin registro previo por WhatsApp.</p>
</section>

<!-- CAMINOS -->
<section class="paths">
  <p class="section-eyebrow">Dos formas de crear tu CV</p>
  <h2 class="section-title">Elige como prefieres</h2>
  <div class="paths-grid">
    <div class="path-card path-web">
      <div class="path-icon">🖥️</div>
      <h3>Formulario web</h3>
      <p>Rellena nombre, experiencia, educacion y habilidades paso a paso. Anade una foto opcional. Ve la vista previa antes de pagar.</p>
      ${user
        ? `<a href="/crear" class="btn-path">Crear mi CV</a>`
        : `<a href="/auth/google" class="btn-path">Entrar con Google</a>`
      }
    </div>
    <div class="path-card path-wa">
      <div class="path-icon">💬</div>
      <h3>Por WhatsApp</h3>
      <p>Habla con nuestro bot desde el movil. El te guia por todo el proceso sin necesidad de formularios ni registro web.</p>
      <a href="https://wa.me/${waNumber}" class="btn-path">Abrir WhatsApp</a>
    </div>
  </div>
</section>

<!-- PASOS -->
<section class="steps">
  <p class="section-eyebrow">Como funciona</p>
  <h2 class="section-title">3 pasos simples</h2>
  <div class="steps-grid">
    <div class="step">
      <div class="step-num">1</div>
      <h3>Rellena tu perfil</h3>
      <p>Nombre, experiencia, estudios y habilidades. Opcional: sube una foto de perfil.</p>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <h3>Previsualiza tu CV</h3>
      <p>Revisa como queda antes de pagar. Puedes volver atras y editar cualquier dato.</p>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <h3>Descarga el PDF</h3>
      <p>Paga 5 EUR una sola vez y obtén tu CV en PDF profesional, sin marca de agua.</p>
    </div>
  </div>
</section>

<!-- EMPLEOS -->
<section class="jobs-section" id="empleos">
  <p class="section-eyebrow">Busca trabajo</p>
  <h2 class="section-title">Empleos disponibles ahora</h2>
  <div class="jobs-grid">${jobsHtml}</div>
  <p style="text-align:center;margin-top:28px;font-size:13px;color:#8a9aaa;">Empleos orientativos. Pulsa "Me interesa" para guardar y preparar tu candidatura con un CV profesional.</p>
</section>

<!-- NOTICIAS -->
<section class="news-section">
  <p class="section-eyebrow">Mercado laboral</p>
  <h2 class="section-title">Grandes empresas contratando</h2>
  <div class="news-grid">${newsHtml}</div>
  <p style="text-align:center;margin-top:28px;font-size:13px;color:#8a9aaa;">Informacion periodicamente actualizada sobre oportunidades en empresas lideres de logistica, farmacia e industria.</p>
</section>

<!-- PRECIO -->
<section class="price">
  <p class="section-eyebrow">Precio</p>
  <h2 class="section-title" style="margin-bottom:40px;">Simple y honesto</h2>
  <div class="price-card">
    <div class="price-amount"><sup>€</sup>5</div>
    <p class="price-desc">Pago unico por descarga. Sin suscripciones.</p>
    <ul class="price-features">
      <li>CV en PDF de alta calidad</li>
      <li>Diseno profesional imprimible</li>
      <li>Foto de perfil opcional incluida</li>
      <li>Edicion ilimitada del borrador</li>
      <li>Nueva descarga tras editar = 5 EUR</li>
    </ul>
    ${loginOrDashboard}
  </div>
</section>

<!-- CTA FINAL -->
<section class="cta">
  <h2>Empieza ahora. Es gratis hasta que descargues.</h2>
  <p>Sin tarjeta de credito. Sin suscripcion. Solo tu CV.</p>
  ${user
    ? `<a href="/crear" class="btn-cta">Crear mi CV</a>`
    : `<a href="/auth/google" class="btn-cta">Entrar con Google</a>`
  }
</section>

<footer>CreaCV &copy; ${new Date().getFullYear()} — Hecho para ayudarte a conseguir trabajo</footer>

<script>
  function showInterest(btn) {
    btn.textContent = '¡Guardado!';
    btn.classList.add('clicked');
    btn.disabled = true;
  }
</script>
</body>
</html>`;
}

function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { renderLanding };
