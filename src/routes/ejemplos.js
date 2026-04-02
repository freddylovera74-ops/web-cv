const router = require('express').Router();
const { renderCvHtml } = require('../views/cv.html.js');

const EJEMPLOS = {
  'camarero': {
    meta: {
      title: 'Ejemplo de CV para Camarero/a — Descargable gratis',
      description: 'Plantilla de curriculum vitae para camarero o camarera. Incluye experiencia en hostelería, habilidades y formación. Crea el tuyo gratis en 5 minutos.',
      keywords: 'cv camarero, curriculum camarera, plantilla cv hosteleria, cv sin experiencia hosteleria',
    },
    user: { id: 0, email: '' },
    cvData: {
      profile: { nombre: 'Laura', apellidos: 'Martínez Ruiz', city: 'Madrid', phone: '600 000 000', email: 'laura@ejemplo.com' },
      jobs: [
        { name: 'Restaurante Casa Paco', position: 'Camarera', duration: 'Ene 2022 — Actualidad', descripcion: 'Atención al cliente, toma de comandas, gestión de mesas, cobro en caja, mantenimiento del orden de la sala.', is_real: true },
        { name: 'Cafetería Central', position: 'Ayudante de sala', duration: 'Jun 2020 — Dic 2021', descripcion: 'Preparación de desayunos, atención en barra, limpieza y reposición de stock.', is_real: true },
      ],
      ai_suggested_jobs: [],
      education: [
        { titulo: 'Técnico en Servicios de Restauración', institucion: 'IES Hostelería Madrid', anio: '2020' },
        { titulo: 'Bachillerato', institucion: 'IES Cervantes', anio: '2018' },
      ],
      skills: { habilidades: ['Atención al cliente', 'Trabajo en equipo', 'Gestión de caja', 'TPV', 'Inglés básico'], idiomas: ['Español (nativo)', 'Inglés (básico)'] },
    },
  },
  'almacen': {
    meta: {
      title: 'Ejemplo de CV para Mozo/a de Almacén — Plantilla gratis',
      description: 'Modelo de curriculum vitae para operario o mozo de almacén y logística. Incluye experiencia en carga/descarga, carretilla elevadora y gestión de stock.',
      keywords: 'cv almacen, curriculum mozo almacen, cv logistica, cv operario almacen, plantilla cv almacen',
    },
    user: { id: 0, email: '' },
    cvData: {
      profile: { nombre: 'Carlos', apellidos: 'López Fernández', city: 'Barcelona', phone: '610 000 000', email: 'carlos@ejemplo.com' },
      jobs: [
        { name: 'Amazon Logistics', position: 'Operario de almacén', duration: 'Mar 2023 — Actualidad', descripcion: 'Picking y packing de pedidos, uso de PDA, gestión de stock, carga y descarga de camiones, control de inventario.', is_real: true },
        { name: 'Decathlon', position: 'Mozo de almacén', duration: 'Sep 2021 — Feb 2023', descripcion: 'Recepción de mercancía, reposición de estanterías, control de caducidades, manejo de carretilla retráctil.', is_real: true },
      ],
      ai_suggested_jobs: [],
      education: [
        { titulo: 'Certificado de Profesionalidad — Logística de Almacenamiento', institucion: 'SEPE', anio: '2021' },
        { titulo: 'ESO', institucion: 'IES Can Mas', anio: '2018' },
      ],
      skills: { habilidades: ['Carretilla elevadora (CAP)', 'PDA / RF', 'Gestión de stock', 'SAP', 'Trabajo bajo presión'], idiomas: ['Español (nativo)', 'Catalán (nativo)'] },
    },
  },
  'auxiliar-farmacia': {
    meta: {
      title: 'Ejemplo de CV para Auxiliar de Farmacia — Modelo gratis',
      description: 'Plantilla de curriculum vitae para auxiliar de farmacia. Con experiencia en dispensación, atención al paciente y gestión de stock. Crea el tuyo gratis.',
      keywords: 'cv auxiliar farmacia, curriculum farmacia, cv farmaceutico, plantilla cv farmacia',
    },
    user: { id: 0, email: '' },
    cvData: {
      profile: { nombre: 'Sara', apellidos: 'Gómez Herrera', city: 'Valencia', phone: '620 000 000', email: 'sara@ejemplo.com' },
      jobs: [
        { name: 'Farmacia Salud Plus', position: 'Auxiliar de farmacia', duration: 'Feb 2022 — Actualidad', descripcion: 'Dispensación de medicamentos, atención y consejo farmacéutico, control de stock, pedidos a distribuidoras, gestión de recetas.', is_real: true },
        { name: 'Parafarmacia Natura', position: 'Dependienta', duration: 'Ago 2020 — Ene 2022', descripcion: 'Venta de productos de parafarmacia, cosmética y dietética. Reposición y control de caducidades.', is_real: true },
      ],
      ai_suggested_jobs: [],
      education: [
        { titulo: 'CFGM Farmacia y Parafarmacia', institucion: 'IES La Patacona', anio: '2020' },
        { titulo: 'Bachillerato de Ciencias de la Salud', institucion: 'IES Benlliure', anio: '2018' },
      ],
      skills: { habilidades: ['Dispensación de medicamentos', 'Atención al paciente', 'BOT Plus', 'Control de stock', 'Trabajo en equipo'], idiomas: ['Español (nativo)', 'Valenciano (nativo)', 'Inglés (intermedio)'] },
    },
  },
  'conductor-reparto': {
    meta: {
      title: 'Ejemplo de CV para Conductor/a de Reparto — Plantilla gratis',
      description: 'Modelo de curriculum vitae para conductor de reparto y mensajería. Con experiencia en última milla, gestión de rutas y atención al cliente.',
      keywords: 'cv conductor reparto, curriculum repartidor, cv mensajeria, cv ultima milla, cv carnet b',
    },
    user: { id: 0, email: '' },
    cvData: {
      profile: { nombre: 'Miguel', apellidos: 'Torres Blanco', city: 'Sevilla', phone: '630 000 000', email: 'miguel@ejemplo.com' },
      jobs: [
        { name: 'Correos Express', position: 'Conductor de reparto', duration: 'May 2022 — Actualidad', descripcion: 'Reparto de paquetería en ruta fija, gestión de 80-120 entregas diarias, uso de PDA para registro de entregas, atención al cliente.', is_real: true },
        { name: 'GLS Spain', position: 'Repartidor', duration: 'Ene 2021 — Abr 2022', descripcion: 'Última milla en zona urbana, carga y descarga de furgoneta, resolución de incidencias de entrega.', is_real: true },
      ],
      ai_suggested_jobs: [],
      education: [
        { titulo: 'Permiso de conducción B (sin puntos negativos)', institucion: 'Autoescuela Central', anio: '2015' },
        { titulo: 'ESO', institucion: 'IES Al-Yussana', anio: '2013' },
      ],
      skills: { habilidades: ['Carnet B + 8 años experiencia', 'Gestión de rutas', 'PDA logística', 'Atención al cliente', 'Puntualidad'], idiomas: ['Español (nativo)'] },
    },
  },
  'recepcionista': {
    meta: {
      title: 'Ejemplo de CV para Recepcionista — Plantilla profesional gratis',
      description: 'Modelo de curriculum vitae para recepcionista de hotel, clínica u oficina. Incluye atención al público, gestión de agenda y manejo de centralita.',
      keywords: 'cv recepcionista, curriculum recepcionista hotel, cv atencion al cliente, plantilla cv recepcionista',
    },
    user: { id: 0, email: '' },
    cvData: {
      profile: { nombre: 'Elena', apellidos: 'Sánchez Mora', city: 'Málaga', phone: '640 000 000', email: 'elena@ejemplo.com' },
      jobs: [
        { name: 'Hotel Costa Sol', position: 'Recepcionista', duration: 'Jun 2021 — Actualidad', descripcion: 'Check-in y check-out, gestión de reservas en Booking y Opera, atención telefónica, resolución de incidencias, coordinación con housekeeping.', is_real: true },
        { name: 'Clínica Dental Sonrisa', position: 'Auxiliar administrativa', duration: 'Mar 2019 — May 2021', descripcion: 'Recepción de pacientes, gestión de agenda, cobros y facturación, tramitación de seguros dentales.', is_real: true },
      ],
      ai_suggested_jobs: [],
      education: [
        { titulo: 'CFGS Gestión de Alojamientos Turísticos', institucion: 'Escuela de Hostelería de Málaga', anio: '2019' },
      ],
      skills: { habilidades: ['Opera PMS', 'Booking.com', 'Gestión de agenda', 'Facturación', 'Atención multiidioma'], idiomas: ['Español (nativo)', 'Inglés (avanzado)', 'Francés (básico)'] },
    },
  },
  'limpieza': {
    meta: {
      title: 'Ejemplo de CV para Personal de Limpieza — Modelo gratis',
      description: 'Plantilla de curriculum vitae para personal de limpieza, limpiadoras de hotel u oficinas. Incluye experiencia, habilidades y referencias. Gratis.',
      keywords: 'cv limpieza, curriculum limpiadora, cv personal limpieza, cv gobernanta, plantilla limpieza',
    },
    user: { id: 0, email: '' },
    cvData: {
      profile: { nombre: 'Rosa', apellidos: 'Jiménez Campos', city: 'Bilbao', phone: '650 000 000', email: 'rosa@ejemplo.com' },
      jobs: [
        { name: 'Hotel Bilbao Gran Via', position: 'Camarera de pisos', duration: 'Ene 2020 — Actualidad', descripcion: 'Limpieza y preparación de habitaciones, reposición de lencería y amenities, control de material de limpieza, partes de incidencias.', is_real: true },
        { name: 'Empresa de Limpieza CleanPro', position: 'Operaria de limpieza', duration: 'Sep 2017 — Dic 2019', descripcion: 'Limpieza de oficinas y zonas comunes, uso de maquinaria industrial, desinfección de superficies.', is_real: true },
      ],
      ai_suggested_jobs: [],
      education: [
        { titulo: 'Certificado de Profesionalidad — Operaciones de limpieza', institucion: 'SEPE Bilbao', anio: '2017' },
      ],
      skills: { habilidades: ['Maquinaria de limpieza industrial', 'Gestión de ropa de cama', 'Rapidez y eficiencia', 'Discreción', 'Trabajo en equipo'], idiomas: ['Español (nativo)', 'Rumano (nativo)'] },
    },
  },
};

