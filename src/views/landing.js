function renderLanding(user) {
  const loginOrDashboard = user
    ? `<a href="/cv/${user.id}" class="btn-primary">Ver mi CV</a>`
    : `<a href="/auth/google" class="btn-primary">Empezar gratis con Google</a>`;

  const waNumber = process.env.WHATSAPP_NUMBER || '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CreaCV — Tu CV profesional en minutos</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { font-family: 'Inter', sans-serif; color: #2c3e50; background: #fff; line-height: 1.6; }

    /* NAV */
    nav { display: flex; justify-content: space-between; align-items: center; padding: 18px 48px; border-bottom: 1px solid #e8f4f8; background: #fff; position: sticky; top: 0; z-index: 100; }
    .nav-logo { font-size: 20px; font-weight: 800; color: #3a7ca5; text-decoration: none; }
    .nav-logo span { color: #4caf50; }
    .nav-links { display: flex; gap: 12px; align-items: center; }
    .btn-nav { padding: 9px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; }
    .btn-nav-ghost { background: transparent; color: #3a7ca5; border: 2px solid #3a7ca5; }
    .btn-nav-ghost:hover { background: #e8f4f8; }
    .btn-nav-solid { background: #4caf50; color: #fff; }
    .btn-nav-solid:hover { background: #388e3c; }

    /* HERO */
    .hero { background: linear-gradient(160deg, #e8f4f8 0%, #e8f5e9 100%); padding: 80px 48px 72px; text-align: center; }
    .hero-badge { display: inline-block; background: #e8f5e9; color: #2e7d32; font-size: 13px; font-weight: 600; padding: 5px 14px; border-radius: 20px; margin-bottom: 20px; }
    .hero h1 { font-size: clamp(32px, 5vw, 56px); font-weight: 800; color: #2c3e50; line-height: 1.15; margin-bottom: 20px; }
    .hero h1 em { color: #3a7ca5; font-style: normal; }
    .hero p { font-size: 18px; color: #5a6a7a; max-width: 520px; margin: 0 auto 36px; }
    .hero-ctas { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
    .btn-primary { background: #3a7ca5; color: #fff; padding: 15px 32px; border-radius: 10px; font-size: 16px; font-weight: 700; text-decoration: none; display: inline-block; transition: background 0.2s, transform 0.1s; border: none; cursor: pointer; }
    .btn-primary:hover { background: #2c6490; transform: translateY(-1px); }
    .btn-whatsapp { background: #25d366; color: #fff; padding: 15px 32px; border-radius: 10px; font-size: 16px; font-weight: 700; text-decoration: none; display: inline-block; transition: background 0.2s; }
    .btn-whatsapp:hover { background: #1da851; }
    .hero-note { font-size: 13px; color: #8a9aaa; margin-top: 16px; }

    /* PATHS */
    .paths { padding: 72px 48px; background: #fff; }
    .section-label { text-align: center; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #3a7ca5; margin-bottom: 12px; }
    .section-title { text-align: center; font-size: clamp(24px, 3vw, 36px); font-weight: 800; color: #2c3e50; margin-bottom: 48px; }
    .paths-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; max-width: 860px; margin: 0 auto; }
    .path-card { border-radius: 16px; padding: 36px 32px; border: 2px solid transparent; transition: border-color 0.2s, box-shadow 0.2s; }
    .path-card:hover { box-shadow: 0 8px 32px rgba(58,124,165,0.12); }
    .path-web { background: #e8f4f8; border-color: #3a7ca5; }
    .path-wa { background: #e8f5e9; border-color: #4caf50; }
    .path-icon { font-size: 40px; margin-bottom: 16px; }
    .path-card h3 { font-size: 20px; font-weight: 700; margin-bottom: 10px; color: #2c3e50; }
    .path-card p { font-size: 14px; color: #5a6a7a; margin-bottom: 20px; line-height: 1.6; }
    .path-card .btn-path { display: inline-block; padding: 11px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; }
    .path-web .btn-path { background: #3a7ca5; color: #fff; }
    .path-web .btn-path:hover { background: #2c6490; }
    .path-wa .btn-path { background: #25d366; color: #fff; }
    .path-wa .btn-path:hover { background: #1da851; }

    /* STEPS */
    .steps { background: linear-gradient(160deg, #e8f4f8 0%, #e8f5e9 100%); padding: 72px 48px; }
    .steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; max-width: 860px; margin: 0 auto; }
    .step { text-align: center; }
    .step-num { width: 48px; height: 48px; border-radius: 50%; background: #3a7ca5; color: #fff; font-size: 20px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
    .step h3 { font-size: 17px; font-weight: 700; margin-bottom: 8px; color: #2c3e50; }
    .step p { font-size: 14px; color: #5a6a7a; }

    /* PRICE */
    .price { padding: 72px 48px; background: #fff; text-align: center; }
    .price-card { display: inline-block; background: linear-gradient(135deg, #3a7ca5, #2c6490); color: #fff; border-radius: 20px; padding: 48px 56px; max-width: 440px; width: 100%; }
    .price-amount { font-size: 64px; font-weight: 800; line-height: 1; }
    .price-amount span { font-size: 28px; vertical-align: top; margin-top: 12px; display: inline-block; }
    .price-desc { font-size: 16px; opacity: 0.85; margin: 12px 0 28px; }
    .price-features { list-style: none; text-align: left; margin-bottom: 32px; display: inline-block; }
    .price-features li { font-size: 14px; padding: 4px 0; opacity: 0.9; }
    .price-features li::before { content: '✓  '; font-weight: 700; color: #a5d6a7; }

    /* CTA */
    .cta { background: #2c3e50; padding: 72px 48px; text-align: center; color: #fff; }
    .cta h2 { font-size: clamp(24px, 3vw, 36px); font-weight: 800; margin-bottom: 16px; }
    .cta p { font-size: 16px; opacity: 0.75; margin-bottom: 32px; }

    /* FOOTER */
    footer { background: #1a2530; color: #8a9aaa; text-align: center; padding: 24px; font-size: 13px; }

    /* RESPONSIVE */
    @media (max-width: 700px) {
      nav { padding: 16px 20px; }
      .hero, .paths, .steps, .price, .cta { padding: 48px 20px; }
      .paths-grid, .steps-grid { grid-template-columns: 1fr; }
      .price-card { padding: 36px 28px; }
    }
  </style>
</head>
<body>

<nav>
  <a class="nav-logo" href="/">Crea<span>CV</span></a>
  <div class="nav-links">
    ${user
      ? `<span style="font-size:14px;color:#5a6a7a;">Hola, ${escHtml(user.email)}</span>
         <a href="/cv/${user.id}" class="btn-nav btn-nav-ghost">Mi CV</a>
         <a href="/auth/logout" class="btn-nav btn-nav-ghost">Salir</a>`
      : `<a href="/auth/google" class="btn-nav btn-nav-solid">Entrar con Google</a>`
    }
  </div>
</nav>

<section class="hero">
  <div class="hero-badge">Gratis para crear, 2 EUR para descargar</div>
  <h1>Tu CV profesional<br><em>listo en minutos</em></h1>
  <p>Rellena un formulario sencillo, deja que la IA mejore tu experiencia, y descarga un PDF impecable.</p>
  <div class="hero-ctas">
    ${user
      ? `<a href="/crear" class="btn-primary">Crear CV ahora</a>`
      : `<a href="/auth/google" class="btn-primary">Empezar con Google — es gratis</a>`
    }
    <a href="https://wa.me/${waNumber}" class="btn-whatsapp">Crear por WhatsApp</a>
  </div>
  <p class="hero-note">Sin suscripciones. Pagas 2 EUR solo cuando descargues el PDF.</p>
</section>

<section class="paths">
  <p class="section-label">Dos formas de crear tu CV</p>
  <h2 class="section-title">Elige como prefieres</h2>
  <div class="paths-grid">
    <div class="path-card path-web">
      <div class="path-icon">🖥️</div>
      <h3>Formulario web</h3>
      <p>Rellena tu experiencia, educacion y habilidades paso a paso. Ve la vista previa en tiempo real antes de pagar.</p>
      ${user
        ? `<a href="/crear" class="btn-path">Crear mi CV</a>`
        : `<a href="/auth/google" class="btn-path">Entrar con Google</a>`
      }
    </div>
    <div class="path-card path-wa">
      <div class="path-icon">💬</div>
      <h3>Por WhatsApp</h3>
      <p>Habla con nuestro bot y el se encarga de todo. Ideal si prefieres hacerlo desde el movil sin formularios.</p>
      <a href="https://wa.me/${waNumber}" class="btn-path">Abrir WhatsApp</a>
    </div>
  </div>
</section>

<section class="steps">
  <p class="section-label">Como funciona</p>
  <h2 class="section-title">3 pasos simples</h2>
  <div class="steps-grid">
    <div class="step">
      <div class="step-num">1</div>
      <h3>Cuenta tu historia</h3>
      <p>Rellena tu experiencia laboral, educacion y habilidades en un formulario claro y sencillo.</p>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <h3>La IA te ayuda</h3>
      <p>Opcionalmente, la inteligencia artificial sugiere empleos adicionales para completar tu historial.</p>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <h3>Descarga tu PDF</h3>
      <p>Paga 2 EUR una sola vez y descarga un PDF profesional listo para enviar a cualquier empresa.</p>
    </div>
  </div>
</section>

<section class="price">
  <p class="section-label">Precio</p>
  <h2 class="section-title" style="margin-bottom:40px;">Simple y honesto</h2>
  <div class="price-card">
    <div class="price-amount"><span>€</span>2</div>
    <p class="price-desc">Pago unico por descarga. Sin suscripciones.</p>
    <ul class="price-features">
      <li>CV en PDF de alta calidad</li>
      <li>Diseno profesional imprimible</li>
      <li>Sugerencias de IA incluidas</li>
      <li>Edicion ilimitada (nueva descarga = 2 EUR)</li>
    </ul>
    ${loginOrDashboard}
  </div>
</section>

<section class="cta">
  <h2>Empieza ahora. Es gratis hasta que descargues.</h2>
  <p>Sin tarjeta de credito. Sin suscripcion. Solo tu CV.</p>
  ${user
    ? `<a href="/crear" class="btn-primary">Crear mi CV</a>`
    : `<a href="/auth/google" class="btn-primary">Entrar con Google</a>`
  }
</section>

<footer>
  <p>CreaCV &copy; ${new Date().getFullYear()} — Hecho para ayudarte a conseguir trabajo</p>
</footer>

</body>
</html>`;
}

function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { renderLanding };