router.get('/:profesion', (req, res) => {
  const slug = req.params.profesion.toLowerCase();
  const ejemplo = EJEMPLOS[slug];
  if (!ejemplo) return res.status(404).send('Ejemplo no encontrado');

  const { meta, user, cvData } = ejemplo;
  const baseUrl = process.env.BASE_URL || '';

  // Render the CV HTML (no watermark, no pay button — it's a demo)
  const cvHtml = renderCvHtml(user, cvData, { showPayButton: false, watermark: false });
  const cvEncoded = Buffer.from(cvHtml).toString('base64');

  // List of all examples for the sidebar nav
  const otrosEjemplos = Object.entries(EJEMPLOS)
    .filter(([s]) => s !== slug)
    .map(([s, e]) => `<a href="/cv-ejemplo/${s}" class="ej-link">${e.meta.title.split('—')[0].replace('Ejemplo de CV para ', '').trim()}</a>`)
    .join('');

  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(meta.title)}</title>
  <meta name="description" content="${escHtml(meta.description)}">
  <meta name="keywords" content="${escHtml(meta.keywords)}">
  <link rel="canonical" href="${baseUrl}/cv-ejemplo/${slug}">
  <meta property="og:title" content="${escHtml(meta.title)}">
  <meta property="og:description" content="${escHtml(meta.description)}">
  <meta property="og:url" content="${baseUrl}/cv-ejemplo/${slug}">
  <meta property="og:type" content="website">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"HowTo","name":"${escHtml(meta.title)}",
   "description":"${escHtml(meta.description)}",
   "step":[{"@type":"HowToStep","text":"Introduce tus datos personales"},
           {"@type":"HowToStep","text":"Añade tu experiencia laboral"},
           {"@type":"HowToStep","text":"Descarga el PDF profesional"}]}
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f0f7fa; color: #1a2535; }
    nav { background: #fff; border-bottom: 1px solid #e0eaf4; padding: 14px 40px; display: flex; justify-content: space-between; align-items: center; }
    .nav-logo { font-size: 17px; font-weight: 800; color: #3a7ca5; text-decoration: none; }
    .nav-logo span { color: #4caf50; }
    .page { max-width: 1100px; margin: 36px auto; padding: 0 20px 80px; display: grid; grid-template-columns: 1fr 340px; gap: 32px; }
    @media(max-width:820px) { .page { grid-template-columns: 1fr; } .sidebar { order: -1; } }
    h1 { font-size: 24px; font-weight: 800; color: #1e2d4d; margin-bottom: 10px; line-height: 1.3; }
    .subtitle { font-size: 14px; color: #5a6a7a; margin-bottom: 24px; line-height: 1.6; }
    .cv-frame { border: 2px solid #dde6f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
    .cv-frame iframe { width: 100%; height: 620px; border: none; display: block; }
    .cta-box { background: #1e2d4d; color: #fff; border-radius: 12px; padding: 28px; text-align: center; }
    .cta-box h2 { font-size: 18px; margin-bottom: 8px; }
    .cta-box p { font-size: 13px; color: rgba(255,255,255,0.75); margin-bottom: 20px; }
    .btn-cta { display: block; background: #4caf50; color: #fff; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-size: 15px; font-weight: 700; margin-bottom: 10px; }
    .btn-cta:hover { background: #388e3c; }
    .btn-wa { display: block; background: #25d366; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; }
    .sidebar { }
    .sidebar-card { background: #fff; border-radius: 12px; border: 1px solid #dde6f0; padding: 22px; margin-bottom: 20px; }
    .sidebar-card h3 { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #3a7ca5; margin-bottom: 14px; }
    .ej-link { display: block; font-size: 14px; color: #1e2d4d; text-decoration: none; padding: 7px 0; border-bottom: 1px solid #f0f4f8; }
    .ej-link:hover { color: #3a7ca5; }
    .ej-link:last-child { border-bottom: none; }
    .tip-list { list-style: none; }
    .tip-list li { font-size: 13px; color: #3a5a7a; padding: 6px 0; border-bottom: 1px solid #f0f4f8; display: flex; gap: 8px; }
    .tip-list li::before { content: "✓"; color: #4caf50; font-weight: 700; flex-shrink: 0; }
    .badge { display: inline-block; background: #e8f5e9; color: #2e7d32; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-bottom: 12px; }
  </style>
</head>
<body>
<nav>
  <a class="nav-logo" href="/">Crea<span>CV</span></a>
  <a href="/crear" style="background:#3a7ca5;color:#fff;padding:8px 18px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;">Crear mi CV</a>
</nav>
<div class="page">
  <main>
    <span class="badge">Ejemplo gratuito</span>
    <h1>${escHtml(meta.title)}</h1>
    <p class="subtitle">${escHtml(meta.description)}</p>
    <div class="cv-frame">
      <iframe id="cv-iframe" title="Ejemplo de CV" srcdoc=""></iframe>
    </div>
    <div class="cta-box">
      <h2>Crea tu propio CV ahora</h2>
      <p>Rellena el formulario en 5 minutos y descarga tu PDF profesional por 5€.</p>
      <a href="/crear" class="btn-cta">Crear mi CV gratis →</a>
      <a href="https://wa.me/${escHtml(process.env.WHATSAPP_NUMBER || '')}" class="btn-wa">📱 Crear por WhatsApp</a>
    </div>
  </main>
  <aside class="sidebar">
    <div class="sidebar-card">
      <h3>Otros ejemplos de CV</h3>
      ${otrosEjemplos}
    </div>
    <div class="sidebar-card">
      <h3>Consejos para este CV</h3>
      <ul class="tip-list">
        <li>Incluye tus datos de contacto actualizados</li>
        <li>Ordena la experiencia del más reciente al más antiguo</li>
        <li>Usa verbos de acción: gestioné, atendí, coordiné</li>
        <li>Adapta las habilidades a cada oferta de trabajo</li>
        <li>Máximo 1 página si tienes menos de 5 años de experiencia</li>
      </ul>
    </div>
  </aside>
</div>
<script>
  const encoded = '${cvEncoded}';
  const html = decodeURIComponent(escape(atob(encoded)));
  document.getElementById('cv-iframe').srcdoc = html;
</script>
</body>
</html>`);
});

function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = router;
